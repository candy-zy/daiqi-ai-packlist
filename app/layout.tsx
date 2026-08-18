import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "带齐｜朋友一起收拾行李",
  description: "为 2–4 位朋友设计的 AI 协作装包清单：边聊边认领，出发前再逐项核对。",
  openGraph: {
    title: "带齐｜先认领，再核对",
    description: "朋友一起收拾，出发不落东西。",
    images: ["https://daiqi-packlist.xuchenyu020412.chatgpt.site/og-v3.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "带齐｜先认领，再核对",
    description: "朋友一起收拾，出发不落东西。",
    images: ["https://daiqi-packlist.xuchenyu020412.chatgpt.site/og-v3.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
