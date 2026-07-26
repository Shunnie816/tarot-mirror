import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

/**
 * Bundle the function, workspace packages and all.
 *
 * The workspace packages ship as TypeScript source with no build step, which
 * suits Next.js and Vitest but not a deploy: Cloud Functions installs from
 * `package.json` with npm, and npm cannot parse `workspace:*` — it fails while
 * *reading* the manifest, so even listing them under devDependencies breaks
 * the deploy. They are therefore not in the manifest at all, and are resolved
 * here by path instead.
 *
 * A missing entry below is a build error ("Could not resolve"), not a runtime
 * one: esbuild refuses to leave a bare specifier unbundled unless it is listed
 * in `external`. That is what makes this list safe to maintain by hand.
 *
 * The three runtime dependencies stay external. `firebase-functions` and
 * `firebase-admin` must be the copies the runtime provides, and bundling the
 * Anthropic SDK would buy nothing but a slower build.
 */
const packages = fileURLToPath(new URL("../packages/", import.meta.url));
const src = (name, file = "index.ts") =>
  path.join(packages, name, "src", file);

await build({
  entryPoints: ["src/index.ts"],
  outfile: "lib/index.js",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  external: ["firebase-functions", "firebase-admin", "@anthropic-ai/sdk"],
  alias: {
    "@tarot-mirror/content": src("content"),
    // モデルへの指示だけ別の入口にしてある（辞書に混ぜるとブラウザにも載るため）。
    "@tarot-mirror/content/prompt": src("content", "prompt.ts"),
    "@tarot-mirror/decks": src("decks"),
    "@tarot-mirror/engine": src("engine"),
  },
  logLevel: "info",
});
