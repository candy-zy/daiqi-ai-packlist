import type { Metadata } from "next";
import "./globals.css";
import "./typography.css";

export const metadata: Metadata = {
  title: "带齐｜朋友一起收拾行李",
  description: "为 2–4 位朋友设计的 AI 旅行准备清单：一起认领物品，并根据韩国首尔旅行特点智能补充。",
  openGraph: {
    title: "带齐｜目的地懂你，清单依然简单",
    description: "创建队伍、输入韩国首尔，一起认领物品并在出发前逐项核对。",
    images: ["https://daiqi-packlist.xuchenyu020412.chatgpt.site/og-v5.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "带齐｜目的地懂你，清单依然简单",
    description: "创建队伍、输入韩国首尔，一起认领物品并在出发前逐项核对。",
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
