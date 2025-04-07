'use client';

import { useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

export function NetworkChangeLogger() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();

  useEffect(() => {
    const getNetworkName = (chainId: number) => {
      switch (chainId) {
        case baseSepolia.id:
          return 'Base Sepolia';
        case 1:
          return 'Ethereum Mainnet';
        case 11155111:
          return 'Sepolia';
        case 8453:
          return 'Base Mainnet';
        default:
          return `Unknown Network (${chainId})`;
      }
    };

    const isCorrectNetwork = chainId === baseSepolia.id;
    const networkName = getNetworkName(chainId);

    console.log(`[NetworkChangeLogger] Network changed to: ${networkName} (${chainId})`);
    console.log(`[NetworkChangeLogger] Is connected: ${isConnected}`);
    console.log(`[NetworkChangeLogger] Is correct network: ${isCorrectNetwork}`);
    console.log(`[NetworkChangeLogger] User address: ${address || 'Not connected'}`);
  }, [chainId, isConnected, address]);

  useEffect(() => {
    const handleNetworkChange = () => {
      console.log("[NetworkChangeLogger] Network change event detected");
      console.log("[NetworkChangeLogger] Current chainId:", chainId);
      console.log("[NetworkChangeLogger] Is connected:", isConnected);
      console.log("[NetworkChangeLogger] Is correct network:", chainId === baseSepolia.id);
    };

    if (window.ethereum) {
      window.ethereum.on('chainChanged', handleNetworkChange);
      window.ethereum.on('accountsChanged', handleNetworkChange);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('chainChanged', handleNetworkChange);
        window.ethereum.removeListener('accountsChanged', handleNetworkChange);
      }
    };
  }, [chainId, isConnected]);

  return null;
} 