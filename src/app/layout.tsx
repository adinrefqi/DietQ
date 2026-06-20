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
  title: "DietQ — Pantau Nutrisi & Berat Badan",
  description: "Aplikasi diet dengan AI food recognition. Catat makanan, hitung kalori, dan capai tujuan sehatmu.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: ekstensi browser (mis. Bitdefender) menyuntik
          atribut bis_register/__processed ke <body> sebelum React hydrate.
          Ini meredam warning palsu tsb tanpa memengaruhi kode aplikasi. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
