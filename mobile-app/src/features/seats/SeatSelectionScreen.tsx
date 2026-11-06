import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getAccessToken, refreshAccessToken } from '../../api/client';
import { tripsApi } from '../../api/endpoints/trips';
import { getErrorMessage } from '../../api/errors';
import { Button } from '../../components/Button';
import { InlineNotice } from '../../components/InlineNotice';
import { Screen } from '../../components/Screen';
import { ErrorView, LoadingView } from '../../components/StatusView';
import { useAppResume } from '../../hooks/useAppResume';
import type { AppStackParamList } from '../../navigation/types';
import {
  connectTripSocket,
  createTripSocket,
  extendSeatHold,
  holdSeats,
  joinTrip,
  leaveTrip,
  releaseSeats,
  untrackTripSocket,
  type SeatBookedEvent,
  type SeatHeldEvent,
  type SeatReleasedEvent,
  type TripSocket,
} from '../../services/socket';
import { colors, radius, spacing } from '../../theme/colors';
import type { SeatAvailability, SeatMap, TripDetail, TripSeat } from '../../types/trip';
import { formatCountdown, formatCurrency } from '../../utils/format';
import { createOwnerRef } from '../../utils/owner-ref';
import { groupSeatsByFloor } from '../../utils/seat-layout';

type Props = NativeStackScreenProps<AppStackParamList, 'SeatSelection'>;

const MAX_SEATS = 5;

function seatTone(seat: TripSeat, selected: boolean, pending: boolean) {
  if (selected) {
    return {
      container: styles.seatSelected,
      label: styles.seatLabelSelected,
      caption: styles.seatCaptionSelected,
    };
  }

  if (pending) {
    return {
      container: styles.seatPending,
      label: styles.seatLabelMuted,
      caption: styles.seatCaptionMuted,
    };
  }

  if (seat.trang_thai === 'DA_DAT') {
    return {
      container: styles.seatBooked,
      label: styles.seatLabelMuted,
      caption: styles.seatCaptionMuted,
    };
  }

  if (seat.trang_thai === 'DANG_GIU') {
    return {
      container: styles.seatHeld,
      label: styles.seatLabelHeld,
      caption: styles.seatCaptionHeld,
    };
  }

  return {
    container: styles.seatAvailable,
    label: styles.seatLabel,
    caption: styles.seatCaption,
  };
}

