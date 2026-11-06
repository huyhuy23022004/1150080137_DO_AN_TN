import { Card, Empty, Typography } from 'antd';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <Card className="page-card">
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {title}
      </Typography.Title>
      <Empty description={description ?? 'Chức năng này sẽ được triển khai ở phase tiếp theo'} />
    </Card>
  );
}
