import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ticketsApi } from '../../api/endpoints/tickets';
import { tripsApi } from '../../api/endpoints/trips';
import { getErrorMessage } from '../../api/errors';
import { Button } from '../../components/Button';
import { InlineNotice } from '../../components/InlineNotice';
import { Screen } from '../../components/Screen';
import { ErrorView, LoadingView } from '../../components/StatusView';
import { useAppResume } from '../../hooks/useAppResume';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme/colors';
import type { Passenger, TripPassengers } from '../../types/ticket';
import type { TripDetail } from '../../types/trip';
import { formatDateTime, formatTime } from '../../utils/format';
import { TRIP_STATUS_LABELS } from '../../utils/status';

type Props = NativeStackScreenProps<AppStackParamList, 'DriverTripDetail'>;

const statusTone = {
  SAP_CHAY: { background: colors.warningSoft, foreground: colors.warning },
  DANG_CHAY: { background: colors.successSoft, foreground: colors.success },
  HOAN_THANH: { background: colors.surfaceMuted, foreground: colors.muted },
  HUY: { background: colors.dangerSoft, foreground: colors.danger },
} as const;

function PassengerRow({ passenger }: { passenger: Passenger }) {
  const checkedIn = passenger.trang_thai_soat_ve === 'DA_LEN_XE';

  return (
    <View style={styles.passengerRow}>
      <View style={[styles.passengerIcon, checkedIn ? styles.passengerIconChecked : null]}>
        <Ionicons
          name={checkedIn ? 'checkmark' : 'person-outline'}
          size={18}
          color={checkedIn ? colors.success : colors.muted}
        />
      </View>
      <View style={styles.passengerInfo}>
        <Text style={styles.passengerName}>{passenger.ho_ten_khach}</Text>
        <Text style={styles.passengerMeta}>
          {passenger.so_dien_thoai_khach} · {passenger.ma_dinh_danh_don}
        </Text>
        {checkedIn && passenger.thoi_gian_soat_ve ? (
          <Text style={styles.checkedTime}>
            Đã lên xe lúc {formatDateTime(passenger.thoi_gian_soat_ve)}
          </Text>
        ) : null}
      </View>
      <View style={styles.seatBadge}>
        <Text style={styles.seatText}>{passenger.ky_hieu_ghe}</Text>
      </View>
    </View>
  );
}

export function DriverTripDetailScreen({ route, navigation }: Props) {
  const { tripId } = route.params;
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [passengers, setPassengers] = useState<TripPassengers | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const [detail, passengerList] = await Promise.all([
          tripsApi.getDetail(tripId),
          ticketsApi.listPassengers(tripId),
        ]);
        setTrip(detail);
        setPassengers(passengerList);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tripId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useAppResume(() => {
    void load(true);
  });

  if (loading && !trip) {
    return <LoadingView message="Đang tải chi tiết chuyến..." />;
  }

  if (error && !trip) {
    return <ErrorView message={error} onRetry={() => void load()} />;
  }

  if (!trip) {
    return <ErrorView message="Không tìm thấy chuyến xe." />;
  }

  const tone = statusTone[trip.trang_thai];
  const list = passengers?.danh_sach ?? [];

  return (
    <Screen
      scroll
      contentContainerStyle={styles.content}
      refreshing={refreshing}
      onRefresh={() => void load(true)}
    >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={[styles.statusPill, { backgroundColor: tone.background }]}>
            <Text style={[styles.statusText, { color: tone.foreground }]}>
              {TRIP_STATUS_LABELS[trip.trang_thai]}
            </Text>
          </View>
          <Text style={styles.plate}>{trip.bien_so_xe}</Text>
        </View>

        <Text style={styles.route}>{trip.ten_tuyen}</Text>
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={17} color={colors.white} />
          <Text style={styles.timeText}>
            {formatTime(trip.thoi_gian_xuat_ben)} · {formatDateTime(trip.thoi_gian_xuat_ben)}
          </Text>
        </View>
        <Text style={styles.driver}>
          {trip.ten_tai_xe} · {trip.ten_loai_xe}
        </Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{passengers?.tong_so_hanh_khach ?? 0}</Text>
            <Text style={styles.statLabel}>Tổng khách</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{passengers?.da_len_xe ?? 0}</Text>
            <Text style={styles.statLabel}>Đã lên</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{passengers?.chua_len_xe ?? 0}</Text>
            <Text style={styles.statLabel}>Chưa lên</Text>
          </View>
        </View>
      </View>

      {error ? <InlineNotice tone="error" message={error} /> : null}

      <Button
        title="Quét mã vé"
        onPress={() => navigation.navigate('DriverScan', { tripId })}
        left={<Ionicons name="qr-code-outline" size={20} color={colors.white} />}
      />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Danh sách hành khách</Text>
          <Text style={styles.sectionCount}>{list.length}</Text>
        </View>

        {list.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={34} color={colors.muted} />
            <Text style={styles.emptyTitle}>Chưa có hành khách</Text>
            <Text style={styles.emptyText}>
              Danh sách sẽ cập nhật khi khách thanh toán vé thành công.
            </Text>
          </View>
        ) : (
          <View style={styles.passengerList}>
            {list.map((passenger) => (
              <PassengerRow key={passenger.ma_ve} passenger={passenger} />
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lịch trình</Text>
        {trip.diem_dung.map((stop) => (
          <View key={stop.ma_diem_dung} style={styles.stopRow}>
            <View style={styles.stopTimeline}>
              <View style={styles.stopDot} />
              <View style={styles.stopLine} />
            </View>
            <View style={styles.stopInfo}>
              <Text style={styles.stopName}>{stop.ten_diem_dung}</Text>
              {stop.dia_chi ? <Text style={styles.stopAddress}>{stop.dia_chi}</Text> : null}
            </View>
            <Text style={styles.stopType}>{stop.loai_diem}</Text>
          </View>
        ))}
      </View>
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
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  plate: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '700',
  },
  route: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timeText: {
    color: colors.white,
    fontSize: 13,
  },
  driver: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    color: colors.white,
    fontSize: 19,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 10,
  },
  statDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.brand,
    backgroundColor: colors.brandSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  passengerList: {
    gap: spacing.sm,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  passengerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerIconChecked: {
    backgroundColor: colors.successSoft,
  },
  passengerInfo: {
    flex: 1,
    gap: 1,
  },
  passengerName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  passengerMeta: {
    fontSize: 11,
    color: colors.muted,
  },
  checkedTime: {
    fontSize: 10,
    color: colors.success,
    fontWeight: '600',
  },
  seatBadge: {
    minWidth: 44,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  seatText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    textAlign: 'center',
  },
  stopRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stopTimeline: {
    width: 14,
    alignItems: 'center',
  },
  stopDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    marginTop: 4,
  },
  stopLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginTop: 2,
  },
  stopInfo: {
    flex: 1,
    paddingBottom: spacing.md,
    gap: 1,
  },
  stopName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  stopAddress: {
    fontSize: 11,
    color: colors.muted,
  },
  stopType: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
  },
});
