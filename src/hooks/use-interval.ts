"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `callback` on a fixed interval without ever resetting the timer when the
 * callback identity changes (the callback is stored in a ref). Pass
 * `delay = null` to pause/clear the interval.
 *
 * This is the classic "stable interval" pattern: the interval is only
 * recreated when `delay` itself changes, so frequent state updates from the
 * callback can't stall or restart the timer.
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  // Always keep the latest callback without touching the timer.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = window.setInterval(() => savedCallback.current(), delay);
    return () => window.clearInterval(id);
  }, [delay]);
}
