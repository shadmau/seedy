'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { metaMask } from '@wagmi/connectors';

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const handleConnect = () => {
    connect({ connector: metaMask() });
  };

  return (
    <div className="flex items-center gap-4">
      {!isConnected ? (
        <button
          onClick={handleConnect}
          disabled={isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {isPending ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-600">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </div>
          <button
            onClick={() => disconnect()}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors text-sm"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
} 