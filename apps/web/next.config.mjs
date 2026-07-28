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
};

export default nextConfig;
