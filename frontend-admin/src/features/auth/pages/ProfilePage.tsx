import { App, Button, Card, Descriptions, Form, Input, Space, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/endpoints/auth';
import { useAuthStore } from '@/features/auth/auth.store';
import { formatDateTime } from '@/lib/format';
import { getRoleLabel } from '@/lib/roles';
import type { ChangePasswordInput } from '@/types/auth';

interface ChangePasswordFormValues extends ChangePasswordInput {
  xac_nhan_mat_khau_moi: string;
}

export function ProfilePage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    return null;
  }

  async function handleChangePassword(values: ChangePasswordFormValues): Promise<void> {
    setSubmitting(true);

    try {
      const result = await authApi.changePassword(values);
      message.success(result);
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : 'Đổi mật khẩu thất bại, vui lòng thử lại',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="page-card" title="Thông tin cá nhân">
        <Descriptions column={{ xs: 1, sm: 2 }} size="middle">
          <Descriptions.Item label="Họ và tên">{user.ho_va_ten}</Descriptions.Item>
          <Descriptions.Item label="Vai trò">{getRoleLabel(user.ten_vai_tro)}</Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">{user.so_dien_thoai}</Descriptions.Item>
          <Descriptions.Item label="Email">{user.email ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Chi nhánh">
            {user.ma_chi_nhanh ? `#${user.ma_chi_nhanh}` : 'Toàn hệ thống'}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày tạo">
            {formatDateTime(user.thoi_gian_tao)}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card className="page-card" title="Đổi mật khẩu">
        <Typography.Paragraph type="secondary">
          Sau khi đổi mật khẩu, toàn bộ phiên đăng nhập trên các thiết bị sẽ bị thu hồi.
        </Typography.Paragraph>

        <Form<ChangePasswordFormValues>
          layout="vertical"
          onFinish={handleChangePassword}
          requiredMark={false}
          style={{ maxWidth: 480 }}
        >
          <Form.Item
            name="mat_khau_cu"
            label="Mật khẩu hiện tại"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>

          <Form.Item
            name="mat_khau_moi"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu mới' },
              { min: 8, max: 72, message: 'Mật khẩu phải có từ 8 đến 72 ký tự' },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <Form.Item
            name="xac_nhan_mat_khau_moi"
            label="Xác nhận mật khẩu mới"
            dependencies={['mat_khau_moi']}
            rules={[
              { required: true, message: 'Vui lòng xác nhận mật khẩu mới' },
              ({ getFieldValue }) => ({
                validator(_, value: string) {
                  if (!value || getFieldValue('mat_khau_moi') === value) {
                    return Promise.resolve();
                  }

                  return Promise.reject(new Error('Xác nhận mật khẩu không khớp'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={submitting}>
            Đổi mật khẩu
          </Button>
        </Form>
      </Card>
    </Space>
  );
}
