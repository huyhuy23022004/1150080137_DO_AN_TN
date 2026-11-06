import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { InlineNotice } from '../../components/InlineNotice';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import type { AppStackParamList } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  clearAuthError,
  selectAuth,
  selectCurrentUser,
  updateProfile,
} from '../../store/authSlice';
import { colors, radius, spacing } from '../../theme/colors';
import { normalizeVietnamesePhone } from '../auth/validation';

type Props = NativeStackScreenProps<AppStackParamList, 'EditProfile'>;

interface FormErrors {
  ho_va_ten?: string;
  so_dien_thoai?: string;
  email?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(name: string, phone: string, email: string): FormErrors {
  const errors: FormErrors = {};
  const trimmedName = name.trim();
  const normalizedPhone = normalizeVietnamesePhone(phone);
  const trimmedEmail = email.trim();

  if (trimmedName.length < 2) {
    errors.ho_va_ten = 'Họ và tên phải có ít nhất 2 ký tự.';
  } else if (trimmedName.length > 100) {
    errors.ho_va_ten = 'Họ và tên không được vượt quá 100 ký tự.';
  }

  if (!/^0\d{9}$/.test(normalizedPhone)) {
    errors.so_dien_thoai = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.';
  }

  if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'Email không hợp lệ.';
  }

  return errors;
}

export function EditProfileScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectCurrentUser);
  const [name, setName] = useState(user?.ho_va_ten ?? '');
  const [phone, setPhone] = useState(user?.so_dien_thoai ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  const handleSubmit = async () => {
    const localErrors = validate(name, phone, email);
    setErrors(localErrors);

    if (Object.keys(localErrors).length > 0 || auth.isUpdatingProfile) {
      return;
    }

    const result = await dispatch(
      updateProfile({
        ho_va_ten: name.trim(),
        so_dien_thoai: normalizeVietnamesePhone(phone),
        email: email.trim() ? email.trim() : null,
      }),
    );

    if (updateProfile.fulfilled.match(result)) {
      navigation.goBack();
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Screen scroll keyboardAvoiding contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.heading}>
          <Text style={styles.title}>Chỉnh sửa hồ sơ</Text>
          <Text style={styles.subtitle}>Thông tin này được dùng khi đặt vé và liên hệ hỗ trợ.</Text>
        </View>

        {auth.error ? <InlineNotice tone="error" message={auth.error} /> : null}

        <TextField
          label="Họ và tên"
          placeholder="Nguyễn Văn A"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setErrors((current) => ({ ...current, ho_va_ten: undefined }));
          }}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          error={errors.ho_va_ten ?? auth.fieldErrors.ho_va_ten}
          maxLength={100}
        />

        <TextField
          label="Số điện thoại"
          placeholder="0901234567"
          value={phone}
          onChangeText={(value) => {
            setPhone(value);
            setErrors((current) => ({ ...current, so_dien_thoai: undefined }));
          }}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          error={errors.so_dien_thoai ?? auth.fieldErrors.so_dien_thoai}
          hint="Số điện thoại dùng để đăng nhập, cần duy nhất."
          maxLength={15}
        />

        <TextField
          label="Email"
          placeholder="email@example.com"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          error={errors.email ?? auth.fieldErrors.email}
          hint="Không bắt buộc. Dùng để nhận thông tin vé."
        />

        <View style={styles.codeRow}>
          <Text style={styles.codeLabel}>Mã người dùng</Text>
          <Text style={styles.codeValue}>{user.ma_nguoi_dung}</Text>
        </View>
      </View>

      <Button
        title="Lưu thay đổi"
        loading={auth.isUpdatingProfile}
        onPress={() => {
          void handleSubmit();
        }}
      />
      <Button
        title="Hủy"
        variant="secondary"
        disabled={auth.isUpdatingProfile}
        onPress={() => navigation.goBack()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heading: {
    gap: spacing.xs,
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
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  codeLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  codeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
});
