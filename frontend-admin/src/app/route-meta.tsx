import {
  ApartmentOutlined,
  AppstoreOutlined,
  CarOutlined,
  DashboardOutlined,
  EnvironmentOutlined,
  FileSearchOutlined,
  ScheduleOutlined,
  ShopOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { ADMIN_ROLES, ROLES, type AdminRole } from '@/lib/roles';

export interface AppRouteMeta {
  path: string;
  label: string;
  icon: ReactNode;
  roles: readonly AdminRole[];
}

export const APP_ROUTES: readonly AppRouteMeta[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: <DashboardOutlined />,
    roles: [ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_CHI_NHANH, ROLES.DIEU_HANH],
  },
  {
    path: '/branches',
    label: 'Chi nhánh',
    icon: <ApartmentOutlined />,
    roles: [ROLES.QUAN_TRI_VIEN],
  },
  {
    path: '/users',
    label: 'Tài khoản',
    icon: <TeamOutlined />,
    roles: [ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_CHI_NHANH, ROLES.DIEU_HANH],
  },
  {
    path: '/vehicle-types',
    label: 'Loại xe',
    icon: <AppstoreOutlined />,
    roles: [ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_CHI_NHANH, ROLES.DIEU_HANH],
  },
  {
    path: '/vehicles',
    label: 'Đội xe',
    icon: <CarOutlined />,
    roles: [ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_CHI_NHANH, ROLES.DIEU_HANH],
  },
  {
    path: '/routes',
    label: 'Tuyến đường',
    icon: <EnvironmentOutlined />,
    roles: [ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_CHI_NHANH, ROLES.DIEU_HANH],
  },
  {
    path: '/trips',
    label: 'Chuyến xe',
    icon: <ScheduleOutlined />,
    roles: [ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_CHI_NHANH, ROLES.DIEU_HANH],
  },
  {
    path: '/counter',
    label: 'Phòng vé',
    icon: <ShopOutlined />,
    roles: [ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_CHI_NHANH, ROLES.NHAN_VIEN_PHONG_VE],
  },
  {
    path: '/orders',
    label: 'Đơn vé',
    icon: <FileSearchOutlined />,
    roles: [
      ROLES.QUAN_TRI_VIEN,
      ROLES.QUAN_LY_CHI_NHANH,
      ROLES.NHAN_VIEN_PHONG_VE,
      ROLES.DIEU_HANH,
    ],
  },
];

export const PROFILE_ROLES: readonly AdminRole[] = ADMIN_ROLES;

export function getVisibleRoutes(role: AdminRole): AppRouteMeta[] {
  return APP_ROUTES.filter((route) => route.roles.includes(role));
}

export function getRouteByPath(pathname: string): AppRouteMeta | undefined {
  return APP_ROUTES.filter(
    (route) => pathname === route.path || pathname.startsWith(`${route.path}/`),
  ).sort((left, right) => right.path.length - left.path.length)[0];
}
