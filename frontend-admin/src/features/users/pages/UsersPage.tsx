import {
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  LockOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
  type MenuProps,
  type TableColumnsType,
} from 'antd';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryErrorAlert } from '@/components/common/QueryErrorAlert';
import { AccountStatusTag, RoleTag } from '@/components/common/StatusTag';
import { TableToolbar } from '@/components/common/TableToolbar';
import { useAuthStore } from '@/features/auth/auth.store';
import {
  canAssignRole,
  canDeleteUsers,
  canManageUsers,
  getRoleLabel,
  isBranchRequiredRole,
} from '@/lib/roles';
import { formatDateTime } from '@/lib/format';
import type {
  AccountStatus,
  CreateUserInput,
  RoleOption,
  UpdateUserInput,
  UserRecord,
} from '@/types/user';
import { useBranchOptions } from '@/features/branches/hooks';
import {
  useChangeUserStatus,
  useCreateUser,
  useDeleteUser,
  useResetUserPassword,
  useUpdateUser,
  useUserRoles,
  useUsers,
} from '../hooks';

interface PaginationState {
  page: number;
  limit: number;
}

interface UserFormValues {
  ma_vai_tro: number;
  ma_chi_nhanh?: number | null;
  ho_va_ten: string;
  so_dien_thoai: string;
  email?: string | null;
  mat_khau?: string;
  trang_thai_tai_khoan: AccountStatus;
}

