import { useEffect, useRef } from 'react';

// Keep successful mobile results visible briefly before resuming the scanner.
export function useMobileScanReturn(success, onReturn) {
  const callback = useRef(onReturn);
  callback.current = onReturn;
  useEffect(() => {
    if (!success || !window.matchMedia('(max-width: 900px)').matches) return;
    const timer = window.setTimeout(() => callback.current(), 4000);
    return () => window.clearTimeout(timer);
  }, [success]);
}
