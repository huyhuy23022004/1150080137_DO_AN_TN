import { Empty, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import type { CounterSeat, CounterSeatMap } from '@/types/counter';

interface SeatMapBoardProps {
  seatMap: CounterSeatMap | null;
  selected: string[];
  disabled?: boolean;
  onToggle: (seat: CounterSeat) => void;
}

const FLOOR_LABELS: Record<number, string> = {
  1: 'Tầng dưới (A)',
  2: 'Tầng trên (B)',
};

const STATUS_LABELS: Record<CounterSeat['trang_thai'], string> = {
  TRONG: 'Ghế trống',
  DANG_GIU: 'Đang giữ',
  DA_DAT: 'Đã bán',
};

function SeatButton({
  seat,
  selected,
  disabled,
  onToggle,
}: {
  seat: CounterSeat;
  selected: boolean;
  disabled: boolean;
  onToggle: (seat: CounterSeat) => void;
}) {
  const unavailable = seat.trang_thai !== 'TRONG';

  return (
    <button
      type="button"
      className={[
        'counter-seat',
        seat.loai_cho === 'VIP' ? 'is-vip' : '',
        selected ? 'is-selected' : '',
        seat.trang_thai === 'DANG_GIU' ? 'is-held' : '',
        seat.trang_thai === 'DA_DAT' ? 'is-booked' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || (unavailable && !selected)}
      title={`${seat.ky_hieu_ghe} - ${STATUS_LABELS[seat.trang_thai]} - ${seat.loai_cho}`}
      onClick={() => onToggle(seat)}
    >
      {seat.ky_hieu_ghe}
    </button>
  );
}

function FloorMap({
  floor,
  seats,
  selected,
  disabled,
  onToggle,
}: {
  floor: number;
  seats: CounterSeat[];
  selected: Set<string>;
  disabled: boolean;
  onToggle: (seat: CounterSeat) => void;
}) {
  const rows = useMemo(() => {
    const maxRow = seats.reduce((max, seat) => Math.max(max, seat.hang), 0);
    const maxCol = seats.reduce((max, seat) => Math.max(max, seat.cot), 0);

    return Array.from({ length: maxRow }, (_value, rowIndex) => {
      const row = rowIndex + 1;
      return Array.from({ length: maxCol }, (_cell, colIndex) => {
        const col = colIndex + 1;
        return seats.find((seat) => seat.hang === row && seat.cot === col) ?? null;
      });
    });
  }, [seats]);

  const columns = seats.reduce((max, seat) => Math.max(max, seat.cot), 1);

  return (
    <div className="counter-floor">
      <div className="counter-floor-heading">
        <Typography.Text strong>{FLOOR_LABELS[floor] ?? `Tầng ${floor}`}</Typography.Text>
        <Tag>{seats.length} ghế</Tag>
      </div>
      <div className="counter-seat-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {rows.flatMap((row, rowIndex) =>
          row.map((seat, colIndex) =>
            seat ? (
              <SeatButton
                key={seat.ky_hieu_ghe}
                seat={seat}
                selected={selected.has(seat.ky_hieu_ghe)}
                disabled={disabled}
                onToggle={onToggle}
              />
            ) : (
              <span key={`${floor}-${rowIndex}-${colIndex}`} className="counter-seat-placeholder" />
            ),
          ),
        )}
      </div>
    </div>
  );
}

export function SeatMapBoard({ seatMap, selected, disabled, onToggle }: SeatMapBoardProps) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  if (!seatMap || seatMap.ghe.length === 0) {
    return <Empty description="Chọn chuyến xe để xem sơ đồ ghế" />;
  }

  const floors = Array.from(new Set(seatMap.ghe.map((seat) => seat.tang))).sort(
    (left, right) => left - right,
  );

  return (
    <div>
      <div className="counter-seat-legend">
        <span>
          <i className="counter-legend-dot is-free" /> Trống
        </span>
        <span>
          <i className="counter-legend-dot is-held" /> Đang giữ
        </span>
        <span>
          <i className="counter-legend-dot is-booked" /> Đã bán
        </span>
        <span>
          <i className="counter-legend-dot is-selected" /> Đang chọn
        </span>
        <span>
          <i className="counter-legend-dot is-vip" /> VIP
        </span>
      </div>

      <div className="counter-floors">
        {floors.map((floor) => (
          <FloorMap
            key={floor}
            floor={floor}
            seats={seatMap.ghe.filter((seat) => seat.tang === floor)}
            selected={selectedSet}
            disabled={Boolean(disabled)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}
