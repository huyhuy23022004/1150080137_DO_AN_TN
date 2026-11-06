type Listener<T> = (event: T) => void;

export interface SeatHeldRealtimeEvent {
  ma_chuyen: number;
  danh_sach_ghe: string[];
  owner_ref: string;
  expires_at: string;
  ttl_seconds: number;
}

export interface SeatReleasedRealtimeEvent {
  ma_chuyen: number;
  danh_sach_ghe: string[];
  owner_ref?: string;
  reason: 'RELEASED' | 'EXPIRED' | 'BOOKING_EXPIRED' | 'CANCELLED';
}

export interface SeatBookedRealtimeEvent {
  ma_chuyen: number;
  danh_sach_ghe: string[];
  ma_don_ve: string;
  owner_ref?: string;
  trang_thai_don: string;
}

const heldListeners = new Set<Listener<SeatHeldRealtimeEvent>>();
const releasedListeners = new Set<Listener<SeatReleasedRealtimeEvent>>();
const bookedListeners = new Set<Listener<SeatBookedRealtimeEvent>>();

function subscribe<T>(listeners: Set<Listener<T>>, listener: Listener<T>): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit<T>(listeners: Set<Listener<T>>, event: T): void {
  for (const listener of listeners) {
    listener(event);
  }
}

export function onSeatHeld(listener: Listener<SeatHeldRealtimeEvent>): () => void {
  return subscribe(heldListeners, listener);
}

export function onSeatReleased(listener: Listener<SeatReleasedRealtimeEvent>): () => void {
  return subscribe(releasedListeners, listener);
}

export function onSeatBooked(listener: Listener<SeatBookedRealtimeEvent>): () => void {
  return subscribe(bookedListeners, listener);
}

export function publishSeatHeld(event: SeatHeldRealtimeEvent): void {
  emit(heldListeners, event);
}

export function publishSeatReleased(event: SeatReleasedRealtimeEvent): void {
  emit(releasedListeners, event);
}

export function publishSeatBooked(event: SeatBookedRealtimeEvent): void {
  emit(bookedListeners, event);
}
