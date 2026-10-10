import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Emit a fully static HTML site into the `out` folder on `next build`.
  output: "export",
  images: {
    unoptimized: true,
  },
  // `cacheComponents`/`partialPrefetching` require a server runtime and are
  // incompatible with `output: "export"`, so they cannot be enabled here.
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
