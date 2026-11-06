import type { BookingListFilters } from '@/types/booking';
import type { BranchListFilters } from '@/types/branch';
import type { RouteListFilters } from '@/types/route';
import type { TripListFilters } from '@/types/trip';
import type { UserListFilters } from '@/types/user';
import type { VehicleTypeListFilters } from '@/types/vehicle-type';
import type { VehicleListFilters } from '@/types/vehicle';
import type { RevenueFilters, RevenueTimeFilters } from '@/types/statistics';

export const queryKeys = {
  branches: {
    all: ['branches'] as const,
    list: (filters: BranchListFilters) => ['branches', 'list', filters] as const,
    detail: (id: number) => ['branches', 'detail', id] as const,
    options: ['branches', 'options'] as const,
  },
  users: {
    all: ['users'] as const,
    list: (filters: UserListFilters) => ['users', 'list', filters] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
    roles: ['users', 'roles'] as const,
    drivers: ['users', 'drivers'] as const,
  },
  vehicleTypes: {
    all: ['vehicle-types'] as const,
    list: (filters: VehicleTypeListFilters) => ['vehicle-types', 'list', filters] as const,
    detail: (id: number) => ['vehicle-types', 'detail', id] as const,
    options: ['vehicle-types', 'options'] as const,
  },
  vehicles: {
    all: ['vehicles'] as const,
    list: (filters: VehicleListFilters) => ['vehicles', 'list', filters] as const,
    detail: (id: number) => ['vehicles', 'detail', id] as const,
  },
  routes: {
    all: ['routes'] as const,
    list: (filters: RouteListFilters) => ['routes', 'list', filters] as const,
    detail: (id: number) => ['routes', 'detail', id] as const,
    options: ['routes', 'options'] as const,
  },
  trips: {
    all: ['trips'] as const,
    list: (filters: TripListFilters) => ['trips', 'list', filters] as const,
    detail: (id: number) => ['trips', 'detail', id] as const,
  },
  bookings: {
    all: ['bookings'] as const,
    list: (filters: BookingListFilters) => ['bookings', 'list', filters] as const,
    detail: (id: string) => ['bookings', 'detail', id] as const,
  },
  counter: {
    all: ['counter'] as const,
    trips: (filters: { ma_tuyen?: number; ngay?: string }) =>
      ['counter', 'trips', filters] as const,
    seatMap: (tripId: number) => ['counter', 'seat-map', tripId] as const,
    quote: (tripId: number, seats: string[]) => ['counter', 'quote', tripId, seats] as const,
  },
  statistics: {
    revenue: (filters: RevenueTimeFilters) => ['statistics', 'revenue', filters] as const,
    byRoute: (filters: RevenueFilters) => ['statistics', 'by-route', filters] as const,
    byBranch: (filters: RevenueFilters) => ['statistics', 'by-branch', filters] as const,
  },
};
