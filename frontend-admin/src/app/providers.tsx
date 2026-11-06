import { QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { type ReactNode, useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { FullPageLoading } from '@/components/feedback/FullPageLoading';
import { useAuthStore } from '@/features/auth/auth.store';
import { createQueryClient } from './query-client';

interface AppProvidersProps {
  children: ReactNode;
}

function AuthGate({ children }: AppProvidersProps) {
  const status = useAuthStore((state) => state.status);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (status === 'bootstrapping') {
    return <FullPageLoading />;
  }

  return <>{children}</>;
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={viVN}
        theme={{
          token: {
            colorPrimary: '#f26522',
            colorLink: '#f26522',
            borderRadius: 8,
            fontFamily: "'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          },
          components: {
            Layout: {
              headerBg: '#ffffff',
              siderBg: '#111827',
            },
            Menu: {
              darkItemBg: '#111827',
              darkItemSelectedBg: '#f26522',
            },
          },
        }}
      >
        <AntdApp>
          <BrowserRouter>
            <AuthGate>{children}</AuthGate>
          </BrowserRouter>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
