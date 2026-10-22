/**
 * Tauri v2 injects `__TAURI_INTERNALS__` into every webview. The `__TAURI__`
 * global only exists when `withGlobalTauri` is enabled, so checking both keeps
 * detection working across configurations.
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;

  const candidate = window as Window & {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  };

  return "__TAURI_INTERNALS__" in candidate || "__TAURI__" in candidate;
}

/**
 * Runs in `<head>` **before the body is parsed**, so the desktop shell never
 * paints the marketing homepage. It marks the document (the style below hides
 * the page and shows a small launch screen), then replaces the location with
 * the editor workspace.
 *
 * A string rather than a React component on purpose: an inline head script
 * executes synchronously during HTML parsing, which a hydrated component
 * cannot do. Regular web browsers hit the first guard and are untouched.
 */
export const TAURI_ENTRY_SCRIPT = `(function(){try{var w=window;if(!("__TAURI_INTERNALS__" in w||"__TAURI__" in w))return;var p=w.location.pathname;if(p!=="/"&&p!=="/index.html")return;document.documentElement.setAttribute("data-tauri-entry","");w.location.replace("/editor");}catch(e){}})();`;

/** Pre-paint launch state for the desktop shell (inert in browsers). */
export const TAURI_ENTRY_STYLE = `html[data-tauri-entry]{background:#09090b}html[data-tauri-entry] body{visibility:hidden!important}html[data-tauri-entry]::after{content:"Opening Forgevyn\\2026";position:fixed;inset:0;display:grid;place-items:center;background:#09090b;color:#a1a1aa;font:500 13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.01em}`;
