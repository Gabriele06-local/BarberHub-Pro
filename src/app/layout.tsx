import type { Metadata, Viewport } from "next";
import { Epilogue, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const epilogue = Epilogue({
  subsets: ["latin"],
  variable: "--font-epilogue",
});

export const metadata: Metadata = {
  title: "BarberHub Pro",
  description: "SaaS multi-tenant per barber shop",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={`${inter.variable} ${epilogue.variable} h-full`}>
      <body className="min-h-dvh min-h-full antialiased pb-[env(safe-area-inset-bottom,0px)]">{children}</body>
    </html>
  );
}
