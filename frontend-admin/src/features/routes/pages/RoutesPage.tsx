import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Timeline,
  Typography,
  type TableColumnsType,
} from 'antd';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryErrorAlert } from '@/components/common/QueryErrorAlert';
import { TableToolbar } from '@/components/common/TableToolbar';
import { ActiveStatusTag, StopTypeTag } from '@/components/common/StatusTag';
import { useAuthStore } from '@/features/auth/auth.store';
import { canManageRoutes } from '@/lib/roles';
import { formatDistance, formatDuration, formatNumber } from '@/lib/format';
import type { Route, RouteInput, RouteStatusFilter, StopType } from '@/types/route';
import { useCreateRoute, useDeleteRoute, useRoutes, useUpdateRoute } from '../hooks';

interface PaginationState {
  page: number;
  limit: number;
}

interface RouteStopFormValues {
  ten_diem_dung: string;
  dia_chi?: string;
  loai_diem: StopType;
}

interface RouteFormValues {
  ten_tuyen: string;
  tinh_di: string;
  tinh_den: string;
  khoang_cach_km: number;
  thoi_gian_chay_du_kien: number;
  trang_thai: boolean;
  diem_dung: RouteStopFormValues[];
}

const STOP_TYPE_OPTIONS: Array<{ value: StopType; label: string }> = [
  { value: 'DON', label: 'Đón khách' },
  { value: 'TRA', label: 'Trả khách' },
  { value: 'TRUNG_CHUYEN', label: 'Trung chuyển' },
];

const STATUS_FILTER_OPTIONS: Array<{ value: RouteStatusFilter; label: string }> = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'true', label: 'Đang hoạt động' },
  { value: 'false', label: 'Ngừng hoạt động' },
];

function emptyStop(type: StopType): RouteStopFormValues {
  return { ten_diem_dung: '', dia_chi: '', loai_diem: type };
}

