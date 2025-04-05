// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import {Test, console} from "forge-std/Test.sol";
import {SeedyVerifier} from "../src/Seedy.sol";

contract SeedyTest is Test {
    SeedyVerifier public seedyVerifier;

    function setUp() public {
        seedyVerifier = new SeedyVerifier();
    }

    function testVerifyProof() public {
        bytes memory x = hex"1234abcd";
        bytes memory y =
            hex"0344f9790741bce8b2e18da20fecbe300fd94574e7650204b7609e3557c88bab9a6d6f2b494ba4316cdca705fd46e823e7d4692388cb23eb8c36fb30d1b966973a7c22a3c11a79215c141856d951215487931249665bb35823bea23fa790ce6dcc84cb11338a144b192280820c74a58f3bef2ca89438f825a27169fedc0791da7d"; // paste the full hex from your output
        bytes memory N =
            hex"0c196ba6b8f017e8a7d66f83240c5f4acf45c8f6f9e48f2b9d63c6f9b742ccb8701f3af0b66d34ab63d6c6efa509572dfe3019575280ef967a0c0e9a0b68b10cb6a7063bd5c7cc7fc1f76147cb1a45a3f802e8a8774e37cf11f750b15811d37f321293c29f67cbaa4c9e4c7a3ad1830f06069dc271d48d2611b1ef8b64c7ead9c1";

        uint256 T = 32768;
        uint256 delta = 9;
        bytes[] memory proof = new bytes[](6);
        proof[0] =
            hex"066c83979c2f1e85d767471519ba55400f5a1b6aa07e14f155cecf648731df78b731e1d62c0d10a5b71c47f4531c13cdc6f2dfba9e22df82322213b545cf7528dbfb7e9e263e1aad0167712643358376bdc724b5046a5c94da597fce3b7d8ab52dd7a5b41806fc28a67154e3c0502f52a05c02c158db75a7c358c2e51523eabc59";
        proof[1] =
            hex"881f4ac3e09376f0e3c065f08c003daea28288a5ad0a03908f309a583238ebae6831bc68e2a7f7739f025b0a4f8510d3aca9888048db262be7864c0eca1caf8a3b04893f6b46f60e337b7bde798cf45631fc78e1c01d03f6d6de4310cd428e97f2b41994e2b4551870fb3e26274244f7e8d2d69b1275b76efe467f72a3227489";
        proof[2] =
            hex"0a2d2f91637d233127b62fce917736117ad31d09b761d81b087a50ab7e7f2a15ebc68d20d313f9241ca51598e888641348f3c05c39c741e43c101a4750663d2cd6d05343eb3a183ff5124284382feaa18268abb141f7622e5d343b61bb1c7daa4fe590524536e94a1b88d74b0174ab40bfb640806e4474549a1391b59d6d573f82";
        proof[3] =
            hex"0b9f13e348e62612388d915add77ed744d2dc731bc8ccc2138ae598dc22083c7109c4241f73ce77d43516aab9228fd5a49502305abe07b988a49e6456d50f6d0fadb6559641c1324a51a0d432e8bd246af2e4e7030fce040e6978fa9c784ecac2a641bf59a7de16fb3e315f5d60eec5848c7b10af8926147754a00aaa226f23371";
        proof[4] =
            hex"0a879b67c7814eff34373451d767a885678778de35d9a1336d812c844fa904bd017ad2e2063b6802e395f49ab1c0d5be836b596ba80096431a1d197a555e58f62ddb127ad2209a1c40408c5819cb07d91f0da9fcd32ce32d97cb1627ab70c460ee4a28dab192f0be17430fc5bde414a0bc7c50044bf480eb1a17bb72218696c4d6";
        proof[5] =
            hex"0830d7f92be9d7e69c96e6ec0ea68d38fa657b001b9fe722b964024a64b875631284c5fcbf188c1b69d82e39baf032155034c09cb6cd74f88e2b3aeca5c9360fae19c9e9a1e11510a1c20a16c4d3c3f2fe06405bcc92920acee5d480f7898149e67952ec52a6394c8df1da0f5954cc5f3abb55fa35537eb48f9e178c388c4d65ea";

        (bytes memory out1, bytes memory out2) = seedyVerifier.verify(x, y, T, delta, proof, N);
        console.logBytes(out1);
        console.logBytes(out2);
        bool isValid = keccak256(out1) == keccak256(out2);
        assertTrue(isValid, "Expected proof to be valid");
    }
}
