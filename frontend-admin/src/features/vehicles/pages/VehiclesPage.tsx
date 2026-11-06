import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
  type TableColumnsType,
} from 'antd';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryErrorAlert } from '@/components/common/QueryErrorAlert';
import { TableToolbar } from '@/components/common/TableToolbar';
import { VehicleStatusTag } from '@/components/common/StatusTag';
import { useAuthStore } from '@/features/auth/auth.store';
import { canManageVehicles } from '@/lib/roles';
import { formatNumber } from '@/lib/format';
import type { Vehicle, VehicleInput, VehicleStatus } from '@/types/vehicle';
import { useVehicleTypeOptions } from '@/features/vehicle-types/hooks';
import { useCreateVehicle, useDeleteVehicle, useUpdateVehicle, useVehicles } from '../hooks';

interface PaginationState {
  page: number;
  limit: number;
}

interface VehicleFormValues {
  ma_loai_xe: number;
  bien_so_xe: string;
  hang_san_xuat?: string;
  trang_thai: VehicleStatus;
}

const STATUS_OPTIONS: Array<{ value: VehicleStatus; label: string }> = [
  { value: 'HOAT_DONG', label: 'Hoạt động' },
  { value: 'BAO_DUONG', label: 'Bảo dưỡng' },
  { value: 'DANG_CHAY', label: 'Đang chạy' },
];

