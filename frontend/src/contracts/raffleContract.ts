import raffleAbiJson from '../../ABI/raffleabi.json';
import { Abi } from 'viem';

export const RAFFLE_CONTRACT_ADDRESS = '0xF918db551C9C9bd8c960582676657b32DcD19b4a' as const;
const parsedAbi = JSON.parse(JSON.stringify(raffleAbiJson));
export const RAFFLE_ABI = parsedAbi as Abi; 