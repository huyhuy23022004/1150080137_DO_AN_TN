import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BrandMark } from '../../components/BrandMark';
import { colors, spacing } from '../../theme/colors';

export function BootSplashScreen() {
  return (
    <View style={styles.container}>
      <BrandMark />
      <ActivityIndicator size="small" color={colors.brand} />
      <Text style={styles.caption}>Đang khôi phục phiên đăng nhập...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  caption: {
    color: colors.muted,
    fontSize: 13,
  },
});
