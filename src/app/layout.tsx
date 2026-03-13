import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Web3Provider } from "@/components/web3-provider";

// GeistSans and GeistMono from the 'geist' npm package — no network fetch at build time

// GeistSans.variable = "--font-geist-sans", GeistMono.variable = "--font-geist-mono"

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
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased bg-background text-foreground`}
      >
        <Web3Provider>
          {children}
        </Web3Provider>
        <Toaster />
      </body>
    </html>
  );
}
