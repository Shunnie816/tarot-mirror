import { build } from "esbuild";

/**
 * Bundle the function, workspace packages and all.
 *
 * The workspace packages ship as TypeScript source with no build step, which
 * suits Next.js and Vitest but not a deploy: Cloud Functions installs from
 * `package.json` and has never heard of `workspace:*`. Bundling them in means
 * the deployed artifact depends only on real npm packages, and the engine and
 * dictionary reach production as the exact source this repo tested.
 *
 * The three runtime dependencies stay external. `firebase-functions` and
 * `firebase-admin` must be the copies the runtime provides, and bundling the
 * Anthropic SDK would buy nothing but a slower build.
 */
await build({
  entryPoints: ["src/index.ts"],
  outfile: "lib/index.js",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  external: ["firebase-functions", "firebase-admin", "@anthropic-ai/sdk"],
  logLevel: "info",
});
