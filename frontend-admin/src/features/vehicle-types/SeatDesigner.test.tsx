import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../tests/test-utils';
import { SeatDesigner, SeatMapPreview } from './SeatDesigner';
import type { SeatInput } from '@/types/vehicle-type';

const SEATS: SeatInput[] = [
  { ky_hieu_ghe: 'A01', tang: 1, hang: 1, cot: 1, loai_cho: 'THUONG' },
  { ky_hieu_ghe: 'A02', tang: 1, hang: 1, cot: 2, loai_cho: 'VIP' },
  { ky_hieu_ghe: 'B01', tang: 2, hang: 1, cot: 1, loai_cho: 'THUONG' },
];

describe('SeatDesigner', () => {
  it('toggles a seat between normal and VIP', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderWithProviders(<SeatDesigner seats={SEATS} soTang={2} onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'A01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /A02/ })).toHaveClass('is-vip');

    await user.click(screen.getByRole('button', { name: 'A01' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nextSeats = onChange.mock.calls[0]?.[0] as SeatInput[];
    expect(nextSeats.find((seat) => seat.ky_hieu_ghe === 'A01')?.loai_cho).toBe('VIP');
  });

  it('switches between floors', async () => {
    const user = userEvent.setup();

    renderWithProviders(<SeatDesigner seats={SEATS} soTang={2} onChange={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'B01' })).not.toBeInTheDocument();

    await user.click(screen.getByText('Tầng 2'));

    expect(screen.getByRole('button', { name: 'B01' })).toBeInTheDocument();
  });
});

describe('SeatMapPreview', () => {
  it('renders both floor labels', () => {
    renderWithProviders(<SeatMapPreview seats={SEATS} soTang={2} />);

    expect(screen.getByText('Tầng 1')).toBeInTheDocument();
    expect(screen.getByText('Tầng 2')).toBeInTheDocument();
    expect(screen.getByText('A01')).toBeInTheDocument();
    expect(screen.getByText('B01')).toBeInTheDocument();
  });
});
