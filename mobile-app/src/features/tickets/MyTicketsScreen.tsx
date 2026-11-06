import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { bookingsApi } from '../../api/endpoints/bookings';
import { paymentsApi } from '../../api/endpoints/payments';
import { ticketsApi } from '../../api/endpoints/tickets';
import { getErrorMessage } from '../../api/errors';
import { BrandMark } from '../../components/BrandMark';
import { Button } from '../../components/Button';
import { InlineNotice } from '../../components/InlineNotice';
import { Screen } from '../../components/Screen';
import { EmptyView, LoadingView } from '../../components/StatusView';
import { useAppResume } from '../../hooks/useAppResume';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme/colors';
import type { BookingStatus } from '../../types/booking';
import type { TicketOrderGroup } from '../../types/ticket';
import { formatCurrency, formatDate, formatTime } from '../../utils/format';
import { ORDER_STATUS_LABELS, TICKET_STATUS_LABELS } from '../../utils/status';
import { groupTicketsByOrder } from '../../utils/tickets';

type Filter = 'ALL' | BookingStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'CHO_THANH_TOAN', label: 'Chờ thanh toán' },
  { key: 'DA_THANH_TOAN', label: 'Đã thanh toán' },
  { key: 'DA_HUY', label: 'Đã hủy' },
];

const toneForStatus = {
  CHO_THANH_TOAN: { background: colors.warningSoft, foreground: colors.warning },
  DA_THANH_TOAN: { background: colors.successSoft, foreground: colors.success },
  DA_HUY: { background: colors.dangerSoft, foreground: colors.danger },
} as const;

export function MyTicketsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [groups, setGroups] = useState<TicketOrderGroup[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const result = await ticketsApi.listMine({ limit: 100 });
      setGroups(groupTicketsByOrder(result.items));
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

  const filtered = useMemo(
    () => (filter === 'ALL' ? groups : groups.filter((group) => group.trang_thai_don === filter)),
    [filter, groups],
  );

  const handlePay = async (group: TicketOrderGroup) => {
    setBusyOrder(group.ma_don_ve);
    setError(null);

    try {
      const payment = await paymentsApi.createVnpayUrl(group.ma_don_ve);
      navigation.navigate('PaymentWebView', {
        bookingId: group.ma_don_ve,
        paymentUrl: payment.payment_url,
      });
    } catch (paymentError) {
      setError(getErrorMessage(paymentError));
    } finally {
      setBusyOrder(null);
    }
  };

  const confirmCancel = (group: TicketOrderGroup) => {
    Alert.alert('Hủy đơn vé', `Hủy đơn ${group.ma_dinh_danh_don}?`, [
      { text: 'Giữ đơn', style: 'cancel' },
      {
        text: 'Hủy đơn',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusyOrder(group.ma_don_ve);
            setError(null);
            try {
              await bookingsApi.cancel(group.ma_don_ve);
              await load(true);
            } catch (cancelError) {
              setError(getErrorMessage(cancelError));
            } finally {
              setBusyOrder(null);
            }
          })();
        },
      },
    ]);
  };

  if (loading) {
    return <LoadingView message="Đang tải vé của bạn..." />;
  }

  return (
    <Screen
      scroll
      contentContainerStyle={styles.content}
      refreshing={refreshing}
      onRefresh={() => void load(true)}
    >
      <BrandMark compact subtitle="Vé điện tử và đơn đặt vé" />

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

      {error ? <InlineNotice tone="error" message={error} /> : null}

      {filtered.length === 0 ? (
        <EmptyView
          title="Chưa có vé"
          message="Đặt vé trên trang chủ để xem vé điện tử và mã QR tại đây."
          actionLabel="Tìm chuyến xe"
          onAction={() => navigation.navigate('PassengerTabs', { screen: 'Search' })}
        />
      ) : null}

      {filtered.map((group) => {
        const tone = toneForStatus[group.trang_thai_don];
        const pending = group.trang_thai_don === 'CHO_THANH_TOAN';
        const paid = group.trang_thai_don === 'DA_THANH_TOAN';

        return (
          <View key={group.ma_don_ve} style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <View style={styles.routeBox}>
                <Text style={styles.routeName}>{group.ten_tuyen}</Text>
                <Text style={styles.routeMeta}>
                  {formatTime(group.thoi_gian_xuat_ben)} · {formatDate(group.thoi_gian_xuat_ben)}
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: tone.background }]}>
                <Text style={[styles.statusText, { color: tone.foreground }]}>
                  {ORDER_STATUS_LABELS[group.trang_thai_don]}
                </Text>
              </View>
            </View>

            <View style={styles.orderInfo}>
              <Text style={styles.orderCode}>{group.ma_dinh_danh_don}</Text>
              <Text style={styles.amount}>{formatCurrency(group.tong_tien)}</Text>
            </View>

            <View style={styles.ticketList}>
              {group.tickets.map((ticket) => (
                <Pressable
                  key={ticket.ma_ve}
                  accessibilityRole="button"
                  disabled={!paid}
                  onPress={() => navigation.navigate('TicketDetail', { ticketId: ticket.ma_ve })}
                  style={({ pressed }) => [
                    styles.ticketRow,
                    paid ? styles.ticketRowPaid : null,
                    pressed && paid ? styles.pressed : null,
                  ]}
                >
                  <View style={styles.seatBadge}>
                    <Text style={styles.seatText}>{ticket.ky_hieu_ghe}</Text>
                  </View>
                  <View style={styles.ticketInfo}>
                    <Text style={styles.ticketName}>{ticket.ho_ten_khach}</Text>
                    <Text style={styles.ticketMeta}>
                      {TICKET_STATUS_LABELS[ticket.trang_thai_soat_ve]} · {ticket.ten_tai_xe}
                    </Text>
                  </View>
                  {paid ? (
                    <Ionicons name="qr-code-outline" size={22} color={colors.brand} />
                  ) : (
                    <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
                  )}
                </Pressable>
              ))}
            </View>

            {pending ? (
              <View style={styles.actions}>
                <Button
                  title="Thanh toán"
                  loading={busyOrder === group.ma_don_ve}
                  onPress={() => {
                    void handlePay(group);
                  }}
                  style={styles.flexButton}
                />
                <Button
                  title="Hủy đơn"
                  variant="outline"
                  disabled={busyOrder === group.ma_don_ve}
                  onPress={() => confirmCancel(group)}
                  style={styles.flexButton}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
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
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  orderHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  routeBox: {
    flex: 1,
    gap: 2,
  },
  routeName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  routeMeta: {
    fontSize: 12,
    color: colors.muted,
  },
  statusPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  orderCode: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
  },
  amount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.brand,
  },
  ticketList: {
    gap: spacing.sm,
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
  },
  ticketRowPaid: {
    backgroundColor: colors.brandSoft,
  },
  seatBadge: {
    minWidth: 48,
    minHeight: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  seatText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  ticketInfo: {
    flex: 1,
    gap: 2,
  },
  ticketName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  ticketMeta: {
    fontSize: 11,
    color: colors.muted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexButton: {
    flex: 1,
  },
  pressed: {
    opacity: 0.78,
  },
});
