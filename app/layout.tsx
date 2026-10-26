import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Downcript",
  description: "Download, transcribe, and extract Meta ad creatives in one app.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* overflow-hidden here, not min-h-full/flex -- page.tsx's own h-screen
          grid (sidebar + a single independently-scrolling main column) owns
          the whole viewport now, so the body itself must never scroll or a
          second, outer scrollbar appears alongside the real one. */}
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
