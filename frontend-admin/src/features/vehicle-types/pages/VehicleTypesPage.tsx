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
  Tag,
  Typography,
  type TableColumnsType,
} from 'antd';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryErrorAlert } from '@/components/common/QueryErrorAlert';
import { TableToolbar } from '@/components/common/TableToolbar';
import { useAuthStore } from '@/features/auth/auth.store';
import { canManageVehicleTypes } from '@/lib/roles';
import { formatNumber } from '@/lib/format';
import type { SeatInput, VehicleType } from '@/types/vehicle-type';
import { SeatDesigner, SeatMapPreview } from '../SeatDesigner';
import {
  useCreateVehicleType,
  useDeleteVehicleType,
  useUpdateVehicleType,
  useVehicleTypes,
} from '../hooks';

interface PaginationState {
  page: number;
  limit: number;
}

interface VehicleTypeFormValues {
  ten_loai_xe: string;
  so_tang: number;
}

function toSeatInputs(record: VehicleType): SeatInput[] {
  return record.so_do_ghe.map((seat) => ({
    ky_hieu_ghe: seat.ky_hieu_ghe,
    tang: seat.tang,
    hang: seat.hang,
    cot: seat.cot,
    loai_cho: seat.loai_cho,
  }));
}

export function VehicleTypesPage() {
  const { message } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const [form] = Form.useForm<VehicleTypeFormValues>();
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, limit: 20 });
  const [seats, setSeats] = useState<SeatInput[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleType | null>(null);
  const soTang = Form.useWatch('so_tang', form) ?? 2;

  const filters = useMemo(
    () => ({
      ...(search ? { q: search } : {}),
      page: pagination.page,
      limit: pagination.limit,
    }),
    [pagination, search],
  );

  const typesQuery = useVehicleTypes(filters);
  const createMutation = useCreateVehicleType();
  const updateMutation = useUpdateVehicleType();
  const deleteMutation = useDeleteVehicleType();
  const canWrite = user ? canManageVehicleTypes(user.ten_vai_tro) : false;
  const submitting = createMutation.isPending || updateMutation.isPending;

  if (!user) {
    return null;
  }

  function openCreate(): void {
    setEditing(null);
    setSeats([]);
    form.resetFields();
    form.setFieldsValue({ so_tang: 2 });
    setOpen(true);
  }

  function openEdit(record: VehicleType): void {
    setEditing(record);
    setSeats(toSeatInputs(record));
    form.resetFields();
    form.setFieldsValue({
      ten_loai_xe: record.ten_loai_xe,
      so_tang: record.so_tang,
    });
    setOpen(true);
  }

  async function handleSubmit(): Promise<void> {
    try {
      const values = await form.validateFields();

      if (seats.length === 0) {
        message.error('Vui lòng tạo ít nhất một ghế cho loại xe');
        return;
      }

      const input = {
        ten_loai_xe: values.ten_loai_xe.trim(),
        so_tang: values.so_tang,
        so_do_ghe: seats,
      };

      if (editing) {
        await updateMutation.mutateAsync({ id: editing.ma_loai_xe, input });
        message.success('Cập nhật loại xe thành công');
      } else {
        await createMutation.mutateAsync(input);
        message.success('Tạo loại xe thành công');
      }

      setOpen(false);
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
  }

  async function handleDelete(record: VehicleType): Promise<void> {
    try {
      await deleteMutation.mutateAsync(record.ma_loai_xe);
      message.success('Đã xóa loại xe');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Xóa loại xe thất bại');
    }
  }

  const columns: TableColumnsType<VehicleType> = [
    {
      title: 'Loại xe',
      dataIndex: 'ten_loai_xe',
      key: 'ten_loai_xe',
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: 'Số tầng',
      dataIndex: 'so_tang',
      key: 'so_tang',
      width: 110,
      render: (value: number) => <Tag>{value} tầng</Tag>,
    },
    {
      title: 'Tổng ghế',
      key: 'tong_so_ghe',
      width: 120,
      align: 'right',
      render: (_value, record) => formatNumber(record.so_do_ghe.length),
    },
    {
      title: 'Ghế VIP',
      key: 'vip',
      width: 120,
      align: 'right',
      render: (_value, record) => (
        <Tag color="orange">
          {formatNumber(record.so_do_ghe.filter((seat) => seat.loai_cho === 'VIP').length)}
        </Tag>
      ),
    },
    ...(canWrite
      ? [
          {
            title: 'Thao tác',
            key: 'actions',
            width: 120,
            render: (_value: unknown, record: VehicleType) => (
              <Space size={4}>
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  aria-label={`Sửa ${record.ten_loai_xe}`}
                  onClick={() => openEdit(record)}
                />
                <Popconfirm
                  title="Xóa loại xe?"
                  description="Chỉ xóa được loại xe chưa có xe hoặc vé sử dụng."
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => void handleDelete(record)}
                >
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={`Xóa ${record.ten_loai_xe}`}
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
        title="Loại xe & sơ đồ ghế"
        description="Cấu hình số tầng, vị trí và loại ghế thường/VIP cho từng loại xe."
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm loại xe
            </Button>
          ) : undefined
        }
      />

      <Card className="page-card">
        <TableToolbar
          left={
            <Input.Search
              allowClear
              placeholder="Tìm tên loại xe..."
              style={{ width: 280 }}
              onSearch={(value) => {
                setSearch(value.trim());
                setPagination((current) => ({ ...current, page: 1 }));
              }}
            />
          }
          right={
            <Button
              icon={<ReloadOutlined />}
              loading={typesQuery.isFetching}
              onClick={() => void typesQuery.refetch()}
            >
              Làm mới
            </Button>
          }
        />

        {typesQuery.isError ? (
          <QueryErrorAlert
            error={typesQuery.error}
            title="Không thể tải danh sách loại xe"
            onRetry={() => void typesQuery.refetch()}
          />
        ) : (
          <Table<VehicleType>
            rowKey="ma_loai_xe"
            columns={columns}
            dataSource={typesQuery.data?.items ?? []}
            loading={typesQuery.isFetching}
            scroll={{ x: 760 }}
            locale={{ emptyText: <Empty description="Chưa có loại xe" /> }}
            expandable={{
              expandedRowRender: (record) => (
                <SeatMapPreview seats={record.so_do_ghe} soTang={record.so_tang} />
              ),
              rowExpandable: (record) => record.so_do_ghe.length > 0,
            }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: typesQuery.data?.meta.total ?? 0,
              showSizeChanger: true,
              showTotal: (total) => `${total} loại xe`,
              onChange: (page, pageSize) => setPagination({ page, limit: pageSize }),
            }}
          />
        )}
      </Card>

      <Modal
        title={editing ? 'Cập nhật loại xe' : 'Thêm loại xe'}
        open={open}
        width={920}
        forceRender
        okText={editing ? 'Cập nhật' : 'Tạo mới'}
        cancelText="Hủy"
        confirmLoading={submitting}
        onOk={() => void handleSubmit()}
        onCancel={() => setOpen(false)}
      >
        <Form<VehicleTypeFormValues> form={form} layout="vertical" requiredMark={false}>
          <div className="form-grid">
            <Form.Item
              name="ten_loai_xe"
              label="Tên loại xe"
              rules={[
                { required: true, message: 'Vui lòng nhập tên loại xe' },
                { min: 2, max: 100, message: 'Tên phải có từ 2 đến 100 ký tự' },
              ]}
            >
              <Input placeholder="Limousine 34 Phòng" />
            </Form.Item>

            <Form.Item
              name="so_tang"
              label="Số tầng"
              rules={[{ required: true, message: 'Vui lòng chọn số tầng' }]}
            >
              <Select
                options={[
                  { value: 1, label: '1 tầng' },
                  { value: 2, label: '2 tầng' },
                  { value: 3, label: '3 tầng' },
                ]}
                onChange={(value: number) => {
                  const nextSeats = seats.filter((seat) => seat.tang <= value);
                  if (nextSeats.length !== seats.length) {
                    message.warning('Đã loại bỏ các ghế thuộc tầng không còn sử dụng');
                  }
                  setSeats(nextSeats);
                }}
              />
            </Form.Item>
          </div>

          <Form.Item
            label="Sơ đồ ghế"
            required
            validateStatus={seats.length === 0 ? 'warning' : undefined}
            help={seats.length === 0 ? 'Cần tạo ít nhất một ghế' : undefined}
          >
            <SeatDesigner
              key={`${editing?.ma_loai_xe ?? 'new'}-${open ? 'open' : 'closed'}`}
              seats={seats}
              soTang={soTang}
              disabled={!canWrite}
              onChange={setSeats}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
