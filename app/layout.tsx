import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Word Fusion",
  description: "ランダムな単語の組み合わせを発見しよう",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
