import {
  CheckCircleOutlined,
  DollarOutlined,
  FileTextOutlined,
  ProfileOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  type TableColumnsType,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { type ReactNode, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuthStore } from '@/features/auth/auth.store';
import { formatCompactNumber, formatCurrency, formatDate } from '@/lib/format';
import { isBranchScopedRole } from '@/lib/roles';
import type { RevenueRouteItem } from '@/types/statistics';
import { toBranchChartData, toRouteChartData, toTimeChartData } from '../chart-data';
import {
  useBranchOptions,
  useRevenueByBranch,
  useRevenueByRoute,
  useRevenueTimeReport,
} from '../hooks';

const { RangePicker } = DatePicker;

type DateRange = [Dayjs, Dayjs];

interface TooltipEntry {
  value?: number | string | ReadonlyArray<number | string>;
  dataKey?: string | number;
}

interface RevenueTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color: string;
  loading: boolean;
}

function RevenueTooltip({ active, payload, label }: RevenueTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const revenueEntry = payload.find((item) => item.dataKey === 'doanh_thu') ?? payload[0];
  const rawValue = revenueEntry?.value;
  const amount =
    typeof rawValue === 'number' || typeof rawValue === 'string' ? rawValue : undefined;

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #eaecf0',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(16, 24, 40, 0.12)',
        padding: '8px 12px',
      }}
    >
      <div style={{ color: '#475467', fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#101828', fontWeight: 600 }}>{formatCurrency(amount)}</div>
    </div>
  );
}

function KpiCard({ title, value, icon, color, loading }: KpiCardProps) {
  return (
    <Card className="page-card" styles={{ body: { padding: 20 } }}>
      {loading ? (
        <Skeleton active title={false} paragraph={{ rows: 2 }} />
      ) : (
        <Statistic
          title={title}
          value={value}
          groupSeparator="."
          prefix={<span style={{ color }}>{icon}</span>}
          valueStyle={{ color, fontSize: 24, fontWeight: 600 }}
        />
      )}
    </Card>
  );
}

