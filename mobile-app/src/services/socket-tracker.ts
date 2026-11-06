export interface ReconnectableSocket {
  connected: boolean;
  connect(): void;
  disconnect(): void;
}

export function createSocketTracker() {
  const sockets = new Set<ReconnectableSocket>();

  return {
    track(socket: ReconnectableSocket): void {
      sockets.add(socket);
    },
    untrack(socket: ReconnectableSocket): void {
      sockets.delete(socket);
    },
    reconnectAll(): void {
      for (const socket of [...sockets]) {
        if (socket.connected) {
          socket.disconnect();
        }
        socket.connect();
      }
    },
    size(): number {
      return sockets.size;
    },
  };
}

export const tripSocketTracker = createSocketTracker();
