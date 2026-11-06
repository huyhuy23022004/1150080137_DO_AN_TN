import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout, selectAuth } from '../../store/authSlice';
import { colors, spacing } from '../../theme/colors';

export function UnsupportedRoleScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectAuth).user;

  return (
    <Screen scroll contentContainerStyle={styles.container}>
      <Ionicons name="phone-portrait-outline" size={54} color={colors.muted} />
      <Text style={styles.title}>Vai trò chưa được hỗ trợ</Text>
      <Text style={styles.message}>
        Ứng dụng di động hiện dành cho khách hàng và tài xế. Vai trò hiện tại của bạn là{' '}
        {user?.ten_vai_tro ?? 'không xác định'}.
      </Text>
      <Button
        title="Đăng xuất"
        variant="outline"
        onPress={() => {
          void dispatch(logout());
        }}
        style={styles.button}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
});
