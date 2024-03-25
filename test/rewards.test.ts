import * as hre from "hardhat";
import { ethers, parseEther } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

import {
  MockERC1155,
  MockERC20,
  MockERC721,
  Staking721,
} from "../typechain";
import {
  POOL_NOT_EXIST,
  INVALID_TOKEN_ID,
  ONLY_NFT_OWNER,
  ONLY_SNFT_OWNER,
  ONLY_ADMIN,
  INVALID_POOL,
} from "./helpers/staking/errors";
import {
  PoolConfig,
} from "./helpers/staking/types";
import { createDefaultConfigs } from "./helpers/staking/defaults";
import { calcRewardsAmount } from "./helpers/staking/rewards";
import { dayInSeconds } from "./helpers/staking/constants";

describe("Reward calculation edge cases", () => {
  let deployer : SignerWithAddress;
  let staker : SignerWithAddress;
  let notStaker : SignerWithAddress;

  let staking721 : Staking721;

  let mockERC20 : MockERC20;
  let mockERC721 : MockERC721;

  let config : PoolConfig;
  let tokenId : number;

  let stakedOrClaimedAt : number;
  before(async function () {
    [
      deployer,
      staker,
      notStaker
    ] = await hre.ethers.getSigners();

    const mockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    mockERC20 = await mockERC20Factory.deploy("MEOW", "MEOW");

    const mockERC721Factory = await hre.ethers.getContractFactory("MockERC721");
    mockERC721 = await mockERC721Factory.deploy("WilderWheels", "WW", "0://wheels-base");

    config = await createDefaultConfigs(mockERC20, mockERC721);

    const stakingFactory = await hre.ethers.getContractFactory("Staking721");
    staking721 = await stakingFactory.deploy(
      "StakingNFT",
      "SNFT",
      config
    ) as Staking721;
  });
  // Define edge cases for each parameter
  const timePassedCases = [1, 2, 100, 1000, 10 ** 15, BigInt("1000000000000000000"), BigInt("1000000000000000000000000")]; //up to 10^24
  const poolWeightCases = [0, 1, 1000, 10000, 10 ** 15, BigInt("1000000000000000000"), BigInt("1000000000000000000000000")];
  const rewardPeriodCases = [1, 2, 10, 1000, 10 ** 15, BigInt("1000000000000000000"), BigInt("1000000000000000000000000")]; // todo, cover rewardPeriod >= timePassed
  const stakeAmountCases = [0, 1, 1000, 10000, 10 ** 15, BigInt("1000000000000000000"), BigInt("1000000000000000000000000")];

  // Loop over all combinations of edge cases
  for (const timePassed of timePassedCases) {
    for (const poolWeight of poolWeightCases) {
      for (const rewardPeriod of rewardPeriodCases) {
        for (const stakeAmount of stakeAmountCases) {
          it(`calculates rewards for timePassed=${timePassed}, poolWeight=${poolWeight}, rewardPeriod=${rewardPeriod}, stakeAmount=${stakeAmount}`, async function () {

            // Calculate expected rewards using JavaScript
            // const expectedRewards = calcRewardsAmount({
            //   timePassed: BigInt(timePassed),
            //   rewardWeight: BigInt(poolWeight), // Assuming `calcRewardsAmount` expects a rewardWeight instead of poolWeight
            //   rewardPeriod: BigInt(rewardPeriod),
            //   stakeAmount: BigInt(stakeAmount),
            // });

            const expectedRewards = calcRewardsAmount(
              {
                poolWeight: BigInt(poolWeight),
                periodLength: BigInt(rewardPeriod),
              } as unknown as PoolConfig,
              BigInt(1),
              BigInt(timePassed)
            )

            //This is the max uint in solidity 2^256 - 1
            // let maxUint = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935");
            //This is the numerator of the reward calc, if it is over the max uint, it will overflow
            // let upperEdgeCalc = BigInt("1000000000000000000") * BigInt(poolWeight) * BigInt(timePassed) * BigInt(stakeAmount);

            // if (upperEdgeCalc >= ethers.MaxUint256) {
            //   // Contract call should overflow
            //   // await expect(staking721.viewPendingRewards(
            //   //   timePassed, poolWeight, rewardPeriod, stakeAmount
            //   // )).to.be.reverted;
            // } else {
            //   // Calculate rewards using the smart contract
            //   const contractRewards = await staking721.(
            //     timePassed, poolWeight, rewardPeriod, stakeAmount
            //   );
            //   // Compare the results
            //   expect(contractRewards.toString()).to.equal(expectedRewards.toString());
            // }
          });
        }
      }
    }
  }
});