export function RoutesPage() {
  const { message } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const [form] = Form.useForm<RouteFormValues>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RouteStatusFilter>('all');
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, limit: 20 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Route | null>(null);

  const filters = useMemo(
    () => ({
      ...(search ? { q: search } : {}),
      trang_thai: statusFilter,
      page: pagination.page,
      limit: pagination.limit,
    }),
    [pagination, search, statusFilter],
  );

  const routesQuery = useRoutes(filters);
  const createMutation = useCreateRoute();
  const updateMutation = useUpdateRoute();
  const deleteMutation = useDeleteRoute();
  const canWrite = user ? canManageRoutes(user.ten_vai_tro) : false;
  const submitting = createMutation.isPending || updateMutation.isPending;

  if (!user) {
    return null;
  }

  function openCreate(): void {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      trang_thai: true,
      diem_dung: [emptyStop('DON'), emptyStop('TRA')],
    });
    setOpen(true);
  }

  function openEdit(record: Route): void {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({
      ten_tuyen: record.ten_tuyen,
      tinh_di: record.tinh_di,
      tinh_den: record.tinh_den,
      khoang_cach_km: Number(record.khoang_cach_km),
      thoi_gian_chay_du_kien: record.thoi_gian_chay_du_kien,
      trang_thai: record.trang_thai,
      diem_dung: [...record.diem_dung]
        .sort((left, right) => left.thu_tu_dung - right.thu_tu_dung)
        .map((stop) => ({
          ten_diem_dung: stop.ten_diem_dung,
          dia_chi: stop.dia_chi ?? '',
          loai_diem: stop.loai_diem,
        })),
    });
    setOpen(true);
  }

  async function handleSubmit(): Promise<void> {
    try {
      const values = await form.validateFields();
      const input: RouteInput = {
        ten_tuyen: values.ten_tuyen.trim(),
        tinh_di: values.tinh_di.trim(),
        tinh_den: values.tinh_den.trim(),
        khoang_cach_km: values.khoang_cach_km,
        thoi_gian_chay_du_kien: values.thoi_gian_chay_du_kien,
        trang_thai: values.trang_thai,
        diem_dung: values.diem_dung.map((stop, index) => ({
          ten_diem_dung: stop.ten_diem_dung.trim(),
          dia_chi: stop.dia_chi?.trim() || null,
          loai_diem: stop.loai_diem,
          thu_tu_dung: index + 1,
        })),
      };

      if (editing) {
        await updateMutation.mutateAsync({ id: editing.ma_tuyen, input });
        message.success('Cập nhật tuyến đường thành công');
      } else {
        await createMutation.mutateAsync(input);
        message.success('Tạo tuyến đường thành công');
      }

      setOpen(false);
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
  }

  async function handleDelete(record: Route): Promise<void> {
    try {
      await deleteMutation.mutateAsync(record.ma_tuyen);
      message.success('Đã xóa tuyến đường');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Xóa tuyến đường thất bại');
    }
  }

  const columns: TableColumnsType<Route> = [
    {
      title: 'Tuyến đường',
      dataIndex: 'ten_tuyen',
      key: 'ten_tuyen',
      render: (value: string, record) => (
        <div>
          <Typography.Text strong>{value}</Typography.Text>
          <div className="table-subtext">
            {record.tinh_di} → {record.tinh_den}
          </div>
        </div>
      ),
    },
    {
      title: 'Khoảng cách',
      dataIndex: 'khoang_cach_km',
      key: 'khoang_cach_km',
      width: 140,
      render: (value: string) => formatDistance(value),
    },
    {
      title: 'Thời gian',
      dataIndex: 'thoi_gian_chay_du_kien',
      key: 'thoi_gian_chay_du_kien',
      width: 150,
      render: (value: number) => formatDuration(value),
    },
    {
      title: 'Điểm dừng',
      key: 'stops',
      width: 120,
      align: 'right',
      render: (_value, record) => `${formatNumber(record.diem_dung.length)} điểm`,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      key: 'trang_thai',
      width: 150,
      render: (value: boolean) => <ActiveStatusTag active={value} />,
    },
    ...(canWrite
      ? [
          {
            title: 'Thao tác',
            key: 'actions',
            width: 120,
            render: (_value: unknown, record: Route) => (
              <Space size={4}>
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  aria-label={`Sửa ${record.ten_tuyen}`}
                  onClick={() => openEdit(record)}
                />
                <Popconfirm
                  title="Xóa tuyến đường?"
                  description="Chỉ xóa được tuyến chưa được sử dụng để xếp lịch."
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => void handleDelete(record)}
                >
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={`Xóa ${record.ten_tuyen}`}
                  />
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeader
        title="Tuyến đường"
        description="Quản lý hành trình, khoảng cách, thời gian chạy và các điểm đón/trả."
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm tuyến đường
            </Button>
          ) : undefined
        }
      />

      <Card className="page-card">
        <TableToolbar
          left={
            <Space wrap>
              <Input.Search
                allowClear
                placeholder="Tìm tên tuyến, tỉnh thành..."
                style={{ width: 280 }}
                onSearch={(value) => {
                  setSearch(value.trim());
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
              />
              <Select<RouteStatusFilter>
                style={{ width: 190 }}
                value={statusFilter}
                options={STATUS_FILTER_OPTIONS}
                onChange={(value) => {
                  setStatusFilter(value);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
              />
            </Space>
          }
          right={
            <Button
              icon={<ReloadOutlined />}
              loading={routesQuery.isFetching}
              onClick={() => void routesQuery.refetch()}
            >
              Làm mới
            </Button>
          }
        />

        {routesQuery.isError ? (
          <QueryErrorAlert
            error={routesQuery.error}
            title="Không thể tải danh sách tuyến đường"
            onRetry={() => void routesQuery.refetch()}
          />
        ) : (
          <Table<Route>
            rowKey="ma_tuyen"
            columns={columns}
            dataSource={routesQuery.data?.items ?? []}
            loading={routesQuery.isFetching}
            scroll={{ x: 860 }}
            locale={{ emptyText: <Empty description="Chưa có tuyến đường" /> }}
            expandable={{
              expandedRowRender: (record) => (
                <Timeline
                  items={[...record.diem_dung]
                    .sort((left, right) => left.thu_tu_dung - right.thu_tu_dung)
                    .map((stop) => ({
                      color:
                        stop.loai_diem === 'DON'
                          ? 'green'
                          : stop.loai_diem === 'TRA'
                            ? 'blue'
                            : 'gray',
                      children: (
                        <Space direction="vertical" size={2}>
                          <Space size={8}>
                            <Tag color="blue">{stop.thu_tu_dung}</Tag>
                            <Typography.Text strong>{stop.ten_diem_dung}</Typography.Text>
                            <StopTypeTag type={stop.loai_diem} />
                          </Space>
                          {stop.dia_chi ? (
                            <Typography.Text type="secondary">{stop.dia_chi}</Typography.Text>
                          ) : null}
                        </Space>
                      ),
                    }))}
                />
              ),
              rowExpandable: (record) => record.diem_dung.length > 0,
            }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: routesQuery.data?.meta.total ?? 0,
              showSizeChanger: true,
              showTotal: (total) => `${total} tuyến`,
              onChange: (page, pageSize) => setPagination({ page, limit: pageSize }),
            }}
          />
        )}
      </Card>

      <Modal
        title={editing ? 'Cập nhật tuyến đường' : 'Thêm tuyến đường'}
        open={open}
        width={1000}
        forceRender
        okText={editing ? 'Cập nhật' : 'Tạo mới'}
        cancelText="Hủy"
        confirmLoading={submitting}
        onOk={() => void handleSubmit()}
        onCancel={() => setOpen(false)}
      >
        <Form<RouteFormValues> form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="ten_tuyen"
            label="Tên tuyến đường"
            rules={[
              { required: true, message: 'Vui lòng nhập tên tuyến' },
              { min: 2, max: 150, message: 'Tên tuyến phải có từ 2 đến 150 ký tự' },
            ]}
          >
            <Input placeholder="TP.HCM - Đà Lạt" />
          </Form.Item>

          <div className="form-grid">
            <Form.Item
              name="tinh_di"
              label="Tỉnh/Thành phố đi"
              rules={[{ required: true, message: 'Vui lòng nhập tỉnh đi' }]}
            >
              <Input placeholder="TP. Hồ Chí Minh" maxLength={100} />
            </Form.Item>

            <Form.Item
              name="tinh_den"
              label="Tỉnh/Thành phố đến"
              rules={[{ required: true, message: 'Vui lòng nhập tỉnh đến' }]}
            >
              <Input placeholder="Lâm Đồng" maxLength={100} />
            </Form.Item>
          </div>

          <div className="form-grid">
            <Form.Item
              name="khoang_cach_km"
              label="Khoảng cách"
              rules={[{ required: true, message: 'Vui lòng nhập khoảng cách' }]}
            >
              <InputNumber
                min={0.1}
                max={5000}
                step={0.1}
                addonAfter="km"
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
              name="thoi_gian_chay_du_kien"
              label="Thời gian chạy dự kiến"
              rules={[{ required: true, message: 'Vui lòng nhập thời gian chạy' }]}
            >
              <InputNumber min={1} max={10080} addonAfter="phút" style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item
            name="trang_thai"
            label="Trạng thái hoạt động"
            valuePropName="checked"
            extra="Tắt để tạm ngừng khai thác tuyến đường."
          >
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Ngừng" />
          </Form.Item>

          <Form.Item label="Điểm dừng" required style={{ marginBottom: 0 }}>
            <Form.List
              name="diem_dung"
              rules={[
                {
                  validator: async (_rule, stops: RouteStopFormValues[] | undefined) => {
                    if (!stops || stops.length < 2) {
                      throw new Error('Tuyến đường cần ít nhất 2 điểm dừng');
                    }
                  },
                },
              ]}
            >
              {(fields, { add, remove, move }, { errors }) => (
                <>
                  <div className="route-stop-heading">
                    <span>Thứ tự</span>
                    <span>Tên điểm dừng</span>
                    <span>Địa chỉ</span>
                    <span>Loại điểm</span>
                    <span />
                  </div>

                  {fields.map((field, index) => (
                    <div className="route-stop-row" key={field.key}>
                      <Tag color="blue">{index + 1}</Tag>
                      <Form.Item
                        name={[field.name, 'ten_diem_dung']}
                        rules={[
                          { required: true, message: 'Nhập tên điểm dừng' },
                          { min: 2, message: 'Tên có ít nhất 2 ký tự' },
                        ]}
                      >
                        <Input placeholder="Tên điểm dừng" maxLength={150} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'dia_chi']}>
                        <Input placeholder="Địa chỉ (không bắt buộc)" maxLength={255} />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'loai_diem']}
                        rules={[{ required: true, message: 'Chọn loại điểm' }]}
                      >
                        <Select options={STOP_TYPE_OPTIONS} />
                      </Form.Item>
                      <Space size={0}>
                        <Button
                          type="text"
                          icon={<ArrowUpOutlined />}
                          aria-label={`Di chuyển điểm dừng ${index + 1} lên`}
                          disabled={index === 0}
                          onClick={() => move(index, index - 1)}
                        />
                        <Button
                          type="text"
                          icon={<ArrowDownOutlined />}
                          aria-label={`Di chuyển điểm dừng ${index + 1} xuống`}
                          disabled={index === fields.length - 1}
                          onClick={() => move(index, index + 1)}
                        />
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          aria-label={`Xóa điểm dừng ${index + 1}`}
                          disabled={fields.length <= 2}
                          onClick={() => remove(field.name)}
                        />
                      </Space>
                    </div>
                  ))}

                  <Form.ErrorList errors={errors} />

                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    disabled={fields.length >= 50}
                    onClick={() => add(emptyStop('TRUNG_CHUYEN'))}
                    style={{ marginTop: 12 }}
                  >
                    Thêm điểm dừng
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
