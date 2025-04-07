'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider as WagmiProviderBase, createConfig, http, useChainId, useAccount, useSwitchChain, useDisconnect } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { metaMask } from '@wagmi/connectors';
import { useEffect, useState } from 'react';
import { NetworkMonitor } from './NetworkMonitor';
import { NetworkChangeLogger } from './NetworkChangeLogger';

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

// Network Logger Component
function NetworkLogger({ children }: { children: React.ReactNode }) {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const { disconnect } = useDisconnect();
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

  useEffect(() => {
    const validateAndLogNetwork = async () => {
      if (typeof window === 'undefined' || !window.ethereum) return;

      try {
        const ethChainId = await window.ethereum.request({ method: 'eth_chainId' });
        const currentChainId = parseInt(ethChainId as string, 16);
        
        console.log("[WagmiProvider] Network Status:");
        console.log("  - Window Ethereum ChainId:", currentChainId);
        console.log("  - Wagmi ChainId:", chainId);
        console.log("  - Expected ChainId:", baseSepolia.id);
        console.log("  - Is Connected:", isConnected);
        console.log("  - Chain Match:", currentChainId === chainId);
        console.log("  - Correct Network:", currentChainId === baseSepolia.id);

        // If we detect a mismatch or wrong network
        if (isConnected && currentChainId !== baseSepolia.id && !isSwitchingNetwork) {
          console.log("[WagmiProvider] Network mismatch detected, attempting switch...");
          setIsSwitchingNetwork(true);
          
          try {
            await switchChain({ chainId: baseSepolia.id });
            console.log("[WagmiProvider] Network switch requested successfully");
          } catch (switchError) {
            console.error("[WagmiProvider] Failed to switch network:", switchError);
            disconnect();
          }
        }
      } catch (error) {
        console.error("[WagmiProvider] Network validation error:", error);
      } finally {
        setIsSwitchingNetwork(false);
      }
    };

    validateAndLogNetwork();
  }, [chainId, isConnected, switchChain, isSwitchingNetwork, disconnect]);

  return <>{children}</>;
}

export function WagmiProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProviderBase config={config}>
      <QueryClientProvider client={queryClient}>
        <NetworkLogger>
          <NetworkMonitor />
          <NetworkChangeLogger />
          {children}
        </NetworkLogger>
      </QueryClientProvider>
    </WagmiProviderBase>
  );
} 