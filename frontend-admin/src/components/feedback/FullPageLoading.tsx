import { Spin } from 'antd';

interface FullPageLoadingProps {
  message?: string;
}

export function FullPageLoading({
  message = 'Đang khôi phục phiên đăng nhập...',
}: FullPageLoadingProps) {
  return (
    <div className="full-page-center" style={{ flexDirection: 'column', gap: 16 }}>
      <Spin size="large" />
      <span style={{ color: '#667085' }}>{message}</span>
    </div>
  );
}
