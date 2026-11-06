import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title="404"
      subTitle="Trang bạn tìm kiếm không tồn tại hoặc đã bị di chuyển."
      extra={
        <Button type="primary" onClick={() => navigate('/', { replace: true })}>
          Về trang chính
        </Button>
      }
    />
  );
}
