import type { Metadata, Viewport } from "next";
import { LINE_Seed_JP } from "next/font/google";
import "./globals.css";
import { LiffProvider } from "@/components/LiffProvider";

// スマホ・PCで画面幅にきちんと合わせる（横方向にはみ出して極端に拡大されるのを防ぐ）
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// LINEの中で開くアプリなので、LINEが配布しているフォントに合わせる。
// 和文・欧文が同じ設計で作られているため、OS任せのときのような
// 「欧文と日本語で別のフォントが混ざる」見え方にならない。
// 日本語は字数が多くファイルが大きいので、先読みはしない（表示は遅らせない）。
const lineSeed = LINE_Seed_JP({
  variable: "--font-line-seed",
  weight: ["400", "700"],
  subsets: ["latin"],
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  // 各ページが title を返すと「春キャンプ | CampKit」の形になる。
  // タブ・履歴・LINEで共有したときのプレビュー名を区別するため。
  title: {
    default: "CampKit — アウトドアサークルの計画・計画書づくり",
    template: "%s | CampKit",
  },
  description:
    "サークルの計画づくり・参加募集から、学校提出用の計画書作成までをまとめて。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${lineSeed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LiffProvider>{children}</LiffProvider>
      </body>
    </html>
  );
}
