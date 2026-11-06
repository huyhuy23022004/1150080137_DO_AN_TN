import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme/colors';

type NoticeTone = 'error' | 'warning' | 'info' | 'success';

const toneStyle: Record<
  NoticeTone,
  { background: string; foreground: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  error: { background: colors.dangerSoft, foreground: colors.danger, icon: 'alert-circle-outline' },
  warning: { background: colors.warningSoft, foreground: colors.warning, icon: 'warning-outline' },
  info: {
    background: colors.brandSoft,
    foreground: colors.brandDark,
    icon: 'information-circle-outline',
  },
  success: {
    background: colors.successSoft,
    foreground: colors.success,
    icon: 'checkmark-circle-outline',
  },
};

export function InlineNotice({ tone = 'info', message }: { tone?: NoticeTone; message: string }) {
  const palette = toneStyle[tone];

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Ionicons name={palette.icon} size={19} color={palette.foreground} />
      <Text style={[styles.text, { color: palette.foreground }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});
