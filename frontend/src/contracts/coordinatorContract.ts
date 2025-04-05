import seedyCoordinatorAbiJson from '../../seedCoordinatorabi.json';

console.log("--- coordinatorContract.ts executing ---");
console.log("Raw JSON import type:", typeof seedyCoordinatorAbiJson, "Is Array?", Array.isArray(seedyCoordinatorAbiJson));

export const SEEDY_COORDINATOR_ADDRESS = '0x1b8A8a422D4dD3c6d47f79f30ed49b42D96185Da' as const;

export const SEEDY_COORDINATOR_ABI = seedyCoordinatorAbiJson as unknown[];

console.log("Final SEEDY_COORDINATOR_ABI:", typeof SEEDY_COORDINATOR_ABI, Array.isArray(SEEDY_COORDINATOR_ABI), SEEDY_COORDINATOR_ABI?.length);
console.log("--- coordinatorContract.ts finished ---");
