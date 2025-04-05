// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

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
            hex"344f9790741bce8b2e18da20fecbe300fd94574e7650204b7609e3557c88bab9a6d6f2b494ba4316cdca705fd46e823e7d4692388cb23eb8c36fb30d1b966973a7c22a3c11a79215c141856d951215487931249665bb35823bea23fa790ce6dcc84cb11338a144b192280820c74a58f3bef2ca89438f825a27169fedc0791da7d0"; // paste the full hex from your output
        bytes memory N =
            hex"c196ba6b8f017e8a7d66f83240c5f4acf45c8f6f9e48f2b9d63c6f9b742ccb8701f3af0b66d34ab63d6c6efa509572dfe3019575280ef967a0c0e9a0b68b10cb6a7063bd5c7cc7fc1f76147cb1a45a3f802e8a8774e37cf11f750b15811d37f321293c29f67cbaa4c9e4c7a3ad1830f06069dc271d48d2611b1ef8b64c7ead9c10";

        uint256 T = 32768;
        uint256 delta = 9;
        bytes[] memory proof = new bytes[](6);
        proof[0] =
            hex"66c83979c2f1e85d767471519ba55400f5a1b6aa07e14f155cecf648731df78b731e1d62c0d10a5b71c47f4531c13cdc6f2dfba9e22df82322213b545cf7528dbfb7e9e263e1aad0167712643358376bdc724b5046a5c94da597fce3b7d8ab52dd7a5b41806fc28a67154e3c0502f52a05c02c158db75a7c358c2e51523eabc590";
        proof[2] =
            hex"c0038526c81675dcf16c527dc5894ddf0a29482f3f4afe687363247541064fd6c41e422a33dad0d1b679b9492fc551626749c78c18aeadab0ec6cd9efda267829a00403535ea1045ce21a55b9782ad95ac7e95e85de3f0e87637da1abdfe847bcf872f0700c553eb964cfa02ecd83c473688e84e76982bbb212e95f852976c29d0";
        proof[3] =
            hex"98db9b72d9babb6a6d1b4a3716e7a1a689a3b9bdd3dc77290294eaf420a93a4c2e149759ba194d5a24ea4e293346b0a31d65919199c135ee86317bc9fb3ace438310d6a938294be1f9494cb4df21a6cbe1108aed13024efc310468b739fab8abd093cb6dd513fcf827fcede12698fe98d177e7441a85d4c695824a7373b3262620";
        proof[4] =
            hex"a44e5382527bb4c7e320b5e6e0c449a09a46d2e27f3aaec6dbb0b3919406226aefc9da0df4d2221a32ca852a9fdc7da5ae6710f035ae547fff99f194c4011b10670b53f404f914fcac500b64ab63832071736a4be81e0dfc6adbe886dc5c713f5887935269703b39764ef7076161f40231776fea14bcb5a8c6939d233755516ab0";
        proof[5] =
            hex"a7bcde3089148ecc883edf59663112d146cd6967781b26aa7d126f61eae03e06c93754f1bafde8ef7441565ae9db61e6c62333c2675b47f08d103b434241df44d7e295cf865466b6b3ab9f731c25298ce5fc80515614b367f9a23eb02e21a9addf8cb9408e64522654a7abcbd1198f836161763ea5717923ad821edb2fbc1feae0";

        bool isValid = seedyVerifier.verifyPietrzakVDF(x, y, T, delta, proof, N);
        assertTrue(isValid, "Expected proof to be valid");
    }
}
