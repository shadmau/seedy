import raffleAbiJson from '../../raffleabi.json';
import { Abi } from 'viem'; // Import Abi type

export const RAFFLE_CONTRACT_ADDRESS = '0xF918db551C9C9bd8c960582676657b32DcD19b4a' as const;

// Force re-parse and then assert as Abi
const parsedAbi = JSON.parse(JSON.stringify(raffleAbiJson));
export const RAFFLE_ABI = parsedAbi as Abi; 