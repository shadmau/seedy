import seedyCoordinatorAbiJson from '../../seedCoordinatorabi.json';

console.log("--- coordinatorContract.ts executing ---");
console.log("Raw JSON import type:", typeof seedyCoordinatorAbiJson, "Is Array?", Array.isArray(seedyCoordinatorAbiJson));

export const SEEDY_COORDINATOR_ADDRESS = '0xf25469bdf21c06aff3f4236b8e0ca1b51c9e5ec6' as const;

export const SEEDY_COORDINATOR_ABI = seedyCoordinatorAbiJson as unknown[];

console.log("Final SEEDY_COORDINATOR_ABI:", typeof SEEDY_COORDINATOR_ABI, Array.isArray(SEEDY_COORDINATOR_ABI), SEEDY_COORDINATOR_ABI?.length);
console.log("--- coordinatorContract.ts finished ---");
