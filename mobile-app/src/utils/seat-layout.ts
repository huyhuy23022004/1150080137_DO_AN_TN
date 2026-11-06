import type { TripSeat } from '../types/trip';

export interface SeatRow {
  hang: number;
  seats: TripSeat[];
}

export interface SeatFloor {
  tang: number;
  label: string;
  rows: SeatRow[];
  total: number;
}

export function floorLabel(tang: number): string {
  if (tang === 1) {
    return 'Tầng dưới (A)';
  }

  if (tang === 2) {
    return 'Tầng trên (B)';
  }

  return `Tầng ${tang}`;
}

export function groupSeatsByFloor(seats: TripSeat[]): SeatFloor[] {
  const byFloor = new Map<number, TripSeat[]>();

  for (const seat of seats) {
    const current = byFloor.get(seat.tang) ?? [];
    current.push(seat);
    byFloor.set(seat.tang, current);
  }

  return Array.from(byFloor.entries())
    .sort(([left], [right]) => left - right)
    .map(([tang, floorSeats]) => {
      const byRow = new Map<number, TripSeat[]>();

      for (const seat of floorSeats) {
        const current = byRow.get(seat.hang) ?? [];
        current.push(seat);
        byRow.set(seat.hang, current);
      }

      const rows = Array.from(byRow.entries())
        .sort(([left], [right]) => left - right)
        .map(([hang, rowSeats]) => ({
          hang,
          seats: [...rowSeats].sort((left, right) => left.cot - right.cot),
        }));

      return {
        tang,
        label: floorLabel(tang),
        rows,
        total: floorSeats.length,
      };
    });
}
