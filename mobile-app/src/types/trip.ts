export type TripStatus = 'SAP_CHAY' | 'DANG_CHAY' | 'HOAN_THANH' | 'HUY';
export type SeatAvailability = 'TRONG' | 'DANG_GIU' | 'DA_DAT';
export type SeatType = 'THUONG' | 'VIP';
export type StopType = 'DON' | 'TRA' | 'TRUNG_CHUYEN';

export interface RouteStop {
  ma_diem_dung: number;
  ten_diem_dung: string;
  dia_chi: string | null;
  loai_diem: StopType;
  thu_tu_dung: number;
}

export interface Trip {
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

export interface TripDetail extends Trip {
  diem_dung: RouteStop[];
}

export interface TripSeat {
  ma_ghe: number;
  ky_hieu_ghe: string;
  tang: number;
  hang: number;
  cot: number;
  loai_cho: SeatType;
  trang_thai: SeatAvailability;
}

export interface SeatMap {
  ma_chuyen: number;
  ma_xe: number;
  bien_so_xe: string;
  ma_loai_xe: number;
  ten_loai_xe: string;
  tong_so_ghe: number;
  so_ghe_trong: number;
  ghe: TripSeat[];
}

export interface TripSearchParams {
  tinh_di?: string;
  tinh_den?: string;
  ma_tuyen?: number;
  ngay?: string;
  page?: number;
  limit?: number;
}

export interface TripSearchResult {
  items: Trip[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}
