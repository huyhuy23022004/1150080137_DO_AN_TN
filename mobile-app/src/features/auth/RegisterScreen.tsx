import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandMark } from '../../components/BrandMark';
import { Button } from '../../components/Button';
import { InlineNotice } from '../../components/InlineNotice';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import type { AppStackParamList } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { clearAuthError, register, selectAuth } from '../../store/authSlice';
import { colors, radius, spacing } from '../../theme/colors';
import {
  hasFieldErrors,
  normalizeVietnamesePhone,
  validateRegister,
  type FieldErrors,
} from './validation';

interface RegisterForm {
  ho_va_ten: string;
  so_dien_thoai: string;
  email: string;
  mat_khau: string;
  xac_nhan_mat_khau: string;
}

const initialForm: RegisterForm = {
  ho_va_ten: '',
  so_dien_thoai: '',
  email: '',
  mat_khau: '',
  xac_nhan_mat_khau: '',
};

export function RegisterScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const [form, setForm] = useState<RegisterForm>(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);

  const updateField = (field: keyof RegisterForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    dispatch(clearAuthError());
  };

  const fieldError = (field: keyof RegisterForm) => errors[field] ?? auth.fieldErrors[field];

  const handleSubmit = async () => {
    const localErrors = validateRegister(form);
    setErrors(localErrors);

    if (hasFieldErrors(localErrors)) {
      return;
    }

    dispatch(clearAuthError());
    await dispatch(
      register({
        ho_va_ten: form.ho_va_ten.trim(),
        so_dien_thoai: normalizeVietnamesePhone(form.so_dien_thoai),
        email: form.email.trim() || undefined,
        mat_khau: form.mat_khau,
        xac_nhan_mat_khau: form.xac_nhan_mat_khau,
      }),
    );
  };

  return (
    <Screen scroll keyboardAvoiding style={styles.screen} contentContainerStyle={styles.content}>
      <StatusBar style="light" />
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          hitSlop={12}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </Pressable>
      </View>

      <BrandMark subtitle="Tạo tài khoản khách hàng mới" light />

      <View style={styles.card}>
        <View style={styles.heading}>
          <Text style={styles.title}>Bắt đầu hành trình</Text>
          <Text style={styles.subtitle}>Thông tin của bạn được bảo mật và chỉ dùng để đặt vé.</Text>
        </View>

        {auth.error ? <InlineNotice tone="error" message={auth.error} /> : null}

        <TextField
          label="Họ và tên"
          placeholder="Nguyễn Văn An"
          value={form.ho_va_ten}
          onChangeText={(value) => updateField('ho_va_ten', value)}
          autoCapitalize="words"
          textContentType="name"
          error={fieldError('ho_va_ten')}
          testID="register-name"
        />

        <TextField
          label="Số điện thoại"
          placeholder="0901234567"
          value={form.so_dien_thoai}
          onChangeText={(value) => updateField('so_dien_thoai', value)}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          error={fieldError('so_dien_thoai')}
          testID="register-phone"
        />

        <TextField
          label="Email (không bắt buộc)"
          placeholder="ban@example.com"
          value={form.email}
          onChangeText={(value) => updateField('email', value)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          error={fieldError('email')}
          testID="register-email"
        />

        <View>
          <TextField
            label="Mật khẩu"
            placeholder="Ít nhất 8 ký tự"
            value={form.mat_khau}
            onChangeText={(value) => updateField('mat_khau', value)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            error={fieldError('mat_khau')}
            testID="register-password"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            hitSlop={10}
            onPress={() => setShowPassword((value) => !value)}
            style={styles.eyeButton}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.muted}
            />
          </Pressable>
        </View>

        <TextField
          label="Xác nhận mật khẩu"
          placeholder="Nhập lại mật khẩu"
          value={form.xac_nhan_mat_khau}
          onChangeText={(value) => updateField('xac_nhan_mat_khau', value)}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          error={fieldError('xac_nhan_mat_khau')}
          testID="register-confirm-password"
        />

        <Button
          title="Tạo tài khoản"
          loading={auth.isSubmitting}
          onPress={() => {
            void handleSubmit();
          }}
          testID="register-submit"
        />

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Đã có tài khoản?</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              dispatch(clearAuthError());
              navigation.navigate('Login');
            }}
          >
            <Text style={styles.loginLink}>Đăng nhập</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.brand,
  },
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  topRow: {
    minHeight: 36,
    justifyContent: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heading: {
    gap: spacing.xs,
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
    top: 38,
    padding: spacing.xs,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  loginText: {
    fontSize: 14,
    color: colors.muted,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand,
  },
});
