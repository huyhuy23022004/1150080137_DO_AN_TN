import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BrandMark } from '../../components/BrandMark';
import { Button } from '../../components/Button';
import { InlineNotice } from '../../components/InlineNotice';
import { Screen } from '../../components/Screen';
import { EmptyView, ErrorView, LoadingView } from '../../components/StatusView';
import { TextField } from '../../components/TextField';
import { useAppResume } from '../../hooks/useAppResume';
import type { AppStackParamList } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { loadMoreTrips, searchTrips, selectTrips } from '../../store/tripsSlice';
import { colors, radius, spacing } from '../../theme/colors';
import type { Trip } from '../../types/trip';
import { nextDays, toVietnamDateString } from '../../utils/datetime';
import {
  formatCurrency,
  formatDateChip,
  formatDurationBetween,
  formatTime,
} from '../../utils/format';

function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const soldOut = trip.so_ghe_trong <= 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Chuyến ${trip.ten_tuyen} lúc ${formatTime(trip.thoi_gian_xuat_ben)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tripCard, pressed ? styles.tripCardPressed : null]}
    >
      <View style={styles.tripTop}>
        <View style={styles.timeColumn}>
          <Text style={styles.timeText}>{formatTime(trip.thoi_gian_xuat_ben)}</Text>
          <Text style={styles.timeSub}>{formatTime(trip.thoi_gian_den_du_kien)}</Text>
        </View>

        <View style={styles.routeColumn}>
          <Text style={styles.routeText} numberOfLines={1}>
            {trip.tinh_di}
          </Text>
          <View style={styles.routeLine}>
            <View style={styles.routeDot} />
            <View style={styles.routeDash} />
            <Ionicons name="arrow-forward" size={13} color={colors.brand} />
          </View>
          <Text style={styles.routeText} numberOfLines={1}>
            {trip.tinh_den}
          </Text>
          <Text style={styles.duration}>
            {formatDurationBetween(trip.thoi_gian_xuat_ben, trip.thoi_gian_den_du_kien)}
          </Text>
        </View>

        <View style={styles.priceColumn}>
          <Text style={styles.price}>{formatCurrency(trip.gia_ve_co_ban)}</Text>
          <Text style={styles.priceLabel}>mỗi vé</Text>
        </View>
      </View>

      <View style={styles.tripFooter}>
        <View style={styles.metaChip}>
          <Ionicons name="bus-outline" size={14} color={colors.muted} />
          <Text style={styles.metaText}>{trip.ten_loai_xe}</Text>
        </View>
        <View style={styles.metaChip}>
          <Ionicons name="card-outline" size={14} color={colors.muted} />
          <Text style={styles.metaText}>{trip.bien_so_xe}</Text>
        </View>
        <View style={[styles.seatChip, soldOut ? styles.seatChipSoldOut : null]}>
          <Text style={[styles.seatText, soldOut ? styles.seatTextSoldOut : null]}>
            {soldOut ? 'Hết ghế' : `${trip.so_ghe_trong} ghế trống`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function SearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const dispatch = useAppDispatch();
  const trips = useAppSelector(selectTrips);
  const dates = nextDays(7);
  const [from, setFrom] = useState(trips.lastQuery.tinh_di);
  const [to, setTo] = useState(trips.lastQuery.tinh_den);
  const [departureDate, setDepartureDate] = useState(trips.lastQuery.ngay || toVietnamDateString());
  const didAutoSearch = useRef(false);

  const runSearch = (date = departureDate) => {
    Keyboard.dismiss();
    void dispatch(
      searchTrips({
        tinh_di: from.trim() || undefined,
        tinh_den: to.trim() || undefined,
        ngay: date,
      }),
    );
  };

  useAppResume(() => {
    void dispatch(searchTrips(trips.lastQuery));
  });

  useEffect(() => {
    if (didAutoSearch.current) {
      return;
    }

    didAutoSearch.current = true;

    if (trips.status === 'idle') {
      void dispatch(searchTrips({ ngay: departureDate }));
    }
  }, [departureDate, dispatch, trips.status]);

  const swapLocations = () => {
    setFrom(to);
    setTo(from);
  };

  const showEmpty =
    trips.status !== 'loading' && trips.status !== 'failed' && trips.items.length === 0;

  return (
    <Screen
      scroll
      padded={false}
      contentContainerStyle={styles.screenContent}
      refreshing={trips.status === 'loading' && trips.items.length > 0}
      onRefresh={() => runSearch()}
    >
      <View style={styles.hero}>
        <BrandMark subtitle="Xe khách liên tỉnh, đặt vé dễ dàng" light />
        <Text style={styles.heroTitle}>Đi đâu hôm nay?</Text>
        <Text style={styles.heroSubtitle}>
          Chọn điểm đi, điểm đến và ngày khởi hành để xem chuyến phù hợp.
        </Text>
      </View>

      <View style={styles.searchCard}>
        <View style={styles.locationRow}>
          <View style={styles.locationFields}>
            <TextField
              label="Điểm đi"
              placeholder="Ví dụ: TP. Hồ Chí Minh"
              value={from}
              onChangeText={setFrom}
              returnKeyType="next"
              testID="search-from"
            />
            <TextField
              label="Điểm đến"
              placeholder="Ví dụ: Đà Nẵng"
              value={to}
              onChangeText={setTo}
              returnKeyType="search"
              onSubmitEditing={() => runSearch()}
              testID="search-to"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đổi điểm đi và điểm đến"
            onPress={swapLocations}
            style={styles.swapButton}
          >
            <Ionicons name="swap-vertical" size={20} color={colors.brand} />
          </Pressable>
        </View>

        <View style={styles.dateSection}>
          <Text style={styles.fieldLabel}>Ngày khởi hành</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateList}
          >
            {dates.map((date) => {
              const selected = date === departureDate;
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setDepartureDate(date);
                    runSearch(date);
                  }}
                  style={[styles.dateChip, selected ? styles.dateChipSelected : null]}
                >
                  <Text style={[styles.dateText, selected ? styles.dateTextSelected : null]}>
                    {formatDateChip(date)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <Button
          title="Tìm chuyến xe"
          left={<Ionicons name="search" size={18} color={colors.white} />}
          onPress={() => runSearch()}
          loading={trips.status === 'loading'}
          testID="search-submit"
        />
      </View>

      <View style={styles.resultsHeader}>
        <View>
          <Text style={styles.resultsTitle}>Chuyến xe phù hợp</Text>
          <Text style={styles.resultsSubtitle}>
            {formatDateChip(departureDate)} · {trips.meta.total} chuyến
          </Text>
        </View>
        {trips.status === 'loading' ? (
          <ActivityIndicator size="small" color={colors.brand} />
        ) : null}
      </View>

      {trips.error ? <InlineNotice tone="error" message={trips.error} /> : null}

      {trips.loadMoreError ? <InlineNotice tone="error" message={trips.loadMoreError} /> : null}

      {trips.items.map((trip) => (
        <TripCard
          key={trip.ma_chuyen}
          trip={trip}
          onPress={() => navigation.navigate('TripDetail', { tripId: trip.ma_chuyen })}
        />
      ))}

      {trips.status === 'loading' && trips.items.length === 0 ? (
        <LoadingView message="Đang tìm chuyến xe..." />
      ) : null}

      {trips.status === 'failed' && trips.items.length === 0 ? (
        <ErrorView
          message={trips.error ?? 'Không thể tải chuyến xe.'}
          onRetry={() => runSearch()}
        />
      ) : null}

      {showEmpty ? (
        <EmptyView
          title="Chưa có chuyến phù hợp"
          message="Thử đổi điểm đi, điểm đến hoặc chọn một ngày khác."
        />
      ) : null}

      {trips.meta.page < trips.meta.total_pages ? (
        <Button
          title="Xem thêm chuyến"
          variant="secondary"
          loading={trips.isLoadingMore}
          onPress={() => {
            void dispatch(loadMoreTrips());
          }}
          style={styles.loadMoreButton}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  hero: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    lineHeight: 21,
  },
  searchCard: {
    marginTop: -spacing.xl,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
    shadowColor: '#0B1F12',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  locationFields: {
    flex: 1,
    gap: spacing.md,
  },
  swapButton: {
    marginTop: 24,
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateSection: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  dateList: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  dateChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dateChipSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  dateTextSelected: {
    color: colors.white,
  },
  resultsHeader: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  resultsSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  loadMoreButton: {
    marginHorizontal: spacing.lg,
  },
  tripCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tripCardPressed: {
    opacity: 0.83,
  },
  tripTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  timeColumn: {
    alignItems: 'flex-start',
    gap: 2,
  },
  timeText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  timeSub: {
    fontSize: 13,
    color: colors.muted,
  },
  routeColumn: {
    flex: 1,
    gap: 2,
  },
  routeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginVertical: 1,
  },
  routeDot: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  routeDash: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  duration: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  priceColumn: {
    alignItems: 'flex-end',
    gap: 1,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.brand,
  },
  priceLabel: {
    fontSize: 11,
    color: colors.muted,
  },
  tripFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.muted,
  },
  seatChip: {
    marginLeft: 'auto',
    backgroundColor: colors.successSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  seatChipSoldOut: {
    backgroundColor: colors.dangerSoft,
  },
  seatText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  seatTextSoldOut: {
    color: colors.danger,
  },
});
