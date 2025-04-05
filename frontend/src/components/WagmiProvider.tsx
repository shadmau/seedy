'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider as WagmiProviderBase, createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { metaMask } from '@wagmi/connectors';

const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    metaMask()
  ],
  transports: {
    [baseSepolia.id]: http("https://base-sepolia.g.alchemy.com/v2/1M1BRjOvJuHPZsKKY0_wwBCadNswgNti"),
  },
});

const queryClient = new QueryClient();

export function WagmiProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProviderBase config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProviderBase>
  );
} 