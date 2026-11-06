import type { PaginationMeta } from './api';

export type SeatType = 'THUONG' | 'VIP';

export interface Seat {
  ma_ghe?: number;
  ky_hieu_ghe: string;
  tang: number;
  hang: number;
  cot: number;
  loai_cho: SeatType;
}

export interface SeatInput {
  ky_hieu_ghe: string;
  tang: number;
  hang: number;
  cot: number;
  loai_cho: SeatType;
}

export interface VehicleType {
  ma_loai_xe: number;
  ten_loai_xe: string;
  so_tang: number;
  tong_so_ghe: number;
  so_do_ghe: Seat[];
}

export interface VehicleTypeListFilters {
  q?: string;
  page: number;
  limit: number;
}

export interface VehicleTypeListResult {
  items: VehicleType[];
  meta: PaginationMeta;
}

export interface VehicleTypeInput {
  ten_loai_xe: string;
  so_tang: number;
  so_do_ghe: SeatInput[];
}
