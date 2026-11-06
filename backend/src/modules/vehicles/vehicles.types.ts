import type { DbExecutor } from '../../db/types';
import type { Pagination } from '../../utils/pagination';

export const VEHICLE_STATUS = {
  HOAT_DONG: 'HOAT_DONG',
  BAO_DUONG: 'BAO_DUONG',
  DANG_CHAY: 'DANG_CHAY',
} as const;

export type VehicleStatus = (typeof VEHICLE_STATUS)[keyof typeof VEHICLE_STATUS];

export const VEHICLE_STATUSES: readonly VehicleStatus[] = Object.values(VEHICLE_STATUS);

export interface VehicleRecord {
  ma_xe: number;
  ma_loai_xe: number;
  ten_loai_xe: string;
  tong_so_ghe: number;
  bien_so_xe: string;
  hang_san_xuat: string | null;
  trang_thai: VehicleStatus;
}

export interface VehicleListFilters {
  q: string | null;
  ma_loai_xe: number | null;
  trang_thai: VehicleStatus | null;
  pagination: Pagination;
}

export interface CreateVehicleInput {
  ma_loai_xe: number;
  bien_so_xe: string;
  hang_san_xuat: string | null;
  trang_thai: VehicleStatus;
}

export type UpdateVehicleInput = CreateVehicleInput;

export interface VehicleRepositoryPort {
  list(filters: VehicleListFilters): Promise<{ items: VehicleRecord[]; total: number }>;
  findById(id: number, executor?: DbExecutor): Promise<VehicleRecord | null>;
  plateExists(plate: string, excludeId?: number): Promise<boolean>;
  vehicleTypeExists(id: number, executor?: DbExecutor): Promise<boolean>;
  create(input: CreateVehicleInput, executor?: DbExecutor): Promise<number>;
  update(id: number, input: UpdateVehicleInput, executor?: DbExecutor): Promise<void>;
  delete(id: number): Promise<boolean>;
  hasTrips(id: number, executor?: DbExecutor): Promise<boolean>;
}
