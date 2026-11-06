import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandMark } from '../../components/BrandMark';
import { InlineNotice } from '../../components/InlineNotice';
import { Screen } from '../../components/Screen';
import type { AppStackParamList } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout, selectAuth } from '../../store/authSlice';
import { colors, radius, spacing } from '../../theme/colors';

const ROLE_LABELS: Record<string, string> = {
  KHACH_HANG: 'Khách hàng',
  TAI_XE: 'Tài xế',
  QUAN_TRI_VIEN: 'Quản trị viên',
  QUAN_LY_CHI_NHANH: 'Quản lý chi nhánh',
  NHAN_VIEN_PHONG_VE: 'Nhân viên phòng vé',
  DIEU_HANH: 'Điều hành',
};

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }

  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

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
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={colors.brand} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  description,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed ? styles.actionPressed : null]}
    >
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={colors.brand} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = auth.user;

  const confirmLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất khỏi ứng dụng?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: () => {
          void dispatch(logout());
        },
      },
    ]);
  };

  if (!user) {
    return null;
  }

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <BrandMark compact subtitle="Tài khoản của bạn" />

      {auth.warning ? <InlineNotice tone="warning" message={auth.warning} /> : null}

      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(user.ho_va_ten)}</Text>
        </View>
        <View style={styles.heroText}>
          <Text style={styles.name}>{user.ho_va_ten}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{ROLE_LABELS[user.ten_vai_tro] ?? user.ten_vai_tro}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Thông tin tài khoản</Text>
        <InfoRow icon="call-outline" label="Số điện thoại" value={user.so_dien_thoai} />
        <InfoRow icon="mail-outline" label="Email" value={user.email ?? 'Chưa cập nhật'} />
        <InfoRow icon="person-outline" label="Mã người dùng" value={user.ma_nguoi_dung} />
        <InfoRow
          icon="shield-checkmark-outline"
          label="Trạng thái"
          value={
            user.trang_thai_tai_khoan === 'HOAT_DONG' ? 'Đang hoạt động' : user.trang_thai_tai_khoan
          }
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tiện ích</Text>
        {user.ten_vai_tro === 'KHACH_HANG' ? (
          <ActionRow
            icon="ticket-outline"
            label="Vé của tôi"
            description="Xem vé điện tử, mã QR và đơn đặt vé"
            onPress={() => navigation.navigate('PassengerTabs', { screen: 'MyTickets' })}
          />
        ) : null}
        <ActionRow
          icon="create-outline"
          label="Chỉnh sửa hồ sơ"
          description="Cập nhật họ tên, số điện thoại và email"
          onPress={() => navigation.navigate('EditProfile')}
        />
        <ActionRow
          icon="key-outline"
          label="Đổi mật khẩu"
          description="Bảo vệ tài khoản bằng mật khẩu mới"
          onPress={() => navigation.navigate('ChangePassword')}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={confirmLogout}
        disabled={auth.isLoggingOut}
        style={({ pressed }) => [styles.logoutButton, pressed ? styles.logoutPressed : null]}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>
          {auth.isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  hero: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.brandDark,
    fontSize: 22,
    fontWeight: '800',
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    color: colors.white,
    fontSize: 21,
    fontWeight: '800',
  },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  roleText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    gap: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  infoValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  actionPressed: {
    opacity: 0.65,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  actionDescription: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  logoutButton: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  logoutPressed: {
    opacity: 0.75,
  },
  logoutText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '700',
  },
});
