"use client";

import type { Update } from "@tauri-apps/plugin-updater";
import { isTauriEnvironment } from "@/lib/tauri";

/**
 * Must stay in sync with `plugins.updater.endpoints` in `tauri.conf.json`.
 * The repository name ends with a hyphen.
 */
export const UPDATER_ENDPOINT =
  "https://github.com/khuzaima-false/clipping-workspace-/releases/latest/download/latest.json";

export const UPDATE_CHECK_EVENT = "forgevyn:update-check-result";

export type UpdateCheckOutcome =
  | {
      status: "available";
      update: Update;
      currentVersion: string;
      endpoint: string;
    }
  | {
      status: "uptodate";
      currentVersion: string;
      latestVersion: string;
      endpoint: string;
    }
  | {
      status: "error";
      error: string;
      currentVersion: string | null;
      endpoint: string;
    };

function dispatch(outcome: UpdateCheckOutcome): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<UpdateCheckOutcome>(UPDATE_CHECK_EVENT, {
      detail: outcome,
    })
  );
}

/**
 * One shared update-check path for launch checks and the Help menu.
 * Errors are always logged with the endpoint and current version so desktop
 * diagnostics no longer disappear into a silent catch.
 */
export async function runUpdateCheck(): Promise<UpdateCheckOutcome> {
  if (!isTauriEnvironment()) {
    const outcome: UpdateCheckOutcome = {
      status: "error",
      error: "The Tauri updater is only available in the desktop app.",
      currentVersion: null,
      endpoint: UPDATER_ENDPOINT,
    };
    console.warn("[updater] check skipped:", outcome.error);
    dispatch(outcome);
    return outcome;
  }

  let currentVersion: string | null = null;
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    currentVersion = await getVersion().catch(() => null);
    const { check } = await import("@tauri-apps/plugin-updater");

    console.info("[updater] checking", {
      endpoint: UPDATER_ENDPOINT,
      currentVersion,
    });

    const found = await check({ timeout: 20_000 });
    if (!found) {
      const outcome: UpdateCheckOutcome = {
        status: "uptodate",
        currentVersion: currentVersion ?? "unknown",
        latestVersion: currentVersion ?? "unknown",
        endpoint: UPDATER_ENDPOINT,
      };
      console.info(
        `[updater] no update. current=${outcome.currentVersion} endpoint=${UPDATER_ENDPOINT}`
      );
      dispatch(outcome);
      return outcome;
    }

    const outcome: UpdateCheckOutcome = {
      status: "available",
      update: found,
      currentVersion: currentVersion ?? "unknown",
      endpoint: UPDATER_ENDPOINT,
    };
    console.info(
      `[updater] update available. current=${outcome.currentVersion} latest=${found.version} endpoint=${UPDATER_ENDPOINT}`
    );
    dispatch(outcome);
    return outcome;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const outcome: UpdateCheckOutcome = {
      status: "error",
      error: message,
      currentVersion,
      endpoint: UPDATER_ENDPOINT,
    };
    console.error("[updater] check failed:", {
      endpoint: UPDATER_ENDPOINT,
      currentVersion,
      error: message,
    });
    dispatch(outcome);
    return outcome;
  }
}
