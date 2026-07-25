import type { Metadata } from "next";
import { Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";

import "../design-system/tokens.css";
import "../design-system/tokens.board.css";
import "../design-system/board.css";
import "../design-system/screens.css";
import "../design-system/reading.css";
import "./globals.css";

/**
 * 明朝＝読み物、ゴシック＝ラベル。この使い分けが体験設計そのものなので、
 * 両方を自前配信して外部リクエストに依存させない。
 *
 * preload を切っているのは日本語フォントだから。CJK は unicode-range で
 * 100以上のサブセットに分割されて配信されるため、全部を preload すると
 * 先読みが渋滞して逆に遅くなる。tokens.css 側に Hiragino / Yu の
 * フォールバックを積んであるので、読み込み前でも明朝・ゴシックの別は保たれる。
 */
const serif = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-noto-serif-jp",
  display: "swap",
  preload: false,
});

const sans = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-noto-sans-jp",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Tarot Mirror",
  description: "カードを手がかりに、自分の状態を整理するための道具。",
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
