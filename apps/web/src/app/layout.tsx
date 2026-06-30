import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "高考新生 MVP",
  description: "云端优先的高考重考、AI辅导与AI估分产品预览"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
