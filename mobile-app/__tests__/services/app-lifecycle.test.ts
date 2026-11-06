import type { AppStateStatus } from 'react-native';
import { createAppResumeMonitor } from '../../src/services/app-lifecycle';

function createHarness(initialStatus: AppStateStatus = 'active') {
  let addCount = 0;
  let removeCount = 0;
  let stateListener: ((status: AppStateStatus) => void) | null = null;

  const monitor = createAppResumeMonitor(
    () => initialStatus,
    (listener) => {
      addCount += 1;
      stateListener = listener;

      return {
        remove: () => {
          removeCount += 1;
          stateListener = null;
        },
      };
    },
  );

  return {
    monitor,
    addCount: () => addCount,
    removeCount: () => removeCount,
    emit: (status: AppStateStatus) => stateListener?.(status),
    hasListener: () => stateListener !== null,
  };
}

describe('app resume monitor', () => {
  it('notifies listeners when the app returns to the foreground', () => {
    const harness = createHarness('background');
    const listener = jest.fn();

    harness.monitor.subscribe(listener);

    expect(harness.monitor.handleStateChange('background')).toBe(false);
    expect(harness.monitor.handleStateChange('active')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores inactive, background and repeated active transitions', () => {
    const harness = createHarness('active');
    const listener = jest.fn();

    harness.monitor.subscribe(listener);

    expect(harness.monitor.handleStateChange('inactive')).toBe(false);
    expect(harness.monitor.handleStateChange('background')).toBe(false);
    expect(harness.monitor.handleStateChange('active')).toBe(true);
    expect(harness.monitor.handleStateChange('active')).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('shares one AppState subscription until the last listener unsubscribes', () => {
    const harness = createHarness('background');
    const first = jest.fn();
    const second = jest.fn();

    const unsubscribeFirst = harness.monitor.subscribe(first);
    const unsubscribeSecond = harness.monitor.subscribe(second);

    expect(harness.addCount()).toBe(1);

    unsubscribeFirst();
    expect(harness.removeCount()).toBe(0);
    expect(harness.hasListener()).toBe(true);

    unsubscribeSecond();
    expect(harness.removeCount()).toBe(1);
    expect(harness.hasListener()).toBe(false);
  });

  it('keeps notifying other listeners when one listener throws', () => {
    const harness = createHarness('background');
    const listener = jest.fn();

    harness.monitor.subscribe(() => {
      throw new Error('listener failure');
    });
    harness.monitor.subscribe(listener);

    harness.emit('active');

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
