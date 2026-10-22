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
 * (the style below hides the page and shows a small launch screen), then
 * replaces the location with the editor. Regular browsers hit the first guard
 * and are untouched.
 *
 * A string rather than a React component on purpose: an inline head script
 * executes synchronously during HTML parsing, which a hydrated component
 * cannot do.
 */
export const TAURI_ENTRY_SCRIPT = `(function(){try{var w=window;if(!("__TAURI_INTERNALS__" in w||"__TAURI__" in w))return;var p=w.location.pathname;while(p.length>1&&p.charAt(p.length-1)==="/"){p=p.slice(0,-1)}if(p==="/editor"||p==="/editor.html"||p.indexOf("/editor/")===0)return;document.documentElement.setAttribute("data-tauri-entry","");var id=null;try{id=w.localStorage.getItem("forgevyn:active-project")}catch(e){}if(!id||id.indexOf("local-")!==0){id="local-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);try{w.localStorage.setItem("forgevyn:active-project",id)}catch(e){}}w.location.replace("/editor?id="+encodeURIComponent(id));}catch(e){}})();`;

/** Pre-paint launch state for the desktop shell (inert in browsers). */
export const TAURI_ENTRY_STYLE = `html[data-tauri-entry]{background:#09090b}html[data-tauri-entry] body{visibility:hidden!important}html[data-tauri-entry]::after{content:"Opening Forgevyn\\2026";position:fixed;inset:0;display:grid;place-items:center;background:#09090b;color:#a1a1aa;font:500 13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.01em}`;
