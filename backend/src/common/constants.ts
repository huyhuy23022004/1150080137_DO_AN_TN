export const ROLES = {
  QUAN_TRI_VIEN: 'QUAN_TRI_VIEN',
  QUAN_LY_CHI_NHANH: 'QUAN_LY_CHI_NHANH',
  NHAN_VIEN_PHONG_VE: 'NHAN_VIEN_PHONG_VE',
  DIEU_HANH: 'DIEU_HANH',
  TAI_XE: 'TAI_XE',
  KHACH_HANG: 'KHACH_HANG',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: readonly RoleName[] = Object.values(ROLES);

export function isRoleName(value: string): value is RoleName {
  return (ALL_ROLES as readonly string[]).includes(value);
}

export const ACCOUNT_STATUS = {
  HOAT_DONG: 'HOAT_DONG',
  KHOA: 'KHOA',
} as const;

export type AccountStatus = (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];

export const TOKEN_TYPE = {
  ACCESS: 'access',
  REFRESH: 'refresh',
} as const;

export type TokenType = (typeof TOKEN_TYPE)[keyof typeof TOKEN_TYPE];

export const DON_DAT_VE_STATUS = {
  CHO_THANH_TOAN: 'CHO_THANH_TOAN',
  DA_THANH_TOAN: 'DA_THANH_TOAN',
  DA_HUY: 'DA_HUY',
} as const;

export const CHI_TIET_VE_STATUS = {
  HIEU_LUC: 'HIEU_LUC',
  DA_HUY: 'DA_HUY',
} as const;

export const TRANG_THAI_SOAT_VE = {
  CHUA_LEN_XE: 'CHUA_LEN_XE',
  DA_LEN_XE: 'DA_LEN_XE',
} as const;

export const CHUYEN_XE_STATUS = {
  SAP_CHAY: 'SAP_CHAY',
  DANG_CHAY: 'DANG_CHAY',
  HOAN_THANH: 'HOAN_THANH',
  HUY: 'HUY',
} as const;

export const PHUONG_THUC_THANH_TOAN = {
  TIEN_MAT: 'TIEN_MAT',
  VNPAY: 'VNPAY',
} as const;

export type PaymentMethod = (typeof PHUONG_THUC_THANH_TOAN)[keyof typeof PHUONG_THUC_THANH_TOAN];

export const TRANG_THAI_THANH_TOAN = {
  CHO_XU_LY: 'CHO_XU_LY',
  THANH_CONG: 'THANH_CONG',
  THAT_BAI: 'THAT_BAI',
} as const;

export type PaymentStatus = (typeof TRANG_THAI_THANH_TOAN)[keyof typeof TRANG_THAI_THANH_TOAN];