export function VehiclesPage() {
  const { message } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const [form] = Form.useForm<VehicleFormValues>();
  const selectedTypeId = Form.useWatch('ma_loai_xe', form);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<number | undefined>();
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | undefined>();
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, limit: 20 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);

  const filters = useMemo(
    () => ({
      ...(search ? { q: search } : {}),
      ...(typeFilter ? { ma_loai_xe: typeFilter } : {}),
      ...(statusFilter ? { trang_thai: statusFilter } : {}),
      page: pagination.page,
      limit: pagination.limit,
    }),
    [pagination, search, statusFilter, typeFilter],
  );

  const vehiclesQuery = useVehicles(filters);
  const typesQuery = useVehicleTypeOptions();
  const createMutation = useCreateVehicle();
  const updateMutation = useUpdateVehicle();
  const deleteMutation = useDeleteVehicle();
  const canWrite = user ? canManageVehicles(user.ten_vai_tro) : false;
  const submitting = createMutation.isPending || updateMutation.isPending;
  const selectedType = typesQuery.data?.find((type) => type.ma_loai_xe === selectedTypeId);

  if (!user) {
    return null;
  }

  function openCreate(): void {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ trang_thai: 'HOAT_DONG' });
    setOpen(true);
  }

  function openEdit(record: Vehicle): void {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({
      ma_loai_xe: record.ma_loai_xe,
      bien_so_xe: record.bien_so_xe,
      hang_san_xuat: record.hang_san_xuat ?? undefined,
      trang_thai: record.trang_thai,
    });
    setOpen(true);
  }

  async function handleSubmit(): Promise<void> {
    try {
      const values = await form.validateFields();
      const input: VehicleInput = {
        ma_loai_xe: values.ma_loai_xe,
        bien_so_xe: values.bien_so_xe.trim().toUpperCase(),
        hang_san_xuat: values.hang_san_xuat?.trim() || null,
        trang_thai: values.trang_thai,
      };

      if (editing) {
        await updateMutation.mutateAsync({ id: editing.ma_xe, input });
        message.success('Cập nhật xe thành công');
      } else {
        await createMutation.mutateAsync(input);
        message.success('Thêm xe thành công');
      }

      setOpen(false);
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
  }

  async function handleDelete(record: Vehicle): Promise<void> {
    try {
      await deleteMutation.mutateAsync(record.ma_xe);
      message.success('Đã xóa xe');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Xóa xe thất bại');
    }
  }

  const columns: TableColumnsType<Vehicle> = [
    {
      title: 'Biển số xe',
      dataIndex: 'bien_so_xe',
      key: 'bien_so_xe',
      width: 160,
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: 'Loại xe',
      dataIndex: 'ten_loai_xe',
      key: 'ten_loai_xe',
      render: (value: string, record) => (
        <Space size={6}>
          <span>{value}</span>
          <Typography.Text type="secondary">
            ({formatNumber(record.tong_so_ghe)} ghế)
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Hãng sản xuất',
      dataIndex: 'hang_san_xuat',
      key: 'hang_san_xuat',
      render: (value: string | null) =>
        value || <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      key: 'trang_thai',
      width: 140,
      render: (value: VehicleStatus) => <VehicleStatusTag status={value} />,
    },
    ...(canWrite
      ? [
          {
            title: 'Thao tác',
            key: 'actions',
            width: 120,
            render: (_value: unknown, record: Vehicle) => (
              <Space size={4}>
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  aria-label={`Sửa xe ${record.bien_so_xe}`}
                  onClick={() => openEdit(record)}
                />
                <Popconfirm
                  title="Xóa xe?"
                  description="Chỉ xóa được xe chưa được xếp lịch chạy."
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => void handleDelete(record)}
                >
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={`Xóa xe ${record.bien_so_xe}`}
                  />
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ];

  function resetFilters(): void {
    setSearch('');
    setTypeFilter(undefined);
    setStatusFilter(undefined);
    setPagination((current) => ({ ...current, page: 1 }));
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeader
        title="Đội xe"
        description="Quản lý biển số, loại xe và trạng thái vận hành của xe."
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm xe
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
                placeholder="Tìm biển số, hãng xe..."
                style={{ width: 250 }}
                onSearch={(value) => {
                  setSearch(value.trim());
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
              />
              <Select<number>
                allowClear
                placeholder="Loại xe"
                style={{ width: 200 }}
                value={typeFilter}
                loading={typesQuery.isFetching}
                options={(typesQuery.data ?? []).map((type) => ({
                  value: type.ma_loai_xe,
                  label: `${type.ten_loai_xe} (${type.tong_so_ghe} ghế)`,
                }))}
                onChange={(value) => {
                  setTypeFilter(value);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
              />
              <Select<VehicleStatus>
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
              <Button onClick={resetFilters}>Xóa lọc</Button>
            </Space>
          }
          right={
            <Button
              icon={<ReloadOutlined />}
              loading={vehiclesQuery.isFetching}
              onClick={() => void vehiclesQuery.refetch()}
            >
              Làm mới
            </Button>
          }
        />

        {vehiclesQuery.isError ? (
          <QueryErrorAlert
            error={vehiclesQuery.error}
            title="Không thể tải danh sách xe"
            onRetry={() => void vehiclesQuery.refetch()}
          />
        ) : (
          <Table<Vehicle>
            rowKey="ma_xe"
            columns={columns}
            dataSource={vehiclesQuery.data?.items ?? []}
            loading={vehiclesQuery.isFetching}
            scroll={{ x: 820 }}
            locale={{ emptyText: <Empty description="Chưa có xe" /> }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: vehiclesQuery.data?.meta.total ?? 0,
              showSizeChanger: true,
              showTotal: (total) => `${total} xe`,
              onChange: (page, pageSize) => setPagination({ page, limit: pageSize }),
            }}
          />
        )}
      </Card>

      <Modal
        title={editing ? 'Cập nhật xe' : 'Thêm xe'}
        open={open}
        forceRender
        okText={editing ? 'Cập nhật' : 'Thêm mới'}
        cancelText="Hủy"
        confirmLoading={submitting}
        onOk={() => void handleSubmit()}
        onCancel={() => setOpen(false)}
      >
        <Form<VehicleFormValues> form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="bien_so_xe"
            label="Biển số xe"
            rules={[
              { required: true, message: 'Vui lòng nhập biển số xe' },
              { max: 20, message: 'Biển số tối đa 20 ký tự' },
            ]}
            normalize={(value: string) => value.toUpperCase()}
          >
            <Input placeholder="51B-123.45" />
          </Form.Item>

          <Form.Item
            name="ma_loai_xe"
            label="Loại xe"
            rules={[{ required: true, message: 'Vui lòng chọn loại xe' }]}
            extra={
              selectedType
                ? `Sơ đồ ${selectedType.so_tang} tầng, ${formatNumber(selectedType.tong_so_ghe)} ghế`
                : undefined
            }
          >
            <Select
              showSearch
              optionFilterProp="label"
              loading={typesQuery.isFetching}
              placeholder="Chọn loại xe"
              options={(typesQuery.data ?? []).map((type) => ({
                value: type.ma_loai_xe,
                label: `${type.ten_loai_xe} (${type.tong_so_ghe} ghế)`,
              }))}
            />
          </Form.Item>

          <div className="form-grid">
            <Form.Item name="hang_san_xuat" label="Hãng sản xuất">
              <Input placeholder="Thaco, Hyundai..." maxLength={50} />
            </Form.Item>

            <Form.Item
              name="trang_thai"
              label="Trạng thái"
              rules={[{ required: true, message: 'Vui lòng chọn trạng thái' }]}
            >
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </Space>
  );
}
