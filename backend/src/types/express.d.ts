import type { RoleName } from '../common/constants';

declare global {
  namespace Express {
    interface AuthUser {
      ma_nguoi_dung: string;
      ho_va_ten: string;
      ten_vai_tro: RoleName;
      ma_chi_nhanh: number | null;
    }

    interface RequestScope {
      all: boolean;
      ma_chi_nhanh: number | null;
    }

    interface Request {
      requestId: string;
      user?: AuthUser;
      scope?: RequestScope;
    }
  }
}

export {};
