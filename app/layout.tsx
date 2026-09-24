import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./refinement.css";

const yesevaOne = localFont({
  src: "../node_modules/@fontsource/yeseva-one/files/yeseva-one-latin-400-normal.woff2",
  variable: "--font-yeseva-one",
  weight: "400",
  display: "block",
  preload: true,
});

const dmSans = localFont({
  src: "../node_modules/@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2",
  variable: "--font-dm-sans",
  weight: "500",
  display: "block",
  preload: true,
});
export const metadata: Metadata = {
  title: "DISCO TILL DAWN — ✦ CELESTIAL ELEGANCE ✦",
  description:
    "An evening beneath the stars for DP2 & A Level. 14 NOVEMBER 2026 · 4:00 PM onwards · TIPS MAIN — SEMINAR HALL",
  openGraph: {
    title: "DISCO TILL DAWN — ✦ CELESTIAL ELEGANCE ✦",
    description:
      "14 NOVEMBER 2026 · 4:00 PM onwards · TIPS MAIN — SEMINAR HALL",
    type: "website",
  },
  icons: { icon: "/icon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${yesevaOne.variable} ${dmSans.variable}`}>{children}</body>
    </html>
  );
}
