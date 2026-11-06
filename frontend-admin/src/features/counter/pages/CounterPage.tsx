import {
  CheckCircleOutlined,
  DisconnectOutlined,
  ReloadOutlined,
  ShopOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Empty,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryErrorAlert } from '@/components/common/QueryErrorAlert';
import { formatCurrency, formatTime } from '@/lib/format';
import { holdSeats, releaseSeats, extendSeats } from '@/lib/socket';
import { useRouteOptions } from '@/features/routes/hooks';
import type { PaymentMethod } from '@/types/booking';
import type {
  CounterSeat,
  CounterSeatMap,
  CreatedCounterBooking,
  CreateCounterBookingResult,
} from '@/types/counter';
import type { RouteStop } from '@/types/route';
import { SeatMapBoard } from '../SeatMapBoard';
import {
  useCounterQuote,
  useCounterSeatMap,
  useCounterTripDetail,
  useCounterTrips,
  useCreateCounterBooking,
} from '../hooks';

interface CounterFormValues {
  ho_ten_khach: string;
  so_dien_thoai_khach: string;
  email_khach?: string;
  ma_diem_don: number;
  ma_diem_tra: number;
  phuong_thuc_thanh_toan: PaymentMethod;
}

const MAX_SEATS = 5;

function createOwnerRef(): string {
  return `counter_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function idempotencyKey(tripId: number): string {
  return `counter-${tripId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pickupStops(stops: RouteStop[]): RouteStop[] {
  return stops.filter((stop) => stop.loai_diem === 'DON' || stop.loai_diem === 'TRUNG_CHUYEN');
}

function dropoffStops(stops: RouteStop[]): RouteStop[] {
  const result = stops.filter(
    (stop) => stop.loai_diem === 'TRA' || stop.loai_diem === 'TRUNG_CHUYEN',
  );
  return result.length > 0 ? result : stops;
}

export function CounterPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<CounterFormValues>();
  const [routeId, setRouteId] = useState<number | undefined>();
  const [travelDate, setTravelDate] = useState<Dayjs>(dayjs());
  const [tripId, setTripId] = useState<number | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [holdingSeat, setHoldingSeat] = useState<string | null>(null);
  const [result, setResult] = useState<CreateCounterBookingResult | null>(null);
  const ownerRef = useRef(createOwnerRef());
  const selectedRef = useRef(selectedSeats);
  const tripRef = useRef(tripId);
  selectedRef.current = selectedSeats;
  tripRef.current = tripId;

  const routesQuery = useRouteOptions();
  const tripFilters = useMemo(
    () => ({ ...(routeId ? { ma_tuyen: routeId } : {}), ngay: travelDate.format('YYYY-MM-DD') }),
    [routeId, travelDate],
  );
  const tripsQuery = useCounterTrips(tripFilters);
  const tripDetailQuery = useCounterTripDetail(tripId);
  const seatMapQuery = useCounterSeatMap(tripId, {
    onSeatsReleased: (seats) => {
      const released = new Set(seats);
      setSelectedSeats((previous) => previous.filter((seat) => !released.has(seat)));
    },
    onSeatsBooked: (event) => {
      const booked = new Set(event.danh_sach_ghe);
      setSelectedSeats((previous) => previous.filter((seat) => !booked.has(seat)));
    },
  });
  const quoteQuery = useCounterQuote(tripId, selectedSeats);
  const createBooking = useCreateCounterBooking();

  const trips = tripsQuery.data ?? [];
  const stops = tripDetailQuery.data?.diem_dung ?? [];
  const selectedTrip = trips.find((trip) => trip.ma_chuyen === tripId);
  const seatMap: CounterSeatMap | null = seatMapQuery.data ?? null;

  useEffect(() => {
    if (!tripDetailQuery.data) {
      return;
    }

    const pickup = pickupStops(tripDetailQuery.data.diem_dung).find((stop) => stop.ma_diem_dung);
    const dropoff = [...dropoffStops(tripDetailQuery.data.diem_dung)]
      .reverse()
      .find((stop) => stop.ma_diem_dung);

    if (pickup?.ma_diem_dung && !form.getFieldValue('ma_diem_don')) {
      form.setFieldValue('ma_diem_don', pickup.ma_diem_dung);
    }

    if (dropoff?.ma_diem_dung && !form.getFieldValue('ma_diem_tra')) {
      form.setFieldValue('ma_diem_tra', dropoff.ma_diem_dung);
    }
  }, [form, tripDetailQuery.data]);

  useEffect(() => {
    if (!tripId || selectedSeats.length === 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      extendSeats(tripId, ownerRef.current).catch(() => {
        message.warning('Không thể gia hạn giữ ghế, vui lòng chọn lại ghế');
      });
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [message, selectedSeats.length, tripId]);

  useEffect(() => {
    return () => {
      if (tripRef.current && selectedRef.current.length > 0) {
        void releaseSeats(tripRef.current, selectedRef.current, ownerRef.current).catch(
          () => undefined,
        );
      }
    };
  }, []);

  function detachTrip(): void {
    if (tripId && selectedSeats.length > 0) {
      void releaseSeats(tripId, selectedSeats, ownerRef.current).catch(() => undefined);
    }

    setSelectedSeats([]);
    setTripId(null);
    ownerRef.current = createOwnerRef();
    form.resetFields(['ma_diem_don', 'ma_diem_tra']);
  }

  function changeTrip(nextTripId: number): void {
    if (tripId === nextTripId) {
      return;
    }

    detachTrip();
    setTripId(nextTripId);
  }

  async function toggleSeat(seat: CounterSeat): Promise<void> {
    if (!tripId || holdingSeat) {
      return;
    }

    if (selectedSeats.includes(seat.ky_hieu_ghe)) {
      setSelectedSeats((previous) => previous.filter((code) => code !== seat.ky_hieu_ghe));
      releaseSeats(tripId, [seat.ky_hieu_ghe], ownerRef.current).catch(() => {
        message.warning('Không thể nhả ghế, hệ thống sẽ tự đồng bộ lại');
        void seatMapQuery.refetch();
      });
      return;
    }

    if (seat.trang_thai !== 'TRONG') {
      return;
    }

    if (selectedSeats.length >= MAX_SEATS) {
      message.warning(`Mỗi đơn chỉ được chọn tối đa ${MAX_SEATS} ghế`);
      return;
    }

    setHoldingSeat(seat.ky_hieu_ghe);

    try {
      await holdSeats(tripId, [seat.ky_hieu_ghe], ownerRef.current);
      setSelectedSeats((previous) => [...previous, seat.ky_hieu_ghe]);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể giữ ghế');
      void seatMapQuery.refetch();
    } finally {
      setHoldingSeat(null);
    }
  }

  async function submitBooking(values: CounterFormValues): Promise<void> {
    if (!tripId || selectedSeats.length === 0) {
      message.warning('Vui lòng chọn chuyến xe và ghế trước khi tạo đơn');
      return;
    }

    try {
      const created = await createBooking.mutateAsync({
        input: {
          ma_chuyen: tripId,
          danh_sach_ghe: selectedSeats,
          owner_ref: ownerRef.current,
          ma_diem_don: values.ma_diem_don,
          ma_diem_tra: values.ma_diem_tra,
          ...(values.ho_ten_khach?.trim() ? { ho_ten_khach: values.ho_ten_khach.trim() } : {}),
          ...(values.so_dien_thoai_khach?.trim()
            ? { so_dien_thoai_khach: values.so_dien_thoai_khach.trim() }
            : {}),
          ...(values.email_khach?.trim() ? { email_khach: values.email_khach.trim() } : {}),
          phuong_thuc_thanh_toan: values.phuong_thuc_thanh_toan,
        },
        idempotencyKey: idempotencyKey(tripId),
      });

      setSelectedSeats([]);
      form.resetFields(['ho_ten_khach', 'so_dien_thoai_khach', 'email_khach']);
      setResult(created);
      void seatMapQuery.refetch();
      message.success('Tạo đơn đặt vé thành công');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể tạo đơn đặt vé');
    }
  }

  return (
    <div>
      <PageHeader
        title="Phòng vé"
        description="Bán vé tại quầy, giữ ghế realtime và xác nhận thanh toán tiền mặt ngay."
        extra={
          <Tag
            icon={seatMapQuery.connected ? <WifiOutlined /> : <DisconnectOutlined />}
            color={seatMapQuery.connected ? 'green' : 'default'}
          >
            {seatMapQuery.connected ? 'Realtime đang kết nối' : 'Realtime chưa kết nối'}
          </Tag>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card
            title={
              <Space>
                <ShopOutlined />
                <span>Chọn chuyến & sơ đồ ghế</span>
              </Space>
            }
            extra={
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  void tripsQuery.refetch();
                  void seatMapQuery.refetch();
                }}
              >
                Làm mới
              </Button>
            }
          >
            <Row gutter={[12, 12]}>
              <Col xs={24} md={9}>
                <Typography.Text type="secondary">Tuyến đường</Typography.Text>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn tuyến"
                  style={{ width: '100%' }}
                  loading={routesQuery.isLoading}
                  value={routeId}
                  onChange={(value) => {
                    detachTrip();
                    setRouteId(value);
                  }}
                  options={(routesQuery.data ?? []).map((route) => ({
                    value: route.ma_tuyen,
                    label: `${route.ten_tuyen} (${route.tinh_di} - ${route.tinh_den})`,
                  }))}
                />
              </Col>
              <Col xs={24} md={7}>
                <Typography.Text type="secondary">Ngày đi</Typography.Text>
                <DatePicker
                  allowClear={false}
                  style={{ width: '100%' }}
                  format="DD/MM/YYYY"
                  value={travelDate}
                  disabledDate={(current) => current.isBefore(dayjs().startOf('day'))}
                  onChange={(value) => {
                    if (value) {
                      detachTrip();
                      setTravelDate(value);
                    }
                  }}
                />
              </Col>
              <Col xs={24} md={8}>
                <Typography.Text type="secondary">Chuyến xe</Typography.Text>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder={trips.length ? 'Chọn chuyến' : 'Không có chuyến sẵn bán'}
                  style={{ width: '100%' }}
                  loading={tripsQuery.isLoading}
                  value={tripId ?? undefined}
                  onChange={changeTrip}
                  options={trips.map((trip) => ({
                    value: trip.ma_chuyen,
                    label: `${formatTime(trip.thoi_gian_xuat_ben)} - ${trip.ten_tuyen} (${trip.so_ghe_trong} ghế trống)`,
                  }))}
                />
              </Col>
            </Row>

            {tripsQuery.error ? (
              <div style={{ marginTop: 16 }}>
                <QueryErrorAlert
                  error={tripsQuery.error}
                  title="Không thể tải danh sách chuyến"
                  onRetry={() => void tripsQuery.refetch()}
                />
              </div>
            ) : null}

            {tripId && tripDetailQuery.error ? (
              <div style={{ marginTop: 16 }}>
                <QueryErrorAlert
                  error={tripDetailQuery.error}
                  title="Không thể tải thông tin chuyến"
                  onRetry={() => void tripDetailQuery.refetch()}
                />
              </div>
            ) : null}

            {seatMapQuery.connectionError ? (
              <Alert
                style={{ marginTop: 16 }}
                type="warning"
                showIcon
                message="Mất kết nối thời gian thực"
                description={seatMapQuery.connectionError}
              />
            ) : null}

            <Divider />

            <Spin spinning={seatMapQuery.isFetching || Boolean(holdingSeat)}>
              <SeatMapBoard
                seatMap={seatMap}
                selected={selectedSeats}
                disabled={createBooking.isPending}
                onToggle={(seat) => void toggleSeat(seat)}
              />
            </Spin>
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card title="Thông tin đặt vé">
            {!tripId ? (
              <Empty description="Chọn chuyến xe để bắt đầu bán vé" />
            ) : (
              <Form<CounterFormValues>
                form={form}
                layout="vertical"
                initialValues={{ phuong_thuc_thanh_toan: 'TIEN_MAT' }}
                onFinish={(values) => void submitBooking(values)}
              >
                {selectedTrip ? (
                  <div className="counter-trip-summary">
                    <Typography.Text strong>{selectedTrip.ten_tuyen}</Typography.Text>
                    <Typography.Text type="secondary">
                      {formatTime(selectedTrip.thoi_gian_xuat_ben)} · {selectedTrip.bien_so_xe} ·{' '}
                      {selectedTrip.ten_loai_xe}
                    </Typography.Text>
                  </div>
                ) : null}

                <div className="counter-selected-seats">
                  <Typography.Text type="secondary">Ghế đã chọn</Typography.Text>
                  <div>
                    {selectedSeats.length === 0 ? (
                      <Typography.Text type="secondary">Chưa chọn ghế</Typography.Text>
                    ) : (
                      selectedSeats.map((seat) => (
                        <Tag key={seat} color="orange">
                          {seat}
                        </Tag>
                      ))
                    )}
                  </div>
                </div>

                {quoteQuery.error ? (
                  <QueryErrorAlert error={quoteQuery.error} title="Không thể báo giá" />
                ) : null}

                <div className="counter-quote">
                  <span>Tạm tính</span>
                  <strong>
                    {quoteQuery.isFetching
                      ? 'Đang tính...'
                      : formatCurrency(quoteQuery.data?.tong_tien ?? 0)}
                  </strong>
                </div>

                <Form.Item
                  name="ho_ten_khach"
                  label="Họ tên khách"
                  rules={[{ required: true, message: 'Vui lòng nhập họ tên khách' }]}
                >
                  <Input maxLength={100} placeholder="Nguyễn Văn A" />
                </Form.Item>
                <Form.Item
                  name="so_dien_thoai_khach"
                  label="Số điện thoại"
                  rules={[
                    { required: true, message: 'Vui lòng nhập số điện thoại' },
                    { pattern: /^0\d{9,10}$/, message: 'Số điện thoại không hợp lệ' },
                  ]}
                >
                  <Input maxLength={11} placeholder="0901234567" />
                </Form.Item>
                <Form.Item
                  name="email_khach"
                  label="Email (không bắt buộc)"
                  rules={[{ type: 'email', message: 'Email không hợp lệ' }]}
                >
                  <Input maxLength={100} placeholder="khachhang@example.com" />
                </Form.Item>

                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item
                      name="ma_diem_don"
                      label="Điểm đón"
                      rules={[{ required: true, message: 'Chọn điểm đón' }]}
                    >
                      <Select
                        placeholder="Điểm đón"
                        options={pickupStops(stops)
                          .filter((stop) => stop.ma_diem_dung)
                          .map((stop) => ({
                            value: stop.ma_diem_dung as number,
                            label: stop.ten_diem_dung,
                          }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="ma_diem_tra"
                      label="Điểm trả"
                      rules={[{ required: true, message: 'Chọn điểm trả' }]}
                    >
                      <Select
                        placeholder="Điểm trả"
                        options={dropoffStops(stops)
                          .filter((stop) => stop.ma_diem_dung)
                          .map((stop) => ({
                            value: stop.ma_diem_dung as number,
                            label: stop.ten_diem_dung,
                          }))}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="phuong_thuc_thanh_toan" label="Thanh toán">
                  <Radio.Group>
                    <Radio value="TIEN_MAT">Tiền mặt tại quầy</Radio>
                    <Radio value="VNPAY">VNPAY</Radio>
                  </Radio.Group>
                </Form.Item>

                {createBooking.error ? (
                  <QueryErrorAlert error={createBooking.error} title="Không thể tạo đơn" />
                ) : null}

                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  size="large"
                  icon={<CheckCircleOutlined />}
                  loading={createBooking.isPending}
                  disabled={selectedSeats.length === 0 || seatMapQuery.isFetching}
                >
                  Xác nhận tạo đơn
                </Button>
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  Thanh toán tiền mặt bởi nhân viên được ghi nhận đã thanh toán ngay khi tạo đơn.
                </Typography.Paragraph>
              </Form>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        open={Boolean(result)}
        title="Tạo đơn thành công"
        onCancel={() => setResult(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setResult(null)}>
            Đóng
          </Button>,
        ]}
      >
        {result ? <BookingResultContent result={result} /> : null}
      </Modal>
    </div>
  );
}

function BookingResultContent({ result }: { result: CreateCounterBookingResult }) {
  const booking: CreatedCounterBooking = result.don_dat_ve;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type={booking.trang_thai_don === 'DA_THANH_TOAN' ? 'success' : 'info'}
        showIcon
        message={
          booking.trang_thai_don === 'DA_THANH_TOAN'
            ? 'Đơn đã thanh toán'
            : 'Đơn đang chờ thanh toán'
        }
      />
      <div>
        <Typography.Text type="secondary">Mã đơn</Typography.Text>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {booking.ma_dinh_danh_don}
        </Typography.Title>
      </div>
      <div>
        <Typography.Text type="secondary">Tổng tiền</Typography.Text>
        <div>
          <Typography.Text strong>{formatCurrency(booking.tong_tien)}</Typography.Text>
        </div>
      </div>
      {result.payment_url ? (
        <Button type="primary" href={result.payment_url} target="_blank">
          Mở trang thanh toán VNPAY
        </Button>
      ) : null}
      {booking.thoi_gian_het_han ? (
        <Typography.Text type="secondary">
          Hạn thanh toán: {dayjs(booking.thoi_gian_het_han).format('DD/MM/YYYY HH:mm')}
        </Typography.Text>
      ) : null}
    </Space>
  );
}
