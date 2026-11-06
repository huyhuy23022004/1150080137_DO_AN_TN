import { LockOutlined, PhoneOutlined } from '@ant-design/icons';
import { App, Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth.store';
import { getLandingPath } from '@/lib/roles';
import type { LoginInput } from '@/types/auth';

interface LoginLocationState {
  from?: {
    pathname?: string;
  };
}

export function LoginPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const [submitting, setSubmitting] = useState(false);

  const state = location.state as LoginLocationState | null;
  const redirectPath = state?.from?.pathname;

  if (status === 'authenticated' && user) {
    return <Navigate to={redirectPath ?? getLandingPath(user.ten_vai_tro)} replace />;
  }

  async function handleSubmit(values: LoginInput): Promise<void> {
    setSubmitting(true);

    try {
      await login(values);
      const currentUser = useAuthStore.getState().user;
      message.success('Đăng nhập thành công');

      if (currentUser) {
        navigate(redirectPath ?? getLandingPath(currentUser.ten_vai_tro), { replace: true });
      }
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : 'Đăng nhập thất bại, vui lòng thử lại',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <Card className="login-card" styles={{ body: { padding: 32 } }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <span className="brand-mark" style={{ width: 48, height: 48, fontSize: 24 }}>
            F
          </span>
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              FUTA Bus Admin
            </Typography.Title>
            <Typography.Text type="secondary">Hệ thống quản trị vận tải</Typography.Text>
          </div>
        </div>

        <Typography.Paragraph type="secondary">
          Đăng nhập bằng tài khoản quản trị, điều hành hoặc phòng vé.
        </Typography.Paragraph>

        <Form<LoginInput> layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item
            name="so_dien_thoai"
            label="Số điện thoại"
            rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
          >
            <Input
              size="large"
              prefix={<PhoneOutlined />}
              placeholder="0901234567"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="mat_khau"
            label="Mật khẩu"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined />}
              placeholder="Nhập mật khẩu"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 8 }}>
            <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
              Đăng nhập
            </Button>
          </Form.Item>
        </Form>

        <Typography.Text
          type="secondary"
          style={{ display: 'block', textAlign: 'center', fontSize: 12 }}
        >
          Phiên đăng nhập được bảo vệ bằng refresh token HttpOnly.
        </Typography.Text>
      </Card>
    </div>
  );
}
