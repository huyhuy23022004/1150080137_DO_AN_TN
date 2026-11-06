import type { Ticket, TicketOrderGroup } from '../types/ticket';

export function groupTicketsByOrder(tickets: Ticket[]): TicketOrderGroup[] {
  const groups = new Map<string, TicketOrderGroup>();

  for (const ticket of tickets) {
    const current = groups.get(ticket.ma_don_ve);

    if (!current) {
      groups.set(ticket.ma_don_ve, {
        ma_don_ve: ticket.ma_don_ve,
        ma_dinh_danh_don: ticket.ma_dinh_danh_don,
        trang_thai_don: ticket.trang_thai_don,
        ten_tuyen: ticket.ten_tuyen,
        tinh_di: ticket.tinh_di,
        tinh_den: ticket.tinh_den,
        thoi_gian_xuat_ben: ticket.thoi_gian_xuat_ben,
        ma_chuyen: ticket.ma_chuyen,
        tickets: [ticket],
        tong_tien: Number(ticket.gia_ve),
        trang_thai_thanh_toan: null,
      });
      continue;
    }

    current.tickets.push(ticket);
    current.tong_tien += Number(ticket.gia_ve);
  }

  return [...groups.values()].sort(
    (left, right) =>
      new Date(right.thoi_gian_xuat_ben).getTime() - new Date(left.thoi_gian_xuat_ben).getTime(),
  );
}
