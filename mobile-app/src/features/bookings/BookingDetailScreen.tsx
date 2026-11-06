import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { colors, radius, spacing } from '../../theme/colors';
import type { BookingOrder } from '../../types/booking';
import type { TripDetail } from '../../types/trip';
import { formatCurrency, formatDateTime, formatTime } from '../../utils/format';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../../utils/status';

type Props = NativeStackScreenProps<AppStackParamList, 'BookingDetail'>;

const statusTone = {
  CHO_THANH_TOAN: { background: colors.warningSoft, foreground: colors.warning },
  DA_THANH_TOAN: { background: colors.successSoft, foreground: colors.success },
  DA_HUY: { background: colors.dangerSoft, foreground: colors.danger },
} as const;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function BookingDetailScreen({ route, navigation }: Props) {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<BookingOrder | null>(null);
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const order = await bookingsApi.getById(bookingId);
      setBooking(order);

      if (order.ma_chuyen !== null) {
        try {
          setTrip(await tripsApi.getDetail(order.ma_chuyen));
        } catch {
          setTrip(null);
        }
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useAppResume(() => {
    void load();
  });

  const handlePay = async () => {
    if (!booking || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const payment = await paymentsApi.createVnpayUrl(booking.ma_don_ve);
      navigation.navigate('PaymentWebView', {
        bookingId: booking.ma_don_ve,
        paymentUrl: payment.payment_url,
      });
    } catch (paymentError) {
      setError(getErrorMessage(paymentError));
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = () => {
    Alert.alert('Hủy đơn vé', 'Bạn có chắc muốn hủy đơn đang chờ thanh toán?', [
      { text: 'Giữ đơn', style: 'cancel' },
      {
        text: 'Hủy đơn',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            setError(null);
            try {
              const cancelled = await bookingsApi.cancel(bookingId);
              setBooking(cancelled);
            } catch (cancelError) {
              setError(getErrorMessage(cancelError));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  if (loading && !booking) {
    return <LoadingView message="Đang tải đơn vé..." />;
  }

  if (error && !booking) {
    return <ErrorView message={error} onRetry={() => void load()} />;
  }

  if (!booking) {
    return <ErrorView message="Không tìm thấy đơn vé." />;
  }

  const tone = statusTone[booking.trang_thai_don];
  const payment = booking.thanh_toan[0];
  const seats = booking.chi_tiet_ve.map((ticket) => ticket.ky_hieu_ghe);

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={[styles.statusPill, { backgroundColor: tone.background }]}>
          <Text style={[styles.statusText, { color: tone.foreground }]}>
            {ORDER_STATUS_LABELS[booking.trang_thai_don]}
          </Text>
        </View>
        <Text style={styles.orderCode}>{booking.ma_dinh_danh_don}</Text>
        <Text style={styles.createdAt}>Tạo lúc {formatDateTime(booking.thoi_gian_tao)}</Text>
        {trip ? (
          <View style={styles.tripRow}>
            <Ionicons name="bus-outline" size={18} color={colors.white} />
            <Text style={styles.tripName}>{trip.ten_tuyen}</Text>
            <Text style={styles.tripTime}>{formatTime(trip.thoi_gian_xuat_ben)}</Text>
          </View>
        ) : null}
      </View>

      {booking.trang_thai_don === 'CHO_THANH_TOAN' ? (
        <InlineNotice
          tone="warning"
          message={`Đơn sẽ hết hạn${
            booking.thoi_gian_het_han
              ? ` lúc ${formatDateTime(booking.thoi_gian_het_han)}`
              : ' sau ít phút'
          }. Vui lòng hoàn tất thanh toán để giữ ghế.`}
        />
      ) : null}

      {booking.trang_thai_don === 'DA_THANH_TOAN' ? (
        <InlineNotice
          tone="success"
          message="Thanh toán thành công. Vé điện tử đã sẵn sàng trong mục Vé của tôi."
        />
      ) : null}

      {error ? <InlineNotice tone="error" message={error} /> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Thông tin chuyến</Text>
        <Row label="Ghế" value={seats.join(', ') || '--'} />
        <Row label="Điểm đón" value={`Mã #${booking.ma_diem_don}`} />
        <Row label="Điểm trả" value={`Mã #${booking.ma_diem_tra}`} />
        <Row label="Hành khách" value={booking.ho_ten_khach} />
        <Row label="Số điện thoại" value={booking.so_dien_thoai_khach} />
        {booking.email_khach ? <Row label="Email" value={booking.email_khach} /> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Thanh toán</Text>
        <Row
          label="Phương thức"
          value={payment ? PAYMENT_METHOD_LABELS[payment.phuong_thuc] : 'VNPAY'}
        />
        <Row
          label="Trạng thái"
          value={payment ? PAYMENT_STATUS_LABELS[payment.trang_thai] : '--'}
        />
        <Row label="Tổng tiền" value={formatCurrency(booking.tong_tien)} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Cần thanh toán</Text>
          <Text style={styles.totalValue}>{formatCurrency(booking.tong_tien)}</Text>
        </View>
      </View>

      {booking.trang_thai_don === 'CHO_THANH_TOAN' ? (
        <>
          <Button
            title="Thanh toán VNPAY"
            loading={busy}
            onPress={() => {
              void handlePay();
            }}
            left={<Ionicons name="card-outline" size={19} color={colors.white} />}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={confirmCancel}
            style={({ pressed }) => [styles.cancelButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.cancelText}>Hủy đơn vé</Text>
          </Pressable>
        </>
      ) : null}

      {booking.trang_thai_don === 'DA_THANH_TOAN' ? (
        <Button
          title="Xem vé của tôi"
          onPress={() => navigation.navigate('PassengerTabs', { screen: 'MyTickets' })}
          left={<Ionicons name="qr-code-outline" size={19} color={colors.white} />}
        />
      ) : null}

      <Button title="Về trang chủ" variant="secondary" onPress={() => navigation.popToTop()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
  },
  hero: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  orderCode: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  createdAt: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  tripName: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  tripTime: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowLabel: {
    fontSize: 14,
    color: colors.muted,
  },
  rowValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.brand,
  },
  cancelButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.surface,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.danger,
  },
  pressed: {
    opacity: 0.75,
  },
});
