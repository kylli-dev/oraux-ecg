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
  title: "ENSAE — Oraux Admin",
  description: "Plateforme de gestion des oraux ECG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
        {process.env.NEXT_PUBLIC_ENV === "dev" && (
          <div style={{
            position: "fixed",
            bottom: "12px",
            right: "12px",
            background: "#f97316",
            color: "#fff",
            fontWeight: 700,
            fontSize: "11px",
            letterSpacing: "0.1em",
            padding: "3px 8px",
            borderRadius: "4px",
            zIndex: 9999,
            pointerEvents: "none",
          }}>
            DEV
          </div>
        )}
      </body>
    </html>
  );
}

