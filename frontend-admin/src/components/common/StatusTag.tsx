import { Tag } from 'antd';
import { getRoleLabel, type RoleName } from '@/lib/roles';
import type { AccountStatus } from '@/types/user';
import type { VehicleStatus } from '@/types/vehicle';
import type { StopType } from '@/types/route';
import type { TripStatus } from '@/types/trip';
import type { OrderStatus, PaymentStatus } from '@/types/booking';

export function ActiveStatusTag({ active }: { active: boolean }) {
  return <Tag color={active ? 'green' : 'default'}>{active ? 'Hoạt động' : 'Ngừng hoạt động'}</Tag>;
}

export function AccountStatusTag({ status }: { status: AccountStatus }) {
  return (
    <Tag color={status === 'HOAT_DONG' ? 'green' : 'red'}>
      {status === 'HOAT_DONG' ? 'Hoạt động' : 'Đã khóa'}
    </Tag>
  );
}

const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  HOAT_DONG: 'Hoạt động',
  BAO_DUONG: 'Bảo dưỡng',
  DANG_CHAY: 'Đang chạy',
};

const VEHICLE_STATUS_COLORS: Record<VehicleStatus, string> = {
  HOAT_DONG: 'green',
  BAO_DUONG: 'orange',
  DANG_CHAY: 'blue',
};

export function VehicleStatusTag({ status }: { status: VehicleStatus }) {
  return <Tag color={VEHICLE_STATUS_COLORS[status]}>{VEHICLE_STATUS_LABELS[status]}</Tag>;
}

export function RoleTag({ role }: { role: RoleName }) {
  const color =
    role === 'QUAN_TRI_VIEN'
      ? 'red'
      : role === 'DIEU_HANH'
        ? 'blue'
        : role === 'QUAN_LY_CHI_NHANH'
          ? 'orange'
          : 'default';

  return <Tag color={color}>{getRoleLabel(role)}</Tag>;
}

const STOP_TYPE_LABELS: Record<StopType, string> = {
  DON: 'Đón',
  TRA: 'Trả',
  TRUNG_CHUYEN: 'Trung chuyển',
};

const STOP_TYPE_COLORS: Record<StopType, string> = {
  DON: 'green',
  TRA: 'blue',
  TRUNG_CHUYEN: 'purple',
};

export function StopTypeTag({ type }: { type: StopType }) {
  return <Tag color={STOP_TYPE_COLORS[type]}>{STOP_TYPE_LABELS[type]}</Tag>;
}

const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  SAP_CHAY: 'Sắp chạy',
  DANG_CHAY: 'Đang chạy',
  HOAN_THANH: 'Hoàn thành',
  HUY: 'Đã hủy',
};

const TRIP_STATUS_COLORS: Record<TripStatus, string> = {
  SAP_CHAY: 'blue',
  DANG_CHAY: 'orange',
  HOAN_THANH: 'green',
  HUY: 'red',
};

export function TripStatusTag({ status }: { status: TripStatus }) {
  return <Tag color={TRIP_STATUS_COLORS[status]}>{TRIP_STATUS_LABELS[status]}</Tag>;
}

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  CHO_THANH_TOAN: 'Chờ thanh toán',
  DA_THANH_TOAN: 'Đã thanh toán',
  DA_HUY: 'Đã hủy',
};

const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  CHO_THANH_TOAN: 'orange',
  DA_THANH_TOAN: 'green',
  DA_HUY: 'red',
};

export function OrderStatusTag({ status }: { status: OrderStatus }) {
  return <Tag color={ORDER_STATUS_COLORS[status]}>{ORDER_STATUS_LABELS[status]}</Tag>;
}

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  CHO_XU_LY: 'Chờ xử lý',
  THANH_CONG: 'Thành công',
  THAT_BAI: 'Thất bại',
};

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  CHO_XU_LY: 'blue',
  THANH_CONG: 'green',
  THAT_BAI: 'red',
};

export function PaymentStatusTag({ status }: { status: PaymentStatus }) {
  return <Tag color={PAYMENT_STATUS_COLORS[status]}>{PAYMENT_STATUS_LABELS[status]}</Tag>;
}
