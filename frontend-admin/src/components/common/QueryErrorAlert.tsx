import { ReloadOutlined } from '@ant-design/icons';
import { Alert, Button } from 'antd';

interface QueryErrorAlertProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Vui lòng thử lại sau';
}

export function QueryErrorAlert({ error, title, onRetry }: QueryErrorAlertProps) {
  return (
    <Alert
      type="error"
      showIcon
      message={title ?? 'Không thể tải dữ liệu'}
      description={messageOf(error)}
      action={
        onRetry ? (
          <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>
            Thử lại
          </Button>
        ) : undefined
      }
    />
  );
}
