import raffleAbiJson from '../../raffleabi.json';
import { Abi } from 'viem'; // Import Abi type

export const RAFFLE_CONTRACT_ADDRESS = '0xe2117B0e346Df9921daf1b6193509BaAF5F110aE' as const;

// Force re-parse and then assert as Abi
const parsedAbi = JSON.parse(JSON.stringify(raffleAbiJson));
export const RAFFLE_ABI = parsedAbi as Abi; 