'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId } from 'wagmi';
import { RAFFLE_CONTRACT_ADDRESS, RAFFLE_ABI } from '@/contracts/raffleAbi';
import { parseEther, BaseError } from 'viem';
import { baseSepolia } from 'wagmi/chains';
import { ArrowRightIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, XCircleIcon, BeakerIcon } from '@heroicons/react/24/outline'; // Example icons
import Confetti from 'react-confetti'; // For winning animation
import useWindowSize from 'react-use/lib/useWindowSize'; // To get window size for confetti

const PREDEFINED_AMOUNTS = [0.0001, 0.05, 0.1, 0.5];
const HOUSE_EDGE = 0.975; // 2.5% house edge
const REFETCH_INTERVAL = 5000; // 5 seconds for status refetching
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'; // Check for dev mode

// Raffle status enum
enum RaffleStatus {
  PENDING = 0,
  READY_TO_SOLVE = 1,
  SOLVED = 2,
  EXPIRED = 3
}

// Helper Function
function formatError(error: unknown): string {
  if (!error) return "An unknown error occurred.";
  if (error instanceof BaseError) {
    // Handle wagmi/viem specific errors
    if (error.shortMessage.includes('rejected')) {
       return 'Transaction rejected in wallet.';
    }
    if (error.shortMessage.includes('insufficient funds')) {
      return 'Insufficient funds for transaction.';
    }
     // You can add more specific checks here based on error.cause or details
    return error.shortMessage;
  } else if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function RaffleInterface() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { width, height } = useWindowSize(); // For confetti
  const [selectedAmount, setSelectedAmount] = useState<number>(0.0001);
  const [isCustomAmount, setIsCustomAmount] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [probability, setProbability] = useState<number>(50);
  const [winAmount, setWinAmount] = useState<number>(0);
  const [raffleId, setRaffleId] = useState<string | null>(null);
  const [isEntering, setIsEntering] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [raffleStatus, setRaffleStatus] = useState<RaffleStatus | null>(null);
  const [isWon, setIsWon] = useState<boolean | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>(undefined);

  const { writeContract, data: writeData, error: writeError, reset: resetWriteContract } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  });

  // Check if we're on the correct network
  const isCorrectNetwork = chainId === baseSepolia.id;

  // Read raffle status if we have a raffleId
  const { data: statusData, refetch: refetchStatus } = useReadContract({
    address: RAFFLE_CONTRACT_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: 'getRaffleStatus',
    args: raffleId ? [BigInt(raffleId)] : undefined,
    query: { enabled: !!raffleId }
  });

  // Read raffle details if we have a raffleId
  const { data: detailsData, refetch: refetchDetails } = useReadContract({
    address: RAFFLE_CONTRACT_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: 'getRaffleDetails',
    args: raffleId ? [BigInt(raffleId)] : undefined,
    query: { enabled: !!raffleId && raffleStatus === RaffleStatus.SOLVED }
  });

  // Update raffle status when data changes
  useEffect(() => {
    if (statusData !== undefined && statusData !== null) {
       const newStatus = statusData as RaffleStatus;
       console.log("Fetched Raffle Status:", RaffleStatus[newStatus]);
      setRaffleStatus(newStatus);
       // If solved, refetch details immediately
       if (newStatus === RaffleStatus.SOLVED) {
           refetchDetails();
       }
    }
  }, [statusData, refetchDetails]);

  // Update win status when details change
  useEffect(() => {
    if (detailsData && raffleStatus === RaffleStatus.SOLVED) {
      const [_player, _amount, _probability, _winAmount, _blockNumber, won] = detailsData;
      console.log("Fetched Raffle Details - Won:", won);
      setIsWon(won);
      if (won) {
        setShowConfetti(true);
        // Automatically hide confetti after some time
        const timer = setTimeout(() => setShowConfetti(false), 10000); // 10 seconds
        return () => clearTimeout(timer);
      }
    }
  }, [detailsData, raffleStatus]);
  
  // Refetch status and details periodically when raffleId exists
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (raffleId && (raffleStatus === RaffleStatus.PENDING || raffleStatus === RaffleStatus.READY_TO_SOLVE)) {
       console.log(`Starting periodic refetch for Raffle ID ${raffleId}, Status: ${RaffleStatus[raffleStatus]}`);
      intervalId = setInterval(() => {
        console.log("Periodic refetch triggered...");
        refetchStatus();
        // Only refetch details if status might become SOLVED
         if(raffleStatus === RaffleStatus.READY_TO_SOLVE) refetchDetails();
      }, REFETCH_INTERVAL);
    }
    // Cleanup function
    return () => {
      if (intervalId) {
         console.log("Clearing periodic refetch interval.");
         clearInterval(intervalId);
      }
     };
  }, [raffleId, raffleStatus, refetchStatus, refetchDetails]);

  useEffect(() => {
    const amount = isCustomAmount ? parseFloat(customAmount) || 0 : selectedAmount;
    const calculatedWinAmount = (1 / (probability / 100)) * amount * HOUSE_EDGE;
    setWinAmount(calculatedWinAmount);
  }, [selectedAmount, customAmount, isCustomAmount, probability]);

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setIsCustomAmount(false);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and a single decimal point
    if (/^\d*\.?\d*$/.test(value)) {
      setCustomAmount(value);
    }
  };

  const handleEnterRaffle = async () => {
    if (!isConnected || isEntering || isConfirming || isSolving) return;
    setNetworkError(null); // Clear previous errors

    if (!isCorrectNetwork) {
      setNetworkError("Incorrect Network: Please switch to Base Sepolia.");
      return;
    }
    
    const amount = isCustomAmount ? parseFloat(customAmount) : selectedAmount;
    if (!amount || amount <= 0) {
       setNetworkError("Invalid Amount: Please enter a valid stake amount.");
       return;
    }
    
    const probabilityPermil = Math.floor((1000 - (probability * 10)));
    if (probabilityPermil < 1 || probabilityPermil > 999) {
      setNetworkError("Invalid Probability: Adjust the slider.");
      return;
    }

    console.log(`Initiating placeBet with oddsPermil: ${probabilityPermil}, Value: ${amount} ETH`);
    setIsEntering(true); // Set entering state
    setCurrentTxHash(undefined); // Clear previous hash before new write
    
    writeContract({
      address: RAFFLE_CONTRACT_ADDRESS,
      abi: RAFFLE_ABI,
      functionName: 'placeBet',
      args: [BigInt(probabilityPermil)],
      value: parseEther(amount.toString()),
    });
  };

  const handleSolvePuzzle = async () => {
    if (!raffleId || isSolving || isConfirming || isEntering) return;
     setNetworkError(null);

    if (!isCorrectNetwork) {
      setNetworkError("Incorrect Network: Please switch to Base Sepolia.");
      return;
    }

    console.log(`Initiating finalizeBet for Raffle ID: ${raffleId}`);
    setIsSolving(true); // Set solving state
    setCurrentTxHash(undefined); // Clear previous hash

    writeContract({
      address: RAFFLE_CONTRACT_ADDRESS,
      abi: RAFFLE_ABI,
      functionName: 'finalizeBet',
      args: [BigInt(raffleId)],
    });
  };

  // Update raffleId when transaction is confirmed
  useEffect(() => {
    if (isConfirmed && currentTxHash) {
      console.log("Transaction confirmed:", currentTxHash);
      if (isEntering) {
          // --- This is where you'd ideally decode the event log ---
          // Find the BetPlaced event in the transaction receipt logs
          // For now, we simulate getting a raffleId
          console.log("Simulating raffle ID retrieval after placeBet confirmation.");
          const mockRaffleId = Date.now().toString().slice(-6); // Simple mock ID
          setRaffleId(mockRaffleId);
          console.log("Mock Raffle ID set:", mockRaffleId);
          refetchStatus(); // Fetch initial status
          // --- End of simulation ---
      } else if (isSolving) {
          console.log("finalizeBet transaction confirmed. Refetching status & details.");
          refetchStatus();
          refetchDetails(); // Refetch details to get win status
      }
      setIsEntering(false);
      setIsSolving(false);
      setCurrentTxHash(undefined); // Clear hash once processed
      resetWriteContract(); // Reset write state
    }
     if (!isConfirmed && !isConfirming) {
       setIsEntering(false); // Reset entering state if transaction fails or is cancelled
     }
  }, [isConfirmed, isConfirming, currentTxHash, isEntering, isSolving, refetchStatus, refetchDetails, resetWriteContract]);

  // Handle direct write errors (e.g., user rejection)
  useEffect(() => {
     if (writeError) {
        console.error("Write error:", writeError);
        setNetworkError(formatError(writeError));
        // Reset relevant states if a write fails immediately
        if (isEntering) setIsEntering(false);
        if (isSolving) setIsSolving(false);
        setCurrentTxHash(undefined); // Clear any potential hash from previous attempts
        // No need to call resetWriteContract here, it resets automatically on error or success
     }
  }, [writeError, isEntering, isSolving]);

  const getSliderBackground = () => {
    // Create a gradient background for the slider based on probability
    const colorStop = Math.max(0, Math.min(100, probability));
    // Use greenish tones for the "seedy" theme gradient
    return `linear-gradient(to right, #84cc16 ${colorStop}%, #4b5563 ${colorStop}%)`;
  };

  const isLoading = isEntering || isSolving || isConfirming;
  const buttonText = isEntering ? "Placing Bet..." : isSolving ? "Finalizing..." : isConfirming ? "Confirming Tx..." : "Enter Raffle";

  // --- Dev Mode Handlers ---
  const showDevWin = () => {
    setRaffleId("DEV-WIN");
    setRaffleStatus(RaffleStatus.SOLVED);
    setIsWon(true);
    setNetworkError(null);
  };
  const showDevLoss = () => {
    setRaffleId("DEV-LOSS");
    setRaffleStatus(RaffleStatus.SOLVED);
    setIsWon(false);
    setNetworkError(null);
  };
   const showDevPending = () => {
    setRaffleId("DEV-PEND");
    setRaffleStatus(RaffleStatus.PENDING);
    setIsWon(null);
    setNetworkError(null);
  };
   const showDevReady = () => {
    setRaffleId("DEV-READY");
    setRaffleStatus(RaffleStatus.READY_TO_SOLVE);
    setIsWon(null);
    setNetworkError(null);
  };
   const showDevExpired = () => {
    setRaffleId("DEV-EXP");
    setRaffleStatus(RaffleStatus.EXPIRED);
    setIsWon(null);
    setNetworkError(null);
  };
   const resetDev = () => {
      setRaffleId(null);
      setRaffleStatus(null);
      setIsWon(null);
      setIsEntering(false);
      setIsSolving(false);
      setShowConfetti(false);
      setNetworkError(null);
      setCurrentTxHash(undefined);
      resetWriteContract();
   }

  return (
    <div className="max-w-2xl mx-auto bg-gray-800 text-gray-200 rounded-xl shadow-2xl p-6 md:p-8 space-y-8 border border-gray-700 relative overflow-hidden">
       {/* Confetti Canvas */}
       {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}

      {/* Development Mode Showcase Buttons */}
      {IS_DEVELOPMENT && (
        <div className="absolute top-2 right-2 bg-gray-900 p-2 rounded-lg border border-yellow-600 space-y-1 z-10">
           <p className="text-xs text-yellow-400 text-center font-semibold mb-1">Dev Controls</p>
           <button onClick={showDevWin} className="text-xs bg-green-700 hover:bg-green-600 px-2 py-1 rounded w-full">Show Win</button>
           <button onClick={showDevLoss} className="text-xs bg-red-700 hover:bg-red-600 px-2 py-1 rounded w-full">Show Loss</button>
           <button onClick={showDevPending} className="text-xs bg-yellow-700 hover:bg-yellow-600 px-2 py-1 rounded w-full">Show Pending</button>
           <button onClick={showDevReady} className="text-xs bg-blue-700 hover:bg-blue-600 px-2 py-1 rounded w-full">Show Ready</button>
           <button onClick={showDevExpired} className="text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded w-full">Show Expired</button>
           <button onClick={resetDev} className="text-xs bg-purple-700 hover:bg-purple-600 px-2 py-1 rounded w-full">Reset All</button>
        </div>
      )}

      {/* Network Status Banners */}
      {networkError && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-900/80 border border-red-700 rounded-lg p-3 flex items-center space-x-2 text-sm shadow-lg">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 font-medium">{networkError}</p>
        </motion.div>
      )}
      
      {!isCorrectNetwork && isConnected && !networkError && (
         <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-yellow-900/80 border border-yellow-700 rounded-lg p-3 flex items-center space-x-2 text-sm shadow-lg">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 flex-shrink-0" />
          <p className="text-yellow-300 font-medium">⚠️ Incorrect Network: Please switch to Base Sepolia.</p>
        </motion.div>
      )}

      {/* --- Main Interface Sections --- */}
       {!raffleId ? (
          <>
             {/* Amount Selection */}
             <div className="space-y-4">
               <h2 className="text-2xl font-semibold text-lime-300">1. Plant Your Stake</h2>
               <div className="flex flex-wrap gap-3">
                 {PREDEFINED_AMOUNTS.map((amount) => (
                   <motion.button
                     key={amount}
                     onClick={() => handleAmountSelect(amount)}
                     className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 border-2 text-sm md:text-base ${!isCustomAmount && selectedAmount === amount
                         ? 'bg-lime-600 border-lime-500 text-white shadow-lg scale-105'
                         : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500'
                     }`}
                     whileHover={{ scale: 1.05 }}
                     whileTap={{ scale: 0.95 }}
                   >
                     {amount} ETH
                   </motion.button>
                 ))}
                 <motion.button
                   onClick={() => setIsCustomAmount(true)}
                   className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 border-2 text-sm md:text-base ${isCustomAmount
                       ? 'bg-lime-600 border-lime-500 text-white shadow-lg scale-105'
                       : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500'
                   }`}
                   whileHover={{ scale: 1.05 }}
                   whileTap={{ scale: 0.95 }}
                 >
                   Custom
                 </motion.button>
               </div>
               {isCustomAmount && (
                 <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3">
                   <input
                     type="text" inputMode="decimal" value={customAmount} onChange={handleCustomAmountChange}
                     placeholder="Enter ETH amount (e.g., 0.25)"
                     className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 text-gray-100 placeholder-gray-500"
                   />
                 </motion.div>
               )}
             </div>

             {/* Probability Selection */}
             <div className="space-y-4">
               <h2 className="text-2xl font-semibold text-lime-300">2. Choose Your Growth Rate</h2>
               <div className="space-y-3 bg-gray-900 p-5 rounded-lg border border-gray-700">
                 <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Win Chance:</span>
                    <span className="text-xl font-bold text-lime-400">{probability.toFixed(1)}%</span>
                 </div>
                 <input
                   type="range" min="0.1" max="99.9" step="0.1" value={probability}
                   onChange={(e) => setProbability(parseFloat(e.target.value))}
                   className="w-full h-3 rounded-lg appearance-none cursor-pointer range-lg accent-lime-600"
                   style={{ background: getSliderBackground() }}
                 />
                 <div className="flex justify-between text-xs text-gray-500">
                   <span>0.1% (High Yield)</span>
                   <span>99.9% (Low Yield)</span>
                 </div>
                 <p className="text-xs text-gray-400 pt-2">Higher chance = lower potential yield. The house keeps a small cutting (~2.5%).</p>
               </div>
             </div>

             {/* Summary */}
             <div className="bg-gray-900 rounded-lg p-5 space-y-3 border border-gray-700">
               <h3 className="text-lg font-medium text-gray-300 mb-3">Harvest Forecast</h3>
               <div className="flex justify-between items-center">
                 <span className="text-gray-400">Your Stake:</span>
                 <span className="font-semibold text-lg text-gray-100">{isCustomAmount ? parseFloat(customAmount) || 0 : selectedAmount} ETH</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-gray-400">Win Chance:</span>
                 <span className="font-semibold text-lg text-lime-400">{probability.toFixed(1)}%</span>
               </div>
               <hr className="border-gray-600"/>
               <div className="flex justify-between items-center pt-1">
                 <span className="text-gray-400">Potential Harvest:</span>
                 <span className="font-bold text-xl text-green-400">{winAmount.toFixed(4)} ETH</span>
               </div>
             </div>

             {/* Enter Button Area */}
             <motion.button
               onClick={handleEnterRaffle}
               disabled={isLoading || !isConnected || !isCorrectNetwork}
               className={`w-full py-3.5 bg-gradient-to-r from-lime-600 to-green-600 text-white rounded-lg text-lg font-semibold transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-lime-500/50 flex items-center justify-center space-x-2 ${isLoading ? 'animate-pulse' : 'hover:from-lime-500 hover:to-green-500'}`}
               whileHover={!isLoading ? { scale: 1.02, transition: { duration: 0.2 } } : {}}
               whileTap={!isLoading ? { scale: 0.98 } : {}}
             >
               {isLoading ? (
                 <>
                   <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                   {buttonText}
                 </>
               ) : (
                 'Plant Your Seed!'
               )}
             </motion.button>
          </>
       ) : (
         // Status Display Area
         <div className="bg-gray-900/80 border border-lime-800/50 rounded-lg p-5 space-y-4 shadow-inner">
           <h3 className="text-xl font-semibold text-lime-300 mb-2">Seed Planted!</h3>
           <p className="text-lime-400 text-sm break-all">Raffle ID: <span className="font-mono bg-gray-700 px-1.5 py-0.5 rounded text-xs">{raffleId}</span></p>

           {/* Status: PENDING */}
           {raffleStatus === RaffleStatus.PENDING && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center space-x-3 text-yellow-400 p-3 bg-yellow-900/50 rounded-md border border-yellow-700/50">
               <ClockIcon className="h-6 w-6 animate-spin flex-shrink-0" />
               <div>
                   <p className="text-sm font-medium">Waiting for Future Block...</p>
                   <p className="text-xs text-yellow-500">Secure randomness requires waiting for a future block to be mined.</p>
                </div>
             </motion.div>
           )}

           {/* Status: READY_TO_SOLVE */}
           {raffleStatus === RaffleStatus.READY_TO_SOLVE && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 p-3 bg-blue-900/50 rounded-md border border-blue-700/50">
               <div className="flex items-center space-x-3 text-blue-400">
                  <BeakerIcon className="h-6 w-6 flex-shrink-0" />
                  <div>
                     <p className="text-sm font-medium">Ready to Solve VDF Puzzle</p>
                     <p className="text-xs text-blue-500">Randomness committed. Finalize to compute the result using the VDF.</p>
                  </div>
               </div>
               <motion.button
                 onClick={handleSolvePuzzle}
                 className={`w-full py-3 bg-blue-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2 ${isSolving || isConfirming ? 'animate-pulse' : 'hover:bg-blue-500'}`}
                 disabled={!isCorrectNetwork || isSolving || isConfirming || isEntering}
                 whileHover={!(isSolving || isConfirming) ? { scale: 1.02 } : {}}
                 whileTap={!(isSolving || isConfirming) ? { scale: 0.98 } : {}}
               >
                  {isSolving || isConfirming ? (
                     <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        {isSolving ? "Solving Puzzle..." : "Confirming Tx..."}
                     </>
                  ) : (
                     <>
                        <span>Solve Puzzle & Reveal Result</span>
                        <ArrowRightIcon className="h-5 w-5"/>
                     </>
                  )}
               </motion.button>
             </motion.div>
           )}

           {/* Status: SOLVED */}
           {raffleStatus === RaffleStatus.SOLVED && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className="flex items-center space-x-3 text-lime-400 p-3 bg-lime-900/50 rounded-md border border-lime-700/50">
                     <CheckCircleIcon className="h-6 w-6 flex-shrink-0" />
                     <p className="text-sm font-medium">Harvest Ready!</p>
                 </div>
               {isWon === true && ( // Explicit check for true
                 <motion.div
                   initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
                   className="bg-gradient-to-br from-green-800 to-lime-800 border border-green-600 rounded-lg p-4 mt-2 text-center shadow-xl"
                  >
                   <p className="text-green-200 font-bold text-lg animate-pulse">🎉 Bountiful Harvest! You Won! 🎉</p>
                   {/* TODO: Display actual payout amount from detailsData */}
                 </motion.div>
               )}
                {isWon === false && ( // Explicit check for false
                 <motion.div
                   initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
                   className="bg-gradient-to-br from-red-800 to-orange-800 border border-red-600 rounded-lg p-4 mt-2 text-center shadow-xl"
                 >
                   <p className="text-red-200 font-medium text-lg">🥀 The soil wasn't right... Better luck next time! 🥀</p>
                 </motion.div>
               )}
                {isWon === null && ( // Loading state while fetching details
                  <div className="text-center text-gray-400 text-sm py-4">Loading results...</div>
                )}
                 {/* Button to start a new raffle */}
                  <button
                      onClick={resetDev} // Reusing resetDev for simplicity, could be a dedicated function
                      className="w-full py-2 mt-4 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-500 transition-colors text-sm"
                  >
                      Start New Raffle
                  </button>
             </motion.div>
           )}

           {/* Status: EXPIRED */}
           {raffleStatus === RaffleStatus.EXPIRED && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center space-x-3 text-red-400 p-3 bg-red-900/50 rounded-md border border-red-700/50">
                 <XCircleIcon className="h-6 w-6 flex-shrink-0" />
                <p className="text-sm font-medium">Raffle Expired: Randomness wasn't finalized in time.</p>
             </motion.div>
           )}
          </div>
       )}
    </div>
  );
} 