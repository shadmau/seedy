import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WagmiProvider } from "@/components/WagmiProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Seedy - The VDF-Powered Raffle",
  description: "Test your luck with provably fair randomness powered by cryptographic puzzles",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gradient-to-b from-white to-gray-50 min-h-screen`}>
        <WagmiProvider>{children}</WagmiProvider>
      </body>
    </html>
  );
}
