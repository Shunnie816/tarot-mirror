/** @type {import('next').NextConfig} */
const nextConfig = {
  // ワークスペースの各パッケージは素の TypeScript を src/ から公開しているので、
  // Next 側でトランスパイルさせる必要がある（ビルド済み dist を持たせていない）。
  transpilePackages: [
    "@tarot-mirror/content",
    "@tarot-mirror/decks",
    "@tarot-mirror/engine",
  ],

  // dev サーバーは localhost で待ち受けるが、E2E は 127.0.0.1 で叩く
  // （`playwright.config.ts` の baseURL）。Next から見ると別オリジンで、
  // 16 からは /_next/* の取得が既定で拒否される。HMR が落ちるだけに見えて、
  // 実際にはクライアント側の JS が丸ごと動かなくなる。
  //
  // Next 15 のあいだは警告で済んでいて、E2E のログにもずっと出ていた
  // （"In a future major version of Next.js, you will need to explicitly
  // configure allowedDevOrigins"）。その「将来のメジャー」がこれ。
  //
  // 効くのは `next dev` だけで、本番のビルドにも配信にも関わらない。
  allowedDevOrigins: ["127.0.0.1"],

  webpack: (config) => {
    // パッケージ内の import は ESM の作法どおり "./ids.js" と拡張子付きで書かれて
    // いるが、実体は .ts。webpack に .js → .ts の読み替えを教える。
    //
    // Next 16 の既定は Turbopack で、こちらは transpilePackages 越しの
    // ワークスペースには同じ読み替えをしてくれない（"Can't resolve './ids.js'"
    // が 43 件出る）。turbopack.resolveExtensions は拡張子**無し**の import に
    // 効くもので、拡張子付きの読み替えには使えない。
    //
    // なので dev / build とも --webpack で建てている（package.json）。
    // Turbopack に移るには、パッケージ側の import から .js を落とすほうが筋が
    // いい（tsconfig は moduleResolution: Bundler なので TS 的には落とせる）が、
    // 3パッケージ横断で esbuild と vitest の解決にも触るので別でやる（#93）。
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
