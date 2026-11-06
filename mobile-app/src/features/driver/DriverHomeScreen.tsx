import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { driverApi } from '../../api/endpoints/driver';
import { getErrorMessage } from '../../api/errors';
import { BrandMark } from '../../components/BrandMark';
import { InlineNotice } from '../../components/InlineNotice';
import { Screen } from '../../components/Screen';
import { EmptyView, LoadingView } from '../../components/StatusView';
import { useAppResume } from '../../hooks/useAppResume';
import type { AppStackParamList } from '../../navigation/types';
import { useAppSelector } from '../../store/hooks';
import { selectCurrentUser } from '../../store/authSlice';
import { colors, radius, spacing } from '../../theme/colors';
import type { Trip, TripStatus } from '../../types/trip';
import { formatDateChip, formatTime } from '../../utils/format';
import { TRIP_STATUS_LABELS } from '../../utils/status';

type Filter = 'ALL' | TripStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'DANG_CHAY', label: 'Đang chạy' },
  { key: 'SAP_CHAY', label: 'Sắp chạy' },
  { key: 'HOAN_THANH', label: 'Hoàn thành' },
];

const statusTone: Record<TripStatus, { background: string; foreground: string }> = {
  SAP_CHAY: { background: colors.warningSoft, foreground: colors.warning },
  DANG_CHAY: { background: colors.successSoft, foreground: colors.success },
  HOAN_THANH: { background: colors.surfaceMuted, foreground: colors.muted },
  HUY: { background: colors.dangerSoft, foreground: colors.danger },
};

export function DriverHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const user = useAppSelector(selectCurrentUser);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const result = await driverApi.listTrips({ limit: 100 });
      setTrips(result.items);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useAppResume(() => {
    void load(true);
  });

  const counts = useMemo(
    () => ({
      total: trips.length,
      running: trips.filter((trip) => trip.trang_thai === 'DANG_CHAY').length,
      upcoming: trips.filter((trip) => trip.trang_thai === 'SAP_CHAY').length,
    }),
    [trips],
  );

  const filtered = useMemo(
    () => (filter === 'ALL' ? trips : trips.filter((trip) => trip.trang_thai === filter)),
    [filter, trips],
  );

  if (loading) {
    return <LoadingView message="Đang tải chuyến được phân công..." />;
  }

  return (
    <Screen
      scroll
      contentContainerStyle={styles.content}
      refreshing={refreshing}
      onRefresh={() => void load(true)}
    >
      <BrandMark compact subtitle="Không gian tài xế" />

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroText}>
            <Text style={styles.greeting}>Xin chào,</Text>
            <Text style={styles.name}>{user?.ho_va_ten ?? 'Tài xế'}</Text>
            <Text style={styles.date}>{formatDateChip(new Date())}</Text>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="bus" size={28} color={colors.brandDark} />
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{counts.total}</Text>
            <Text style={styles.statLabel}>Tổng chuyến</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{counts.running}</Text>
            <Text style={styles.statLabel}>Đang chạy</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{counts.upcoming}</Text>
            <Text style={styles.statLabel}>Sắp chạy</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('DriverScan', {})}
          style={({ pressed }) => [styles.scanButton, pressed ? styles.pressed : null]}
        >
          <Ionicons name="qr-code-outline" size={22} color={colors.brandDark} />
          <Text style={styles.scanText}>Quét mã vé lên xe</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.brandDark} />
        </Pressable>
      </View>

      {error ? <InlineNotice tone="error" message={error} /> : null}

      <View style={styles.filters}>
        {FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(item.key)}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}
            >
              <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {filtered.length === 0 ? (
        <EmptyView
          title="Chưa có chuyến"
          message="Bạn chưa được phân công chuyến nào phù hợp với bộ lọc hiện tại."
        />
      ) : null}

      {filtered.map((trip) => {
        const tone = statusTone[trip.trang_thai];
        return (
          <Pressable
            key={trip.ma_chuyen}
            accessibilityRole="button"
            onPress={() => navigation.navigate('DriverTripDetail', { tripId: trip.ma_chuyen })}
            style={({ pressed }) => [styles.tripCard, pressed ? styles.pressed : null]}
          >
            <View style={styles.tripTop}>
              <View style={styles.timeBox}>
                <Text style={styles.time}>{formatTime(trip.thoi_gian_xuat_ben)}</Text>
                <Text style={styles.dateText}>{formatDateChip(trip.thoi_gian_xuat_ben)}</Text>
              </View>
              <View style={styles.tripMain}>
                <Text style={styles.route} numberOfLines={2}>
                  {trip.ten_tuyen}
                </Text>
                <Text style={styles.plate}>{trip.bien_so_xe}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: tone.background }]}>
                <Text style={[styles.statusText, { color: tone.foreground }]}>
                  {TRIP_STATUS_LABELS[trip.trang_thai]}
                </Text>
              </View>
            </View>

            <View style={styles.tripBottom}>
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={16} color={colors.muted} />
                <Text style={styles.metaText}>
                  {trip.so_ghe_da_dat}/{trip.tong_so_ghe} khách
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={16} color={colors.muted} />
                <Text style={styles.metaText}>{formatTime(trip.thoi_gian_den_du_kien)} đến</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </View>
          </Pressable>
        );
      })}
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
    gap: spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  name: {
    color: colors.white,
    fontSize: 23,
    fontWeight: '800',
  },
  date: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    marginTop: spacing.xs,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  scanText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.brandDark,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  filterTextActive: {
    color: colors.white,
  },
  tripCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  tripTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  timeBox: {
    width: 64,
    gap: 1,
  },
  time: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  dateText: {
    fontSize: 11,
    color: colors.muted,
  },
  tripMain: {
    flex: 1,
    gap: 3,
  },
  route: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 20,
  },
  plate: {
    fontSize: 12,
    color: colors.muted,
  },
  statusPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  tripBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.muted,
  },
  pressed: {
    opacity: 0.8,
  },
});
