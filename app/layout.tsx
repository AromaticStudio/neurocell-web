import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 모바일 상단바 색상 및 앱 화면 비율 고정 설정
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // 앱처럼 터치 확대 방지
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "Neuro Cell_Fit",
  description: "의지력이 아닌 뇌를 깨우는 1% 루틴",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cell_Fit",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="apple-touch-icon" href="/icon.png" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}