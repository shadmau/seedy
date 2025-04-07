'use client';

import { useEffect } from 'react';
import { useAccount, useChainId, usePublicClient } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

export function NetworkMonitor() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();

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
        case 10:
          return 'Optimism';
        case 420:
          return 'Optimism Goerli';
        case 84532:
          return 'Base Sepolia';
        default:
          return `Unknown Network (${chainId})`;
      }
    };

    const isCorrectNetwork = chainId === baseSepolia.id;
    const networkName = getNetworkName(chainId);

    console.log(`[NetworkMonitor] Network changed to: ${networkName} (${chainId})`);
    console.log(`[NetworkMonitor] Is connected: ${isConnected}`);
    console.log(`[NetworkMonitor] Is correct network: ${isCorrectNetwork}`);
    console.log(`[NetworkMonitor] User address: ${address || 'Not connected'}`);
    console.log(`[NetworkMonitor] Expected Base Sepolia ID: ${baseSepolia.id}`);
    console.log(`[NetworkMonitor] Current chainId: ${chainId}`);
    console.log(`[NetworkMonitor] Network comparison: ${chainId === baseSepolia.id ? 'MATCH' : 'MISMATCH'}`);

    // Check if window.ethereum is available and log its chainId
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.request({ method: 'eth_chainId' })
        .then((value: unknown) => {
          const ethChainId = value as string;
          console.log(`[NetworkMonitor] window.ethereum chainId: ${ethChainId}`);
          console.log(`[NetworkMonitor] window.ethereum chainId (decimal): ${parseInt(ethChainId, 16)}`);
          console.log(`[NetworkMonitor] window.ethereum vs wagmi chainId match: ${parseInt(ethChainId, 16) === chainId}`);
        })
        .catch((error: Error) => {
          console.error('[NetworkMonitor] Error getting ethereum chainId:', error);
        });
    }

    if (isConnected && publicClient) {
      const fetchNetworkInfo = async () => {
        try {
          const blockNumber = await publicClient.getBlockNumber();
          const block = await publicClient.getBlock({ blockNumber });
          const chain = await publicClient.getChainId();

          console.log(`[NetworkMonitor] Current block: ${blockNumber}`);
          console.log(`[NetworkMonitor] Block timestamp: ${block?.timestamp}`);
          console.log(`[NetworkMonitor] Public client chainId: ${chain}`);
          console.log(`[NetworkMonitor] Public client vs wagmi chainId match: ${chain === chainId}`);
        } catch (error) {
          console.error('[NetworkMonitor] Error fetching network info:', error);
        }
      };

      fetchNetworkInfo();
    }
  }, [chainId, isConnected, address, publicClient]);

  return null;
} 