import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confection NF Denim — Inventaire",
  description: "Inventaire bilingue de pièces de machines pour Confection NF Denim.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
