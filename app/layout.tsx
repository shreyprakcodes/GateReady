import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { FetchLogger } from "@/components/dev/FetchLogger";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "GateReady",
  description: "Your autonomous travel day agent",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable} h-full`}>
      <body
        className="min-h-full antialiased"
        style={{ backgroundColor: "#F7F5F0", color: "#1A1A2E", fontFamily: "var(--font-inter), Inter, sans-serif" }}
      >
        {process.env.NODE_ENV === "development" && <FetchLogger />}
        {children}
      </body>
    </html>
  );
}
