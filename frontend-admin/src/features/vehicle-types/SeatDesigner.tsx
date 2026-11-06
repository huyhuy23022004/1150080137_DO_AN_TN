import { App, Button, Empty, InputNumber, Segmented, Select, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import type { SeatInput, SeatType } from '@/types/vehicle-type';

interface SeatDesignerProps {
  seats: SeatInput[];
  soTang: number;
  disabled?: boolean;
  onChange: (seats: SeatInput[]) => void;
}

function maxOf(seats: SeatInput[], field: 'hang' | 'cot', fallback: number): number {
  return seats.reduce((max, seat) => Math.max(max, seat[field]), fallback);
}

function sortSeats(seats: SeatInput[]): SeatInput[] {
  return [...seats].sort(
    (left, right) =>
      left.tang - right.tang ||
      left.hang - right.hang ||
      left.cot - right.cot ||
      left.ky_hieu_ghe.localeCompare(right.ky_hieu_ghe),
  );
}

export function SeatDesigner({ seats, soTang, disabled, onChange }: SeatDesignerProps) {
  const { message, modal } = App.useApp();
  const firstFloorSeats = seats.filter((seat) => seat.tang === 1);
  const [activeFloor, setActiveFloor] = useState(1);
  const [rows, setRows] = useState(() => maxOf(firstFloorSeats, 'hang', 4));
  const [cols, setCols] = useState(() => maxOf(firstFloorSeats, 'cot', 2));
  const [defaultType, setDefaultType] = useState<SeatType>('THUONG');

  const floor = Math.min(activeFloor, soTang);
  const floorSeats = sortSeats(seats.filter((seat) => seat.tang === floor));
  const gridColumns = Math.max(cols, maxOf(floorSeats, 'cot', 1));
  const vipCount = seats.filter((seat) => seat.loai_cho === 'VIP').length;

  function selectFloor(nextFloor: number): void {
    setActiveFloor(nextFloor);
    const nextSeats = seats.filter((seat) => seat.tang === nextFloor);
    setRows(maxOf(nextSeats, 'hang', 4));
    setCols(maxOf(nextSeats, 'cot', 2));
  }

  function toggleSeatType(code: string): void {
    if (disabled) {
      return;
    }

    onChange(
      seats.map((seat) =>
        seat.tang === floor && seat.ky_hieu_ghe === code
          ? { ...seat, loai_cho: seat.loai_cho === 'VIP' ? 'THUONG' : 'VIP' }
          : seat,
      ),
    );
  }

  async function generateFloor(): Promise<void> {
    if (disabled) {
      return;
    }

    const otherSeats = seats.filter((seat) => seat.tang !== floor);
    const total = otherSeats.length + rows * cols;

    if (rows < 1 || cols < 1) {
      message.error('Số hàng và số cột phải lớn hơn 0');
      return;
    }

    if (total > 200) {
      message.error('Tổng số ghế không được vượt quá 200');
      return;
    }

    if (floorSeats.length > 0) {
      const confirmed = await modal.confirm({
        title: `Tạo lại sơ đồ tầng ${floor}?`,
        content: `Toàn bộ ${floorSeats.length} ghế hiện có trên tầng ${floor} sẽ được thay thế.`,
        okText: 'Tạo lại',
        cancelText: 'Hủy',
        okButtonProps: { danger: true },
      });

      if (!confirmed) {
        return;
      }
    }

    const usedCodes = new Set(otherSeats.map((seat) => seat.ky_hieu_ghe));
    const prefix = String.fromCharCode(64 + floor);
    const generated: SeatInput[] = [];
    let index = 1;

    for (let row = 1; row <= rows; row += 1) {
      for (let col = 1; col <= cols; col += 1) {
        const code = `${prefix}${String(index).padStart(2, '0')}`;
        if (usedCodes.has(code)) {
          message.error(`Ký hiệu ghế ${code} đã tồn tại ở tầng khác`);
          return;
        }

        generated.push({
          ky_hieu_ghe: code,
          tang: floor,
          hang: row,
          cot: col,
          loai_cho: defaultType,
        });
        index += 1;
      }
    }

    onChange(sortSeats([...otherSeats, ...generated]));
    message.success(`Đã tạo ${generated.length} ghế cho tầng ${floor}`);
  }

  return (
    <div className="seat-designer">
      <Space wrap>
        <Segmented
          value={floor}
          disabled={disabled}
          options={Array.from({ length: soTang }, (_value, index) => ({
            value: index + 1,
            label: `Tầng ${index + 1}`,
          }))}
          onChange={(value) => selectFloor(Number(value))}
        />
        <Tag color="blue">{seats.length} ghế</Tag>
        <Tag color="orange">{vipCount} VIP</Tag>
      </Space>

      <div className="seat-floor-toolbar">
        <Typography.Text type="secondary">Số hàng</Typography.Text>
        <InputNumber
          min={1}
          max={20}
          value={rows}
          disabled={disabled}
          onChange={(value) => setRows(value ?? 1)}
          style={{ width: 80 }}
        />
        <Typography.Text type="secondary">Số cột</Typography.Text>
        <InputNumber
          min={1}
          max={8}
          value={cols}
          disabled={disabled}
          onChange={(value) => setCols(value ?? 1)}
          style={{ width: 80 }}
        />
        <Select<SeatType>
          value={defaultType}
          disabled={disabled}
          style={{ width: 130 }}
          onChange={setDefaultType}
          options={[
            { value: 'THUONG', label: 'Ghế thường' },
            { value: 'VIP', label: 'Ghế VIP' },
          ]}
        />
        <Button type="primary" ghost disabled={disabled} onClick={() => void generateFloor()}>
          Tạo lưới tầng {floor}
        </Button>
      </div>

      <Typography.Text type="secondary">
        Nhấn vào từng ghế để đổi giữa ghế thường và VIP. Tạo lưới sẽ thay thế toàn bộ ghế của tầng
        đang chọn.
      </Typography.Text>

      {floorSeats.length === 0 ? (
        <Empty description={`Tầng ${floor} chưa có ghế`} />
      ) : (
        <div
          className="seat-grid"
          style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(54px, 1fr))` }}
        >
          {floorSeats.map((seat) => (
            <button
              key={seat.ky_hieu_ghe}
              type="button"
              disabled={disabled}
              className={seat.loai_cho === 'VIP' ? 'seat-button is-vip' : 'seat-button'}
              title={`${seat.ky_hieu_ghe} - ${seat.loai_cho === 'VIP' ? 'VIP' : 'Thường'}`}
              onClick={() => toggleSeatType(seat.ky_hieu_ghe)}
            >
              <span>
                {seat.ky_hieu_ghe}
                {seat.loai_cho === 'VIP' ? ' ★' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SeatMapPreview({ seats, soTang }: { seats: SeatInput[]; soTang: number }) {
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {Array.from({ length: soTang }, (_value, index) => {
        const floor = index + 1;
        const floorSeats = sortSeats(seats.filter((seat) => seat.tang === floor));
        const columns = maxOf(floorSeats, 'cot', 1);

        return (
          <div key={floor}>
            <Typography.Text strong>Tầng {floor}</Typography.Text>
            <div
              className="seat-grid"
              style={{
                marginTop: 8,
                gridTemplateColumns: `repeat(${columns}, minmax(44px, 1fr))`,
              }}
            >
              {floorSeats.map((seat) => (
                <div
                  key={seat.ky_hieu_ghe}
                  className={seat.loai_cho === 'VIP' ? 'seat-button is-vip' : 'seat-button'}
                  style={{ height: 38, minWidth: 44, cursor: 'default' }}
                >
                  {seat.ky_hieu_ghe}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </Space>
  );
}
