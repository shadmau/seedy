'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

export function NetworkTest() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [networkLogs, setNetworkLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setNetworkLogs(prev => [...prev, `${new Date().toISOString()} - ${message}`]);
  };

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

    addLog(`Network changed to: ${networkName} (${chainId})`);
    addLog(`Is connected: ${isConnected}`);
    addLog(`Is correct network: ${isCorrectNetwork}`);
    addLog(`User address: ${address || 'Not connected'}`);
  }, [chainId, isConnected, address]);

  // Handle network switch
  const handleSwitchNetwork = async () => {
    try {
      addLog('Attempting to switch to Base Sepolia...');
      await switchChain({ chainId: baseSepolia.id });
      addLog('Network switch request sent to wallet');
    } catch (error) {
      addLog(`Error switching network: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg shadow-lg max-w-md mx-auto mt-8">
      <h2 className="text-xl font-bold text-white mb-4">Network Test</h2>
      
      <div className="mb-4">
        <p className="text-gray-300">Current Network: {chainId === baseSepolia.id ? 'Base Sepolia' : 'Other Network'}</p>
        <p className="text-gray-300">Connected: {isConnected ? 'Yes' : 'No'}</p>
        <p className="text-gray-300">Address: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}</p>
      </div>
      
      <button
        onClick={handleSwitchNetwork}
        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
        disabled={!isConnected || chainId === baseSepolia.id}
      >
        Switch to Base Sepolia
      </button>
      
      <div className="mt-4">
        <h3 className="text-lg font-semibold text-white mb-2">Network Logs</h3>
        <div className="bg-gray-900 p-3 rounded max-h-60 overflow-y-auto">
          {networkLogs.length === 0 ? (
            <p className="text-gray-500">No logs yet</p>
          ) : (
            <ul className="text-xs text-gray-400 space-y-1">
              {networkLogs.map((log, index) => (
                <li key={index}>{log}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
} 