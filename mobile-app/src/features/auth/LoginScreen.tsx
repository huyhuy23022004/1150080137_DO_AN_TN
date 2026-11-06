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
import { clearAuthError, login, selectAuth } from '../../store/authSlice';
import { colors, radius, spacing } from '../../theme/colors';
import {
  hasFieldErrors,
  normalizeVietnamesePhone,
  validateLogin,
  type FieldErrors,
} from './validation';

export function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const phoneError = errors.so_dien_thoai ?? auth.fieldErrors.so_dien_thoai;
  const passwordError = errors.mat_khau ?? auth.fieldErrors.mat_khau;

  const handleSubmit = async () => {
    const localErrors = validateLogin({ so_dien_thoai: phone, mat_khau: password });
    setErrors(localErrors);

    if (hasFieldErrors(localErrors)) {
      return;
    }

    dispatch(clearAuthError());
    await dispatch(
      login({
        so_dien_thoai: normalizeVietnamesePhone(phone),
        mat_khau: password,
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

      <BrandMark subtitle="Đăng nhập để tiếp tục hành trình" light />

      <View style={styles.card}>
        <View style={styles.heading}>
          <Text style={styles.title}>Chào mừng trở lại</Text>
          <Text style={styles.subtitle}>Nhập số điện thoại và mật khẩu của bạn.</Text>
        </View>

        {auth.error ? <InlineNotice tone="error" message={auth.error} /> : null}
        {auth.warning ? <InlineNotice tone="warning" message={auth.warning} /> : null}

        <TextField
          label="Số điện thoại"
          placeholder="0901234567"
          value={phone}
          onChangeText={(value) => {
            setPhone(value);
            setErrors((current) => ({ ...current, so_dien_thoai: undefined }));
            dispatch(clearAuthError());
          }}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          error={phoneError}
          testID="login-phone"
        />

        <View>
          <TextField
            label="Mật khẩu"
            placeholder="Nhập mật khẩu"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setErrors((current) => ({ ...current, mat_khau: undefined }));
              dispatch(clearAuthError());
            }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            error={passwordError}
            testID="login-password"
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

        <Button
          title="Đăng nhập"
          loading={auth.isSubmitting}
          onPress={() => {
            void handleSubmit();
          }}
          testID="login-submit"
        />

        <View style={styles.registerRow}>
          <Text style={styles.registerText}>Chưa có tài khoản?</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              dispatch(clearAuthError());
              navigation.navigate('Register');
            }}
          >
            <Text style={styles.registerLink}>Đăng ký ngay</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.demoHint}>
        Tài khoản tài xế mẫu có trong tài liệu backend. Bạn cũng có thể tạo tài khoản khách hàng
        mới.
      </Text>
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
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  registerText: {
    fontSize: 14,
    color: colors.muted,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand,
  },
  demoHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.76)',
    textAlign: 'center',
    lineHeight: 18,
  },
});
