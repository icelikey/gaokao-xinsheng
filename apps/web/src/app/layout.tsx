import type { Metadata } from "next";
import RetroPreferences from "@/components/RetroPreferences";
import "./globals.css";
import "./retro.css";

export const metadata: Metadata = {
  title: "高考新生｜再考一次，重新作答",
  description: "选择你的高考届次，重新作答，按需获取AI辅导、查看估分与评分依据。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body data-retro-ui="true">
        {children}
        <RetroPreferences />
      </body>
    </html>
  );
}
