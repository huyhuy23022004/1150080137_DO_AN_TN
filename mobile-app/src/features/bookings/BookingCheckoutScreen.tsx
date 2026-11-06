import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { bookingsApi } from '../../api/endpoints/bookings';
import { paymentsApi } from '../../api/endpoints/payments';
import { tripsApi } from '../../api/endpoints/trips';
import { getErrorMessage } from '../../api/errors';
import { Button } from '../../components/Button';
import { InlineNotice } from '../../components/InlineNotice';
import { Screen } from '../../components/Screen';
import { ErrorView, LoadingView } from '../../components/StatusView';
import { useAppResume } from '../../hooks/useAppResume';
import type { AppStackParamList } from '../../navigation/types';
import { useAppSelector } from '../../store/hooks';
import { selectCurrentUser } from '../../store/authSlice';
import { colors, radius, spacing } from '../../theme/colors';
import type { BookingQuote } from '../../types/booking';
import type { RouteStop, TripDetail } from '../../types/trip';
import { formatCurrency, formatDate, formatTime } from '../../utils/format';

type Props = NativeStackScreenProps<AppStackParamList, 'BookingCheckout'>;

function StopOption({
  stop,
  selected,
  onPress,
}: {
  stop: RouteStop;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.stopOption, selected ? styles.stopOptionSelected : null]}
    >
      <View style={[styles.radio, selected ? styles.radioSelected : null]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.stopText}>
        <Text style={styles.stopName}>{stop.ten_diem_dung}</Text>
        {stop.dia_chi ? (
          <Text style={styles.stopAddress} numberOfLines={2}>
            {stop.dia_chi}
          </Text>
        ) : null}
      </View>
      <Text style={styles.stopOrder}>{stop.thu_tu_dung}</Text>
    </Pressable>
  );
}

