import type { Metadata } from "next";
import "./globals.css";
import "./refinement.css";
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
      <body>{children}</body>
    </html>
  );
}