function QueryError({ error, title }: { error: Error | null; title: string }) {
  return (
    <Alert
      type="error"
      showIcon
      message={title}
      description={error?.message ?? 'Vui lòng thử lại sau'}
    />
  );
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [range, setRange] = useState<DateRange>(() => [dayjs().subtract(29, 'day'), dayjs()]);
  const [groupBy, setGroupBy] = useState<'day' | 'month'>('day');
  const [branchId, setBranchId] = useState<number | undefined>();

  const canFilterBranch = user ? !isBranchScopedRole(user.ten_vai_tro) : false;

  const filters = {
    tu_ngay: range[0].format('YYYY-MM-DD'),
    den_ngay: range[1].format('YYYY-MM-DD'),
    ...(branchId ? { ma_chi_nhanh: branchId } : {}),
  };

  const timeQuery = useRevenueTimeReport({ ...filters, group_by: groupBy });
  const routeQuery = useRevenueByRoute(filters);
  const branchQuery = useRevenueByBranch(filters, canFilterBranch);
  const branchesQuery = useBranchOptions(canFilterBranch);

  if (!user) {
    return null;
  }

  const summary = timeQuery.data?.summary;
  const timeData = timeQuery.data
    ? toTimeChartData(timeQuery.data.items, timeQuery.data.group_by)
    : [];
  const routeData = toRouteChartData(routeQuery.data?.items ?? []);
  const branchData = toBranchChartData(branchQuery.data?.items ?? []);
  const isRefreshing =
    timeQuery.isFetching || routeQuery.isFetching || (canFilterBranch && branchQuery.isFetching);

  const presets = [
    { label: '7 ngày gần nhất', value: [dayjs().subtract(6, 'day'), dayjs()] as DateRange },
    { label: '30 ngày gần nhất', value: [dayjs().subtract(29, 'day'), dayjs()] as DateRange },
    { label: 'Tháng này', value: [dayjs().startOf('month'), dayjs()] as DateRange },
    { label: 'Năm nay', value: [dayjs().startOf('year'), dayjs()] as DateRange },
  ];

  const rangeLabel = timeQuery.data
    ? `${formatDate(timeQuery.data.range.tu_ngay)} – ${formatDate(timeQuery.data.range.den_ngay)}`
    : `${range[0].format('DD/MM/YYYY')} – ${range[1].format('DD/MM/YYYY')}`;

  const routeColumns: TableColumnsType<RevenueRouteItem> = [
    {
      title: 'Tuyến',
      dataIndex: 'ten_tuyen',
      key: 'ten_tuyen',
      render: (_value, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.ten_tuyen}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.tinh_di} → {record.tinh_den}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Doanh thu',
      dataIndex: 'tong_doanh_thu',
      key: 'tong_doanh_thu',
      align: 'right',
      render: (value: string) => formatCurrency(value),
    },
    {
      title: 'Số đơn',
      dataIndex: 'so_don',
      key: 'so_don',
      align: 'right',
    },
    {
      title: 'Số vé',
      dataIndex: 'so_ve',
      key: 'so_ve',
      align: 'right',
    },
    {
      title: 'Đã soát',
      dataIndex: 'so_ve_da_soat',
      key: 'so_ve_da_soat',
      align: 'right',
    },
  ];

  function handleRangeChange(values: DateRange | null): void {
    if (values?.[0] && values[1]) {
      setRange([values[0], values[1]]);
    }
  }

  function refetchAll(): void {
    void timeQuery.refetch();
    void routeQuery.refetch();

    if (canFilterBranch) {
      void branchQuery.refetch();
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="page-card" styles={{ body: { padding: 16 } }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <Space wrap size={12}>
            <RangePicker
              value={range}
              allowClear={false}
              format="DD/MM/YYYY"
              presets={presets}
              onChange={(values) => {
                handleRangeChange(values as DateRange | null);
              }}
            />

            <Select<'day' | 'month'>
              value={groupBy}
              style={{ width: 150 }}
              onChange={setGroupBy}
              options={[
                { value: 'day', label: 'Theo ngày' },
                { value: 'month', label: 'Theo tháng' },
              ]}
            />

            {canFilterBranch ? (
              <Select<number | undefined>
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Tất cả chi nhánh"
                style={{ width: 220 }}
                value={branchId}
                loading={branchesQuery.isFetching}
                onChange={(value) => setBranchId(value)}
                options={(branchesQuery.data ?? []).map((branch) => ({
                  value: branch.ma_chi_nhanh,
                  label: branch.ten_chi_nhanh,
                }))}
              />
            ) : (
              <Tag color="orange" style={{ marginInlineEnd: 0 }}>
                Chi nhánh #{user.ma_chi_nhanh ?? '—'}
              </Tag>
            )}
          </Space>

          <Space>
            <Typography.Text type="secondary">{rangeLabel}</Typography.Text>
            <Button icon={<ReloadOutlined />} loading={isRefreshing} onClick={refetchAll}>
              Làm mới
            </Button>
          </Space>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title="Tổng doanh thu"
            value={formatCurrency(summary?.tong_doanh_thu)}
            icon={<DollarOutlined />}
            color="#f26522"
            loading={timeQuery.isPending}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title="Số đơn"
            value={summary?.so_don ?? 0}
            icon={<FileTextOutlined />}
            color="#1677ff"
            loading={timeQuery.isPending}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title="Số vé"
            value={summary?.so_ve ?? 0}
            icon={<ProfileOutlined />}
            color="#7a5af8"
            loading={timeQuery.isPending}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title="Vé đã soát"
            value={summary?.so_ve_da_soat ?? 0}
            icon={<CheckCircleOutlined />}
            color="#12b76a"
            loading={timeQuery.isPending}
          />
        </Col>
      </Row>

      <Card
        className="page-card"
        title="Doanh thu theo thời gian"
        extra={<Tag>{groupBy === 'day' ? 'Theo ngày' : 'Theo tháng'}</Tag>}
      >
        {timeQuery.isError ? (
          <QueryError error={timeQuery.error} title="Không thể tải doanh thu theo thời gian" />
        ) : timeQuery.isPending ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : timeData.length === 0 ? (
          <Empty description="Chưa có dữ liệu trong khoảng thời gian này" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timeData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecf0" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={12}
                width={64}
                tickFormatter={(value: number) => formatCompactNumber(value)}
              />
              <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'rgba(242, 101, 34, 0.06)' }} />
              <Bar
                dataKey="doanh_thu"
                name="Doanh thu"
                fill="#f26522"
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={canFilterBranch ? 12 : 24}>
          <Card className="page-card" title="Doanh thu theo tuyến" extra={<Tag>Top 8</Tag>}>
            {routeQuery.isError ? (
              <QueryError error={routeQuery.error} title="Không thể tải doanh thu theo tuyến" />
            ) : routeQuery.isPending ? (
              <Skeleton active paragraph={{ rows: 7 }} />
            ) : routeData.length === 0 ? (
              <Empty description="Chưa có dữ liệu tuyến" />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(300, routeData.length * 38 + 24)}>
                <BarChart
                  data={routeData}
                  layout="vertical"
                  margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eaecf0" />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    tickFormatter={(value: number) => formatCompactNumber(value)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={132}
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    tickFormatter={(value: string) =>
                      value.length > 20 ? `${value.slice(0, 20)}…` : value
                    }
                  />
                  <Tooltip
                    content={<RevenueTooltip />}
                    cursor={{ fill: 'rgba(22, 119, 255, 0.06)' }}
                  />
                  <Bar
                    dataKey="doanh_thu"
                    name="Doanh thu"
                    fill="#1677ff"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        {canFilterBranch && (
          <Col xs={24} xl={12}>
            <Card className="page-card" title="Doanh thu theo chi nhánh">
              {branchQuery.isError ? (
                <QueryError
                  error={branchQuery.error}
                  title="Không thể tải doanh thu theo chi nhánh"
                />
              ) : branchQuery.isPending ? (
                <Skeleton active paragraph={{ rows: 7 }} />
              ) : branchData.length === 0 ? (
                <Empty description="Chưa có dữ liệu chi nhánh" />
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(300, branchData.length * 38 + 24)}
                >
                  <BarChart
                    data={branchData}
                    layout="vertical"
                    margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eaecf0" />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      tickFormatter={(value: number) => formatCompactNumber(value)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={132}
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      tickFormatter={(value: string) =>
                        value.length > 20 ? `${value.slice(0, 20)}…` : value
                      }
                    />
                    <Tooltip
                      content={<RevenueTooltip />}
                      cursor={{ fill: 'rgba(18, 183, 106, 0.06)' }}
                    />
                    <Bar
                      dataKey="doanh_thu"
                      name="Doanh thu"
                      fill="#12b76a"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Col>
        )}
      </Row>

      <Card className="page-card" title="Chi tiết theo tuyến">
        {routeQuery.isError ? (
          <QueryError error={routeQuery.error} title="Không thể tải chi tiết tuyến" />
        ) : (
          <Table<RevenueRouteItem>
            rowKey="ma_tuyen"
            columns={routeColumns}
            dataSource={routeQuery.data?.items ?? []}
            loading={routeQuery.isPending}
            pagination={{ pageSize: 5, showSizeChanger: false }}
            scroll={{ x: 720 }}
            locale={{ emptyText: <Empty description="Chưa có dữ liệu" /> }}
          />
        )}
      </Card>
    </Space>
  );
}
