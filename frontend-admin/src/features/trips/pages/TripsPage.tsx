import {
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  DatePicker,
  Dropdown,
  Empty,
  Form,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Typography,
  type MenuProps,
  type TableColumnsType,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryErrorAlert } from '@/components/common/QueryErrorAlert';
import { TableToolbar } from '@/components/common/TableToolbar';
import { TripStatusTag } from '@/components/common/StatusTag';
import { useAuthStore } from '@/features/auth/auth.store';
import { useRouteOptions } from '@/features/routes/hooks';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';
import type { Trip, TripInput, TripStatus } from '@/types/trip';
import {
  useChangeTripStatus,
  useCreateTrip,
  useDeleteTrip,
  useDriverOptions,
  useTrips,
  useUpdateTrip,
  useVehicleOptions,
} from '../hooks';

dayjs.extend(utc);

interface PaginationState {
  page: number;
  limit: number;
}

interface TripFormValues {
  ma_tuyen: number;
  ma_xe: number;
  ma_tai_xe: string;
  thoi_gian_xuat_ben: Dayjs;
  thoi_gian_den_du_kien: Dayjs;
  gia_ve_co_ban: number;
}

const STATUS_OPTIONS: Array<{ value: TripStatus; label: string }> = [
  { value: 'SAP_CHAY', label: 'Sắp chạy' },
  { value: 'DANG_CHAY', label: 'Đang chạy' },
  { value: 'HOAN_THANH', label: 'Hoàn thành' },
  { value: 'HUY', label: 'Đã hủy' },
];

function toVnTime(value: string): Dayjs {
  return dayjs.utc(value).utcOffset(7);
}

function toIsoWithOffset(value: Dayjs): string {
  return `${value.format('YYYY-MM-DDTHH:mm:ss')}+07:00`;
}

function routeLabel(route: { ten_tuyen: string; tinh_di: string; tinh_den: string }): string {
  return `${route.ten_tuyen} (${route.tinh_di} → ${route.tinh_den})`;
}

