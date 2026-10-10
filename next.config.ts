import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Transformers.js is browser-only (ONNX Runtime Web + WASM). Keep it out of
  // the server bundle — it is loaded lazily from a client action.
  serverExternalPackages: ["@xenova/transformers"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
    // Node-only native backends and builtins shipped by transformers.js are
    // unused in the browser; stub them out so Turbopack does not resolve them
    // (and so `import fs from 'fs'` yields an object, not `undefined`).
    resolveAlias: {
      fs: { browser: "./src/lib/empty.ts" },
      path: { browser: "./src/lib/empty.ts" },
      url: { browser: "./src/lib/empty.ts" },
      sharp: { browser: "./src/lib/empty.ts" },
      "onnxruntime-node": { browser: "./src/lib/empty.ts" },
    },
  },
};

export default nextConfig;
