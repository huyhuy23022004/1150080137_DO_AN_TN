import { ALL_ROLES, ROLES, type RoleName } from '../../src/common/constants';
import type {
  AuthRepositoryPort,
  AuthUserRecord,
  CreateUserInput,
  RoleRecord,
  UpdateProfileRecord,
} from '../../src/modules/auth/auth.types';

export interface SeedUserInput {
  ho_va_ten: string;
  so_dien_thoai: string;
  email?: string | null;
  mat_khau_ma_hoa: string;
  ten_vai_tro?: RoleName;
}

export class FakeAuthRepository implements AuthRepositoryPort {
  private readonly users = new Map<string, AuthUserRecord>();
  private readonly roles: RoleRecord[] = ALL_ROLES.map((role, index) => ({
    ma_vai_tro: index + 1,
    ten_vai_tro: role,
  }));
  private nextId = 1;

  public async findRoleByName(roleName: string): Promise<RoleRecord | null> {
    return this.roles.find((role) => role.ten_vai_tro === roleName) ?? null;
  }

  public async findUserByPhone(phone: string): Promise<AuthUserRecord | null> {
    for (const user of this.users.values()) {
      if (user.so_dien_thoai === phone) {
        return { ...user };
      }
    }

    return null;
  }

  public async findUserById(userId: string): Promise<AuthUserRecord | null> {
    const user = this.users.get(userId);
    return user ? { ...user } : null;
  }

  public async phoneExists(phone: string, excludeUserId?: string): Promise<boolean> {
    for (const user of this.users.values()) {
      if (user.so_dien_thoai === phone && user.ma_nguoi_dung !== excludeUserId) {
        return true;
      }
    }

    return false;
  }

  public async emailExists(email: string, excludeUserId?: string): Promise<boolean> {
    for (const user of this.users.values()) {
      if (user.email === email && user.ma_nguoi_dung !== excludeUserId) {
        return true;
      }
    }

    return false;
  }

  public async createUser(input: CreateUserInput): Promise<string> {
    const role = this.roles.find((item) => item.ma_vai_tro === input.ma_vai_tro);
    if (!role) {
      throw new Error('Role not found');
    }

    const id = String(this.nextId);
    this.nextId += 1;

    this.users.set(id, {
      ma_nguoi_dung: id,
      ma_vai_tro: role.ma_vai_tro,
      ma_chi_nhanh: input.ma_chi_nhanh,
      ho_va_ten: input.ho_va_ten,
      so_dien_thoai: input.so_dien_thoai,
      email: input.email,
      mat_khau_ma_hoa: input.mat_khau_ma_hoa,
      trang_thai_tai_khoan: 'HOAT_DONG',
      thoi_gian_tao: new Date().toISOString(),
      ten_vai_tro: role.ten_vai_tro,
    });

    return id;
  }

  public async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    this.users.set(userId, { ...user, mat_khau_ma_hoa: passwordHash });
  }

  public async updateProfile(userId: string, input: UpdateProfileRecord): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    this.users.set(userId, {
      ...user,
      ho_va_ten: input.ho_va_ten,
      so_dien_thoai: input.so_dien_thoai,
      email: input.email,
    });
  }

  public async seedUser(input: SeedUserInput): Promise<AuthUserRecord> {
    const roleName = input.ten_vai_tro ?? ROLES.KHACH_HANG;
    const role = await this.findRoleByName(roleName);
    if (!role) {
      throw new Error('Role not found');
    }

    const id = await this.createUser({
      ma_vai_tro: role.ma_vai_tro,
      ma_chi_nhanh: null,
      ho_va_ten: input.ho_va_ten,
      so_dien_thoai: input.so_dien_thoai,
      email: input.email ?? null,
      mat_khau_ma_hoa: input.mat_khau_ma_hoa,
    });

    const user = await this.findUserById(id);
    if (!user) {
      throw new Error('Seeded user not found');
    }

    return user;
  }

  public async setStatus(userId: string, status: 'HOAT_DONG' | 'KHOA'): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    this.users.set(userId, { ...user, trang_thai_tai_khoan: status });
  }
}
