import type { Ticket } from '../../src/types/ticket';
import { groupTicketsByOrder } from '../../src/utils/tickets';

function makeTicket(overrides: Partial<Ticket>): Ticket {
  return {
    ma_ve: 'VE001',
    ma_don_ve: 'DON001',
    ma_dinh_danh_don: 'FUTA001',
    ma_chuyen: 1,
    ma_ghe: 1,
    ky_hieu_ghe: 'A01',
    gia_ve: '150000',
    ma_qr_kiem_tra: 'token-1',
    trang_thai_soat_ve: 'CHUA_LEN_XE',
    thoi_gian_soat_ve: null,
    tai_xe_soat_ve: null,
    trang_thai_ve: 'DA_THANH_TOAN',
    ma_khach_hang: 'ND001',
    ho_ten_khach: 'Nguyễn Văn An',
    so_dien_thoai_khach: '0901234567',
    email_khach: null,
    ma_chi_nhanh_ban: null,
    trang_thai_don: 'DA_THANH_TOAN',
    thoi_gian_tao: '2026-10-20T03:00:00.000Z',
    thoi_gian_xuat_ben: '2026-10-25T01:00:00.000Z',
    trang_thai_chuyen: 'SAP_CHAY',
    ma_tai_xe: 'TX001',
    ten_tuyen: 'Đà Nẵng - Huế',
    tinh_di: 'Đà Nẵng',
    tinh_den: 'Huế',
    bien_so_xe: '43B-12345',
    ten_tai_xe: 'Trần Văn Bình',
    ...overrides,
  };
}

describe('groupTicketsByOrder', () => {
  it('returns an empty list when there are no tickets', () => {
    expect(groupTicketsByOrder([])).toEqual([]);
  });

  it('groups tickets by order and sums the ticket prices', () => {
    const tickets = [
      makeTicket({ ma_ve: 'VE001', ma_ghe: 1, ky_hieu_ghe: 'A01' }),
      makeTicket({
        ma_ve: 'VE002',
        ma_ghe: 2,
        ky_hieu_ghe: 'A02',
        gia_ve: '200000',
      }),
      makeTicket({
        ma_ve: 'VE003',
        ma_don_ve: 'DON002',
        ma_dinh_danh_don: 'FUTA002',
        ma_ghe: 5,
        ky_hieu_ghe: 'B01',
        gia_ve: '100000',
        thoi_gian_xuat_ben: '2026-10-26T01:00:00.000Z',
      }),
    ];

    const groups = groupTicketsByOrder(tickets);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.ma_don_ve).toBe('DON002');
    expect(groups[0]?.tong_tien).toBe(100000);
    expect(groups[1]?.ma_don_ve).toBe('DON001');
    expect(groups[1]?.tickets.map((ticket) => ticket.ky_hieu_ghe)).toEqual(['A01', 'A02']);
    expect(groups[1]?.tong_tien).toBe(350000);
  });

  it('orders groups by departure time, newest first', () => {
    const groups = groupTicketsByOrder([
      makeTicket({
        ma_ve: 'VE001',
        ma_don_ve: 'DON001',
        thoi_gian_xuat_ben: '2026-10-27T01:00:00.000Z',
      }),
      makeTicket({
        ma_ve: 'VE002',
        ma_don_ve: 'DON002',
        thoi_gian_xuat_ben: '2026-10-25T01:00:00.000Z',
      }),
    ]);

    expect(groups.map((group) => group.ma_don_ve)).toEqual(['DON001', 'DON002']);
  });
});
