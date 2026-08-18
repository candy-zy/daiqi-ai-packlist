import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "带齐｜每件物品，都是一行讨论",
  description: "为 2–4 位朋友设计的共享旅行物品清单：直接在对应物品下沟通，准备和出发核对都不漏。",
  openGraph: {
    title: "带齐｜每件物品，都是一行讨论",
    description: "朋友一起准备旅行，不再漏带，也不必切去群聊。",
    images: ["https://daiqi-packlist.xuchenyu020412.chatgpt.site/og-v5.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "带齐｜每件物品，都是一行讨论",
    description: "朋友一起准备旅行，不再漏带，也不必切去群聊。",
    images: ["https://daiqi-packlist.xuchenyu020412.chatgpt.site/og-v5.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
