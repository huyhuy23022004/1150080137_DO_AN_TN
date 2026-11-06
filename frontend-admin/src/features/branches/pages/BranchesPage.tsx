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
  Switch,
  Table,
  Typography,
  type TableColumnsType,
} from 'antd';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryErrorAlert } from '@/components/common/QueryErrorAlert';
import { ActiveStatusTag } from '@/components/common/StatusTag';
import { TableToolbar } from '@/components/common/TableToolbar';
import { useAuthStore } from '@/features/auth/auth.store';
import { canManageBranches } from '@/lib/roles';
import type { Branch, BranchInput, BranchStatusFilter } from '@/types/branch';
import { useBranches, useCreateBranch, useDeleteBranch, useUpdateBranch } from '../hooks';

interface PaginationState {
  page: number;
  limit: number;
}

export function BranchesPage() {
  const { message } = App.useApp();
  const user = useAuthStore((state) => state.user);
  const [form] = Form.useForm<BranchInput>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BranchStatusFilter>('all');
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, limit: 20 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);

  const filters = useMemo(
    () => ({
      ...(search ? { q: search } : {}),
      trang_thai_hoat_dong: status,
      page: pagination.page,
      limit: pagination.limit,
    }),
    [pagination, search, status],
  );

  const branchesQuery = useBranches(filters);
  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();
  const deleteMutation = useDeleteBranch();

  if (!user) {
    return null;
  }

  const canWrite = canManageBranches(user.ten_vai_tro);
  const submitting = createMutation.isPending || updateMutation.isPending;

  function openCreate(): void {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ trang_thai_hoat_dong: true });
    setOpen(true);
  }

  function openEdit(branch: Branch): void {
    setEditing(branch);
    form.setFieldsValue({
      ma_dinh_danh: branch.ma_dinh_danh,
      ten_chi_nhanh: branch.ten_chi_nhanh,
      so_dien_thoai: branch.so_dien_thoai,
      dia_chi: branch.dia_chi,
      tinh_thanh: branch.tinh_thanh,
      trang_thai_hoat_dong: branch.trang_thai_hoat_dong,
    });
    setOpen(true);
  }

  async function handleSubmit(): Promise<void> {
    try {
      const values = await form.validateFields();
      const input: BranchInput = {
        ...values,
        ma_dinh_danh: values.ma_dinh_danh.trim().toUpperCase(),
        ten_chi_nhanh: values.ten_chi_nhanh.trim(),
        so_dien_thoai: values.so_dien_thoai.trim(),
        dia_chi: values.dia_chi.trim(),
        tinh_thanh: values.tinh_thanh.trim(),
      };

      if (editing) {
        await updateMutation.mutateAsync({ id: editing.ma_chi_nhanh, input });
        message.success('Cập nhật chi nhánh thành công');
      } else {
        await createMutation.mutateAsync(input);
        message.success('Tạo chi nhánh thành công');
      }

      setOpen(false);
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
  }

  async function handleDelete(branch: Branch): Promise<void> {
    try {
      await deleteMutation.mutateAsync(branch.ma_chi_nhanh);
      message.success('Đã xóa chi nhánh');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Xóa chi nhánh thất bại');
    }
  }

  const columns: TableColumnsType<Branch> = [
    {
      title: 'Mã',
      dataIndex: 'ma_dinh_danh',
      key: 'ma_dinh_danh',
      width: 160,
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: 'Chi nhánh',
      dataIndex: 'ten_chi_nhanh',
      key: 'ten_chi_nhanh',
      render: (value: string, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{value}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.dia_chi}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Tỉnh/thành',
      dataIndex: 'tinh_thanh',
      key: 'tinh_thanh',
      width: 170,
    },
    {
      title: 'Điện thoại',
      dataIndex: 'so_dien_thoai',
      key: 'so_dien_thoai',
      width: 150,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai_hoat_dong',
      key: 'trang_thai_hoat_dong',
      width: 150,
      render: (value: boolean) => <ActiveStatusTag active={value} />,
    },
    ...(canWrite
      ? [
          {
            title: 'Thao tác',
            key: 'actions',
            width: 120,
            render: (_value: unknown, record: Branch) => (
              <Space size={4}>
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  aria-label={`Sửa ${record.ten_chi_nhanh}`}
                  onClick={() => openEdit(record)}
                />
                <Popconfirm
                  title="Xóa chi nhánh?"
                  description="Chỉ xóa được chi nhánh chưa có người dùng hoặc đơn vé."
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => void handleDelete(record)}
                >
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={`Xóa ${record.ten_chi_nhanh}`}
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
        title="Chi nhánh"
        description="Quản lý phòng vé, địa chỉ và trạng thái hoạt động của từng chi nhánh."
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm chi nhánh
            </Button>
          ) : undefined
        }
      />

      <Card className="page-card">
        <TableToolbar
          left={
            <>
              <Input.Search
                allowClear
                placeholder="Tìm mã, tên, địa chỉ..."
                style={{ width: 280 }}
                onSearch={(value) => {
                  setSearch(value.trim());
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
              />
              <Select<BranchStatusFilter>
                value={status}
                style={{ width: 170 }}
                onChange={(value) => {
                  setStatus(value);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
                options={[
                  { value: 'all', label: 'Tất cả trạng thái' },
                  { value: 'true', label: 'Hoạt động' },
                  { value: 'false', label: 'Ngừng hoạt động' },
                ]}
              />
            </>
          }
          right={
            <Button
              icon={<ReloadOutlined />}
              loading={branchesQuery.isFetching}
              onClick={() => void branchesQuery.refetch()}
            >
              Làm mới
            </Button>
          }
        />

        {branchesQuery.isError ? (
          <QueryErrorAlert
            error={branchesQuery.error}
            title="Không thể tải danh sách chi nhánh"
            onRetry={() => void branchesQuery.refetch()}
          />
        ) : (
          <Table<Branch>
            rowKey="ma_chi_nhanh"
            columns={columns}
            dataSource={branchesQuery.data?.items ?? []}
            loading={branchesQuery.isFetching}
            scroll={{ x: 960 }}
            locale={{ emptyText: <Empty description="Chưa có chi nhánh" /> }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: branchesQuery.data?.meta.total ?? 0,
              showSizeChanger: true,
              showTotal: (total) => `${total} chi nhánh`,
              onChange: (page, pageSize) => setPagination({ page, limit: pageSize }),
            }}
          />
        )}
      </Card>

      <Modal
        title={editing ? 'Cập nhật chi nhánh' : 'Thêm chi nhánh'}
        open={open}
        width={680}
        forceRender
        okText={editing ? 'Cập nhật' : 'Tạo mới'}
        cancelText="Hủy"
        confirmLoading={submitting}
        onOk={() => void handleSubmit()}
        onCancel={() => setOpen(false)}
      >
        <Form<BranchInput> form={form} layout="vertical" requiredMark={false}>
          <div className="form-grid">
            <Form.Item
              name="ma_dinh_danh"
              label="Mã định danh"
              rules={[
                { required: true, message: 'Vui lòng nhập mã định danh' },
                { min: 2, max: 20, message: 'Mã phải có từ 2 đến 20 ký tự' },
                {
                  pattern: /^[A-Za-z0-9_]+$/,
                  message: 'Chỉ gồm chữ, số và dấu gạch dưới',
                },
              ]}
            >
              <Input placeholder="PV_MIEN_TAY" />
            </Form.Item>

            <Form.Item
              name="ten_chi_nhanh"
              label="Tên chi nhánh"
              rules={[
                { required: true, message: 'Vui lòng nhập tên chi nhánh' },
                { min: 2, max: 150, message: 'Tên phải có từ 2 đến 150 ký tự' },
              ]}
            >
              <Input placeholder="Phòng vé Bến xe Miền Tây" />
            </Form.Item>

            <Form.Item
              name="so_dien_thoai"
              label="Số điện thoại"
              rules={[
                { required: true, message: 'Vui lòng nhập số điện thoại' },
                { pattern: /^0\d{9,10}$/, message: 'Số điện thoại không hợp lệ' },
              ]}
            >
              <Input placeholder="02838752875" />
            </Form.Item>

            <Form.Item
              name="tinh_thanh"
              label="Tỉnh/thành"
              rules={[
                { required: true, message: 'Vui lòng nhập tỉnh/thành' },
                { min: 2, max: 100, message: 'Tỉnh/thành tối đa 100 ký tự' },
              ]}
            >
              <Input placeholder="TP. Hồ Chí Minh" />
            </Form.Item>
          </div>

          <Form.Item
            name="dia_chi"
            label="Địa chỉ"
            rules={[
              { required: true, message: 'Vui lòng nhập địa chỉ' },
              { min: 2, max: 255, message: 'Địa chỉ tối đa 255 ký tự' },
            ]}
          >
            <Input placeholder="395 Kinh Dương Vương, Bình Tân" />
          </Form.Item>

          <Form.Item
            name="trang_thai_hoat_dong"
            label="Trạng thái hoạt động"
            valuePropName="checked"
          >
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Ngừng" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
