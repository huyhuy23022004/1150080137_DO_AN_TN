import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  type TableColumnsType,
} from 'antd';
import type { Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryErrorAlert } from '@/components/common/QueryErrorAlert';
import { TableToolbar } from '@/components/common/TableToolbar';
import { OrderStatusTag, PaymentStatusTag } from '@/components/common/StatusTag';
import { useAuthStore } from '@/features/auth/auth.store';
import { canConfirmCash } from '@/lib/roles';
import { formatCurrency, formatDateTime } from '@/lib/format';
import type { BookingListItem, OrderStatus, PaymentMethod } from '@/types/booking';
import { useBookingDetail, useBookings, useCancelBooking, useConfirmCashBooking } from '../hooks';

interface PaginationState {
  page: number;
  limit: number;
}

const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'CHO_THANH_TOAN', label: 'Chờ thanh toán' },
  { value: 'DA_THANH_TOAN', label: 'Đã thanh toán' },
  { value: 'DA_HUY', label: 'Đã hủy' },
];

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  TIEN_MAT: 'Tiền mặt',
  VNPAY: 'VNPAY',
};

export function OrdersPage() {
  const { message, modal } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, limit: 20 });
  const [detailId, setDetailId] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      ...(search ? { q: search } : {}),
      ...(status ? { trang_thai_don: status } : {}),
      ...(dateRange
        ? {
            tu_ngay: dateRange[0].format('YYYY-MM-DD'),
            den_ngay: dateRange[1].format('YYYY-MM-DD'),
          }
        : {}),
      page: pagination.page,
      limit: pagination.limit,
    }),
    [dateRange, pagination, search, status],
  );

  const bookingsQuery = useBookings(filters);
  const detailQuery = useBookingDetail(detailId);
  const cancelMutation = useCancelBooking();
  const cashMutation = useConfirmCashBooking();
  const canCash = user ? canConfirmCash(user.ten_vai_tro) : false;
  const detail = detailQuery.data;

  if (!user) {
    return null;
  }

  async function handleCancel(): Promise<void> {
    if (!detail) {
      return;
    }

    const confirmed = await modal.confirm({
      title: 'Hủy đơn vé?',
      content: `Đơn ${detail.ma_dinh_danh_don} sẽ bị hủy và ghế được giải phóng.`,
      okText: 'Hủy đơn',
      cancelText: 'Giữ đơn',
      okButtonProps: { danger: true },
    });

    if (!confirmed) {
      return;
    }

    try {
      await cancelMutation.mutateAsync(detail.ma_don_ve);
      message.success('Đã hủy đơn vé');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Hủy đơn vé thất bại');
    }
  }

  async function handleConfirmCash(): Promise<void> {
    if (!detail) {
      return;
    }

    const confirmed = await modal.confirm({
      title: 'Xác nhận đã thu tiền mặt?',
      content: `Xác nhận đơn ${detail.ma_dinh_danh_don} đã thanh toán ${formatCurrency(detail.tong_tien)}.`,
      okText: 'Xác nhận',
      cancelText: 'Hủy',
    });

    if (!confirmed) {
      return;
    }

    try {
      await cashMutation.mutateAsync(detail.ma_don_ve);
      message.success('Đã xác nhận thanh toán tiền mặt');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Xác nhận thanh toán thất bại');
    }
  }

  const columns: TableColumnsType<BookingListItem> = [
    {
      title: 'Mã đơn',
      dataIndex: 'ma_dinh_danh_don',
      key: 'ma_dinh_danh_don',
      width: 170,
      render: (value: string, record) => (
        <div>
          <Typography.Text strong>{value}</Typography.Text>
          <div className="table-subtext">{formatDateTime(record.thoi_gian_tao)}</div>
        </div>
      ),
    },
    {
      title: 'Khách hàng',
      key: 'khach',
      width: 200,
      render: (_value, record) => (
        <div>
          <div>{record.ho_ten_khach}</div>
          <div className="table-subtext">{record.so_dien_thoai_khach}</div>
        </div>
      ),
    },
    {
      title: 'Chuyến',
      key: 'chuyen',
      render: (_value, record) => (
        <div>
          <div>{record.ten_tuyen ?? '—'}</div>
          <div className="table-subtext">
            {record.thoi_gian_xuat_ben
              ? formatDateTime(record.thoi_gian_xuat_ben)
              : 'Chưa gán chuyến'}
          </div>
        </div>
      ),
    },
    {
      title: 'Ghế',
      key: 'ghe',
      width: 180,
      render: (_value, record) => (
        <Space size={[4, 4]} wrap>
          {record.danh_sach_ghe.map((seat) => (
            <Tag key={seat}>{seat}</Tag>
          ))}
          <Typography.Text type="secondary">({record.so_ve} vé)</Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Thanh toán',
      key: 'thanh_toan',
      width: 170,
      render: (_value, record) => (
        <div>
          <div>{formatCurrency(record.tong_tien)}</div>
          <div className="table-subtext">
            {record.phuong_thuc_thanh_toan
              ? PAYMENT_METHOD_LABELS[record.phuong_thuc_thanh_toan]
              : 'Chưa có giao dịch'}
          </div>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'trang_thai',
      width: 180,
      render: (_value, record) => (
        <Space direction="vertical" size={4}>
          <OrderStatusTag status={record.trang_thai_don} />
          {record.trang_thai_thanh_toan ? (
            <PaymentStatusTag status={record.trang_thai_thanh_toan} />
          ) : null}
        </Space>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 64,
      render: (_value, record) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          aria-label={`Xem đơn ${record.ma_dinh_danh_don}`}
          onClick={() => setDetailId(record.ma_don_ve)}
        />
      ),
    },
  ];

  const canCancel = detail?.trang_thai_don === 'CHO_THANH_TOAN';
  const canCashConfirm =
    canCash &&
    detail?.trang_thai_don === 'CHO_THANH_TOAN' &&
    detail.thanh_toan.some(
      (payment) => payment.phuong_thuc === 'TIEN_MAT' && payment.trang_thai === 'CHO_XU_LY',
    );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeader
        title="Đơn vé"
        description="Tra cứu đơn, xem chi tiết, hủy đơn chờ thanh toán và xác nhận tiền mặt."
      />

      <Card className="page-card">
        <TableToolbar
          left={
            <Space wrap>
              <Input.Search
                allowClear
                placeholder="Mã đơn, tên, số điện thoại..."
                style={{ width: 280 }}
                onSearch={(value) => {
                  setSearch(value.trim());
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
              />
              <Select<OrderStatus>
                allowClear
                placeholder="Trạng thái đơn"
                style={{ width: 180 }}
                value={status}
                options={ORDER_STATUS_OPTIONS}
                onChange={(value) => {
                  setStatus(value);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
              />
              <DatePicker.RangePicker
                value={dateRange}
                format="DD/MM/YYYY"
                placeholder={['Từ ngày', 'Đến ngày']}
                onChange={(values) => {
                  setDateRange(values ? [values[0]!, values[1]!] : null);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
              />
              <Button
                onClick={() => {
                  setSearch('');
                  setStatus(undefined);
                  setDateRange(null);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
              >
                Xóa lọc
              </Button>
            </Space>
          }
          right={
            <Button
              icon={<ReloadOutlined />}
              loading={bookingsQuery.isFetching}
              onClick={() => void bookingsQuery.refetch()}
            >
              Làm mới
            </Button>
          }
        />

        {bookingsQuery.isError ? (
          <QueryErrorAlert
            error={bookingsQuery.error}
            title="Không thể tải danh sách đơn vé"
            onRetry={() => void bookingsQuery.refetch()}
          />
        ) : (
          <Table<BookingListItem>
            rowKey="ma_don_ve"
            columns={columns}
            dataSource={bookingsQuery.data?.items ?? []}
            loading={bookingsQuery.isFetching}
            scroll={{ x: 1200 }}
            locale={{ emptyText: <Empty description="Chưa có đơn vé" /> }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: bookingsQuery.data?.meta.total ?? 0,
              showSizeChanger: true,
              showTotal: (total) => `${total} đơn vé`,
              onChange: (page, pageSize) => setPagination({ page, limit: pageSize }),
            }}
          />
        )}
      </Card>

      <Drawer
        title={detail ? `Đơn ${detail.ma_dinh_danh_don}` : 'Chi tiết đơn vé'}
        open={Boolean(detailId)}
        width={560}
        loading={detailQuery.isFetching}
        onClose={() => setDetailId(null)}
        extra={
          detail ? (
            <Space>
              {canCashConfirm ? (
                <Button
                  type="primary"
                  loading={cashMutation.isPending}
                  onClick={() => void handleConfirmCash()}
                >
                  Thu tiền mặt
                </Button>
              ) : null}
              {canCancel ? (
                <Button
                  danger
                  loading={cancelMutation.isPending}
                  onClick={() => void handleCancel()}
                >
                  Hủy đơn
                </Button>
              ) : null}
            </Space>
          ) : null
        }
      >
        {detailQuery.isError ? (
          <QueryErrorAlert
            error={detailQuery.error}
            title="Không thể tải chi tiết đơn vé"
            onRetry={() => void detailQuery.refetch()}
          />
        ) : detail ? (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {
                  key: 'status',
                  label: 'Trạng thái',
                  children: <OrderStatusTag status={detail.trang_thai_don} />,
                },
                {
                  key: 'customer',
                  label: 'Khách hàng',
                  children: `${detail.ho_ten_khach} · ${detail.so_dien_thoai_khach}`,
                },
                {
                  key: 'email',
                  label: 'Email',
                  children: detail.email_khach ?? '—',
                },
                {
                  key: 'trip',
                  label: 'Chuyến',
                  children: `#${detail.ma_chuyen} · Đón #${detail.ma_diem_don} · Trả #${detail.ma_diem_tra}`,
                },
                {
                  key: 'total',
                  label: 'Tổng tiền',
                  children: (
                    <Typography.Text strong>{formatCurrency(detail.tong_tien)}</Typography.Text>
                  ),
                },
                {
                  key: 'created',
                  label: 'Thời gian tạo',
                  children: formatDateTime(detail.thoi_gian_tao),
                },
                {
                  key: 'expires',
                  label: 'Hết hạn thanh toán',
                  children: formatDateTime(detail.thoi_gian_het_han),
                },
              ]}
            />

            <div>
              <Typography.Title level={5}>Ghế đã đặt</Typography.Title>
              <Space size={[6, 6]} wrap>
                {detail.chi_tiet_ve.map((ticket) => (
                  <Tag
                    key={ticket.ma_ve}
                    color={ticket.trang_thai_ve === 'HIEU_LUC' ? 'blue' : 'red'}
                  >
                    {ticket.ky_hieu_ghe} · {formatCurrency(ticket.gia_ve)}
                  </Tag>
                ))}
              </Space>
            </div>

            <div>
              <Typography.Title level={5}>Thanh toán</Typography.Title>
              {detail.thanh_toan.length === 0 ? (
                <Typography.Text type="secondary">Chưa có giao dịch thanh toán.</Typography.Text>
              ) : (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {detail.thanh_toan.map((payment) => (
                    <Card key={payment.ma_thanh_toan} size="small">
                      <Space wrap>
                        <Typography.Text strong>
                          {PAYMENT_METHOD_LABELS[payment.phuong_thuc]}
                        </Typography.Text>
                        <PaymentStatusTag status={payment.trang_thai} />
                        <Typography.Text>{formatCurrency(payment.so_tien)}</Typography.Text>
                        <Typography.Text type="secondary">
                          {formatDateTime(payment.thoi_gian_thanh_toan)}
                        </Typography.Text>
                      </Space>
                    </Card>
                  ))}
                </Space>
              )}
            </div>
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}
