import type { Metadata } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import "./globals.css";

const ui = Instrument_Sans({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const doc = Newsreader({
  subsets: ["latin"],
  variable: "--font-doc",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Collab",
  description: "Write together in real time.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${ui.variable} ${doc.variable}`}>
      <body>{children}</body>
    </html>
  );
}