"use client";

import { useSyncExternalStore } from "react";
import { isTauri } from "@/lib/tauri";

// The Tauri globals never change during a session, so there is nothing to
// subscribe to — `useSyncExternalStore` just gives us a hydration-safe read.
const subscribe = () => () => {};
const getSnapshot = () => isTauri();
const getServerSnapshot = () => false;

/**
 * SSR-safe desktop detection. Returns `false` on the server (and for the
 * hydration render), then the real value on the client. Use this instead of
 * calling `isTauri()` during render to avoid hydration mismatches.
 */
export function useIsTauri(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
