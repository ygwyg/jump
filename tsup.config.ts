import { defineConfig } from "tsup";

export default defineConfig([
  // Core (vanilla) bundle - no React dependency
  {
    entry: {
      index: "src/index.ts",
      "core/index": "src/core/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: true,
    splitting: true,
  },
  // React bundle - separate so tree-shaking drops it for vanilla users
  {
    entry: {
      "react/index": "src/react/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    treeshake: true,
    minify: true,
    external: ["react", "react-dom"],
  },
]);
