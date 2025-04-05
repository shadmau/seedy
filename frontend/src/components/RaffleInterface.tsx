'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId, usePublicClient } from 'wagmi';
import { RAFFLE_CONTRACT_ADDRESS, RAFFLE_ABI } from '../contracts/raffleContract';
import { SEEDY_COORDINATOR_ADDRESS, SEEDY_COORDINATOR_ABI } from '../contracts/coordinatorContract';
import { SEEDY_VERIFIER_ADDRESS, SEEDY_VERIFIER_ABI } from '../contracts/verifierContract';
import { parseEther, BaseError, Log, encodeEventTopics, decodeEventLog, Abi } from 'viem';
import { baseSepolia } from 'wagmi/chains';
import { ArrowRightIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, XCircleIcon, BeakerIcon, ChevronLeftIcon, WrenchIcon } from '@heroicons/react/24/outline';
import Confetti from 'react-confetti';
import { generateProof, bytesInputToBigInt } from '../utils/vdf';

// --- Configuration ---
const PREDEFINED_AMOUNTS = [0.0001, 0.05, 0.1, 0.5];
const HOUSE_EDGE = 0.975; // 2.5% house edge
const REFETCH_INTERVAL = 5000; // 5 seconds for status refetching
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'; // Check for dev mode
const BLOCK_POLL_INTERVAL_MS = 1000; // Check block number every 1 second

// --- Enums ---
enum RaffleStatus {
  PENDING = 0,
  READY_TO_SOLVE = 1,
  SOLVED = 2,
  EXPIRED = 3,
  UNKNOWN = 4 // Added for initial/error state
}

// Type for the event arguments (adjust based on your actual event structure)
type BetPlacedEventArgs = {
    player?: `0x${string}`;
    requestId?: bigint;
    amount?: bigint;
    probabilityPermil?: bigint;
};

// Define a type for logs used in receipt processing - Replaced interface with type alias
type ReceiptLog = Pick<Log, 'address' | 'topics' | 'data'>;

// --- Helper Functions ---

// Function to convert bigint to even-length hex string (0x-prefixed)
function toEvenLengthHex(n: bigint): `0x${string}` {
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) {
    hex = '0' + hex; // Prepend 0 if odd length
  }
  return `0x${hex}`;
}

function formatError(error: unknown): string {
  if (!error) return "An unknown error occurred.";
  if (error instanceof BaseError) {
    if (error.shortMessage.includes('rejected')) {
       return 'Transaction rejected in wallet.';
    }
    if (error.shortMessage.includes('insufficient funds')) {
      return 'Insufficient funds for transaction.';
    }
    return error.shortMessage;
  } else if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isValidRaffleId(id: string | null): boolean {
  return !!id && !isNaN(Number(id)) && !id.startsWith('DEV-');
}

// Custom hook for window size (handles SSR)
function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial size
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return size;
}

