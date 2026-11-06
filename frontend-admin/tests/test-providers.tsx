import { App as AntdApp, ConfigProvider } from 'antd';
import type { ReactNode } from 'react';

export function TestProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#f26522',
          borderRadius: 8,
        },
      }}
    >
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}