export function SeatSelectionScreen({ route, navigation }: Props) {
  const { tripId } = route.params;
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [extending, setExtending] = useState(false);
  const [activeFloor, setActiveFloor] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const ownerRefRef = useRef(createOwnerRef());
  const socketRef = useRef<TripSocket | null>(null);
  const selectedRef = useRef<string[]>([]);
  const mountedRef = useRef(true);

  const floors = useMemo(() => groupSeatsByFloor(seatMap?.ghe ?? []), [seatMap]);
  const currentFloor = floors.find((floor) => floor.tang === activeFloor) ?? floors[0];
  const selectedSeats = useMemo(
    () => (seatMap?.ghe ?? []).filter((seat) => selectedCodes.includes(seat.ky_hieu_ghe)),
    [seatMap, selectedCodes],
  );
  const totalPrice = selectedSeats.reduce((total) => total + Number(trip?.gia_ve_co_ban ?? 0), 0);
  const secondsLeft =
    holdExpiresAt && now !== null
      ? Math.max(0, Math.floor((new Date(holdExpiresAt).getTime() - now) / 1000))
      : null;

  const changeSelection = useCallback((mutator: (current: string[]) => string[]) => {
    const next = mutator(selectedRef.current);
    selectedRef.current = next;
    setSelectedCodes(next);
  }, []);

  const applySeatStatus = useCallback((codes: string[], status: SeatAvailability) => {
    const target = new Set(codes);

    setSeatMap((current) => {
      if (!current) {
        return current;
      }

      const ghe = current.ghe.map((seat) => {
        if (!target.has(seat.ky_hieu_ghe) || seat.trang_thai === 'DA_DAT') {
          return seat;
        }

        if (selectedRef.current.includes(seat.ky_hieu_ghe)) {
          return seat.trang_thai === 'TRONG' ? { ...seat, trang_thai: 'DANG_GIU' as const } : seat;
        }

        return { ...seat, trang_thai: status };
      });

      return {
        ...current,
        ghe,
        so_ghe_trong: ghe.filter((seat) => seat.trang_thai === 'TRONG').length,
      };
    });
  }, []);

  const refreshSeatMap = useCallback(async () => {
    try {
      const latest = await tripsApi.getSeatMap(tripId);
      if (!mountedRef.current) {
        return;
      }

      const selected = new Set(selectedRef.current);
      const ghe = latest.ghe.map((seat) =>
        selected.has(seat.ky_hieu_ghe) ? { ...seat, trang_thai: 'DANG_GIU' as const } : seat,
      );
      setSeatMap({ ...latest, ghe });
    } catch {
      return;
    }
  }, [tripId]);

  useAppResume(() => {
    void refreshSeatMap();
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const [detail, seats] = await Promise.all([
          tripsApi.getDetail(tripId),
          tripsApi.getSeatMap(tripId),
        ]);

        if (active) {
          setTrip(detail);
          setSeatMap(seats);
        }
      } catch (error) {
        if (active) {
          setLoadError(getErrorMessage(error));
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

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      const timer = setTimeout(() => {
        setSocketError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      }, 0);

      return () => clearTimeout(timer);
    }

    const ownerRef = ownerRefRef.current;
    const socket = createTripSocket(token);
    socketRef.current = socket;

    const handleHeld = (event: SeatHeldEvent) => {
      if (event.ma_chuyen !== tripId) {
        return;
      }

      applySeatStatus(event.danh_sach_ghe, 'DANG_GIU');

      if (event.danh_sach_ghe.some((code) => selectedRef.current.includes(code))) {
        setNow(null);
        setHoldExpiresAt(event.expires_at);
      }
    };

    const handleReleased = (event: SeatReleasedEvent) => {
      if (event.ma_chuyen === tripId) {
        applySeatStatus(event.danh_sach_ghe, 'TRONG');
      }
    };

    const handleBooked = (event: SeatBookedEvent) => {
      if (event.ma_chuyen !== tripId) {
        return;
      }

      changeSelection((current) => current.filter((code) => !event.danh_sach_ghe.includes(code)));
      applySeatStatus(event.danh_sach_ghe, 'DA_DAT');
      void refreshSeatMap();
    };

    const handleConnect = async () => {
      setIsConnected(true);
      setSocketError(null);

      const ack = await joinTrip(socket, tripId);
      if (!ack.success) {
        setSocketError(ack.message ?? 'Không thể tham gia phòng chuyến xe.');
        return;
      }

      if (ack.data?.so_do_ghe && mountedRef.current) {
        const selected = new Set(selectedRef.current);
        const ghe = ack.data.so_do_ghe.ghe.map((seat) =>
          selected.has(seat.ky_hieu_ghe) ? { ...seat, trang_thai: 'DANG_GIU' as const } : seat,
        );
        setSeatMap({ ...ack.data.so_do_ghe, ghe });
      }
    };

    let refreshing = false;

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleConnectError = async (error: Error) => {
      setIsConnected(false);

      if (error.message.includes('AUTH_TOKEN_INVALID') && !refreshing) {
        refreshing = true;

        try {
          const token = await refreshAccessToken();
          if (!mountedRef.current) {
            return;
          }

          socket.auth = { token };
          socket.connect();
          return;
        } catch {
          if (mountedRef.current) {
            setSocketError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
          }
          return;
        } finally {
          refreshing = false;
        }
      }

      setSocketError(error.message || 'Không thể kết nối realtime.');
    };

    socket.on('seat:held', handleHeld);
    socket.on('seat:released', handleReleased);
    socket.on('seat:booked', handleBooked);
    socket.on('connect', () => {
      void handleConnect();
    });
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    connectTripSocket(socket);

    if (socket.connected) {
      void handleConnect();
    }

    return () => {
      untrackTripSocket(socket);
      socket.off('seat:held', handleHeld);
      socket.off('seat:released', handleReleased);
      socket.off('seat:booked', handleBooked);
      socket.off('connect');
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);

      if (socket.connected) {
        const codes = selectedRef.current;
        void releaseSeats(socket, tripId, ownerRef, codes.length > 0 ? codes : undefined)
          .then(() => leaveTrip(socket, tripId))
          .finally(() => socket.disconnect());
      } else {
        socket.disconnect();
      }

      socketRef.current = null;
    };
  }, [applySeatStatus, changeSelection, refreshSeatMap, tripId]);

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    const timer = setInterval(() => {
      void refreshSeatMap();
    }, 20_000);

    return () => clearInterval(timer);
  }, [isConnected, refreshSeatMap]);

  useEffect(() => {
    if (!holdExpiresAt) {
      return;
    }

    const expiresAt = new Date(holdExpiresAt).getTime();
    const updateClock = () => setNow(Date.now());
    const initialTimer = setTimeout(updateClock, 0);
    const clockTimer = setInterval(updateClock, 1_000);
    const expiryTimer = setTimeout(
      () => {
        setHoldExpiresAt(null);
        setNow(null);
        changeSelection(() => []);

        void refreshSeatMap();
        Alert.alert('Hết thời gian giữ ghế', 'Vui lòng chọn lại ghế để tiếp tục.');
      },
      Math.max(0, expiresAt - Date.now()),
    );

    return () => {
      clearTimeout(initialTimer);
      clearInterval(clockTimer);
      clearTimeout(expiryTimer);
    };
  }, [changeSelection, holdExpiresAt, refreshSeatMap]);

  const handleSeatPress = async (seat: TripSeat) => {
    if (pendingCode) {
      return;
    }

    const isSelected = selectedRef.current.includes(seat.ky_hieu_ghe);

    if (!isSelected && (seat.trang_thai === 'DA_DAT' || seat.trang_thai === 'DANG_GIU')) {
      return;
    }

    const socket = socketRef.current;
    if (!socket?.connected) {
      Alert.alert('Chưa kết nối', 'Đang kết nối lại realtime. Vui lòng thử lại sau vài giây.');
      return;
    }

    if (!isSelected && selectedRef.current.length >= MAX_SEATS) {
      Alert.alert('Đã chọn tối đa', `Mỗi lần đặt vé chỉ được chọn tối đa ${MAX_SEATS} ghế.`);
      return;
    }

    setPendingCode(seat.ky_hieu_ghe);

    try {
      if (isSelected) {
        const ack = await releaseSeats(socket, tripId, ownerRefRef.current, [seat.ky_hieu_ghe]);

        if (ack.success) {
          changeSelection((current) => current.filter((code) => code !== seat.ky_hieu_ghe));
          applySeatStatus([seat.ky_hieu_ghe], 'TRONG');

          if (selectedRef.current.length === 0) {
            setHoldExpiresAt(null);
            setNow(null);
          }
        } else {
          Alert.alert('Không thể bỏ ghế', ack.message ?? 'Vui lòng thử lại.');
          await refreshSeatMap();
        }

        return;
      }

      const ack = await holdSeats(socket, tripId, [seat.ky_hieu_ghe], ownerRefRef.current);

      if (ack.success) {
        changeSelection((current) => [...current, seat.ky_hieu_ghe]);
        applySeatStatus([seat.ky_hieu_ghe], 'DANG_GIU');
        if (ack.data?.expires_at) {
          setNow(null);
          setHoldExpiresAt(ack.data.expires_at);
        }
      } else {
        Alert.alert('Không thể giữ ghế', ack.message ?? 'Ghế có thể vừa được người khác chọn.');
        await refreshSeatMap();
      }
    } finally {
      if (mountedRef.current) {
        setPendingCode(null);
      }
    }
  };

  const handleExtend = async () => {
    const socket = socketRef.current;
    if (!socket?.connected || selectedRef.current.length === 0) {
      return;
    }

    setExtending(true);

    try {
      const ack = await extendSeatHold(socket, tripId, ownerRefRef.current);
      if (ack.success && ack.data?.expires_at) {
        setNow(null);
        setHoldExpiresAt(ack.data.expires_at);
        Alert.alert('Đã gia hạn', 'Thời gian giữ ghế đã được gia hạn thêm.');
      } else {
        Alert.alert('Không thể gia hạn', ack.message ?? 'Vui lòng chọn lại ghế.');
        setHoldExpiresAt(null);
        setNow(null);
        changeSelection(() => []);
        await refreshSeatMap();
      }
    } finally {
      if (mountedRef.current) {
        setExtending(false);
      }
    }
  };

  if (loading) {
    return <LoadingView message="Đang tải sơ đồ ghế..." />;
  }

  if (loadError || !seatMap || !trip) {
    return (
      <ErrorView
        message={loadError ?? 'Không thể tải sơ đồ ghế.'}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return (
    <Screen padded={false} edges={['left', 'right', 'bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryText}>
              <Text style={styles.routeName}>{trip.ten_tuyen}</Text>
              <Text style={styles.busInfo}>
                {trip.ten_loai_xe} · {trip.bien_so_xe}
              </Text>
            </View>
            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>Giá mỗi ghế</Text>
              <Text style={styles.price}>{formatCurrency(trip.gia_ve_co_ban)}</Text>
            </View>
          </View>

          <View style={styles.connectionRow}>
            <View
              style={[styles.connectionDot, isConnected ? styles.connected : styles.disconnected]}
            />
            <Text style={styles.connectionText}>
              {isConnected
                ? 'Đang cập nhật trạng thái ghế theo thời gian thực'
                : 'Đang kết nối lại...'}
            </Text>
          </View>
        </View>

        {socketError ? <InlineNotice tone="warning" message={socketError} /> : null}

        {floors.length > 1 ? (
          <View style={styles.floorTabs}>
            {floors.map((floor) => {
              const active = currentFloor?.tang === floor.tang;
              return (
                <Pressable
                  key={floor.tang}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setActiveFloor(floor.tang)}
                  style={[styles.floorTab, active ? styles.floorTabActive : null]}
                >
                  <Text style={[styles.floorTabText, active ? styles.floorTabTextActive : null]}>
                    {floor.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.busCard}>
          <View style={styles.driverArea}>
            <Ionicons name="speedometer-outline" size={18} color={colors.muted} />
            <Text style={styles.driverLabel}>Khu vực tài xế</Text>
          </View>

          {currentFloor ? (
            <View style={styles.rows}>
              {currentFloor.rows.map((row) => (
                <View key={row.hang} style={styles.seatRow}>
                  <Text style={styles.rowNumber}>{row.hang}</Text>
                  <View style={styles.seatRowContent}>
                    {row.seats.map((seat) => {
                      const selected = selectedCodes.includes(seat.ky_hieu_ghe);
                      const pending = pendingCode === seat.ky_hieu_ghe;
                      const tone = seatTone(seat, selected, pending);
                      const disabled =
                        seat.trang_thai === 'DA_DAT' ||
                        (seat.trang_thai === 'DANG_GIU' && !selected);

                      return (
                        <Pressable
                          key={seat.ma_ghe}
                          accessibilityRole="button"
                          accessibilityLabel={`Ghế ${seat.ky_hieu_ghe}, ${
                            selected
                              ? 'đang chọn'
                              : seat.trang_thai === 'TRONG'
                                ? 'còn trống'
                                : seat.trang_thai === 'DANG_GIU'
                                  ? 'đang được giữ'
                                  : 'đã đặt'
                          }`}
                          accessibilityState={{ disabled, selected, busy: pending }}
                          disabled={disabled || pending}
                          onPress={() => {
                            void handleSeatPress(seat);
                          }}
                          style={[styles.seat, tone.container]}
                        >
                          {pending ? (
                            <ActivityIndicator size="small" color={colors.muted} />
                          ) : (
                            <>
                              <Text style={[styles.seatLabel, tone.label]}>{seat.ky_hieu_ghe}</Text>
                              <Text style={[styles.seatCaption, tone.caption]}>
                                {seat.loai_cho === 'VIP' ? 'VIP' : 'Thường'}
                              </Text>
                            </>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noSeats}>Chưa có sơ đồ ghế cho tầng này.</Text>
          )}

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, styles.seatAvailable]} />
              <Text style={styles.legendText}>Trống</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, styles.seatSelected]} />
              <Text style={styles.legendText}>Đang chọn</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, styles.seatHeld]} />
              <Text style={styles.legendText}>Đang giữ</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, styles.seatBooked]} />
              <Text style={styles.legendText}>Đã đặt</Text>
            </View>
          </View>
        </View>

        <InlineNotice
          tone="info"
          message={`Bạn có thể chọn tối đa ${MAX_SEATS} ghế. Ghế được giữ tạm trong 10 phút và tự động giải phóng nếu chưa đặt vé.`}
        />
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerSummary}>
          <Text style={styles.footerCount}>
            {selectedCodes.length > 0
              ? `${selectedCodes.length} ghế · ${selectedCodes.join(', ')}`
              : 'Chưa chọn ghế'}
          </Text>
          {selectedCodes.length > 0 ? (
            <Text style={styles.footerTotal}>{formatCurrency(totalPrice)}</Text>
          ) : (
            <Text style={styles.footerHint}>Chọn ghế trên sơ đồ để giữ chỗ</Text>
          )}
          {holdExpiresAt ? (
            <Text style={styles.countdown}>
              Giữ ghế còn {secondsLeft === null ? '--:--' : formatCountdown(secondsLeft)}
            </Text>
          ) : null}
        </View>

        {selectedCodes.length > 0 ? (
          <>
            <Button
              title="Tiếp tục đặt vé"
              onPress={() =>
                navigation.navigate('BookingCheckout', {
                  tripId,
                  seatCodes: selectedCodes,
                  ownerRef: ownerRefRef.current,
                })
              }
            />
            <Button
              title="Gia hạn giữ ghế"
              variant="secondary"
              loading={extending}
              onPress={() => {
                void handleExtend();
              }}
              style={styles.extendButton}
            />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryText: {
    flex: 1,
    gap: 3,
  },
  routeName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  busInfo: {
    fontSize: 13,
    color: colors.muted,
  },
  priceBox: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 11,
    color: colors.muted,
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.brand,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  connectionDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
  },
  connected: {
    backgroundColor: colors.success,
  },
  disconnected: {
    backgroundColor: colors.warning,
  },
  connectionText: {
    fontSize: 11,
    color: colors.muted,
  },
  floorTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  floorTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  floorTabActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  floorTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textAlign: 'center',
  },
  floorTabTextActive: {
    color: colors.white,
  },
  busCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  driverArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  driverLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  rows: {
    gap: spacing.md,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowNumber: {
    width: 18,
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textAlign: 'center',
  },
  seatRowContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  seat: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  seatAvailable: {
    backgroundColor: colors.surface,
    borderColor: colors.brand,
  },
  seatSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  seatHeld: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.accent,
  },
  seatBooked: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.surfaceMuted,
  },
  seatPending: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  seatLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  seatLabelSelected: {
    color: colors.white,
  },
  seatLabelHeld: {
    color: colors.warning,
  },
  seatLabelMuted: {
    color: colors.muted,
  },
  seatCaption: {
    fontSize: 9,
    color: colors.muted,
  },
  seatCaptionSelected: {
    color: 'rgba(255,255,255,0.82)',
  },
  seatCaptionHeld: {
    color: colors.warning,
  },
  seatCaptionMuted: {
    color: colors.muted,
  },
  noSeats: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.muted,
    paddingVertical: spacing.lg,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
  },
  legendText: {
    fontSize: 11,
    color: colors.muted,
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  footerSummary: {
    gap: 2,
  },
  footerCount: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  footerTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.brand,
  },
  footerHint: {
    fontSize: 12,
    color: colors.muted,
  },
  countdown: {
    fontSize: 12,
    color: colors.warning,
    fontWeight: '600',
  },
  extendButton: {
    minHeight: 46,
  },
});
