import type { DbExecutor } from '../../db/types';
import type { RouteStopRecord } from '../routes/routes.types';
import type { SeatRecord } from '../vehicle-types/vehicle-types.types';
import type { Pagination } from '../../utils/pagination';

export const TRIP_STATUS = {
  SAP_CHAY: 'SAP_CHAY',
  DANG_CHAY: 'DANG_CHAY',
  HOAN_THANH: 'HOAN_THANH',
  HUY: 'HUY',
} as const;

export type TripStatus = (typeof TRIP_STATUS)[keyof typeof TRIP_STATUS];

export const TRIP_STATUS_VALUES: readonly TripStatus[] = Object.values(TRIP_STATUS);

export interface TripRecord {
  ma_chuyen: number;
  ma_tuyen: number;
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  ma_xe: number;
  bien_so_xe: string;
  ma_loai_xe: number;
  ten_loai_xe: string;
  tong_so_ghe: number;
  ma_tai_xe: string;
  ten_tai_xe: string;
  so_dien_thoai_tai_xe: string;
  ma_chi_nhanh_tai_xe: number | null;
  thoi_gian_xuat_ben: string;
  thoi_gian_den_du_kien: string;
  gia_ve_co_ban: string;
  trang_thai: TripStatus;
  so_ghe_da_dat: number;
  so_ghe_dang_giu: number;
  so_ghe_trong: number;
}

export interface TripDetailRecord extends TripRecord {
  diem_dung: RouteStopRecord[];
}

export interface TripListFilters {
  tinh_di: string | null;
  tinh_den: string | null;
  ma_tuyen: number | null;
  ma_xe: number | null;
  ma_tai_xe: string | null;
  branchId: number | null;
  trang_thai: TripStatus | null;
  startUtc: string | null;
  endUtc: string | null;
  pagination: Pagination;
}

export interface CreateTripInput {
  ma_tuyen: number;
  ma_xe: number;
  ma_tai_xe: string;
  thoi_gian_xuat_ben: string;
  thoi_gian_den_du_kien: string;
  gia_ve_co_ban: string;
  trang_thai: TripStatus;
}

export type UpdateTripInput = Omit<CreateTripInput, 'trang_thai'>;

export interface TripRouteInfo {
  ma_tuyen: number;
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  thoi_gian_chay_du_kien: number;
  trang_thai: boolean;
}

export interface TripVehicleInfo {
  ma_xe: number;
  ma_loai_xe: number;
  bien_so_xe: string;
  trang_thai: string;
}

export interface TripDriverInfo {
  ma_nguoi_dung: string;
  ho_va_ten: string;
  ten_vai_tro: string;
  trang_thai_tai_khoan: string;
  ma_chi_nhanh: number | null;
}

export interface TripSeatMapSeat extends SeatRecord {
  trang_thai: 'TRONG' | 'DANG_GIU' | 'DA_DAT';
}

export interface TripSeatMap {
  ma_chuyen: number;
  ma_xe: number;
  bien_so_xe: string;
  ma_loai_xe: number;
  ten_loai_xe: string;
  tong_so_ghe: number;
  so_ghe_trong: number;
  ghe: TripSeatMapSeat[];
}

export interface TripRepositoryPort {
  search(filters: TripListFilters): Promise<{ items: TripRecord[]; total: number }>;
  list(filters: TripListFilters): Promise<{ items: TripRecord[]; total: number }>;
  findById(id: number, executor?: DbExecutor): Promise<TripRecord | null>;
  lockTripRow(id: number, executor: DbExecutor): Promise<TripRecord | null>;
  findRouteById(id: number, executor?: DbExecutor): Promise<TripRouteInfo | null>;
  findVehicleById(id: number, executor?: DbExecutor): Promise<TripVehicleInfo | null>;
  findDriverById(id: string, executor?: DbExecutor): Promise<TripDriverInfo | null>;
  lockRoute(id: number, executor: DbExecutor): Promise<TripRouteInfo | null>;
  lockVehicle(id: number, executor: DbExecutor): Promise<TripVehicleInfo | null>;
  lockDriver(id: string, executor: DbExecutor): Promise<TripDriverInfo | null>;
  findRouteStops(routeId: number, executor?: DbExecutor): Promise<RouteStopRecord[]>;
  findSeatLayout(vehicleTypeId: number, executor?: DbExecutor): Promise<SeatRecord[]>;
  findVehicleConflict(
    vehicleId: number,
    startUtc: string,
    endUtc: string,
    excludeId: number | null,
    executor: DbExecutor,
  ): Promise<number | null>;
  findDriverConflict(
    driverId: string,
    startUtc: string,
    endUtc: string,
    excludeId: number | null,
    executor: DbExecutor,
  ): Promise<number | null>;
  create(input: CreateTripInput, executor: DbExecutor): Promise<number>;
  update(id: number, input: UpdateTripInput, executor: DbExecutor): Promise<void>;
  updateStatus(id: number, status: TripStatus): Promise<void>;
  delete(id: number): Promise<boolean>;
  countTickets(id: number, executor?: DbExecutor): Promise<number>;
  findBookedSeatCodes(tripId: number, executor?: DbExecutor): Promise<Set<string>>;
  findHeldSeatCodes(tripId: number, executor?: DbExecutor): Promise<Set<string>>;
}
