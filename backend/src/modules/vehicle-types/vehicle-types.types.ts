import type { DbExecutor } from '../../db/types';
import type { Pagination } from '../../utils/pagination';

export const SEAT_TYPES = {
  THUONG: 'THUONG',
  VIP: 'VIP',
} as const;

export type SeatType = (typeof SEAT_TYPES)[keyof typeof SEAT_TYPES];

export interface SeatInput {
  ky_hieu_ghe: string;
  tang: number;
  hang: number;
  cot: number;
  loai_cho: SeatType;
}

export interface SeatRecord extends SeatInput {
  ma_ghe: number;
}

export interface VehicleTypeRecord {
  ma_loai_xe: number;
  ten_loai_xe: string;
  so_tang: number;
  tong_so_ghe: number;
  so_do_ghe: SeatRecord[];
}

export interface VehicleTypeListFilters {
  q: string | null;
  pagination: Pagination;
}

export interface CreateVehicleTypeInput {
  ten_loai_xe: string;
  so_tang: number;
  so_do_ghe: SeatInput[];
}

export interface UpdateVehicleTypeInput {
  ten_loai_xe: string;
  so_tang: number;
  so_do_ghe?: SeatInput[];
}

export interface VehicleTypeRepositoryPort {
  list(filters: VehicleTypeListFilters): Promise<{ items: VehicleTypeRecord[]; total: number }>;
  findById(id: number, executor?: DbExecutor): Promise<VehicleTypeRecord | null>;
  nameExists(name: string, excludeId?: number): Promise<boolean>;
  create(
    input: Omit<CreateVehicleTypeInput, 'so_do_ghe'> & { tong_so_ghe: number },
    executor: DbExecutor,
  ): Promise<number>;
  update(
    id: number,
    input: { ten_loai_xe: string; so_tang: number; tong_so_ghe: number },
    executor: DbExecutor,
  ): Promise<void>;
  replaceSeats(id: number, seats: SeatInput[], executor: DbExecutor): Promise<void>;
  delete(id: number): Promise<boolean>;
  hasVehicles(id: number, executor?: DbExecutor): Promise<boolean>;
  hasTickets(id: number, executor?: DbExecutor): Promise<boolean>;
}
