"use client";

/**
 * Tiny event bus for cross-panel editor intents (no extra state in the store,
 * so the persisted project schema stays untouched).
 */

export type EditorTabRequest =
  | "media"
  | "effects"
  | "properties"
  | "clip"
  | "speed"
  | "captions"
  | "audio"
  | "stickers"
  | "record"
  | "studio";

const TAB_EVENT = "forgevyn:panel-tab";

/** Asks the left panel to switch to `tab` (e.g. selecting a caption → Props). */
export function requestEditorTab(tab: EditorTabRequest): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<EditorTabRequest>(TAB_EVENT, { detail: tab }));
}

/** Subscribes to tab requests. Returns an unsubscribe function. */
export function onEditorTabRequest(
  handler: (tab: EditorTabRequest) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<EditorTabRequest>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener(TAB_EVENT, listener);
  return () => window.removeEventListener(TAB_EVENT, listener);
}
