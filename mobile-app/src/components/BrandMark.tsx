import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme/colors';

interface BrandMarkProps {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  light?: boolean;
}

export function BrandMark({
  title = 'FUTA Bus',
  subtitle = 'Đặt vé nhanh, chuyến đi trọn vẹn',
  compact = false,
  light = false,
}: BrandMarkProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.badge, compact ? styles.badgeCompact : null]}>
        <Ionicons name="bus" size={compact ? 22 : 30} color={colors.white} />
      </View>
      <View style={styles.textColumn}>
        <Text
          style={[
            styles.title,
            light ? styles.lightText : null,
            compact ? styles.titleCompact : null,
          ]}
        >
          {title}
        </Text>
        <Text style={[styles.subtitle, light ? styles.lightSubtitle : null]}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  badge: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCompact: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
  },
  textColumn: {
    flexShrink: 1,
    gap: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: colors.text,
  },
  titleCompact: {
    fontSize: 19,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
  },
  lightText: {
    color: colors.white,
  },
  lightSubtitle: {
    color: 'rgba(255,255,255,0.82)',
  },
});
