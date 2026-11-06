import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../tests/test-utils';
import { holdSeats, releaseSeats } from '@/lib/socket';
import { CounterPage } from './CounterPage';

vi.mock('@/features/routes/hooks', () => ({
  useRouteOptions: () => ({
    data: [
      {
        ma_tuyen: 1,
        ten_tuyen: 'Sai Gon - Da Lat',
        tinh_di: 'TP.HCM',
        tinh_den: 'Lam Dong',
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('../hooks', () => ({
  useCounterTrips: () => ({
    data: [
      {
        ma_chuyen: 101,
        ma_tuyen: 1,
        ten_tuyen: 'Sai Gon - Da Lat',
        tinh_di: 'TP.HCM',
        tinh_den: 'Lam Dong',
        ma_xe: 1,
        bien_so_xe: '51B-289.45',
        ma_loai_xe: 1,
        ten_loai_xe: 'Limousine 34',
        tong_so_ghe: 4,
        ma_tai_xe: 'TX001',
        ten_tai_xe: 'Tran Van Tai',
        so_dien_thoai_tai_xe: '0901000001',
        ma_chi_nhanh_tai_xe: null,
        thoi_gian_xuat_ben: '2026-10-24T00:00:00.000Z',
        thoi_gian_den_du_kien: '2026-10-24T08:00:00.000Z',
        gia_ve_co_ban: '250000.00',
        trang_thai: 'SAP_CHAY',
        so_ghe_da_dat: 0,
        so_ghe_dang_giu: 0,
        so_ghe_trong: 4,
      },
    ],
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCounterTripDetail: () => ({
    data: {
      diem_dung: [
        {
          ma_diem_dung: 1,
          ten_diem_dung: 'Ben xe Mien Tay',
          dia_chi: null,
          loai_diem: 'DON',
          thu_tu_dung: 1,
        },
        {
          ma_diem_dung: 4,
          ten_diem_dung: 'Ben xe Da Lat',
          dia_chi: null,
          loai_diem: 'TRA',
          thu_tu_dung: 4,
        },
      ],
    },
    error: null,
  }),
  useCounterSeatMap: () => ({
    data: {
      ma_chuyen: 101,
      ma_xe: 1,
      bien_so_xe: '51B-289.45',
      ma_loai_xe: 1,
      ten_loai_xe: 'Limousine 34',
      tong_so_ghe: 4,
      so_ghe_trong: 3,
      ghe: [
        {
          ma_ghe: 1,
          ky_hieu_ghe: 'A01',
          tang: 1,
          hang: 1,
          cot: 1,
          loai_cho: 'VIP',
          trang_thai: 'TRONG',
        },
        {
          ma_ghe: 2,
          ky_hieu_ghe: 'A02',
          tang: 1,
          hang: 1,
          cot: 2,
          loai_cho: 'THUONG',
          trang_thai: 'DA_DAT',
        },
        {
          ma_ghe: 3,
          ky_hieu_ghe: 'B01',
          tang: 2,
          hang: 1,
          cot: 1,
          loai_cho: 'THUONG',
          trang_thai: 'TRONG',
        },
      ],
    },
    connected: true,
    connectionError: null,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCounterQuote: () => ({
    data: { tong_tien: '250000.00' },
    isFetching: false,
    error: null,
  }),
  useCreateCounterBooking: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock('@/lib/socket', () => ({
  holdSeats: vi.fn().mockResolvedValue({}),
  releaseSeats: vi.fn().mockResolvedValue(undefined),
  extendSeats: vi.fn().mockResolvedValue({}),
}));

describe('CounterPage', () => {
  it('renders the counter shell and realtime status', () => {
    renderWithProviders(<CounterPage />);

    expect(screen.getByRole('heading', { name: /Phòng vé/ })).toBeInTheDocument();
    expect(screen.getByText(/Realtime đang kết nối/)).toBeInTheDocument();
    expect(screen.getByText(/Chọn chuyến xe để bắt đầu bán vé/)).toBeInTheDocument();
  });

  it('selects a trip and holds a seat through Socket.IO', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CounterPage />);

    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.mouseDown(comboboxes[1]!);

    await user.click(await screen.findByText(/07:00/));

    const seat = await screen.findByRole('button', { name: 'A01' });
    await user.click(seat);

    await waitFor(() => {
      expect(holdSeats).toHaveBeenCalledWith(101, ['A01'], expect.any(String));
    });

    await user.click(seat);

    await waitFor(() => {
      expect(releaseSeats).toHaveBeenCalledWith(101, ['A01'], expect.any(String));
    });
  });
});
