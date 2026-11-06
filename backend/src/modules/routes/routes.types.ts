import type { DbExecutor } from '../../db/types';
import type { Pagination } from '../../utils/pagination';

export const STOP_TYPES = {
  DON: 'DON',
  TRA: 'TRA',
  TRUNG_CHUYEN: 'TRUNG_CHUYEN',
} as const;

export type StopType = (typeof STOP_TYPES)[keyof typeof STOP_TYPES];

export const STOP_TYPE_VALUES: readonly StopType[] = Object.values(STOP_TYPES);

export interface RouteStopInput {
  ten_diem_dung: string;
  dia_chi: string | null;
  loai_diem: StopType;
  thu_tu_dung: number;
}

export interface RouteStopRecord extends RouteStopInput {
  ma_diem_dung: number;
}

export interface RouteRecord {
  ma_tuyen: number;
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  khoang_cach_km: string;
  thoi_gian_chay_du_kien: number;
  trang_thai: boolean;
  diem_dung: RouteStopRecord[];
}

export interface RouteListFilters {
  q: string | null;
  tinh_di: string | null;
  tinh_den: string | null;
  trang_thai: boolean | null;
  pagination: Pagination;
}

export interface CreateRouteInput {
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  khoang_cach_km: string | number;
  thoi_gian_chay_du_kien: number;
  trang_thai: boolean;
  diem_dung: RouteStopInput[];
}

export interface UpdateRouteInput extends Omit<CreateRouteInput, 'diem_dung'> {
  diem_dung?: RouteStopInput[];
}

export interface RouteRepositoryPort {
  list(filters: RouteListFilters): Promise<{ items: RouteRecord[]; total: number }>;
  findById(id: number, executor?: DbExecutor): Promise<RouteRecord | null>;
  nameExists(name: string, excludeId?: number): Promise<boolean>;
  create(input: Omit<CreateRouteInput, 'diem_dung'>, executor: DbExecutor): Promise<number>;
  update(
    id: number,
    input: Omit<UpdateRouteInput, 'diem_dung'>,
    executor: DbExecutor,
  ): Promise<void>;
  replaceStops(id: number, stops: RouteStopInput[], executor: DbExecutor): Promise<void>;
  delete(id: number): Promise<boolean>;
  hasTrips(id: number, executor?: DbExecutor): Promise<boolean>;
  hasOrders(id: number, executor?: DbExecutor): Promise<boolean>;
}
