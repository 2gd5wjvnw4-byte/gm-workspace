import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks recently tapped action IDs for brief in-place confirmation feedback.
 */
export function useFlashConfirm(durationMs = 900) {
  const [flashedIds, setFlashedIds] = useState<Record<string, boolean>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const triggerFlash = useCallback(
    (id: string) => {
      if (timersRef.current[id]) {
        clearTimeout(timersRef.current[id]);
      }
      setFlashedIds((prev) => ({ ...prev, [id]: true }));
      timersRef.current[id] = setTimeout(() => {
        setFlashedIds((prev) => {
          if (!prev[id]) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        delete timersRef.current[id];
      }, durationMs);
    },
    [durationMs]
  );

  return { flashedIds, triggerFlash };
}
