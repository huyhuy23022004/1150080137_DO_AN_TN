import tripsReducer, { loadMoreTrips, searchTrips } from '../../src/store/tripsSlice';
import type { Trip, TripSearchResult } from '../../src/types/trip';

const trip: Trip = {
  ma_chuyen: 1,
  ma_tuyen: 10,
  ten_tuyen: 'TP. Hồ Chí Minh - Đà Nẵng',
  tinh_di: 'TP. Hồ Chí Minh',
  tinh_den: 'Đà Nẵng',
  ma_xe: 5,
  bien_so_xe: '51B-12345',
  ma_loai_xe: 2,
  ten_loai_xe: 'Giường nằm 2 tầng',
  tong_so_ghe: 40,
  ma_tai_xe: 'ND002',
  ten_tai_xe: 'Trần Văn Bình',
  so_dien_thoai_tai_xe: '0907654321',
  ma_chi_nhanh_tai_xe: 1,
  thoi_gian_xuat_ben: '2026-10-24T01:00:00.000Z',
  thoi_gian_den_du_kien: '2026-10-24T19:00:00.000Z',
  gia_ve_co_ban: '350000',
  trang_thai: 'SAP_CHAY',
  so_ghe_da_dat: 10,
  so_ghe_dang_giu: 2,
  so_ghe_trong: 28,
};

const result: TripSearchResult = {
  items: [trip],
  meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
};

const searchInput = {
  tinh_di: 'TP. Hồ Chí Minh',
  tinh_den: 'Đà Nẵng',
  ngay: '2026-10-24',
};

describe('trips slice', () => {
  it('stores successful search results and the query', () => {
    const pending = tripsReducer(undefined, searchTrips.pending('request-1', searchInput));
    const state = tripsReducer(pending, searchTrips.fulfilled(result, 'request-1', searchInput));

    expect(state.status).toBe('succeeded');
    expect(state.items).toHaveLength(1);
    expect(state.meta.total).toBe(1);
    expect(state.lastQuery).toEqual(searchInput);
  });

  it('marks loading while a search is pending', () => {
    const state = tripsReducer(undefined, searchTrips.pending('request-1', searchInput));

    expect(state.status).toBe('loading');
    expect(state.error).toBeNull();
    expect(state.lastQuery.tinh_den).toBe('Đà Nẵng');
  });

  it('appends additional pages without duplicating trips', () => {
    const loaded = tripsReducer(undefined, searchTrips.fulfilled(result, 'request-1', searchInput));
    const extraTrip: Trip = { ...trip, ma_chuyen: 2 };
    const pageTwo: TripSearchResult = {
      items: [trip, extraTrip],
      meta: { page: 2, limit: 20, total: 21, total_pages: 2 },
    };
    const pending = tripsReducer(loaded, loadMoreTrips.pending('request-2'));
    const state = tripsReducer(pending, loadMoreTrips.fulfilled(pageTwo, 'request-2'));

    expect(state.items).toHaveLength(2);
    expect(state.items[1]?.ma_chuyen).toBe(2);
    expect(state.meta.page).toBe(2);
    expect(state.isLoadingMore).toBe(false);
  });

  it('retains previous results and exposes an error on failure', () => {
    const loaded = tripsReducer(undefined, searchTrips.fulfilled(result, 'request-1', searchInput));
    const state = tripsReducer(
      loaded,
      searchTrips.rejected(null, 'request-2', searchInput, 'Mất kết nối máy chủ'),
    );

    expect(state.status).toBe('failed');
    expect(state.items).toHaveLength(1);
    expect(state.error).toBe('Mất kết nối máy chủ');
  });
});