export function UsersPage() {
  const { message, modal } = App.useApp();
  const currentUser = useAuthStore((state) => state.user);
  const [form] = Form.useForm<UserFormValues>();
  const [resetForm] = Form.useForm<{ mat_khau_moi: string }>();
  const [search, setSearch] = useState('');
  const [roleId, setRoleId] = useState<number | undefined>();
  const [branchId, setBranchId] = useState<number | undefined>();
  const [status, setStatus] = useState<AccountStatus | undefined>();
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, limit: 20 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRecord | null>(null);

  const filters = useMemo(
    () => ({
      ...(search ? { q: search } : {}),
      ...(roleId ? { ma_vai_tro: roleId } : {}),
      ...(branchId ? { ma_chi_nhanh: branchId } : {}),
      ...(status ? { trang_thai_tai_khoan: status } : {}),
      page: pagination.page,
      limit: pagination.limit,
    }),
    [branchId, pagination, roleId, search, status],
  );

  const usersQuery = useUsers(filters);
  const rolesQuery = useUserRoles();
  const branchesQuery = useBranchOptions();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const statusMutation = useChangeUserStatus();
  const resetPasswordMutation = useResetUserPassword();
  const deleteMutation = useDeleteUser();

  const selectedRoleId = Form.useWatch('ma_vai_tro', form);
  const selectedRole = rolesQuery.data?.find((role) => role.ma_vai_tro === selectedRoleId);
  const branchRequired = selectedRole ? isBranchRequiredRole(selectedRole.ten_vai_tro) : false;
  const canWrite = currentUser ? canManageUsers(currentUser.ten_vai_tro) : false;
  const canDelete = currentUser ? canDeleteUsers(currentUser.ten_vai_tro) : false;
  const scopedBranchId = currentUser?.ma_chi_nhanh ?? null;
  const submitting = createMutation.isPending || updateMutation.isPending;

  if (!currentUser) {
    return null;
  }

  const roleOptions = rolesQuery.data ?? [];
  const assignableRoleOptions = roleOptions.filter((role) =>
    canAssignRole(currentUser.ten_vai_tro, role.ten_vai_tro),
  );
  const branchOptions = (branchesQuery.data ?? [])
    .filter((branch) => (scopedBranchId ? branch.ma_chi_nhanh === scopedBranchId : true))
    .map((branch) => ({
      value: branch.ma_chi_nhanh,
      label: branch.ten_chi_nhanh,
    }));
  const userRows = usersQuery.data?.items ?? [];

  function openCreate(): void {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      ma_chi_nhanh: scopedBranchId,
      trang_thai_tai_khoan: 'HOAT_DONG',
    });
    setOpen(true);
  }

  function openEdit(record: UserRecord): void {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({
      ma_vai_tro: record.ma_vai_tro,
      ma_chi_nhanh: isBranchRequiredRole(record.ten_vai_tro) ? record.ma_chi_nhanh : null,
      ho_va_ten: record.ho_va_ten,
      so_dien_thoai: record.so_dien_thoai,
      email: record.email,
      trang_thai_tai_khoan: record.trang_thai_tai_khoan,
    });
    setOpen(true);
  }

  async function handleSubmit(): Promise<void> {
    try {
      const values = await form.validateFields();
      const submittedRole = roleOptions.find((role) => role.ma_vai_tro === values.ma_vai_tro);
      const submittedBranchRequired = submittedRole
        ? isBranchRequiredRole(submittedRole.ten_vai_tro)
        : false;
      const common = {
        ma_vai_tro: values.ma_vai_tro,
        ma_chi_nhanh: submittedBranchRequired
          ? (values.ma_chi_nhanh ?? scopedBranchId ?? null)
          : null,
        ho_va_ten: values.ho_va_ten.trim(),
        so_dien_thoai: values.so_dien_thoai.trim(),
        email: values.email?.trim() || null,
        trang_thai_tai_khoan: values.trang_thai_tai_khoan,
      };

      if (editing) {
        const input: UpdateUserInput = common;
        await updateMutation.mutateAsync({ id: editing.ma_nguoi_dung, input });
        message.success('Cập nhật tài khoản thành công');
      } else {
        const input: CreateUserInput = {
          ...common,
          mat_khau: values.mat_khau ?? '',
        };
        await createMutation.mutateAsync(input);
        message.success('Tạo tài khoản thành công');
      }

      setOpen(false);
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
  }

  async function handleResetPassword(): Promise<void> {
    if (!resetTarget) {
      return;
    }

    try {
      const values = await resetForm.validateFields();
      const result = await resetPasswordMutation.mutateAsync({
        id: resetTarget.ma_nguoi_dung,
        password: values.mat_khau_moi,
      });
      message.success(result);
      setResetTarget(null);
      resetForm.resetFields();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
  }

  async function toggleStatus(record: UserRecord): Promise<void> {
    const nextStatus = record.trang_thai_tai_khoan === 'HOAT_DONG' ? 'KHOA' : 'HOAT_DONG';
    const confirmed = await modal.confirm({
      title: nextStatus === 'KHOA' ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?',
      content:
        nextStatus === 'KHOA'
          ? `${record.ho_va_ten} sẽ không thể đăng nhập cho đến khi được mở khóa.`
          : `${record.ho_va_ten} sẽ có thể đăng nhập trở lại.`,
      okText: nextStatus === 'KHOA' ? 'Khóa' : 'Mở khóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: nextStatus === 'KHOA' },
    });

    if (!confirmed) {
      return;
    }

    try {
      await statusMutation.mutateAsync({ id: record.ma_nguoi_dung, status: nextStatus });
      message.success(nextStatus === 'KHOA' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Cập nhật trạng thái thất bại');
    }
  }

  async function handleDelete(record: UserRecord): Promise<void> {
    const confirmed = await modal.confirm({
      title: 'Xóa tài khoản?',
      content: `Tài khoản ${record.ho_va_ten} sẽ bị xóa nếu chưa phát sinh dữ liệu liên quan.`,
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(record.ma_nguoi_dung);
      message.success('Đã xóa tài khoản');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Xóa tài khoản thất bại');
    }
  }

  function menuFor(record: UserRecord): MenuProps['items'] {
    const isSelf = record.ma_nguoi_dung === currentUser?.ma_nguoi_dung;

    return [
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: 'Chỉnh sửa',
      },
      {
        key: 'reset-password',
        icon: <KeyOutlined />,
        label: 'Đặt lại mật khẩu',
      },
      {
        key: 'toggle-status',
        icon: record.trang_thai_tai_khoan === 'HOAT_DONG' ? <LockOutlined /> : <UnlockOutlined />,
        label: record.trang_thai_tai_khoan === 'HOAT_DONG' ? 'Khóa tài khoản' : 'Mở khóa',
        disabled: isSelf,
      },
      ...(canDelete
        ? [
            { type: 'divider' as const },
            {
              key: 'delete',
              icon: <DeleteOutlined />,
              label: 'Xóa tài khoản',
              danger: true,
              disabled: isSelf,
            },
          ]
        : []),
    ];
  }

  function handleMenuAction(key: string, record: UserRecord): void {
    if (key === 'edit') {
      openEdit(record);
      return;
    }

    if (key === 'reset-password') {
      setResetTarget(record);
      resetForm.resetFields();
      return;
    }

    if (key === 'toggle-status') {
      void toggleStatus(record);
      return;
    }

    if (key === 'delete') {
      void handleDelete(record);
    }
  }

  const columns: TableColumnsType<UserRecord> = [
    {
      title: 'Nhân viên',
      dataIndex: 'ho_va_ten',
      key: 'ho_va_ten',
      render: (value: string, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{value}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.so_dien_thoai}
            {record.email ? ` · ${record.email}` : ''}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Vai trò',
      dataIndex: 'ten_vai_tro',
      key: 'ten_vai_tro',
      width: 170,
      render: (value: UserRecord['ten_vai_tro']) => <RoleTag role={value} />,
    },
    {
      title: 'Chi nhánh',
      dataIndex: 'ten_chi_nhanh',
      key: 'ten_chi_nhanh',
      width: 200,
      render: (value: string | null) => value ?? 'Toàn hệ thống',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai_tai_khoan',
      key: 'trang_thai_tai_khoan',
      width: 130,
      render: (value: AccountStatus) => <AccountStatusTag status={value} />,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'thoi_gian_tao',
      key: 'thoi_gian_tao',
      width: 160,
      render: (value: string) => formatDateTime(value),
    },
    ...(canWrite
      ? [
          {
            title: '',
            key: 'actions',
            width: 64,
            render: (_value: unknown, record: UserRecord) => (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: menuFor(record),
                  onClick: ({ key }) => handleMenuAction(key, record),
                }}
              >
                <Button type="text" icon={<MoreOutlined />} aria-label="Thao tác tài khoản" />
              </Dropdown>
            ),
          },
        ]
      : []),
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeader
        title="Tài khoản"
        description="Quản lý nhân viên, vai trò, chi nhánh và trạng thái đăng nhập."
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm tài khoản
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
                placeholder="Tìm tên, số điện thoại, email..."
                style={{ width: 280 }}
                onSearch={(value) => {
                  setSearch(value.trim());
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
              />
              <Select<number>
                allowClear
                placeholder="Vai trò"
                style={{ width: 210, minWidth: 210 }}
                value={roleId}
                loading={rolesQuery.isFetching}
                onChange={(value) => {
                  setRoleId(value);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
                options={roleOptions.map((role: RoleOption) => ({
                  value: role.ma_vai_tro,
                  label: getRoleLabel(role.ten_vai_tro),
                }))}
              />
              {!scopedBranchId ? (
                <Select<number>
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chi nhánh"
                  style={{ width: 230, minWidth: 230 }}
                  value={branchId}
                  loading={branchesQuery.isFetching}
                  onChange={(value) => {
                    setBranchId(value);
                    setPagination((current) => ({ ...current, page: 1 }));
                  }}
                  options={branchOptions}
                />
              ) : null}
              <Select<AccountStatus>
                allowClear
                placeholder="Trạng thái"
                style={{ width: 170, minWidth: 170 }}
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
                options={[
                  { value: 'HOAT_DONG', label: 'Hoạt động' },
                  { value: 'KHOA', label: 'Đã khóa' },
                ]}
              />
            </>
          }
          right={
            <Button
              icon={<ReloadOutlined />}
              loading={usersQuery.isFetching}
              onClick={() => void usersQuery.refetch()}
            >
              Làm mới
            </Button>
          }
        />

        {usersQuery.isError ? (
          <QueryErrorAlert
            error={usersQuery.error}
            title="Không thể tải danh sách tài khoản"
            onRetry={() => void usersQuery.refetch()}
          />
        ) : (
          <Table<UserRecord>
            rowKey="ma_nguoi_dung"
            columns={columns}
            dataSource={userRows}
            loading={usersQuery.isFetching}
            scroll={userRows.length > 0 ? { x: 980 } : undefined}
            locale={{ emptyText: <Empty description="Chưa có tài khoản" /> }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: usersQuery.data?.meta.total ?? 0,
              showSizeChanger: true,
              showTotal: (total) => `${total} tài khoản`,
              onChange: (page, pageSize) => setPagination({ page, limit: pageSize }),
            }}
          />
        )}
      </Card>

      <Modal
        title={editing ? 'Cập nhật tài khoản' : 'Thêm tài khoản'}
        open={open}
        width={720}
        forceRender
        okText={editing ? 'Cập nhật' : 'Tạo mới'}
        cancelText="Hủy"
        confirmLoading={submitting}
        onOk={() => void handleSubmit()}
        onCancel={() => setOpen(false)}
      >
        <Form<UserFormValues> form={form} layout="vertical" requiredMark={false}>
          <div className="form-grid">
            <Form.Item
              name="ho_va_ten"
              label="Họ và tên"
              rules={[
                { required: true, message: 'Vui lòng nhập họ và tên' },
                { min: 2, max: 100, message: 'Họ tên phải có từ 2 đến 100 ký tự' },
              ]}
            >
              <Input placeholder="Nguyễn Văn A" />
            </Form.Item>

            <Form.Item
              name="so_dien_thoai"
              label="Số điện thoại"
              rules={[
                { required: true, message: 'Vui lòng nhập số điện thoại' },
                { pattern: /^0\d{9,10}$/, message: 'Số điện thoại không hợp lệ' },
              ]}
            >
              <Input placeholder="0901234567" />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email"
              rules={[{ type: 'email', message: 'Email không hợp lệ' }]}
            >
              <Input placeholder="nhanvien@futa.vn" />
            </Form.Item>

            <Form.Item
              name="ma_vai_tro"
              label="Vai trò"
              rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
            >
              <Select
                placeholder="Chọn vai trò"
                loading={rolesQuery.isFetching}
                options={assignableRoleOptions.map((role) => ({
                  value: role.ma_vai_tro,
                  label: getRoleLabel(role.ten_vai_tro),
                }))}
                onChange={(value) => {
                  const role = assignableRoleOptions.find((item) => item.ma_vai_tro === value);
                  if (!role) {
                    return;
                  }

                  if (!isBranchRequiredRole(role.ten_vai_tro)) {
                    form.setFieldValue('ma_chi_nhanh', null);
                  } else if (scopedBranchId) {
                    form.setFieldValue('ma_chi_nhanh', scopedBranchId);
                  }
                }}
              />
            </Form.Item>

            <Form.Item
              name="ma_chi_nhanh"
              label="Chi nhánh"
              rules={[
                {
                  required: branchRequired,
                  message: 'Vai trò này bắt buộc phải thuộc một chi nhánh',
                },
              ]}
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder={branchRequired ? 'Chọn chi nhánh' : 'Không áp dụng'}
                disabled={Boolean(scopedBranchId) || !branchRequired}
                loading={branchesQuery.isFetching}
                options={branchOptions}
              />
            </Form.Item>

            <Form.Item
              name="trang_thai_tai_khoan"
              label="Trạng thái"
              rules={[{ required: true, message: 'Vui lòng chọn trạng thái' }]}
            >
              <Select
                options={[
                  { value: 'HOAT_DONG', label: 'Hoạt động' },
                  { value: 'KHOA', label: 'Đã khóa' },
                ]}
              />
            </Form.Item>

            {!editing ? (
              <Form.Item
                name="mat_khau"
                label="Mật khẩu ban đầu"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu' },
                  { min: 8, max: 72, message: 'Mật khẩu phải có từ 8 đến 72 ký tự' },
                ]}
              >
                <Input.Password placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" />
              </Form.Item>
            ) : null}
          </div>
        </Form>
      </Modal>

      <Modal
        title={`Đặt lại mật khẩu${resetTarget ? ` cho ${resetTarget.ho_va_ten}` : ''}`}
        open={Boolean(resetTarget)}
        forceRender
        okText="Đặt lại"
        cancelText="Hủy"
        confirmLoading={resetPasswordMutation.isPending}
        onOk={() => void handleResetPassword()}
        onCancel={() => {
          setResetTarget(null);
          resetForm.resetFields();
        }}
      >
        <Form form={resetForm} layout="vertical" requiredMark={false}>
          <Form.Item
            name="mat_khau_moi"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu mới' },
              { min: 8, max: 72, message: 'Mật khẩu phải có từ 8 đến 72 ký tự' },
            ]}
          >
            <Input.Password placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
