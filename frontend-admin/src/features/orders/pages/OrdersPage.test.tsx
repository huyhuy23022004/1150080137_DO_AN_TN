import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../tests/test-utils';
import { OrdersPage } from './OrdersPage';

vi.mock('@/features/auth/auth.store', () => ({
  useAuthStore: (selector: (state: { user: { ten_vai_tro: string } | null }) => unknown): unknown =>
    selector({ user: { ten_vai_tro: 'QUAN_TRI_VIEN' } }),
}));

vi.mock('../hooks', () => ({
  useBookings: () => ({
    data: {
      items: [
        {
          ma_don_ve: 'DV001',
          ma_dinh_danh_don: 'BK001',
          ma_khach_hang: null,
          ho_ten_khach: 'Nguyen Van A',
          so_dien_thoai_khach: '0901234567',
          email_khach: null,
          ma_nhan_vien_ban: null,
          ma_chi_nhanh_ban: null,
          ten_chi_nhanh: null,
          ma_chuyen: 101,
          ma_tuyen: 1,
          ten_tuyen: 'Sai Gon - Da Lat',
          tinh_di: 'TP.HCM',
          tinh_den: 'Lam Dong',
          thoi_gian_xuat_ben: '2026-10-24T01:00:00.000Z',
          danh_sach_ghe: ['A01', 'A02'],
          so_ve: 2,
          tong_tien: '500000.00',
          trang_thai_don: 'CHO_THANH_TOAN',
          phuong_thuc_thanh_toan: 'TIEN_MAT',
          trang_thai_thanh_toan: 'CHO_XU_LY',
          thoi_gian_tao: '2026-10-23T01:00:00.000Z',
          thoi_gian_het_han: '2026-10-23T01:15:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    },
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useBookingDetail: () => ({
    data: {
      ma_don_ve: 'DV001',
      ma_dinh_danh_don: 'BK001',
      ma_chuyen: 101,
      ma_khach_hang: null,
      ho_ten_khach: 'Nguyen Van A',
      so_dien_thoai_khach: '0901234567',
      email_khach: 'a@example.com',
      ma_nhan_vien_ban: null,
      ma_chi_nhanh_ban: null,
      ma_diem_don: 1,
      ma_diem_tra: 4,
      tong_tien: '500000.00',
      trang_thai_don: 'CHO_THANH_TOAN',
      thoi_gian_tao: '2026-10-23T01:00:00.000Z',
      chi_tiet_ve: [
        {
          ma_ve: 'VE001',
          ma_chuyen: 101,
          ma_ghe: 1,
          ky_hieu_ghe: 'A01',
          gia_ve: '250000.00',
          ma_qr_kiem_tra: 'qr-1',
          trang_thai_soat_ve: 'CHUA_SOAT',
          trang_thai_ve: 'HIEU_LUC',
        },
      ],
      thanh_toan: [
        {
          ma_thanh_toan: 'TT001',
          phuong_thuc: 'TIEN_MAT',
          ma_giao_dich_vnpay: null,
          so_tien: '500000.00',
          trang_thai: 'CHO_XU_LY',
          thoi_gian_thanh_toan: null,
        },
      ],
      thoi_gian_het_han: '2026-10-23T01:15:00.000Z',
    },
    isError: false,
    error: null,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useCancelBooking: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useConfirmCashBooking: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('OrdersPage', () => {
  it('renders booking rows and opens the detail drawer', async () => {
    const user = userEvent.setup();

    renderWithProviders(<OrdersPage />);

    expect(await screen.findByText('BK001')).toBeInTheDocument();
    expect(screen.getByText('Nguyen Van A')).toBeInTheDocument();
    expect(screen.getByText('0901234567')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Xem/ }));

    expect(await screen.findByText(/#101/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thu ti/ })).toBeInTheDocument();
  });
});
