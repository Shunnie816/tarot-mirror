import { rmSync } from "node:fs";
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
 *
 * Every path here is resolved from this file, never from the working
 * directory, so `node functions/build.mjs` works from anywhere. That matters
 * because `firebase deploy` runs the predeploy hook through a shell: a
 * `pnpm --filter` invocation comes back quoted, matches no workspace package,
 * and *still exits 0* — the build silently does not happen and whatever is
 * left in `lib/` gets deployed instead (Issue #38).
 */
const here = fileURLToPath(new URL(".", import.meta.url));
const packages = path.join(here, "..", "packages");
const src = (name, file = "index.ts") =>
  path.join(packages, name, "src", file);

const outDir = path.join(here, "lib");

// 先に消す。ビルドが走らなかったときに古い成果物が残っていると気づけないが、
// 消してあれば firebase-tools が main を見つけられずその場で落ちる。
// 黙って古いものを出荷するより、うるさく落ちるほうがいい。
rmSync(outDir, { recursive: true, force: true });

await build({
  entryPoints: [path.join(here, "src", "index.ts")],
  outfile: path.join(outDir, "index.js"),
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