export function TripsPage() {
  const { message, modal } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const [form] = Form.useForm<TripFormValues>();
  const [routeFilter, setRouteFilter] = useState<number | undefined>();
  const [statusFilter, setStatusFilter] = useState<TripStatus | undefined>();
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, limit: 20 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);

  const filters = useMemo(
    () => ({
      ...(routeFilter ? { ma_tuyen: routeFilter } : {}),
      ...(statusFilter ? { trang_thai: statusFilter } : {}),
      ...(dateRange
        ? {
            tu_ngay: dateRange[0].format('YYYY-MM-DD'),
            den_ngay: dateRange[1].format('YYYY-MM-DD'),
          }
        : {}),
      page: pagination.page,
      limit: pagination.limit,
    }),
    [dateRange, pagination, routeFilter, statusFilter],
  );

  const tripsQuery = useTrips(filters);
  const routesQuery = useRouteOptions();
  const vehiclesQuery = useVehicleOptions();
  const driversQuery = useDriverOptions();
  const createMutation = useCreateTrip();
  const updateMutation = useUpdateTrip();
  const statusMutation = useChangeTripStatus();
  const deleteMutation = useDeleteTrip();
  const submitting = createMutation.isPending || updateMutation.isPending;

  if (!user) {
    return null;
  }

  function openCreate(): void {
    const departure = dayjs().add(1, 'hour').minute(0).second(0).millisecond(0);
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      thoi_gian_xuat_ben: departure,
      thoi_gian_den_du_kien: departure.add(4, 'hour'),
      gia_ve_co_ban: 200_000,
    });
    setOpen(true);
  }

  function openEdit(record: Trip): void {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({
      ma_tuyen: record.ma_tuyen,
      ma_xe: record.ma_xe,
      ma_tai_xe: record.ma_tai_xe,
      thoi_gian_xuat_ben: toVnTime(record.thoi_gian_xuat_ben),
      thoi_gian_den_du_kien: toVnTime(record.thoi_gian_den_du_kien),
      gia_ve_co_ban: Number(record.gia_ve_co_ban),
    });
    setOpen(true);
  }

  function syncArrival(departure: Dayjs | null | undefined): void {
    if (!departure) {
      return;
    }

    const routeId = form.getFieldValue('ma_tuyen') as number | undefined;
    const route = routesQuery.data?.find((item) => item.ma_tuyen === routeId);

    if (route) {
      form.setFieldValue(
        'thoi_gian_den_du_kien',
        departure.add(route.thoi_gian_chay_du_kien, 'minute'),
      );
    }
  }

  async function handleSubmit(): Promise<void> {
    try {
      const values = await form.validateFields();
      const input: TripInput = {
        ma_tuyen: values.ma_tuyen,
        ma_xe: values.ma_xe,
        ma_tai_xe: values.ma_tai_xe,
        thoi_gian_xuat_ben: toIsoWithOffset(values.thoi_gian_xuat_ben),
        thoi_gian_den_du_kien: toIsoWithOffset(values.thoi_gian_den_du_kien),
        gia_ve_co_ban: values.gia_ve_co_ban,
      };

      if (editing) {
        await updateMutation.mutateAsync({ id: editing.ma_chuyen, input });
        message.success('Cập nhật chuyến xe thành công');
      } else {
        await createMutation.mutateAsync({ ...input, trang_thai: 'SAP_CHAY' });
        message.success('Tạo chuyến xe thành công');
      }

      setOpen(false);
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
  }

  async function changeStatus(record: Trip, status: TripStatus): Promise<void> {
    const labels: Record<TripStatus, string> = {
      SAP_CHAY: 'Sắp chạy',
      DANG_CHAY: 'Đang chạy',
      HOAN_THANH: 'Hoàn thành',
      HUY: 'Đã hủy',
    };

    let content = `Chuyển chuyến ${record.ten_tuyen} sang trạng thái ${labels[status]}?`;

    if (status === 'HUY') {
      content = 'Chỉ có thể hủy chuyến chưa có vé. Thao tác này không thể hoàn tác.';
    }

    const confirmed = await modal.confirm({
      title: 'Cập nhật trạng thái chuyến?',
      content,
      okText: 'Xác nhận',
      cancelText: 'Hủy',
      okButtonProps: { danger: status === 'HUY' },
    });

    if (!confirmed) {
      return;
    }

    try {
      await statusMutation.mutateAsync({ id: record.ma_chuyen, status });
      message.success('Đã cập nhật trạng thái chuyến');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Cập nhật trạng thái thất bại');
    }
  }

  async function handleDelete(record: Trip): Promise<void> {
    const confirmed = await modal.confirm({
      title: 'Xóa chuyến xe?',
      content: `Chuyến ${record.ten_tuyen} lúc ${formatDateTime(record.thoi_gian_xuat_ben)} sẽ bị xóa.`,
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(record.ma_chuyen);
      message.success('Đã xóa chuyến xe');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Xóa chuyến xe thất bại');
    }
  }

  function actionsFor(record: Trip): MenuProps['items'] {
    const items: MenuProps['items'] = [];

    if (record.trang_thai === 'SAP_CHAY') {
      items.push({
        key: 'edit',
        icon: <EditOutlined />,
        label: 'Chỉnh sửa',
      });
      items.push({
        key: 'start',
        icon: <PlayCircleOutlined />,
        label: 'Bắt đầu chạy',
      });
      items.push({
        key: 'cancel',
        icon: <StopOutlined />,
        label: 'Hủy chuyến',
        danger: true,
      });
    }

    if (record.trang_thai === 'DANG_CHAY') {
      items.push({
        key: 'complete',
        icon: <StopOutlined />,
        label: 'Hoàn thành chuyến',
      });
    }

    if (record.trang_thai === 'SAP_CHAY' || record.trang_thai === 'HUY') {
      if (items.length > 0) {
        items.push({ type: 'divider' });
      }
      items.push({
        key: 'delete',
        icon: <DeleteOutlined />,
        label: 'Xóa chuyến',
        danger: true,
      });
    }

    return items;
  }

  function handleAction(key: string, record: Trip): void {
    if (key === 'edit') {
      openEdit(record);
    } else if (key === 'start') {
      void changeStatus(record, 'DANG_CHAY');
    } else if (key === 'complete') {
      void changeStatus(record, 'HOAN_THANH');
    } else if (key === 'cancel') {
      void changeStatus(record, 'HUY');
    } else if (key === 'delete') {
      void handleDelete(record);
    }
  }

  const columns: TableColumnsType<Trip> = [
    {
      title: 'Tuyến / Chuyến',
      key: 'tuyen',
      render: (_value, record) => (
        <div>
          <Typography.Text strong>{record.ten_tuyen}</Typography.Text>
          <div className="table-subtext">
            #{record.ma_chuyen} · {record.tinh_di} → {record.tinh_den}
          </div>
        </div>
      ),
    },
    {
      title: 'Khởi hành',
      dataIndex: 'thoi_gian_xuat_ben',
      key: 'thoi_gian_xuat_ben',
      width: 180,
      render: (value: string, record) => (
        <div>
          <div>{formatDateTime(value)}</div>
          <div className="table-subtext">Đến {formatDateTime(record.thoi_gian_den_du_kien)}</div>
        </div>
      ),
    },
    {
      title: 'Xe',
      key: 'xe',
      width: 190,
      render: (_value, record) => (
        <div>
          <Typography.Text strong>{record.bien_so_xe}</Typography.Text>
          <div className="table-subtext">{record.ten_loai_xe}</div>
        </div>
      ),
    },
    {
      title: 'Tài xế',
      key: 'tai_xe',
      width: 180,
      render: (_value, record) => (
        <div>
          <div>{record.ten_tai_xe}</div>
          <div className="table-subtext">{record.so_dien_thoai_tai_xe}</div>
        </div>
      ),
    },
    {
      title: 'Ghế',
      key: 'ghe',
      width: 150,
      render: (_value, record) => (
        <div>
          <div>
            {formatNumber(record.so_ghe_da_dat)}/{formatNumber(record.tong_so_ghe)} đã đặt
          </div>
          <div className="table-subtext">
            Giữ {formatNumber(record.so_ghe_dang_giu)} · Trống {formatNumber(record.so_ghe_trong)}
          </div>
        </div>
      ),
    },
    {
      title: 'Giá vé',
      dataIndex: 'gia_ve_co_ban',
      key: 'gia_ve_co_ban',
      width: 140,
      render: (value: string) => formatCurrency(value),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      key: 'trang_thai',
      width: 130,
      render: (value: TripStatus) => <TripStatusTag status={value} />,
    },
    {
      title: '',
      key: 'actions',
      width: 64,
      render: (_value, record) => {
        const items = actionsFor(record);

        return items && items.length > 0 ? (
          <Dropdown
            trigger={['click']}
            menu={{ items, onClick: ({ key }) => handleAction(key, record) }}
          >
            <Button type="text" icon={<MoreOutlined />} aria-label="Thao tác chuyến xe" />
          </Dropdown>
        ) : null;
      },
    },
  ];

  function resetFilters(): void {
    setRouteFilter(undefined);
    setStatusFilter(undefined);
    setDateRange(null);
    setPagination((current) => ({ ...current, page: 1 }));
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeader
        title="Chuyến xe"
        description="Lập lịch chuyến, phân công xe và tài xế, theo dõi trạng thái vận hành."
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm chuyến xe
          </Button>
        }
      />

      <Card className="page-card">
        <TableToolbar
          left={
            <Space wrap>
              <Select<number>
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Tuyến đường"
                style={{ width: 280 }}
                value={routeFilter}
                loading={routesQuery.isFetching}
                options={(routesQuery.data ?? []).map((route) => ({
                  value: route.ma_tuyen,
                  label: routeLabel(route),
                }))}
                onChange={(value) => {
                  setRouteFilter(value);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
              />
              <Select<TripStatus>
                allowClear
                placeholder="Trạng thái"
                style={{ width: 160 }}
                value={statusFilter}
                options={STATUS_OPTIONS}
                onChange={(value) => {
                  setStatusFilter(value);
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
              <Button onClick={resetFilters}>Xóa lọc</Button>
            </Space>
          }
          right={
            <Button
              icon={<ReloadOutlined />}
              loading={tripsQuery.isFetching}
              onClick={() => void tripsQuery.refetch()}
            >
              Làm mới
            </Button>
          }
        />

        {tripsQuery.isError ? (
          <QueryErrorAlert
            error={tripsQuery.error}
            title="Không thể tải danh sách chuyến xe"
            onRetry={() => void tripsQuery.refetch()}
          />
        ) : (
          <Table<Trip>
            rowKey="ma_chuyen"
            columns={columns}
            dataSource={tripsQuery.data?.items ?? []}
            loading={tripsQuery.isFetching}
            scroll={{ x: 1180 }}
            locale={{ emptyText: <Empty description="Chưa có chuyến xe" /> }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: tripsQuery.data?.meta.total ?? 0,
              showSizeChanger: true,
              showTotal: (total) => `${total} chuyến`,
              onChange: (page, pageSize) => setPagination({ page, limit: pageSize }),
            }}
          />
        )}
      </Card>

      <Modal
        title={editing ? 'Cập nhật chuyến xe' : 'Thêm chuyến xe'}
        open={open}
        width={760}
        forceRender
        okText={editing ? 'Cập nhật' : 'Tạo chuyến'}
        cancelText="Hủy"
        confirmLoading={submitting}
        onOk={() => void handleSubmit()}
        onCancel={() => setOpen(false)}
      >
        <Form<TripFormValues> form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="ma_tuyen"
            label="Tuyến đường"
            rules={[{ required: true, message: 'Vui lòng chọn tuyến đường' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              loading={routesQuery.isFetching}
              placeholder="Chọn tuyến đường"
              options={(routesQuery.data ?? []).map((route) => ({
                value: route.ma_tuyen,
                label: routeLabel(route),
              }))}
              onChange={() => syncArrival(form.getFieldValue('thoi_gian_xuat_ben'))}
            />
          </Form.Item>

          <div className="form-grid">
            <Form.Item
              name="ma_xe"
              label="Xe"
              rules={[{ required: true, message: 'Vui lòng chọn xe' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                loading={vehiclesQuery.isFetching}
                placeholder="Chọn xe đang hoạt động"
                options={(vehiclesQuery.data ?? []).map((vehicle) => ({
                  value: vehicle.ma_xe,
                  label: `${vehicle.bien_so_xe} · ${vehicle.ten_loai_xe} (${vehicle.tong_so_ghe} ghế)`,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="ma_tai_xe"
              label="Tài xế"
              rules={[{ required: true, message: 'Vui lòng chọn tài xế' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                loading={driversQuery.isFetching}
                placeholder="Chọn tài xế đang hoạt động"
                options={(driversQuery.data ?? []).map((driver) => ({
                  value: driver.ma_nguoi_dung,
                  label: `${driver.ho_va_ten} · ${driver.so_dien_thoai}`,
                }))}
              />
            </Form.Item>
          </div>

          <div className="form-grid">
            <Form.Item
              name="thoi_gian_xuat_ben"
              label="Giờ xuất bến"
              rules={[{ required: true, message: 'Vui lòng chọn giờ xuất bến' }]}
            >
              <DatePicker
                showTime={{ format: 'HH:mm' }}
                format="DD/MM/YYYY HH:mm"
                style={{ width: '100%' }}
                onChange={(value) => syncArrival(value)}
              />
            </Form.Item>

            <Form.Item
              name="thoi_gian_den_du_kien"
              label="Giờ đến dự kiến"
              dependencies={['thoi_gian_xuat_ben']}
              rules={[
                { required: true, message: 'Vui lòng chọn giờ đến dự kiến' },
                ({ getFieldValue }) => ({
                  validator: async (_rule, value: Dayjs | null) => {
                    const departure = getFieldValue('thoi_gian_xuat_ben') as Dayjs | null;
                    if (value && departure && !value.isAfter(departure)) {
                      throw new Error('Giờ đến phải sau giờ xuất bến');
                    }
                  },
                }),
              ]}
            >
              <DatePicker
                showTime={{ format: 'HH:mm' }}
                format="DD/MM/YYYY HH:mm"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </div>

          <Form.Item
            name="gia_ve_co_ban"
            label="Giá vé cơ bản"
            rules={[{ required: true, message: 'Vui lòng nhập giá vé' }]}
            extra="Giá vé áp dụng cho ghế thường; ghế VIP có thể được cấu hình giá riêng ở module bán vé."
          >
            <InputNumber
              min={1000}
              max={999_999_999}
              step={10_000}
              addonAfter="đ"
              style={{ width: '100%' }}
            />
          </Form.Item>

          {!editing ? (
            <Typography.Text type="secondary">
              Chuyến mới được tạo ở trạng thái Sắp chạy. Dùng menu thao tác để bắt đầu hoặc hủy
              chuyến.
            </Typography.Text>
          ) : null}
        </Form>
      </Modal>
    </Space>
  );
}