export function BookingCheckoutScreen({ route, navigation }: Props) {
  const { tripId, seatCodes, ownerRef } = route.params;
  const user = useAppSelector(selectCurrentUser);
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [pickupId, setPickupId] = useState<number | null>(null);
  const [dropoffId, setDropoffId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const idempotencyKey = useRef(`book_${ownerRef}`.slice(0, 100));

  const pickupStops = useMemo(
    () => (trip?.diem_dung ?? []).filter((stop) => stop.loai_diem === 'DON'),
    [trip],
  );
  const dropoffStops = useMemo(() => {
    const pickup = pickupStops.find((stop) => stop.ma_diem_dung === pickupId);
    return (trip?.diem_dung ?? []).filter(
      (stop) =>
        stop.loai_diem === 'TRA' && (pickup === undefined || stop.thu_tu_dung > pickup.thu_tu_dung),
    );
  }, [pickupId, pickupStops, trip]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [detail, quotation] = await Promise.all([
          tripsApi.getDetail(tripId),
          bookingsApi.quote(tripId, seatCodes),
        ]);

        if (!active) {
          return;
        }

        setTrip(detail);
        setQuote(quotation);

        const firstPickup = detail.diem_dung.find((stop) => stop.loai_diem === 'DON');
        const lastDropoff = [...detail.diem_dung]
          .reverse()
          .find(
            (stop) =>
              stop.loai_diem === 'TRA' &&
              (firstPickup === undefined || stop.thu_tu_dung > firstPickup.thu_tu_dung),
          );

        setPickupId((current) => current ?? firstPickup?.ma_diem_dung ?? null);
        setDropoffId((current) => current ?? lastDropoff?.ma_diem_dung ?? null);
      } catch (loadError) {
        if (active) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [reloadKey, seatCodes, tripId]);

  useAppResume(() => {
    setReloadKey((value) => value + 1);
  });

  const selectPickup = (stop: RouteStop) => {
    setPickupId(stop.ma_diem_dung);
    const currentDropoff = dropoffStops.find((item) => item.ma_diem_dung === dropoffId);
    if (!currentDropoff) {
      const nextDropoff = (trip?.diem_dung ?? []).find(
        (item) => item.loai_diem === 'TRA' && item.thu_tu_dung > stop.thu_tu_dung,
      );
      setDropoffId(nextDropoff?.ma_diem_dung ?? null);
    }
  };

  const handleSubmit = async () => {
    if (!user || pickupId === null || dropoffId === null || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await bookingsApi.create(
        {
          ma_chuyen: tripId,
          danh_sach_ghe: seatCodes,
          owner_ref: ownerRef,
          ma_diem_don: pickupId,
          ma_diem_tra: dropoffId,
          phuong_thuc_thanh_toan: 'VNPAY',
        },
        idempotencyKey.current,
      );

      const booking = result.don_dat_ve;
      if (booking.trang_thai_don === 'DA_THANH_TOAN') {
        navigation.reset({
          index: 1,
          routes: [
            { name: 'PassengerTabs', params: { screen: 'MyTickets' } },
            { name: 'BookingDetail', params: { bookingId: booking.ma_don_ve } },
          ],
        });
        return;
      }

      const paymentUrl =
        result.payment_url ?? (await paymentsApi.createVnpayUrl(booking.ma_don_ve)).payment_url;

      navigation.replace('PaymentWebView', {
        bookingId: booking.ma_don_ve,
        paymentUrl,
      });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingView message="Đang chuẩn bị thông tin đặt vé..." />;
  }

  if (error && (!trip || !quote)) {
    return <ErrorView message={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  if (!trip || !quote) {
    return <ErrorView message="Không thể tải thông tin đặt vé." />;
  }

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <View style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <View style={styles.tripIcon}>
            <Ionicons name="bus" size={22} color={colors.brand} />
          </View>
          <View style={styles.tripText}>
            <Text style={styles.routeName}>{trip.ten_tuyen}</Text>
            <Text style={styles.tripMeta}>
              {formatTime(trip.thoi_gian_xuat_ben)} · {formatDate(trip.thoi_gian_xuat_ben)}
            </Text>
          </View>
        </View>

        <View style={styles.seatRow}>
          <View>
            <Text style={styles.label}>Ghế đã chọn</Text>
            <Text style={styles.seatCodes}>{seatCodes.join(', ')}</Text>
          </View>
          <Text style={styles.total}>{formatCurrency(quote.tong_tien)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Điểm đón</Text>
        {pickupStops.map((stop) => (
          <StopOption
            key={stop.ma_diem_dung}
            stop={stop}
            selected={pickupId === stop.ma_diem_dung}
            onPress={() => selectPickup(stop)}
          />
        ))}
        {pickupStops.length === 0 ? (
          <Text style={styles.emptyText}>Tuyến chưa cấu hình điểm đón.</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Điểm trả</Text>
        {dropoffStops.map((stop) => (
          <StopOption
            key={stop.ma_diem_dung}
            stop={stop}
            selected={dropoffId === stop.ma_diem_dung}
            onPress={() => setDropoffId(stop.ma_diem_dung)}
          />
        ))}
        {dropoffStops.length === 0 ? (
          <Text style={styles.emptyText}>Không có điểm trả phù hợp sau điểm đón.</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Thông tin hành khách</Text>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={18} color={colors.muted} />
          <Text style={styles.infoText}>{user?.ho_va_ten}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={18} color={colors.muted} />
          <Text style={styles.infoText}>{user?.so_dien_thoai}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={18} color={colors.muted} />
          <Text style={styles.infoText}>{user?.email ?? 'Chưa cập nhật email'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Thanh toán</Text>
        <View style={styles.paymentMethod}>
          <View style={styles.vnpayBadge}>
            <Text style={styles.vnpayText}>VNPAY</Text>
          </View>
          <View style={styles.paymentText}>
            <Text style={styles.paymentName}>Cổng thanh toán VNPAY</Text>
            <Text style={styles.paymentHint}>Sandbox · Thẻ ATM, QR, ví điện tử</Text>
          </View>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
        </View>
      </View>

      {error ? <InlineNotice tone="error" message={error} /> : null}

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tạm tính</Text>
          <Text style={styles.summaryValue}>{formatCurrency(quote.tong_tien)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Phí thanh toán</Text>
          <Text style={styles.summaryValue}>0 đ</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryTotalRow]}>
          <Text style={styles.summaryTotalLabel}>Tổng cộng</Text>
          <Text style={styles.summaryTotal}>{formatCurrency(quote.tong_tien)}</Text>
        </View>
      </View>

      <Button
        title="Thanh toán với VNPAY"
        loading={submitting}
        disabled={pickupId === null || dropoffId === null}
        onPress={() => {
          void handleSubmit();
        }}
        left={<Ionicons name="card-outline" size={19} color={colors.white} />}
      />

      <Text style={styles.terms}>
        Ghế đang được giữ tạm. Đơn sẽ tự hủy nếu không thanh toán trong thời gian quy định.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
  },
  tripCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  tripHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  tripIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripText: {
    flex: 1,
    gap: 3,
  },
  routeName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  tripMeta: {
    fontSize: 13,
    color: colors.muted,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  label: {
    fontSize: 12,
    color: colors.muted,
  },
  seatCodes: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  total: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.brand,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  stopOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  stopOptionSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.brand,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  stopText: {
    flex: 1,
    gap: 2,
  },
  stopName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  stopAddress: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
  },
  stopOrder: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  vnpayBadge: {
    backgroundColor: '#0A4A9E',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  vnpayText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  paymentText: {
    flex: 1,
    gap: 2,
  },
  paymentName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  paymentHint: {
    fontSize: 12,
    color: colors.muted,
  },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.muted,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  summaryTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  summaryTotal: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.brand,
  },
  terms: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    textAlign: 'center',
  },
});
