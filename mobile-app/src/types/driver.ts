import type { TripStatus } from './trip';

export interface DriverTripFilters {
  trang_thai?: TripStatus;
  tu_ngay?: string;
  den_ngay?: string;
  page?: number;
  limit?: number;
}
