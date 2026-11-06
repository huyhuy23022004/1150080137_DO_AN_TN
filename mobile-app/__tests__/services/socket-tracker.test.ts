import { createSocketTracker, type ReconnectableSocket } from '../../src/services/socket-tracker';

function createFakeSocket(connected = false) {
  const calls: string[] = [];
  const socket: ReconnectableSocket = {
    connected,
    connect: () => {
      calls.push('connect');
    },
    disconnect: () => {
      calls.push('disconnect');
    },
  };

  return { calls, socket };
}

describe('socket tracker', () => {
  it('reconnects a tracked socket that is currently disconnected', () => {
    const tracker = createSocketTracker();
    const { calls, socket } = createFakeSocket(false);

    tracker.track(socket);
    tracker.reconnectAll();

    expect(calls).toEqual(['connect']);
  });

  it('forces a fresh handshake for a connected socket', () => {
    const tracker = createSocketTracker();
    const { calls, socket } = createFakeSocket(true);

    tracker.track(socket);
    tracker.reconnectAll();

    expect(calls).toEqual(['disconnect', 'connect']);
  });

  it('tracks each socket once and ignores untracked sockets', () => {
    const tracker = createSocketTracker();
    const first = createFakeSocket(false);
    const second = createFakeSocket(false);

    tracker.track(first.socket);
    tracker.track(first.socket);
    tracker.track(second.socket);
    tracker.untrack(second.socket);

    expect(tracker.size()).toBe(1);

    tracker.reconnectAll();

    expect(first.calls).toEqual(['connect']);
    expect(second.calls).toEqual([]);
  });
});
