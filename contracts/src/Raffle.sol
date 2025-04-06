// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./SeedyCoordinator.sol";

contract Raffle {
    address public owner;

    SeedyCoordinator public coordinator;

    struct Bet {
        address player;
        uint256 stake;
        uint256 oddsPermil;
        uint256 requestId;
        bool finalized;
        bool won;
        uint256 payout;
    }

    mapping(uint256 => Bet) public bets;
    uint256 public betCounter;
    uint256 public houseEdgePermil = 20;

    uint256 public constant BLOCK_DELAY = 5;
    uint256 public constant T = 1048576;
    uint256 public constant DELTA = 9;

    event BetPlaced(
        uint256 indexed betId, address indexed player, uint256 stake, uint256 oddsPermil, uint256 requestId
    );

    event BetFinalized(uint256 indexed betId, bool won, uint256 payout);

    constructor(address _coordinator) {
        owner = msg.sender;
        coordinator = SeedyCoordinator(_coordinator);
    }

    function placeBet(uint256 oddsPermil) external payable returns (uint256 betId) {
        require(msg.value > 0, "No stake sent");
        require(oddsPermil >= 1 && oddsPermil <= 999, "Odds out of range");

        uint256 requestId = coordinator.requestRandomness(BLOCK_DELAY, T, DELTA);

        betId = ++betCounter;
        bets[betId] = Bet({
            player: msg.sender,
            stake: msg.value,
            oddsPermil: oddsPermil,
            requestId: requestId,
            finalized: false,
            won: false,
            payout: 0
        });

        emit BetPlaced(betId, msg.sender, msg.value, oddsPermil, requestId);
    }

    function finalizeBet(uint256 betId) external {
        Bet storage b = bets[betId];
        require(!b.finalized, "Bet already finalized");

        bytes32 finalRand = coordinator.getFinalRandomness(b.requestId);
        require(finalRand != bytes32(0), "Random not finalized yet in coordinator");

        b.finalized = true;

        uint256 randomNum = uint256(finalRand) % 1000;

        if (randomNum < b.oddsPermil) {
            b.won = true;

            uint256 fairPayout = (b.stake * 1000) / b.oddsPermil;
            uint256 edgeCut = (fairPayout * houseEdgePermil) / 1000;
            uint256 finalPayout = fairPayout - edgeCut;

            require(address(this).balance >= finalPayout, "Not enough in pot");
            b.payout = finalPayout;

            (bool success,) = b.player.call{value: finalPayout}("");
            require(success, "Payout failed");
        }

        emit BetFinalized(betId, b.won, b.payout);
    }

   
    function hasWon(uint256 betId, bytes memory actualY) external view returns (bool won) {
        Bet storage b = bets[betId];
        require(b.player != address(0), "Bet does not exist"); 
        
        bytes32 finalRand = keccak256(actualY);
        uint256 randomNum = uint256(finalRand) % 1000;
        won = randomNum < b.oddsPermil;
  
    }

    function depositHouseFunds() external payable {}

    function ownerWithdraw(uint256 amount) external {
        require(msg.sender == owner, "Not owner");
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success,) = owner.call{value: amount}("");
        require(success, "Withdraw failed");
    }

    function changeOwner(address newOwner) external {
        require(msg.sender == owner, "Not owner");
        owner = newOwner;
    }

    function setHouseEdge(uint256 newEdgePermil) external {
        require(msg.sender == owner, "Not owner");
        require(newEdgePermil < 500, "Edge too large"); // up to 50% for example
        houseEdgePermil = newEdgePermil;
    }

    receive() external payable {}
    fallback() external payable {}
}
