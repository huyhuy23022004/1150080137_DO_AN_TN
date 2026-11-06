import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { authApi } from '../../api/endpoints/auth';
import { getErrorMessage, getFieldErrors } from '../../api/errors';
import { Button } from '../../components/Button';
import { InlineNotice } from '../../components/InlineNotice';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import type { AppStackParamList } from '../../navigation/types';
import { useAppDispatch } from '../../store/hooks';
import { logout } from '../../store/authSlice';
import { colors, spacing } from '../../theme/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'ChangePassword'>;

interface FormErrors {
  mat_khau_cu?: string;
  mat_khau_moi?: string;
  xac_nhan_mat_khau_moi?: string;
}

function validate(current: string, next: string, confirmation: string): FormErrors {
  const errors: FormErrors = {};

  if (!current) {
    errors.mat_khau_cu = 'Vui lòng nhập mật khẩu hiện tại.';
  }

  if (next.length < 8) {
    errors.mat_khau_moi = 'Mật khẩu mới phải có ít nhất 8 ký tự.';
  } else if (next.length > 72) {
    errors.mat_khau_moi = 'Mật khẩu mới không được vượt quá 72 ký tự.';
  } else if (next === current) {
    errors.mat_khau_moi = 'Mật khẩu mới phải khác mật khẩu hiện tại.';
  }

  if (confirmation !== next) {
    errors.xac_nhan_mat_khau_moi = 'Xác nhận mật khẩu không khớp.';
  }

  return errors;
}

export function ChangePasswordScreen(_props: Props) {
  const dispatch = useAppDispatch();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);

  const clearError = (field: keyof FormErrors) => {
    setErrors((values) => ({ ...values, [field]: undefined }));
    setServerErrors((values) => ({ ...values, [field]: undefined }));
  };

  const handleSubmit = async () => {
    const localErrors = validate(current, next, confirmation);
    setErrors(localErrors);

    if (Object.keys(localErrors).length > 0 || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setServerErrors({});

    try {
      await authApi.changePassword({
        mat_khau_cu: current,
        mat_khau_moi: next,
        xac_nhan_mat_khau_moi: confirmation,
      });

      Alert.alert(
        'Đổi mật khẩu thành công',
        'Vì lý do bảo mật, vui lòng đăng nhập lại bằng mật khẩu mới.',
        [
          {
            text: 'Đăng nhập lại',
            onPress: () => {
              void dispatch(logout());
            },
          },
        ],
        { cancelable: false },
      );
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setServerErrors(getFieldErrors(submitError));
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll keyboardAvoiding contentContainerStyle={styles.content}>
      <View style={styles.intro}>
        <View style={styles.iconBox}>
          <Ionicons name="lock-closed-outline" size={26} color={colors.brand} />
        </View>
        <View style={styles.introText}>
          <Text style={styles.title}>Đổi mật khẩu</Text>
          <Text style={styles.subtitle}>
            Sau khi đổi mật khẩu, các phiên đăng nhập khác sẽ bị đăng xuất.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        {error ? <InlineNotice tone="error" message={error} /> : null}

        <View>
          <TextField
            label="Mật khẩu hiện tại"
            placeholder="Nhập mật khẩu hiện tại"
            value={current}
            onChangeText={(value) => {
              setCurrent(value);
              clearError('mat_khau_cu');
            }}
            secureTextEntry={!showCurrent}
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            error={errors.mat_khau_cu ?? serverErrors.mat_khau_cu}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showCurrent ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            hitSlop={10}
            onPress={() => setShowCurrent((value) => !value)}
            style={styles.eyeButton}
          >
            <Ionicons
              name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.muted}
            />
          </Pressable>
        </View>

        <View>
          <TextField
            label="Mật khẩu mới"
            placeholder="Ít nhất 8 ký tự"
            value={next}
            onChangeText={(value) => {
              setNext(value);
              clearError('mat_khau_moi');
            }}
            secureTextEntry={!showNext}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            error={errors.mat_khau_moi ?? serverErrors.mat_khau_moi}
            hint="Nên kết hợp chữ, số và ký tự đặc biệt."
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showNext ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            hitSlop={10}
            onPress={() => setShowNext((value) => !value)}
            style={styles.eyeButton}
          >
            <Ionicons
              name={showNext ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.muted}
            />
          </Pressable>
        </View>

        <TextField
          label="Xác nhận mật khẩu mới"
          placeholder="Nhập lại mật khẩu mới"
          value={confirmation}
          onChangeText={(value) => {
            setConfirmation(value);
            clearError('xac_nhan_mat_khau_moi');
          }}
          secureTextEntry={!showNext}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.xac_nhan_mat_khau_moi ?? serverErrors.xac_nhan_mat_khau_moi}
        />
      </View>

      <Button
        title="Cập nhật mật khẩu"
        loading={submitting}
        onPress={() => {
          void handleSubmit();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
  },
  intro: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introText: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
    top: 38,
    padding: spacing.xs,
  },
});
