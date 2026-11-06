import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROLES,
  ALL_ROLES,
  canAssignRole,
  getLandingPath,
  getRoleLabel,
  isAdminRole,
  isBranchRequiredRole,
  isBranchScopedRole,
  ROLES,
} from './roles';

describe('role helpers', () => {
  it('contains all six system roles in display order', () => {
    expect(ALL_ROLES).toEqual([
      ROLES.QUAN_TRI_VIEN,
      ROLES.QUAN_LY_CHI_NHANH,
      ROLES.NHAN_VIEN_PHONG_VE,
      ROLES.DIEU_HANH,
      ROLES.TAI_XE,
      ROLES.KHACH_HANG,
    ]);
  });

  it('accepts the four management roles', () => {
    expect(ADMIN_ROLES).toHaveLength(4);
    expect(isAdminRole(ROLES.QUAN_TRI_VIEN)).toBe(true);
    expect(isAdminRole(ROLES.QUAN_LY_CHI_NHANH)).toBe(true);
    expect(isAdminRole(ROLES.NHAN_VIEN_PHONG_VE)).toBe(true);
    expect(isAdminRole(ROLES.DIEU_HANH)).toBe(true);
  });

  it('rejects customer and driver roles', () => {
    expect(isAdminRole(ROLES.KHACH_HANG)).toBe(false);
    expect(isAdminRole(ROLES.TAI_XE)).toBe(false);
  });

  it('sends ticket staff to the counter and other roles to the dashboard', () => {
    expect(getLandingPath(ROLES.NHAN_VIEN_PHONG_VE)).toBe('/counter');
    expect(getLandingPath(ROLES.QUAN_TRI_VIEN)).toBe('/dashboard');
    expect(getLandingPath(ROLES.DIEU_HANH)).toBe('/dashboard');
  });

  it('marks branch-scoped roles correctly', () => {
    expect(isBranchScopedRole(ROLES.QUAN_LY_CHI_NHANH)).toBe(true);
    expect(isBranchScopedRole(ROLES.NHAN_VIEN_PHONG_VE)).toBe(true);
    expect(isBranchScopedRole(ROLES.QUAN_TRI_VIEN)).toBe(false);
    expect(isBranchScopedRole(ROLES.DIEU_HANH)).toBe(false);
  });

  it('requires a branch for drivers but not customers', () => {
    expect(isBranchRequiredRole(ROLES.TAI_XE)).toBe(true);
    expect(isBranchRequiredRole(ROLES.DIEU_HANH)).toBe(true);
    expect(isBranchRequiredRole(ROLES.KHACH_HANG)).toBe(false);
    expect(isBranchRequiredRole(ROLES.QUAN_TRI_VIEN)).toBe(false);
  });

  it('lets admins assign every role and limits branch managers', () => {
    for (const role of ALL_ROLES) {
      expect(canAssignRole(ROLES.QUAN_TRI_VIEN, role)).toBe(true);
    }

    expect(canAssignRole(ROLES.QUAN_LY_CHI_NHANH, ROLES.TAI_XE)).toBe(true);
    expect(canAssignRole(ROLES.QUAN_LY_CHI_NHANH, ROLES.KHACH_HANG)).toBe(true);
    expect(canAssignRole(ROLES.QUAN_LY_CHI_NHANH, ROLES.QUAN_TRI_VIEN)).toBe(false);
    expect(canAssignRole(ROLES.TAI_XE, ROLES.KHACH_HANG)).toBe(false);
  });

  it('returns Vietnamese labels', () => {
    expect(getRoleLabel(ROLES.QUAN_TRI_VIEN)).toBe('Quản trị viên');
    expect(getRoleLabel(ROLES.NHAN_VIEN_PHONG_VE)).toBe('Nhân viên phòng vé');
    expect(getRoleLabel(ROLES.TAI_XE)).toBe('Tài xế');
    expect(getRoleLabel(ROLES.KHACH_HANG)).toBe('Khách hàng');
  });
});
