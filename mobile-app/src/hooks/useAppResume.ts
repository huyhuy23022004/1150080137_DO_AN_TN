import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { subscribeToAppResume } from '../services/app-lifecycle';

export function useAppResume(callback: () => void, enabled = true): void {
  const isFocused = useIsFocused();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !isFocused) {
      return;
    }

    return subscribeToAppResume(() => callbackRef.current());
  }, [enabled, isFocused]);
}
