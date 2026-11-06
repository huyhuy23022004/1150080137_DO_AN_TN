import { AppState, type AppStateStatus } from 'react-native';

type AppResumeListener = () => void;
type AppStateSubscription = { remove: () => void };
type AppStateListener = (status: AppStateStatus) => void;

export function createAppResumeMonitor(
  getCurrentStatus: () => AppStateStatus,
  addAppStateListener: (listener: AppStateListener) => AppStateSubscription,
) {
  const listeners = new Set<AppResumeListener>();
  let currentStatus = getCurrentStatus();
  let subscription: AppStateSubscription | null = null;

  const stopListening = () => {
    subscription?.remove();
    subscription = null;
  };

  const handleStateChange = (nextStatus: AppStateStatus): boolean => {
    const resumed = currentStatus !== 'active' && nextStatus === 'active';
    currentStatus = nextStatus;

    if (!resumed) {
      return false;
    }

    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        continue;
      }
    }

    return true;
  };

  const subscribe = (listener: AppResumeListener): (() => void) => {
    listeners.add(listener);

    if (!subscription) {
      subscription = addAppStateListener(handleStateChange);
    }

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        stopListening();
      }
    };
  };

  return {
    handleStateChange,
    subscribe,
  };
}

export const appResumeMonitor = createAppResumeMonitor(
  () => (AppState.currentState ?? 'active') as AppStateStatus,
  (listener) => AppState.addEventListener('change', listener),
);

export function subscribeToAppResume(listener: AppResumeListener): () => void {
  return appResumeMonitor.subscribe(listener);
}
