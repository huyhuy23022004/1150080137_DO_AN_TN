export const ROLES = {
  QUAN_TRI_VIEN: 'QUAN_TRI_VIEN',
  QUAN_LY_CHI_NHANH: 'QUAN_LY_CHI_NHANH',
  NHAN_VIEN_PHONG_VE: 'NHAN_VIEN_PHONG_VE',
  DIEU_HANH: 'DIEU_HANH',
  TAI_XE: 'TAI_XE',
  KHACH_HANG: 'KHACH_HANG',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES = [
  ROLES.QUAN_TRI_VIEN,
  ROLES.QUAN_LY_CHI_NHANH,
  ROLES.NHAN_VIEN_PHONG_VE,
  ROLES.DIEU_HANH,
  ROLES.TAI_XE,
  ROLES.KHACH_HANG,
] as const;

export const ADMIN_ROLES = [
  ROLES.QUAN_TRI_VIEN,
  ROLES.QUAN_LY_CHI_NHANH,
  ROLES.NHAN_VIEN_PHONG_VE,
  ROLES.DIEU_HANH,
] as const;

export const BRANCH_REQUIRED_ROLES = [
  ROLES.QUAN_LY_CHI_NHANH,
  ROLES.NHAN_VIEN_PHONG_VE,
  ROLES.DIEU_HANH,
  ROLES.TAI_XE,
] as const;

export const BRANCH_MANAGER_ASSIGNABLE_ROLES = [
  ROLES.NHAN_VIEN_PHONG_VE,
  ROLES.DIEU_HANH,
  ROLES.TAI_XE,
  ROLES.KHACH_HANG,
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ROLE_LABELS: Record<RoleName, string> = {
  QUAN_TRI_VIEN: 'Quản trị viên',
  QUAN_LY_CHI_NHANH: 'Quản lý chi nhánh',
  NHAN_VIEN_PHONG_VE: 'Nhân viên phòng vé',
  DIEU_HANH: 'Điều hành',
  TAI_XE: 'Tài xế',
  KHACH_HANG: 'Khách hàng',
};

export function isAdminRole(role: RoleName): role is AdminRole {
  return (ADMIN_ROLES as readonly RoleName[]).includes(role);
}

export function isBranchScopedRole(role: RoleName): boolean {
  return role === ROLES.QUAN_LY_CHI_NHANH || role === ROLES.NHAN_VIEN_PHONG_VE;
}

export function isBranchRequiredRole(role: RoleName): boolean {
  return (BRANCH_REQUIRED_ROLES as readonly RoleName[]).includes(role);
}

export function canAssignRole(actorRole: RoleName, targetRole: RoleName): boolean {
  if (actorRole === ROLES.QUAN_TRI_VIEN) {
    return true;
  }

  if (actorRole === ROLES.QUAN_LY_CHI_NHANH) {
    return (BRANCH_MANAGER_ASSIGNABLE_ROLES as readonly RoleName[]).includes(targetRole);
  }

  return false;
}

export function getLandingPath(role: RoleName): string {
  return role === ROLES.NHAN_VIEN_PHONG_VE ? '/counter' : '/dashboard';
}

export function getRoleLabel(role: RoleName): string {
  return ROLE_LABELS[role];
}

export function hasAnyRole(role: RoleName, allowed: readonly RoleName[]): boolean {
  return allowed.includes(role);
}

export function canManageBranches(role: RoleName): boolean {
  return role === ROLES.QUAN_TRI_VIEN;
}

export function canManageUsers(role: RoleName): boolean {
  return role === ROLES.QUAN_TRI_VIEN || role === ROLES.QUAN_LY_CHI_NHANH;
}

export function canDeleteUsers(role: RoleName): boolean {
  return role === ROLES.QUAN_TRI_VIEN;
}

export function canManageVehicleTypes(role: RoleName): boolean {
  return role === ROLES.QUAN_TRI_VIEN || role === ROLES.DIEU_HANH;
}

export function canManageVehicles(role: RoleName): boolean {
  return role === ROLES.QUAN_TRI_VIEN || role === ROLES.DIEU_HANH;
}

export function canManageRoutes(role: RoleName): boolean {
  return role === ROLES.QUAN_TRI_VIEN || role === ROLES.DIEU_HANH;
}

export function canConfirmCash(role: RoleName): boolean {
  return (
    role === ROLES.QUAN_TRI_VIEN ||
    role === ROLES.QUAN_LY_CHI_NHANH ||
    role === ROLES.NHAN_VIEN_PHONG_VE
  );
}
