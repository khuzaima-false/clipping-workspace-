/**
 * Canonical desktop-shell detection.
 *
 * Tauri v2 defines `window.isTauri = true` and injects
 * `window.__TAURI_INTERNALS__` before any page script runs; `__TAURI__` exists
 * when `withGlobalTauri` is enabled. Checking all three is deliberately
 * redundant so detection survives Tauri config changes.
 */
export const isTauriEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    "__TAURI__" in window ||
    "__TAURI_INTERNALS__" in window ||
    (window as Window & { isTauri?: boolean }).isTauri === true
  );
};

/** @deprecated Use {@link isTauriEnvironment}. Kept as an alias for callers. */
export const isTauri = isTauriEnvironment;

/**
 * Stable project id used by the desktop shell on first launch. Existing
 * desktop installs keep whatever id is already remembered, so this only seeds
 * a fresh install — no data migration.
 */
export const DESKTOP_PROJECT_ID = "local-demo-project";

/**
 * The desktop shell is local-first: `/editor` is the only route it needs.
 * Everything else (marketing, login, dashboard, projects, OAuth callbacks) is
 * a cloud/web surface and is redirected away before it can render.
 */
export function isEditorPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname === "/editor" ||
    pathname === "/editor.html" ||
    pathname.startsWith("/editor/")
  );
}

/**
 * Runs in `<head>` **before the body is parsed**, so the desktop shell never
 * paints a marketing, login, or dashboard page. In Tauri it marks the document
 * (the style below hides the page and shows a small launch screen), ensures a
 * local project id exists, then replaces the location with the editor.
 * Regular browsers hit the first guard and are untouched.
 *
 * A string rather than a React component on purpose: an inline head script
 * executes synchronously during HTML parsing, which a hydrated component
 * cannot do.
 */
export const TAURI_ENTRY_SCRIPT = `(function(){try{var w=window;if(!("__TAURI_INTERNALS__" in w||"__TAURI__" in w||w.isTauri===true))return;var p=w.location.pathname;while(p.length>1&&p.charAt(p.length-1)==="/"){p=p.slice(0,-1)}if(p==="/editor"||p==="/editor.html"||p.indexOf("/editor/")===0)return;document.documentElement.setAttribute("data-tauri-entry","");var id=null;try{id=w.localStorage.getItem("forgevyn:active-project")}catch(e){}if(!id||id.indexOf("local-")!==0){id="${DESKTOP_PROJECT_ID}";try{w.localStorage.setItem("forgevyn:active-project",id)}catch(e){}}w.location.replace("/editor?id="+encodeURIComponent(id));}catch(e){}})();`;

/** Pre-paint launch state for the desktop shell (inert in browsers). */
export const TAURI_ENTRY_STYLE = `html[data-tauri-entry]{background:#09090b}html[data-tauri-entry] body{visibility:hidden!important}html[data-tauri-entry]::after{content:"Opening Forgevyn\\2026";position:fixed;inset:0;display:grid;place-items:center;background:#09090b;color:#a1a1aa;font:500 13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.01em}`;

/* ------------------------------------------------------------------ */
/* Inspector <-> Rust frame-processing payloads                        */
/* ------------------------------------------------------------------ */

export type InspectorWheelPoint = {
  x: number;
  y: number;
  r?: number;
  g?: number;
  b?: number;
  lum?: number;
  sat?: number;
};

export type InspectorColorWheels = {
  lift: InspectorWheelPoint;
  gamma: InspectorWheelPoint;
  gain: InspectorWheelPoint;
};

export type InspectorClipTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
};

export type InspectorParams = {
  clipId: string | null;
  transform: InspectorClipTransform;
  colorWheels: InspectorColorWheels;
};

/**
 * Mirrors the current Inspector state into the Tauri backend. No-ops in a
 * browser and never throws into the editor if the command is unavailable.
 */
export async function syncInspectorParams(
  params: InspectorParams
): Promise<void> {
  if (!isTauriEnvironment()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("sync_inspector_params", { params });
  } catch (error) {
    console.warn("[tauri] sync_inspector_params failed", error);
  }
}

/** Reads the latest Inspector snapshot from the desktop shell (debug/tests). */
export async function getInspectorParams(): Promise<InspectorParams | null> {
  if (!isTauriEnvironment()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<InspectorParams | null>("get_inspector_params");
  } catch (error) {
    console.warn("[tauri] get_inspector_params failed", error);
    return null;
  }
}
