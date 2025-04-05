'use client';

import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { WalletConnect } from '@/components/WalletConnect';
import { RaffleInterface } from '@/components/RaffleInterface';
import { AboutSection } from '@/components/AboutSection';

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <main className="min-h-screen">
      {/* Header with Wallet Connect */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-sm z-10 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Seedy Raffle</h1>
          <WalletConnect />
        </div>
      </header>

      {/* Main Content */}
      <div className="pt-20">
        {/* Raffle Interface */}
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <RaffleInterface />
          </motion.div>
        </section>

        {/* About Section */}
        <AboutSection />
      </div>
    </main>
  );
}
