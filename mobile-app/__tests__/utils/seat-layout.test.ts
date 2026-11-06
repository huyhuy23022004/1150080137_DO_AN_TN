import type { TripSeat } from '../../src/types/trip';
import { floorLabel, groupSeatsByFloor } from '../../src/utils/seat-layout';

function seat(
  ma_ghe: number,
  ky_hieu_ghe: string,
  tang: number,
  hang: number,
  cot: number,
): TripSeat {
  return {
    ma_ghe,
    ky_hieu_ghe,
    tang,
    hang,
    cot,
    loai_cho: 'THUONG',
    trang_thai: 'TRONG',
  };
}

describe('seat layout', () => {
  it('groups seats by floor and row in display order', () => {
    const floors = groupSeatsByFloor([
      seat(4, 'B02', 2, 2, 2),
      seat(1, 'A01', 1, 2, 1),
      seat(2, 'A02', 1, 1, 2),
      seat(3, 'A03', 1, 1, 1),
    ]);

    expect(floors).toHaveLength(2);
    expect(floors[0]?.tang).toBe(1);
    expect(floors[0]?.total).toBe(3);
    expect(floors[0]?.rows.map((row) => row.hang)).toEqual([1, 2]);
    expect(floors[0]?.rows[0]?.seats.map((item) => item.ky_hieu_ghe)).toEqual(['A03', 'A02']);
    expect(floors[1]?.rows[0]?.seats[0]?.ky_hieu_ghe).toBe('B02');
  });

  it('returns friendly floor labels', () => {
    expect(floorLabel(1)).toBe('Tầng dưới (A)');
    expect(floorLabel(2)).toBe('Tầng trên (B)');
    expect(floorLabel(3)).toBe('Tầng 3');
  });
});
