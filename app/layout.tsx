import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "带齐｜朋友一起收拾行李",
  description: "为 2–4 位朋友设计的 AI 协作装包清单，一起认领、一起确认，出发不遗漏。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
