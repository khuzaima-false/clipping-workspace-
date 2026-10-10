"use client";

import { useSyncExternalStore } from "react";
import { isAdFree } from "@/lib/credits";
import { useWorkspaceStore } from "@/store/workspace";

const subscribeNoop = () => () => {};
const getClientMounted = () => true;
const getServerMounted = () => false;

/**
 * Ad-free status for the current profile.
 *
 * The check reads the current time (`ad_free_until`), so it is evaluated only
 * after hydration — during the static prerender the server snapshot returns
 * `false`, keeping `new Date()` out of the render path (Next.js rejects
 * unstable values during prerendering).
 */
export function useIsAdFree(): boolean {
  const profile = useWorkspaceStore((state) => state.profile);
  const mounted = useSyncExternalStore(
    subscribeNoop,
    getClientMounted,
    getServerMounted
  );
  return mounted ? isAdFree(profile) : false;
}
