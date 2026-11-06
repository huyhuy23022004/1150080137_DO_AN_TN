import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '../theme/colors';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  left?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const backgroundByVariant: Record<ButtonVariant, string> = {
  primary: colors.brand,
  secondary: colors.brandSoft,
  outline: colors.surface,
  danger: colors.dangerSoft,
};

const textByVariant: Record<ButtonVariant, string> = {
  primary: colors.white,
  secondary: colors.brandDark,
  outline: colors.brand,
  danger: colors.danger,
};

export function Button({
  title,
  variant = 'primary',
  loading = false,
  left,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled === true || loading;
  const isOutline = variant === 'outline';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: backgroundByVariant[variant],
          borderColor: isOutline ? colors.border : backgroundByVariant[variant],
        },
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textByVariant[variant]} />
      ) : (
        <>
          {left}
          <Text style={[styles.label, { color: textByVariant[variant] }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.55,
  },
});
