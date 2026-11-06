import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { InlineNotice } from '../../components/InlineNotice';
import { Screen } from '../../components/Screen';
import { LoadingView, ErrorView } from '../../components/StatusView';
import { tripsApi } from '../../api/endpoints/trips';
import { getErrorMessage } from '../../api/errors';
import { useAppResume } from '../../hooks/useAppResume';
import type { AppStackParamList } from '../../navigation/types';
import { useAppSelector } from '../../store/hooks';
import { selectAuth } from '../../store/authSlice';
import { colors, radius, spacing } from '../../theme/colors';
import type { RouteStop, SeatMap, TripDetail } from '../../types/trip';
import { formatCurrency, formatDate, formatDurationBetween, formatTime } from '../../utils/format';

type Props = NativeStackScreenProps<AppStackParamList, 'TripDetail'>;

const stopLabels: Record<RouteStop['loai_diem'], string> = {
  DON: 'Điểm đón',
  TRA: 'Điểm trả',
  TRUNG_CHUYEN: 'Trung chuyển',
};

function DetailMetric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={18} color={colors.brand} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export function TripDetailScreen({ route, navigation }: Props) {
  const { tripId } = route.params;
  const auth = useAppSelector(selectAuth);
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [detail, seats] = await Promise.all([
          tripsApi.getDetail(tripId),
          tripsApi.getSeatMap(tripId),
        ]);

        if (active) {
          setTrip(detail);
          setSeatMap(seats);
        }
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
  }, [reloadKey, tripId]);

  useAppResume(() => {
    setReloadKey((value) => value + 1);
  });

  if (loading) {
    return <LoadingView message="Đang tải thông tin chuyến..." />;
  }

  if (error || !trip || !seatMap) {
    return (
      <ErrorView
        message={error ?? 'Không tìm thấy chuyến xe.'}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  const isPassenger = auth.status === 'authenticated' && auth.user?.ten_vai_tro === 'KHACH_HANG';
  const remainingSeats = seatMap.so_ghe_trong;

  const handleBook = () => {
    if (!isPassenger) {
      navigation.navigate('Login');
      return;
    }

    navigation.navigate('SeatSelection', { tripId });
  };

  return (
    <Screen scroll edges={['left', 'right']} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <Text style={styles.routeName}>{trip.ten_tuyen}</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>
              {trip.trang_thai === 'SAP_CHAY' ? 'Sắp khởi hành' : trip.trang_thai}
            </Text>
          </View>
        </View>

        <View style={styles.timeRow}>
          <View style={styles.timeBlock}>
            <Text style={styles.time}>{formatTime(trip.thoi_gian_xuat_ben)}</Text>
            <Text style={styles.location}>{trip.tinh_di}</Text>
          </View>
          <View style={styles.journey}>
            <View style={styles.journeyLine}>
              <View style={styles.journeyDot} />
              <View style={styles.journeyDash} />
              <Ionicons name="bus" size={18} color={colors.brand} />
              <View style={styles.journeyDash} />
              <View style={styles.journeyDot} />
            </View>
            <Text style={styles.duration}>
              {formatDurationBetween(trip.thoi_gian_xuat_ben, trip.thoi_gian_den_du_kien)}
            </Text>
          </View>
          <View style={[styles.timeBlock, styles.timeBlockRight]}>
            <Text style={styles.time}>{formatTime(trip.thoi_gian_den_du_kien)}</Text>
            <Text style={[styles.location, styles.locationRight]}>{trip.tinh_den}</Text>
          </View>
        </View>

        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={17} color={colors.muted} />
          <Text style={styles.dateText}>{formatDate(trip.thoi_gian_xuat_ben)}</Text>
        </View>

        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceLabel}>Giá vé từ</Text>
            <Text style={styles.price}>{formatCurrency(trip.gia_ve_co_ban)}</Text>
          </View>
          <Text style={styles.seatAvailable}>{remainingSeats} ghế còn trống</Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <DetailMetric icon="bus-outline" label="Loại xe" value={trip.ten_loai_xe} />
        <DetailMetric icon="car-outline" label="Biển số" value={trip.bien_so_xe} />
        <DetailMetric icon="people-outline" label="Số ghế" value={`${trip.tong_so_ghe} chỗ`} />
        <DetailMetric icon="person-outline" label="Tài xế" value={trip.ten_tai_xe} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lộ trình dự kiến</Text>

        <View style={styles.timeline}>
          {trip.diem_dung.map((stop, index) => {
            const isLast = index === trip.diem_dung.length - 1;
            return (
              <View key={`${stop.ma_diem_dung}-${stop.thu_tu_dung}`} style={styles.stopRow}>
                <View style={styles.stopMarkerColumn}>
                  <View style={[styles.stopDot, isLast ? styles.stopDotLast : null]} />
                  {!isLast ? <View style={styles.stopLine} /> : null}
                </View>
                <View style={styles.stopContent}>
                  <View style={styles.stopHeading}>
                    <Text style={styles.stopName}>{stop.ten_diem_dung}</Text>
                    <View style={styles.stopTypePill}>
                      <Text style={styles.stopTypeText}>{stopLabels[stop.loai_diem]}</Text>
                    </View>
                  </View>
                  {stop.dia_chi ? <Text style={styles.stopAddress}>{stop.dia_chi}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {trip.so_dien_thoai_tai_xe ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Liên hệ tài xế</Text>
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar}>
              <Ionicons name="person" size={20} color={colors.brand} />
            </View>
            <View style={styles.driverText}>
              <Text style={styles.driverName}>{trip.ten_tai_xe}</Text>
              <Text style={styles.driverPhone}>{trip.so_dien_thoai_tai_xe}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <InlineNotice
        tone={remainingSeats > 0 ? 'info' : 'warning'}
        message={
          remainingSeats > 0
            ? 'Ghế được giữ tạm thời trong 10 phút sau khi chọn. Vui lòng hoàn tất đặt vé trong thời gian này.'
            : 'Chuyến xe hiện đã hết ghế trống.'
        }
      />

      <Button
        title={isPassenger ? 'Chọn ghế' : 'Đăng nhập để đặt vé'}
        onPress={handleBook}
        disabled={remainingSeats <= 0}
        left={<Ionicons name="ticket-outline" size={19} color={colors.white} />}
        testID="trip-book"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  routeName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  statusPill: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeBlock: {
    width: 84,
    gap: 3,
  },
  timeBlockRight: {
    alignItems: 'flex-end',
  },
  time: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  location: {
    fontSize: 12,
    color: colors.muted,
  },
  locationRight: {
    textAlign: 'right',
  },
  journey: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  journeyLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  journeyDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  journeyDash: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  duration: {
    fontSize: 11,
    color: colors.muted,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateText: {
    fontSize: 13,
    color: colors.muted,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  priceLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  price: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.brand,
  },
  seatAvailable: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.success,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metric: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 3,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
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
  timeline: {
    gap: 0,
  },
  stopRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stopMarkerColumn: {
    width: 14,
    alignItems: 'center',
  },
  stopDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    borderWidth: 2,
    borderColor: colors.brand,
    marginTop: 4,
  },
  stopDotLast: {
    backgroundColor: colors.brand,
  },
  stopLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  stopContent: {
    flex: 1,
    paddingBottom: spacing.lg,
    gap: 2,
  },
  stopHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  stopName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  stopTypePill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  stopTypeText: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: '600',
  },
  stopAddress: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  driverAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverText: {
    gap: 1,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  driverPhone: {
    fontSize: 13,
    color: colors.muted,
  },
});
