/**
 * Empty stub used by `turbopack.resolveAlias` to silence Node-only
 * dependencies (`sharp`, `onnxruntime-node`) that ship inside
 * `@xenova/transformers` but are never used in the browser.
 */
const empty: Record<string, never> = {};
export default empty;
