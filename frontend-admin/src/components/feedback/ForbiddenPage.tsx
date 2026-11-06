import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth.store';
import { getLandingPath, ROLES } from '@/lib/roles';

export function ForbiddenPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const landingPath = getLandingPath(user?.ten_vai_tro ?? ROLES.QUAN_TRI_VIEN);

  return (
    <Result
      status="403"
      title="403"
      subTitle="Bạn không có quyền truy cập chức năng này."
      extra={
        <Button type="primary" onClick={() => navigate(landingPath, { replace: true })}>
          Về trang chính
        </Button>
      }
    />
  );
}
