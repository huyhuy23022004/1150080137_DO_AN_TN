import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { App, Avatar, Button, Dropdown, Layout, Menu, Tag, type MenuProps } from 'antd';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth.store';
import { getRoleLabel } from '@/lib/roles';
import { getRouteByPath, getVisibleRoutes } from '@/app/route-meta';

const { Sider, Header, Content, Footer } = Layout;

export function AdminLayout() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const logoutAll = useAuthStore((state) => state.logoutAll);
  const [collapsed, setCollapsed] = useState(false);

  if (!user) {
    return null;
  }

  const visibleRoutes = getVisibleRoutes(user.ten_vai_tro);
  const currentRoute = getRouteByPath(location.pathname);
  const selectedKeys = currentRoute ? [currentRoute.path] : [];
  const pageTitle =
    currentRoute?.label ?? (location.pathname === '/profile' ? 'Hồ sơ cá nhân' : 'Quản trị');

  const menuItems: MenuProps['items'] = visibleRoutes.map((route) => ({
    key: route.path,
    icon: route.icon,
    label: route.label,
  }));

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Hồ sơ cá nhân',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
    },
    {
      key: 'logout-all',
      icon: <SafetyCertificateOutlined />,
      label: 'Đăng xuất tất cả thiết bị',
      danger: true,
    },
  ];

  async function handleUserMenu(key: string): Promise<void> {
    if (key === 'profile') {
      navigate('/profile');
      return;
    }

    if (key === 'logout') {
      await logout();
      message.success('Đã đăng xuất');
      navigate('/login', { replace: true });
      return;
    }

    if (key === 'logout-all') {
      const confirmed = await modal.confirm({
        title: 'Đăng xuất khỏi tất cả thiết bị?',
        content: 'Tất cả phiên đăng nhập hiện tại sẽ bị thu hồi.',
        okText: 'Đăng xuất',
        cancelText: 'Hủy',
        okButtonProps: { danger: true },
      });

      if (confirmed) {
        await logoutAll();
        message.success('Đã đăng xuất khỏi tất cả thiết bị');
        navigate('/login', { replace: true });
      }
    }
  }

  const avatarText = user.ho_va_ten.trim().charAt(0).toUpperCase() || 'U';
  const branchLabel = user.ma_chi_nhanh ? `Chi nhánh #${user.ma_chi_nhanh}` : 'Toàn hệ thống';

  return (
    <Layout>
      <Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        breakpoint="lg"
        collapsedWidth={64}
        width={232}
        onBreakpoint={setCollapsed}
      >
        <div className="brand-block" style={{ padding: collapsed ? '20px 12px' : '20px 20px' }}>
          <span className="brand-mark">F</span>
          {!collapsed && (
            <div>
              <p className="brand-title">FUTA Bus</p>
              <span className="brand-subtitle">Admin Portal</span>
            </div>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout>
        <Header className="app-header" style={{ height: 64 }}>
          <div className="header-left">
            <Button
              type="text"
              aria-label={collapsed ? 'Mở menu' : 'Thu gọn menu'}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((value) => !value)}
            />
            <h1 className="header-title">{pageTitle}</h1>
          </div>

          <div className="header-right">
            <Tag color={user.ma_chi_nhanh ? 'orange' : 'blue'} style={{ marginInlineEnd: 0 }}>
              {branchLabel}
            </Tag>

            <Dropdown
              menu={{
                items: userMenuItems,
                onClick: ({ key }) => {
                  void handleUserMenu(key);
                },
              }}
              placement="bottomRight"
              trigger={['click']}
            >
              <div className="user-trigger">
                <Avatar style={{ backgroundColor: '#f26522' }}>{avatarText}</Avatar>
                <div className="user-meta">
                  <span className="user-name">{user.ho_va_ten}</span>
                  <span className="user-role">{getRoleLabel(user.ten_vai_tro)}</span>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className="page-content">
          <Outlet />
        </Content>

        <Footer style={{ textAlign: 'center', color: '#98a2b3', fontSize: 12 }}>
          FUTA Bus Admin © {new Date().getFullYear()}
        </Footer>
      </Layout>
    </Layout>
  );
}
