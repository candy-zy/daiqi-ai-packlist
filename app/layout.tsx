import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "带齐｜朋友一起收拾行李",
  description: "为 2–4 位朋友设计的 AI 旅行物品清单：区分共用与私人，并根据目的地特点智能补充。",
  openGraph: {
    title: "带齐｜目的地懂你，清单依然简单",
    description: "AI 根据目的地特点补充物品，共用与私人清单清清楚楚。",
    images: ["https://daiqi-packlist.xuchenyu020412.chatgpt.site/og-v4.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "带齐｜目的地懂你，清单依然简单",
    description: "AI 根据目的地特点补充物品，共用与私人清单清清楚楚。",
    images: ["https://daiqi-packlist.xuchenyu020412.chatgpt.site/og-v4.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
