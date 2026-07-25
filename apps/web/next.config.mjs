/** @type {import('next').NextConfig} */
const nextConfig = {
  // ワークスペースの各パッケージは素の TypeScript を src/ から公開しているので、
  // Next 側でトランスパイルさせる必要がある（ビルド済み dist を持たせていない）。
  transpilePackages: [
    "@tarot-mirror/content",
    "@tarot-mirror/decks",
    "@tarot-mirror/engine",
  ],

  webpack: (config) => {
    // パッケージ内の import は ESM の作法どおり "./ids.js" と拡張子付きで書かれている
    // （tsconfig の verbatimModuleSyntax がそれを要求する）。実体は .ts なので、
    // webpack に .js → .ts の読み替えを教える。
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