// --- Component ---
export function RaffleInterface() {
  // --- Hooks ---
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient(); // For getting block number
  const [isClientMounted, setIsClientMounted] = useState(false); // Hydration fix state
  
  // --- Custom window size hook without external dependency ---
  const windowSize = useWindowSize();
  
  // --- State ---
  const [selectedAmount, setSelectedAmount] = useState<number>(0.0001);
  const [isCustomAmount, setIsCustomAmount] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [probability, setProbability] = useState<number>(50);
  const [displayRaffleId, setDisplayRaffleId] = useState<string | null>(null);
  const [raffleId, setRaffleId] = useState<bigint | null>(null);
  const [isEntering, setIsEntering] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [raffleStatus, setRaffleStatus] = useState<RaffleStatus | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [isDevPanelOpen, setIsDevPanelOpen] = useState(false);
  const [targetBlock, setTargetBlock] = useState<bigint | null>(null);
  const [currentBlock, setCurrentBlock] = useState<bigint | null>(null);
  const [requestBlockInfo, setRequestBlockInfo] = useState<{ requestBlock: bigint; blockDelay: bigint } | null>(null);
  const [hasWonResult, setHasWonResult] = useState<boolean | null>(null);
  const [isFinalizingRandomness, setIsFinalizingRandomness] = useState<boolean>(false); // For "Publish Proof" loading
  const [isRandomnessFinalized, setIsRandomnessFinalized] = useState<boolean>(false); // Tracks if finalizeRandomness succeeded
  // State to store parameters needed for finalization
  const [finalizationParams, setFinalizationParams] = useState<{
    yHex: `0x${string}`;
    proofHex: `0x${string}`[];
    seedResult: `0x${string}`;
  } | null>(null);

  // --- Wagmi Hooks ---
  const { writeContract, data: writeData, error: writeError, reset: resetWriteContract } = useWriteContract();

  const { 
    data: receiptData, // Destructure the receipt into `receiptData`
    isLoading: isConfirming, 
    isSuccess: isConfirmed 
  } = useWaitForTransactionReceipt({
    hash: currentTxHash,
  });

  // --- Derived State ---
  const isDevModeRaffle = useMemo(() => displayRaffleId?.startsWith('DEV-') ?? false, [displayRaffleId]);
  const isRealRaffleId = isValidRaffleId(displayRaffleId);
  const isCorrectNetwork = chainId === baseSepolia.id;
  const betAmount = isCustomAmount ? (parseFloat(customAmount) || 0) : selectedAmount;
  const betAmountParsed = useMemo(() => {
    try { return parseEther(betAmount.toString()); }
    catch { return BigInt(0); }
  }, [betAmount]);
  
  // Calculate oddsPermil based on WIN probability
  const oddsPermil = useMemo(() => {
    // Use probability (win chance %) directly and convert to permil
    const winPermil = Math.round(probability * 10);
    // Clamp between 1 (0.1% win chance) and 999 (99.9% win chance)
    // Ensure the contract interprets this value as win probability permil.
    return BigInt(Math.max(1, Math.min(999, winPermil)));
  }, [probability]);

  const calculatedWinAmount = useMemo(() => betAmount * (1 / (probability / 100)) * HOUSE_EDGE, [betAmount, probability]);

  // Read raffle status
  const { data: statusData, refetch: refetchStatus } = useReadContract({
    address: RAFFLE_CONTRACT_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: 'getRaffleStatus',
    args: isRealRaffleId ? [BigInt(displayRaffleId as string)] : undefined,
    query: { enabled: isRealRaffleId }
  });

  // Fetch Raffle Details (for solved state)
  const { data: detailsData, refetch: refetchDetails } = useReadContract({
    address: RAFFLE_CONTRACT_ADDRESS,
    abi: RAFFLE_ABI,
    functionName: 'getRaffleDetails',
    args: isRealRaffleId ? [BigInt(displayRaffleId as string)] : undefined,
    query: { enabled: isRealRaffleId && !isDevModeRaffle && (statusData as RaffleStatus) === RaffleStatus.SOLVED }
  });

  // Extract `won` status safely from detailsData
  const isWon = useMemo(() => {
    if (isDevModeRaffle) return displayRaffleId === 'DEV-WIN';
    if (detailsData && Array.isArray(detailsData) && detailsData.length > 5) {
        return detailsData[5] as boolean;
    }
    return null;
  }, [isDevModeRaffle, displayRaffleId, detailsData]);

  // --- Effects ---
  
  // Update window size
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    function handleResize() {
      windowSize.width = window.innerWidth;
      windowSize.height = window.innerHeight;
    }
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial size
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hydration fix: Set mount status on client
  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  // Check network status on mount/network change
  useEffect(() => {
      if (isConnected && !isCorrectNetwork) {
         setNetworkError("Incorrect Network: Please switch to Base Sepolia.");
      } else {
          setNetworkError(null);
      }
  }, [isConnected, isCorrectNetwork]);

  // Reset state on account or network change
  useEffect(() => {
    console.log("Account or Chain ID changed, resetting state.");
    resetDev(); // Use resetDev to clear everything
  }, [address, chainId]); // resetDev includes resetWriteContract

  // Update writeData hash
  useEffect(() => {
    if (writeData) {
      console.log("New transaction hash received:", writeData);
      setCurrentTxHash(writeData);
    }
  }, [writeData]);

  // Handle transaction confirmation and errors
  useEffect(() => {
    if (isConfirming) {
      console.log("Transaction confirmation in progress...");
      return;
    }

    if (isConfirmed && currentTxHash) {
      console.log(`Transaction ${currentTxHash} confirmed.`);

      if (isEntering) {
        console.log("PlaceBet TX Confirmed. Simulating raffle ID retrieval...");
        // --- Replace with actual event log decoding --- 
        const mockRaffleId = currentTxHash.slice(-6); // Use part of hash for mock ID
        setDisplayRaffleId(mockRaffleId);
        setRaffleStatus(RaffleStatus.PENDING); // Explicitly set PENDING status
        
        // Set mock block information for the UI
        const mockCurrentBlock = BigInt(Math.floor(Date.now() / 1000) % 1000000);
        const mockBlockDelay = BigInt(5);
        const mockTargetBlock = mockCurrentBlock + mockBlockDelay;
        
        setCurrentBlock(mockCurrentBlock);
        setTargetBlock(mockTargetBlock);
        setRequestBlockInfo({
          requestBlock: mockCurrentBlock,
          blockDelay: mockBlockDelay
        });
        
        console.log("Mock Raffle ID set:", mockRaffleId);
        refetchStatus();
        // --- End Simulation ---
      } else if (isSolving) {
        console.log("Solve Puzzle/hasWon check completed (no transaction).");
        // setIsSolving(false); // Already set after hasWon call
      } else if (isFinalizingRandomness) { // Check if we were finalizing
         console.log("FinalizeRandomness TX Confirmed.");
         setIsRandomnessFinalized(true); // Set flag for UI
         setIsFinalizingRandomness(false); // Reset loading state
         setCurrentTxHash(undefined);
         resetWriteContract();
      } else {
        console.log("An unknown transaction was confirmed.");
        setCurrentTxHash(undefined);
        resetWriteContract();
      }
    }

  }, [isConfirmed, isConfirming, currentTxHash, isEntering, isSolving, raffleId, receiptData, resetWriteContract, writeContract, refetchStatus, refetchDetails, isFinalizingRandomness]); // Added isFinalizingRandomness

  // Handle direct write errors (e.g., user rejection)
  useEffect(() => {
    if (writeError) {
      console.error("Write error:", writeError);
      setNetworkError(formatError(writeError));
      if (isEntering) setIsEntering(false);
      if (isSolving) setIsSolving(false); 
      if (isFinalizingRandomness) {
         console.error("FinalizeRandomness write error:", writeError);
         setIsFinalizingRandomness(false); // Reset finalizing state on error
      }
      setCurrentTxHash(undefined);
      resetWriteContract(); 
    }
  }, [writeError, isEntering, isSolving, isFinalizingRandomness, resetWriteContract]); // Added dependencies

  // Update raffle status from contract data
  useEffect(() => {
    if (isRealRaffleId && statusData !== undefined && statusData !== null) {
      const newStatus = statusData as RaffleStatus;
      console.log("Fetched Raffle Status:", RaffleStatus[newStatus]);
      setRaffleStatus(newStatus);
      if (newStatus === RaffleStatus.SOLVED) {
        console.log("Status is SOLVED, refetching details...");
        refetchDetails();
      }
    }
  }, [statusData, isRealRaffleId, refetchDetails]);

  // Trigger confetti on win
  useEffect(() => {
    if (isWon === true && !showConfetti) {
        console.log("Win detected, showing confetti!");
        setShowConfetti(true);
        const timer = setTimeout(() => setShowConfetti(false), 10000);
        return () => clearTimeout(timer);
      }
      if(isWon !== true && showConfetti) {
          setShowConfetti(false);
      }
  }, [isWon, showConfetti]);

  // Periodically refetch status if pending or ready (only for real IDs)
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (isRealRaffleId && (raffleStatus === RaffleStatus.PENDING || raffleStatus === RaffleStatus.READY_TO_SOLVE)) {
      console.log(`Starting periodic refetch for Raffle ID ${displayRaffleId}, Status: ${RaffleStatus[raffleStatus]}`);
      intervalId = setInterval(() => {
        console.log("Periodic refetch triggered...");
        refetchStatus();
        if(raffleStatus === RaffleStatus.READY_TO_SOLVE) refetchDetails();
      }, REFETCH_INTERVAL);
    }
    return () => {
      if (intervalId) {
        console.log("Clearing periodic refetch interval.");
        clearInterval(intervalId);
      }
    };
  }, [isRealRaffleId, displayRaffleId, raffleStatus, refetchStatus, refetchDetails]);

  // Set appropriate status in dev mode
  useEffect(() => {
    if (isDevModeRaffle && displayRaffleId) {
      console.log("Setting dev mode status for:", displayRaffleId);
      switch (displayRaffleId) {
        case "DEV-PENDING":
          setRaffleStatus(RaffleStatus.PENDING);
          break;
        case "DEV-READY":
          setRaffleStatus(RaffleStatus.READY_TO_SOLVE);
          break;
        case "DEV-WIN":
        case "DEV-LOSS":
          setRaffleStatus(RaffleStatus.SOLVED);
          break;
        case "DEV-EXPIRED":
          setRaffleStatus(RaffleStatus.EXPIRED);
          break;
        default:
          setRaffleStatus(RaffleStatus.UNKNOWN);
      }
    }
  }, [isDevModeRaffle, displayRaffleId]);

  // Poll for current block number
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    // Only poll when in PENDING state
    if (raffleStatus === RaffleStatus.PENDING) {
      async function initialFetchAndStartPolling() {
         // Ensure initial state is set before polling starts
        if (!currentBlock && !isDevModeRaffle && publicClient) {
           try {
             const initialBlock = await publicClient.getBlockNumber();
             setCurrentBlock(initialBlock);
             console.log("Fetched initial block number:", initialBlock.toString());
           } catch (error) {
              console.error("Failed to fetch initial block number:", error);
              // Potentially set an error state or retry?
           }
         } else if (!currentBlock && isDevModeRaffle) {
             // Dev mode pending should have set initial block via showDevPending
             // If it's somehow null, maybe log a warning or set a default?
             console.warn("Dev mode PENDING started with null currentBlock. Check showDevPending.");
             // Set a default mock if needed?
             // setCurrentBlock(BigInt(100)); 
         }

        // Now start the interval
        intervalId = setInterval(async () => {
          // Define timestamp at the start of the callback
          const timestamp = new Date().toISOString();
          
          // Actual update logic inside interval
          if (isDevModeRaffle && raffleStatus === RaffleStatus.PENDING) {
            // Dev mode: increment logic
            if (currentBlock) {
              const incrementedBlock = currentBlock + BigInt(1);
              setCurrentBlock(incrementedBlock);
              console.log("Dev mode: incremented block to", incrementedBlock.toString());

              if (targetBlock && incrementedBlock >= targetBlock) {
                console.log("Target block reached in dev mode, moving to READY_TO_SOLVE");
                setRaffleStatus(RaffleStatus.READY_TO_SOLVE);
              }
            }
          } else if (raffleStatus === RaffleStatus.PENDING && publicClient) {
            // Normal mode: fetch logic
            try {
              const blockNumber = await publicClient.getBlockNumber();
              // Log BEFORE setting state
              console.log(`[${timestamp}] Normal mode: Fetched block ${blockNumber}. Target: ${targetBlock?.toString() ?? 'N/A'}. Current in state: ${currentBlock?.toString() ?? 'null'}. Updating state.`);
              setCurrentBlock(blockNumber); // Update state

              // *** Check if target block is reached in normal mode ***
              if (targetBlock && blockNumber >= targetBlock) {
                console.log(`[${timestamp}] Normal mode: Target block ${targetBlock} reached or passed by current block ${blockNumber}! Moving to READY_TO_SOLVE.`);
                setRaffleStatus(RaffleStatus.READY_TO_SOLVE);
              }
              // *** End check ***

            } catch (error) {
              console.error(`[${timestamp}] Failed to fetch block number:`, error);
            }
          } else {
            // If status is no longer PENDING, or no publicClient, stop polling
             if (intervalId) {
                const statusName = raffleStatus !== null ? RaffleStatus[raffleStatus] : 'null';
                console.log(`[${timestamp}] Stopping polling because status (${statusName}) is not PENDING or publicClient missing.`);
                clearInterval(intervalId);
                intervalId = null;
             }
          }
        }, BLOCK_POLL_INTERVAL_MS);
        console.log("Started block number polling interval");
      }
      
      initialFetchAndStartPolling();
    }
    
    return () => {
      if (intervalId) {
        console.log("Stopped block number polling (cleanup)");
        clearInterval(intervalId);
      }
    };
    // Dependencies: Include raffleStatus to trigger start/stop polling
  }, [publicClient, raffleStatus, isDevModeRaffle]); // Removed currentBlock, targetBlock as dependencies to avoid infinite loops

  // --- Effect to process transaction receipt --- 
  useEffect(() => {
    const timestamp = new Date().toISOString();
    if (receiptData && isEntering && currentTxHash && receiptData.transactionHash === currentTxHash) {
      const receipt = receiptData;
      console.log(`[${timestamp}] Receipt received for PlaceBet Tx ${currentTxHash} in block ${receipt.blockNumber}`);

      const betPlacedLog = receipt.logs.find((log: ReceiptLog) => 
        log.address.toLowerCase() === RAFFLE_CONTRACT_ADDRESS.toLowerCase() &&
        log.topics[0] === encodeEventTopics({ abi: RAFFLE_ABI, eventName: 'BetPlaced' })[0]
      );

      if (betPlacedLog) {
        try {
          // Directly use the decoded log, assuming structure matches ABI
          const decodedLog = decodeEventLog({ 
            abi: RAFFLE_ABI, 
            data: betPlacedLog.data, 
            topics: betPlacedLog.topics 
          }) as { eventName: string; args?: unknown };
          console.log("Decoded Log:", decodedLog);

          // Check eventName and assert args type if eventName matches
          if (decodedLog.eventName === 'BetPlaced') {
            // Assert the type of args for BetPlaced event
            const args = decodedLog.args as BetPlacedEventArgs;
            console.log(`[${timestamp}] Decoded BetPlaced event args from receipt:`, args);

            // Now access requestId safely
            if (args && args.requestId !== undefined) { 
              const receivedRequestId = args.requestId;
              console.log(`[${timestamp}] Extracted Request ID from receipt log: ${receivedRequestId.toString()}`);

              // --- Set state based on receipt and decoded log --- 
              const actualCurrentBlock = receipt.blockNumber;
              const blockDelay = BigInt(5); 
              const calculatedTargetBlock = actualCurrentBlock + blockDelay;

              console.log(`[${timestamp}] Setting State -> Raffle ID: ${receivedRequestId}, Current Block: ${actualCurrentBlock}, Target Block: ${calculatedTargetBlock}, Delay: ${blockDelay}`);

              setRaffleId(receivedRequestId);
              setDisplayRaffleId(receivedRequestId.toString());
              setRaffleStatus(RaffleStatus.PENDING);
              setCurrentBlock(actualCurrentBlock);
              setTargetBlock(calculatedTargetBlock);
              setRequestBlockInfo({ requestBlock: actualCurrentBlock, blockDelay: blockDelay });
              setShowConfetti(false);
              setNetworkError(null);
              refetchStatus();

            } else {
              console.error(`[${timestamp}] BetPlaced event decoded, but requestId is missing/undefined in args.`);
              setNetworkError('Error processing transaction receipt: Missing request ID.');
            }
          } else {
             console.error(`[${timestamp}] Event decoded, but not BetPlaced. Event: ${decodedLog.eventName}`);
             setNetworkError('Error processing transaction receipt: Incorrect event decoded.');
          }
        } catch (error) {
          console.error(`[${timestamp}] Error decoding BetPlaced event from receipt:`, error);
          setNetworkError('Error processing transaction receipt: Failed to decode event.');
        }
      } else {
         console.error(`[${timestamp}] Receipt received, but BetPlaced event log not found for address ${RAFFLE_CONTRACT_ADDRESS}.`);
         setNetworkError('Error processing transaction receipt: Event log not found.');
      }
      setIsEntering(false);
    }
  }, [receiptData, isEntering, currentTxHash, resetWriteContract, refetchStatus]);

  // --- Dev Mode Handler ---
  const resetDev = () => {
    console.log("Resetting component state (Manual)");
    setDisplayRaffleId(null);
    setRaffleId(null);
    setIsEntering(false);
    setIsSolving(false);
    setShowConfetti(false);
    setNetworkError(isConnected && !isCorrectNetwork ? "Incorrect Network: Please switch to Base Sepolia." : null);
    setCurrentTxHash(undefined);
    setRequestBlockInfo(null);
    setTargetBlock(null);
    setCurrentBlock(null);
    setRaffleStatus(null);
    resetWriteContract();
    setSelectedAmount(PREDEFINED_AMOUNTS[0]);
    setIsCustomAmount(false);
    setCustomAmount('');
    setProbability(50);
    setIsFinalizingRandomness(false); // Also reset finalizing states
    setIsRandomnessFinalized(false);
    setHasWonResult(null); // Reset win result
    setFinalizationParams(null); // <-- Clear stored params
  }

  // --- Dev Mode Showcase Functions (Keep displayRaffleId as string) ---
  const showDevWin = () => { resetDev(); setDisplayRaffleId("DEV-WIN"); };
  const showDevLoss = () => { resetDev(); setDisplayRaffleId("DEV-LOSS"); };
  const showDevPending = () => { 
    resetDev(); 
    setDisplayRaffleId("DEV-PENDING"); 
    
    // Set mock block values for dev mode
    const mockCurrentBlock = BigInt(100);
    const mockBlockDelay = BigInt(5);
    const mockTargetBlock = mockCurrentBlock + mockBlockDelay;
    
    setCurrentBlock(mockCurrentBlock);
    setTargetBlock(mockTargetBlock);
    setRequestBlockInfo({
      requestBlock: mockCurrentBlock,
      blockDelay: mockBlockDelay
    });
  };
  const showDevReady = () => { resetDev(); setDisplayRaffleId("DEV-READY"); };
  const showDevExpired = () => { resetDev(); setDisplayRaffleId("DEV-EXPIRED"); };

  // --- UI Helpers ---
  const getSliderBackground = () => {
    const colorStop = Math.max(0, Math.min(100, probability));
    return `linear-gradient(to right, #84cc16 ${colorStop}%, #4b5563 ${colorStop}%)`;
  };

  const isLoading = isEntering || isSolving || isConfirming;
  const buttonText = isEntering ? "Planting Seed..." : isSolving ? "Harvesting..." : isConfirming ? "Confirming Tx..." : "Plant Your Seed!";

  // --- Handler for Finalizing Randomness (Uses Stored Params) ---
  const handleFinalizeRandomness = async () => {
    const timestamp = new Date().toISOString();
    // Check required state
    if (!isConnected || !isCorrectNetwork || !raffleId || !finalizationParams) {
      setNetworkError("Cannot proceed: Missing necessary data or connection error.");
      console.error(`[${timestamp}] Pre-check failed for finalize: connected=${isConnected}, correctNetwork=${isCorrectNetwork}, raffleId=${raffleId}, params=${!!finalizationParams}`);
      return;
    }

    setIsFinalizingRandomness(true);
    setNetworkError(null);
    setCurrentTxHash(undefined);

    try {
      // Retrieve stored parameters
      const { yHex, proofHex, seedResult } = finalizationParams;

      // Call finalizeRandomness
      console.log(`[${timestamp}] Calling finalizeRandomness with stored parameters...`);
      console.log(`  raffleId: ${raffleId}`);
      console.log(`  yHex: ${yHex}`);
      console.log(`  proofHex:`, proofHex);
      console.log(`  seedResult: ${seedResult}`);

      writeContract({
         address: SEEDY_COORDINATOR_ADDRESS,
         abi: SEEDY_COORDINATOR_ABI as Abi,
         functionName: 'finalizeRandomness',
         // Use the stored parameters directly
         args: [raffleId, yHex, proofHex, seedResult]
      });
      // Loading state reset is handled by useEffect

    } catch (error) { // Catch errors during writeContract setup
      console.error(`[${timestamp}] Error preparing handleFinalizeRandomness call:`, error);
      setNetworkError(`Error publishing proof: ${formatError(error)}`); 
      setIsFinalizingRandomness(false); // Stop loading on error
    }
  };

  // --- Render ---
  return (
    <div className="max-w-2xl mx-auto bg-gray-800 text-gray-200 rounded-xl shadow-2xl p-6 md:p-8 space-y-6 border border-gray-700 relative overflow-hidden">
      {/* Confetti Canvas - Render only on client */}
      {isClientMounted && showConfetti && <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={500} />}

      {/* Development Mode Toggle Button (Fixed position) */}
      {IS_DEVELOPMENT && (
        <div className="fixed right-0 top-1/3 z-20 flex items-start">
          {/* Toggle button */}
          <button 
            onClick={() => setIsDevPanelOpen(!isDevPanelOpen)} 
            className="bg-yellow-600 hover:bg-yellow-500 text-white p-2 rounded-l-md shadow-lg flex items-center"
            title="Developer Tools"
          >
            <WrenchIcon className="h-5 w-5" />
            <ChevronLeftIcon className={`h-4 w-4 transition-transform ${isDevPanelOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {/* Collapsible panel */}
          <motion.div 
            initial={{ width: 0, opacity: 0 }} 
            animate={{ 
              width: isDevPanelOpen ? 'auto' : 0,
              opacity: isDevPanelOpen ? 1 : 0
            }}
            className="bg-gray-900/90 border-l border-y border-yellow-600/50 rounded-l-md shadow-xl overflow-hidden backdrop-blur-sm"
          >
            <div className="p-2 space-y-1 w-32">
              <p className="text-xs text-yellow-400 text-center font-semibold mb-1">Dev Controls</p>
              <button onClick={showDevWin} className="text-xs bg-green-700 hover:bg-green-600 px-2 py-1 rounded w-full transition-colors">Win</button>
              <button onClick={showDevLoss} className="text-xs bg-red-700 hover:bg-red-600 px-2 py-1 rounded w-full transition-colors">Loss</button>
              <button onClick={showDevPending} className="text-xs bg-yellow-700 hover:bg-yellow-600 px-2 py-1 rounded w-full transition-colors">Pending</button>
              <button onClick={showDevReady} className="text-xs bg-blue-700 hover:bg-blue-600 px-2 py-1 rounded w-full transition-colors">Ready</button>
              <button onClick={showDevExpired} className="text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded w-full transition-colors">Expired</button>
              <button onClick={resetDev} className="text-xs bg-purple-700 hover:bg-purple-600 px-2 py-1 rounded w-full transition-colors">Reset</button>
            </div>
          </motion.div>
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
      {!displayRaffleId ? (
        // Show input form ONLY if no displayRaffleId exists
          <>
             {/* Amount Selection */}
             <div className="space-y-4">
               <h2 className="text-2xl font-semibold text-lime-300">1. Plant Your Stake</h2>
               <div className="flex flex-wrap gap-3">
                 {PREDEFINED_AMOUNTS.map((amount) => (
                   <motion.button
                     key={amount}
                     onClick={() => setSelectedAmount(amount)}
                     className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 border-2 text-sm md:text-base ${!isCustomAmount && selectedAmount === amount
                         ? 'bg-lime-600 border-lime-500 text-white shadow-lg scale-105'
                         : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500'
                     }`}
                     whileHover={{ scale: 1.05 }}
                     whileTap={{ scale: 0.95 }}
                     disabled={isLoading}
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
                   disabled={isLoading}
                 >
                   Custom
                 </motion.button>
               </div>
               {isCustomAmount && (
                 <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3">
                   <input
                     type="text" inputMode="decimal" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)}
                     placeholder="Enter ETH amount (e.g., 0.25)"
                     className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 text-gray-100 placeholder-gray-500 disabled:opacity-50"
                     disabled={isLoading}
                   />
                 </motion.div>
               )}
             </div>

             {/* Probability Selection */}
             <div className="space-y-4">
               <h2 className="text-2xl font-semibold text-lime-300">2. Choose Your Growth Rate</h2>
               <div className="space-y-3 bg-gray-900 p-4 rounded-lg border border-gray-700">
                 <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Win Chance:</span>
                    <span className="text-xl font-bold text-lime-400">{probability.toFixed(1)}%</span>
                 </div>
                 <input
                   type="range" min="0.1" max="99.9" step="0.1" value={probability}
                   onChange={(e) => setProbability(parseFloat(e.target.value))}
                   className="w-full h-3 rounded-lg appearance-none cursor-pointer range-lg accent-lime-600 disabled:opacity-50 disabled:cursor-not-allowed"
                   style={{ background: getSliderBackground() }}
                   disabled={isLoading}
                 />
                 <div className="flex justify-between text-xs text-gray-500">
                   <span>0.1% (High Yield)</span>
                   <span>99.9% (Low Yield)</span>
                 </div>
                 <p className="text-xs text-gray-400 pt-1">Higher chance = lower potential yield. The house keeps a small cutting (~2.5%).</p>
               </div>
             </div>

             {/* Summary */}
             <div className="bg-gray-900 rounded-lg p-4 space-y-3 border border-gray-700">
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
                 <span className="font-bold text-xl text-green-400">{calculatedWinAmount.toFixed(4)} ETH</span>
               </div>
             </div>

             {/* Enter Button Area */}
             <motion.button
               onClick={() => {
                 if (!isConnected || !isCorrectNetwork) {
                   setNetworkError("Please connect your wallet.");
                   return;
                 }
                 if (selectedAmount <= 0) {
                   setNetworkError("Please enter a valid amount to bet.");
                   return;
                 }
                 if (probability < 0.1 || probability > 99.9) {
                   setNetworkError("Probability must be between 0.1% and 99.9%.");
                   return;
                 }
                 setNetworkError(null);
                 setIsEntering(true);
                 setIsSolving(false);
                 setCurrentTxHash(undefined);
                 console.log("--- placeBet call ---");
                 console.log("oddsPermil:", oddsPermil);
                 // Add the actual contract call
                 writeContract({
                   address: RAFFLE_CONTRACT_ADDRESS,
                   abi: RAFFLE_ABI,
                   functionName: 'placeBet',
                   args: [oddsPermil],
                   value: betAmountParsed
                 });
               }}
               disabled={isLoading || !isConnected || !isCorrectNetwork}
               className={`w-full py-3.5 bg-gradient-to-r from-lime-600 to-green-600 text-white rounded-lg text-lg font-semibold transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-lime-500/50 flex items-center justify-center space-x-2 ${isLoading ? 'animate-pulse cursor-wait' : 'hover:from-lime-500 hover:to-green-500'}`}
               whileHover={!isLoading ? { scale: 1.02, transition: { duration: 0.2 } } : {}}
               whileTap={!isLoading ? { scale: 0.98 } : {}}
             >
               {isLoading ? (
                 <>
                   <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                   {buttonText}
                 </>
               ) : (
                 'Plant Your Seed!'
               )}
             </motion.button>
          </>
       ) : (
         // Status Display Area (Shown whenever displayRaffleId exists)
         <div className="bg-gray-900/80 border border-lime-800/50 rounded-lg p-5 space-y-4 shadow-inner min-h-[400px] flex flex-col justify-center">
           <h3 className="text-xl font-semibold text-lime-300 mb-2 text-center">Seed Planted!</h3>
           <p className="text-lime-400 text-sm break-all text-center">Raffle ID: <span className="font-mono bg-gray-700 px-1.5 py-0.5 rounded text-xs select-all">{displayRaffleId}</span></p>

           {/* Status Indicators */} 
           <div className="flex-grow flex items-center justify-center">
             {/* PENDING */} 
             {raffleStatus === RaffleStatus.PENDING && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center space-y-3 text-yellow-400 text-center">
                 <ClockIcon className="h-12 w-12 animate-spin" />
                 <div>
                     <p className="text-lg font-medium">Waiting for Seed Commitment</p>
                     {targetBlock && currentBlock && currentBlock < targetBlock ? (
                         <p className="text-sm text-yellow-500 mt-1">
                            Target Block: {targetBlock.toString()} (Current: {currentBlock.toString()})<br/>
                            ~{(Number(targetBlock - currentBlock) * 2)} seconds remaining...
                         </p>
                    ) : targetBlock && currentBlock && currentBlock >= targetBlock ? (
                        <p className="text-sm text-yellow-500 mt-1">
                            Target block reached! Checking status...
                         </p>
                    ) : requestBlockInfo ? (
                        <p className="text-sm text-yellow-500 mt-1">
                            Seed requested in block {requestBlockInfo.requestBlock.toString()}, waiting {requestBlockInfo.blockDelay.toString()} blocks...
                        </p>
                    ) : (
                        <p className="text-sm text-yellow-500 mt-1">
                            Fetching block details...
                        </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">Seed randomness is committed {requestBlockInfo?.blockDelay?.toString() ?? 'several'} blocks after request.</p>
                  </div>
               </motion.div>
             )}
             {/* READY TO SOLVE */} 
             {raffleStatus === RaffleStatus.READY_TO_SOLVE && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full space-y-4 text-center">
                 <div className="flex flex-col items-center space-y-3 text-blue-400">
                    <BeakerIcon className="h-12 w-12" />
                    <div>
                       <p className="text-lg font-medium">Ready to Solve VDF Puzzle</p>
                       <p className="text-sm text-blue-500 mt-1">Randomness committed. Finalize to compute the result.</p>
                    </div>
                 </div>
                 <motion.button
                   onClick={async () => {
                     const timestamp = new Date().toISOString();
                     if (!isConnected || !isCorrectNetwork || !raffleId || !publicClient) {
                       // Consolidated initial checks
                       setNetworkError("Cannot proceed: Wallet not connected, wrong network, missing Raffle ID, or connection error.");
                       console.error(`[${timestamp}] Pre-check failed: connected=${isConnected}, correctNetwork=${isCorrectNetwork}, raffleId=${raffleId}, publicClient=${!!publicClient}`);
                       return;
                     }

                     setNetworkError(null);
                     setIsSolving(true); 
                     setCurrentTxHash(undefined); 

                     try {
                        console.log(`[${timestamp}] 1. Fetching VDF parameters for Request ID: ${raffleId.toString()}`);
                        
                        // --- Fetch Request Data (T, delta) and Modulus (N) --- 
                        const [requestData, modulusData] = await Promise.all([
                          publicClient.readContract({
                             address: SEEDY_COORDINATOR_ADDRESS,
                             abi: SEEDY_COORDINATOR_ABI as Abi,
                             functionName: 'requests',
                             args: [raffleId]
                          }),
                          publicClient.readContract({
                             address: SEEDY_COORDINATOR_ADDRESS,
                             abi: SEEDY_COORDINATOR_ABI as Abi,
                             functionName: 'VDF_MODULUS'
                          })
                        ]);

                        if (!requestData || typeof requestData !== 'object' || requestData === null || !Array.isArray(requestData)) {
                           throw new Error("Invalid request data received from Coordinator contract.");
                        }
                        const T_param = requestData[3] as bigint; 
                        const delta_param = requestData[4] as bigint;
                        const N_param = bytesInputToBigInt(modulusData as `0x${string}`); 

                        console.log(`[${timestamp}] Fetched Params: T=${T_param}, delta=${delta_param}, N=${N_param}`); 
                        if (T_param === undefined || delta_param === undefined || N_param === undefined) {
                           throw new Error("One or more VDF parameters (T, delta, N) are undefined after fetching.");
                        }
                        // --- End Fetch --- 
                        
                        console.log(`[${timestamp}] 2. Computing seed for Request ID: ${raffleId.toString()}`);
                        let seedResult = await publicClient.readContract({
                           address: SEEDY_COORDINATOR_ADDRESS,
                           abi: SEEDY_COORDINATOR_ABI as Abi,
                           functionName: 'computeSeed',
                           args: [raffleId] 
                        }) as `0x${string}`;
                        
                        console.log(`[${timestamp}] Computed Seed Result (x): ${seedResult}`);
                        seedResult = `0x3a74a92014645ed1a6` as `0x${string}`; //! change
                        // --- Generate VDF Proof --- 
                        console.log(`[${timestamp}] 3. Generating VDF Proof... (x=${seedResult}, T=${T_param}, delta=${delta_param}, N=${N_param})`);
                        const { y, proof: proofBigInts } = await generateProof(seedResult, T_param, delta_param, N_param);
                        console.log(`[${timestamp}] Proof Generated (bigints): y=${y}, proof=[${proofBigInts.map((p: bigint) => p.toString()).join(', ')}]`);
                        const yHex = toEvenLengthHex(y); // Convert y to hex

                        // --- Format proof elements to even-length hex strings ---
                        const proofHex = proofBigInts.map(toEvenLengthHex);
                        console.log(`[${timestamp}] Proof Formatted (hex):`, proofHex);
                        // --- End Formatting ---

                        // --- Verify VDF Proof (Client-side check) ---
                        console.log(`[${timestamp}] 4. Verifying VDF Proof on-chain (read-only)...`);

                        // --- Log parameters BEFORE verification ---
                        console.log(`[${timestamp}] Parameters for verify function:`);
                        console.log(`  x (seedResult):`, seedResult);
                        console.log(`  y:`, yHex);
                        console.log(`  T (T_param):`, T_param?.toString());
                        console.log(`  delta (delta_param):`, delta_param?.toString());
                        console.log(`  proof (proofHex):`, proofHex);
                        console.log(`  N (modulusData):`, modulusData);
                        // --- End Log ---

                        try {
                            const verificationResult = await publicClient.readContract({
                                address: SEEDY_VERIFIER_ADDRESS,
                                abi: SEEDY_VERIFIER_ABI as Abi,
                                functionName: 'verify',
                                args: [
                                    seedResult, // x (bytes)
                                    yHex,          // y (bytes)
                                    T_param,    // T (uint256)
                                    delta_param,// delta (uint256)
                                    proofHex,   // proof (bytes[]) - Pass the formatted hex proof
                                    modulusData // N (bytes)
                                ]
                            });
                            console.log(`[${timestamp}] Proof Verification Result:`, verificationResult);
                            let actualY = null;
                            // --- Extract actualY from verification result ---
                            if (Array.isArray(verificationResult) && verificationResult.length > 0) {
                                actualY = verificationResult[0];
                                console.log(`[${timestamp}] Extracted actualY for hasWon: ${actualY}`);
                            } else {
                                throw new Error("Could not extract actual Y value from verification result.");
                            }

                            // --- Call hasWon on Raffle Contract ---
                            console.log(`[${timestamp}] 5. Calling hasWon view function...`);
                            const wonResult = await publicClient.readContract({
                                address: RAFFLE_CONTRACT_ADDRESS,
                                abi: RAFFLE_ABI, // Ensure RAFFLE_ABI is correctly typed
                                functionName: 'hasWon',
                                args: [raffleId!, actualY] // Pass raffleId and extracted actualY
                            });
                            console.log(`[${timestamp}] hasWon Result:`, wonResult);
                            // --- End hasWon Call ---

                            // --- Update State based on hasWon result ---
                            setRaffleStatus(RaffleStatus.SOLVED); // Set status to Solved
                            setHasWonResult(wonResult as boolean); // Set the win result state
                            setIsSolving(false); // Stop loading indicator
                            // --- End State Update ---

                        } catch (verifyOrHasWonError) { // Catch errors from verification OR hasWon call
                            console.error(`[${timestamp}] Error during VDF verification or hasWon call:`, verifyOrHasWonError);
                            setNetworkError(`Error checking win status: ${formatError(verifyOrHasWonError)}`);
                            setIsSolving(false); // Stop solving state if verification/check fails
                            return;
                        }
                        // --- End Proof Verification and hasWon check ---

                     } catch (outerError) { // Catch errors from initial parameter fetching etc.
                        console.error(`[${timestamp}] Error during VDF parameter fetch or seed computation:`, outerError);
                        setNetworkError(`Error preparing check: ${formatError(outerError)}`);
                        setIsSolving(false); // Reset solving state on outer error
                     }
                   }}
                   className={`w-full max-w-xs mx-auto py-3 bg-blue-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2 ${isLoading && isSolving ? 'animate-pulse cursor-wait' : 'hover:bg-blue-500'}`}
                   disabled={!isCorrectNetwork || isLoading || isDevModeRaffle}
                   whileHover={!isLoading ? { scale: 1.03 } : {}}
                   whileTap={!isLoading ? { scale: 0.97 } : {}}
                 >
                    {isLoading && isSolving ? (
                       <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          {buttonText}
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
             {/* SOLVED */} 
             {raffleStatus === RaffleStatus.SOLVED && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full space-y-4 text-center">
                    <div className="flex flex-col items-center space-y-2 text-lime-400">
                       <CheckCircleIcon className="h-12 w-12" />
                       <p className="text-lg font-medium">Harvest Ready!</p>
                   </div>
                 {hasWonResult === true && (
                   <>
                     <motion.div
                       initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
                       className="bg-gradient-to-br from-green-800 to-lime-800 border border-green-600 rounded-lg p-6 mt-2 shadow-xl"
                      >
                        <p className="text-green-200 font-bold text-2xl animate-pulse">🎉 Bountiful Harvest! 🎉</p>
                        <p className="text-green-300 text-sm mt-1">You Won! Publish proof to enable claim.</p>
                      </motion.div>

                      {/* Action Buttons for Win State */} 
                      <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
                        <motion.button
                          onClick={handleFinalizeRandomness}
                          disabled={isFinalizingRandomness || isRandomnessFinalized || isLoading}
                          className={`w-full sm:w-auto px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-1 ${ 
                             isRandomnessFinalized ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                             : isFinalizingRandomness ? 'bg-blue-700 text-white animate-pulse cursor-wait' 
                             : 'bg-blue-600 hover:bg-blue-500 text-white' 
                          }`}
                          whileHover={!(isFinalizingRandomness || isRandomnessFinalized) ? { scale: 1.03 } : {}}
                          whileTap={!(isFinalizingRandomness || isRandomnessFinalized) ? { scale: 0.97 } : {}}
                        >
                          {isFinalizingRandomness ? (
                              <>
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>Publishing...</span>
                              </>
                            ) : isRandomnessFinalized ? (
                                <span>Proof Published ✓</span>
                            ) : (
                                <span>Publish Proof</span>
                          )}
                        </motion.button>

                        <motion.button
                          onClick={() => { /* TODO: Implement Claim Logic */ alert("Claim logic not yet implemented."); }}
                          disabled={isFinalizingRandomness || !isRandomnessFinalized || isLoading}
                          className={`w-full sm:w-auto px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-1 ${ 
                             !isRandomnessFinalized ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                             : 'bg-green-600 hover:bg-green-500 text-white' 
                          }`}
                           whileHover={isRandomnessFinalized && !isFinalizingRandomness ? { scale: 1.03 } : {}}
                           whileTap={isRandomnessFinalized && !isFinalizingRandomness ? { scale: 0.97 } : {}}
                        >
                          <span>Claim Your Winnings</span>
                        </motion.button>
                      </div>
                   </>
                 )}
                  {hasWonResult === false && (
                     <> {/* Wrap Loss UI and Button */} 
                       <motion.div
                         initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
                         className="bg-gradient-to-br from-red-800 to-orange-800 border border-red-600 rounded-lg p-6 mt-2 shadow-xl"
                       >
                         <p className="text-red-200 font-medium text-2xl">🥀 Withered Seed 🥀</p>
                         <p className="text-red-300 text-sm mt-1">Better luck next time!</p>
                       </motion.div>
                       {/* Keep Plant Another Seed button for loss */} 
                       <button
                           onClick={resetDev}
                           className="w-full max-w-xs mx-auto py-2 mt-6 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-500 transition-colors text-sm"
                       >
                           Plant Another Seed
                       </button>
                     </>
                 )}
                  {hasWonResult === null && (
                    <div className="text-center text-gray-400 text-base py-4">Loading results...</div>
                  )}
               </motion.div>
             )}
             {/* EXPIRED */} 
             {raffleStatus === RaffleStatus.EXPIRED && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center space-y-3 text-red-400 text-center">
                   <XCircleIcon className="h-12 w-12" />
                  <p className="text-lg font-medium">Raffle Expired</p>
                  <p className="text-sm text-red-500 mt-1">Seed wasn&apos;t finalized in time.</p>
                   <button
                        onClick={resetDev}
                        className="w-full max-w-xs mx-auto py-2 mt-6 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-500 transition-colors text-sm"
                    >
                        Plant Another Seed
                    </button>
               </motion.div>
             )}
           </div>
          </div>
       )}
    </div>
  );
} 