import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { ticketsApi } from '../../api/endpoints/tickets';
import { getErrorMessage } from '../../api/errors';
import { InlineNotice } from '../../components/InlineNotice';
import { Screen } from '../../components/Screen';
import { ErrorView, LoadingView } from '../../components/StatusView';
import { useAppResume } from '../../hooks/useAppResume';
import type { AppStackParamList } from '../../navigation/types';
import { colors, radius, spacing } from '../../theme/colors';
import type { Ticket, TicketQr } from '../../types/ticket';
import { formatCurrency, formatDate, formatDateTime, formatTime } from '../../utils/format';
import { TICKET_STATUS_LABELS } from '../../utils/status';

type Props = NativeStackScreenProps<AppStackParamList, 'TicketDetail'>;

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.muted} />
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export function TicketDetailScreen({ route }: Props) {
  const { ticketId } = route.params;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [qr, setQr] = useState<TicketQr | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      setQrError(null);

      try {
        const detail = await ticketsApi.getById(ticketId);
        if (!active) {
          return;
        }

        setTicket(detail);

        try {
          const qrCode = await ticketsApi.getQr(ticketId);
          if (active) {
            setQr(qrCode);
          }
        } catch (qrLoadError) {
          if (active) {
            setQrError(getErrorMessage(qrLoadError));
          }
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
  }, [reloadKey, ticketId]);

  useAppResume(() => {
    setReloadKey((value) => value + 1);
  });

  if (loading) {
    return <LoadingView message="Đang tải vé điện tử..." />;
  }

  if (error || !ticket) {
    return <ErrorView message={error ?? 'Không tìm thấy vé.'} />;
  }

  const checkedIn = ticket.trang_thai_soat_ve === 'DA_LEN_XE';

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroLabel}>Mã vé</Text>
            <Text style={styles.ticketCode}>{ticket.ma_ve}</Text>
          </View>
          <View style={styles.seatBadge}>
            <Text style={styles.seatLabel}>Ghế</Text>
            <Text style={styles.seatCode}>{ticket.ky_hieu_ghe}</Text>
          </View>
        </View>
        <Text style={styles.route}>{ticket.ten_tuyen}</Text>
        <Text style={styles.heroMeta}>
          {formatTime(ticket.thoi_gian_xuat_ben)} · {formatDate(ticket.thoi_gian_xuat_ben)}
        </Text>
        <View style={[styles.statusPill, checkedIn ? styles.statusPillChecked : null]}>
          <Ionicons
            name={checkedIn ? 'checkmark-circle' : 'time-outline'}
            size={14}
            color={checkedIn ? colors.success : colors.warning}
          />
          <Text style={[styles.statusText, checkedIn ? styles.statusTextChecked : null]}>
            {TICKET_STATUS_LABELS[ticket.trang_thai_soat_ve]}
          </Text>
        </View>
      </View>

      {checkedIn ? (
        <InlineNotice
          tone="success"
          message={`Vé đã được soát${
            ticket.thoi_gian_soat_ve ? ` lúc ${formatDateTime(ticket.thoi_gian_soat_ve)}` : ''
          }.`}
        />
      ) : null}

      <View style={styles.qrCard}>
        <Text style={styles.qrTitle}>Mã QR lên xe</Text>
        <Text style={styles.qrHint}>Đưa mã này cho tài xế để soát vé khi lên xe.</Text>

        {qr ? (
          <View style={styles.qrFrame}>
            <Image source={{ uri: qr.qr_data_url }} style={styles.qrImage} resizeMode="contain" />
          </View>
        ) : (
          <View style={styles.qrPlaceholder}>
            <Ionicons name="qr-code-outline" size={54} color={colors.muted} />
            <Text style={styles.qrPlaceholderText}>
              {qrError ?? 'Mã QR chưa sẵn sàng. Vui lòng thử lại sau.'}
            </Text>
          </View>
        )}

        <Text style={styles.qrToken} selectable>
          {ticket.ma_qr_kiem_tra}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Thông tin chuyến đi</Text>
        <InfoRow icon="navigate-outline" label="Tuyến" value={ticket.ten_tuyen} />
        <InfoRow
          icon="calendar-outline"
          label="Khởi hành"
          value={formatDateTime(ticket.thoi_gian_xuat_ben)}
        />
        <InfoRow icon="bus-outline" label="Biển số xe" value={ticket.bien_so_xe} />
        <InfoRow icon="person-outline" label="Tài xế" value={ticket.ten_tai_xe} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hành khách</Text>
        <InfoRow icon="person-outline" label="Họ tên" value={ticket.ho_ten_khach} />
        <InfoRow icon="call-outline" label="Số điện thoại" value={ticket.so_dien_thoai_khach} />
        {ticket.email_khach ? (
          <InfoRow icon="mail-outline" label="Email" value={ticket.email_khach} />
        ) : null}
        <InfoRow icon="receipt-outline" label="Mã đơn" value={ticket.ma_dinh_danh_don} />
        <InfoRow icon="cash-outline" label="Giá vé" value={formatCurrency(ticket.gia_ve)} />
      </View>

      <Text style={styles.footerNote}>
        Vé điện tử chỉ có giá trị cho chuyến đi và ghế đã ghi. Vui lòng có mặt trước giờ khởi hành
        ít nhất 15 phút.
      </Text>
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
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '600',
  },
  ticketCode: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 2,
  },
  seatBadge: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  seatLabel: {
    color: colors.brandDark,
    fontSize: 10,
    fontWeight: '700',
  },
  seatCode: {
    color: colors.brandDark,
    fontSize: 18,
    fontWeight: '800',
  },
  route: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: spacing.sm,
  },
  statusPillChecked: {
    backgroundColor: colors.successSoft,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.warning,
  },
  statusTextChecked: {
    color: colors.success,
  },
  qrCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  qrTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  qrHint: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
  },
  qrFrame: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  qrImage: {
    width: 220,
    height: 220,
  },
  qrPlaceholder: {
    width: 220,
    height: 220,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  qrPlaceholderText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    textAlign: 'center',
  },
  qrToken: {
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.5,
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoText: {
    flex: 1,
    gap: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.muted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  footerNote: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    textAlign: 'center',
  },
});
