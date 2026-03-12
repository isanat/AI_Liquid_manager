import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Web3Provider } from "@/components/web3-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Liquidity Manager - Adaptive Range Strategy Engine",
  description: "Institutional-grade AI-powered liquidity management for Uniswap V3 and Orca. Adaptive range optimization, regime detection, and automated rebalancing.",
  keywords: ["DeFi", "Liquidity", "Uniswap V3", "Orca", "AI", "Automated Trading", "LP", "Market Making"],
  authors: [{ name: "AI Liquidity Manager" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "AI Liquidity Manager",
    description: "Institutional-grade AI-powered liquidity management",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Web3Provider>
          {children}
        </Web3Provider>
        <Toaster />
      </body>
    </html>
  );
}
