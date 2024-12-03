import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  MockERC20,
  MockERC721,
  StakingERC721,
} from "../typechain";
import {
  createDefaultConfigs,
  calcTotalRewards,
  STAKED_EVENT,
  CLAIMED_EVENT,
  UNSTAKED_EVENT,
  BaseConfig,
  WITHDRAW_EVENT,
  DEFAULT_LOCK,
  DEFAULT_REWARDS_PER_PERIOD,
  DAY_IN_SECONDS,
} from "./helpers/staking";
import {
  FAILED_INNER_CALL_ERR,
  FUNCTION_SELECTOR_ERR,
  ZERO_INIT_ERR,
  NON_TRANSFERRABLE_ERR,
  INCORRECT_OWNER_ERR,
  INVALID_OWNER_ERR,
  NONEXISTENT_TOKEN_ERR,
  NO_REWARDS_BALANCE_ERR,
  TIME_LOCK_NOT_PASSED_ERR, INSUFFICIENT_APPROVAL_721_ERR, OWNABLE_UNAUTHORIZED_ERR,
} from "./helpers/errors";


let owner : SignerWithAddress;
let stakerA : SignerWithAddress;
let stakerB : SignerWithAddress;
let stakerC : SignerWithAddress;
let notStaker : SignerWithAddress;

let stakingERC721 : StakingERC721;
let rewardToken : MockERC20;
let stakingToken : MockERC721;

let stakingERC721Address : string;
let rewardTokenAddress : string;
let stakingTokenAddress : string;

// We don't use `PoolConfig` anymore on the contracts but for convenience in testing
// we can leave this type where it is
let config : BaseConfig;

// Keep timestamps for users
let firstStakedAtA : bigint;
let secondStakedAtA : bigint;

let firstStakedAtB : bigint;
let secondStakedAtB : bigint;

let claimedAtA : bigint;
let claimedAtB : bigint;

let unstakedAtA : bigint;
let unstakedAtB : bigint;

let secondUnstakedAt : bigint;

let balanceAtStakeOne : bigint;
let balanceAtStakeTwo : bigint;

let durationOne : bigint;
let durationTwo : bigint;

// Default token ids
const tokenIdA = 1n;
const tokenIdB = 2n;
const tokenIdC = 3n;
const tokenIdD = 4n;
const tokenIdE = 5n;
const tokenIdF = 6n;
const tokenIdG = 7n;

const tokenIdDelayed = 8n; // Minted and used in stake at a later point in time
const unStakedTokenId = 9n; // Minted but never used in stake
const unmintedTokenId = 10n; // Never minted

const baseUri = "0://staked-nfts";
const emptyUri = "";

let reset = async () => {};
describe("StakingERC721", () => {
  let owner : SignerWithAddress;
  let stakerA : SignerWithAddress;
  let stakerB : SignerWithAddress;
  let stakerC : SignerWithAddress;
  let notStaker : SignerWithAddress;

  let stakingERC721 : StakingERC721;
  let rewardToken : MockERC20;
  let stakingToken : MockERC721;

  let stakingERC721Address : string;
  let rewardTokenAddress : string;
  let stakingTokenAddress : string;

  // We don't use `PoolConfig` anymore on the contracts but for convenience in testing
  // we can leave this type where it is
  let config : BaseConfig;

  // Keep timestamps for users
  let firstStakedAtA : bigint;
  let secondStakedAtA : bigint;

  let firstStakedAtB : bigint;
  let secondStakedAtB : bigint;

  let claimedAtA : bigint;
  let claimedAtB : bigint;

  let unstakedAtA : bigint;
  let unstakedAtB : bigint;

  let secondUnstakedAt : bigint;

  let balanceAtStakeOne : bigint;
  let balanceAtStakeTwo : bigint;

  let durationOne : bigint;
  let durationTwo : bigint;

  // Default token ids
  const tokenIdA = 1n;
  const tokenIdB = 2n;
  const tokenIdC = 3n;
  const tokenIdD = 4n;
  const tokenIdE = 5n;
  const tokenIdF = 6n;
  const tokenIdG = 7n;

  const tokenIdDelayed = 8n; // Minted and used in stake at a later point in time
  const unStakedTokenId = 9n; // Minted but never used in stake
  const unmintedTokenId = 10n; // Never minted

  const baseUri = "0://staked-nfts";
  const emptyUri = "";

  let reset = async () => {};

  before(async () => {
    [
      owner,
      stakerA,
      stakerB,
      stakerC,
      notStaker,
    ] = await hre.ethers.getSigners();

    reset = async () => {

      const mockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
      rewardToken = await mockERC20Factory.deploy("MEOW", "MEOW");
  
      rewardTokenAddress = await rewardToken.getAddress();
  
      const mockERC721Factory = await hre.ethers.getContractFactory("MockERC721");
      stakingToken = await mockERC721Factory.deploy("WilderWheels", "WW", baseUri);
  
      stakingTokenAddress = await stakingToken.getAddress();
  
      config = await createDefaultConfigs(rewardToken, stakingToken);
  
      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      stakingERC721 = await stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        config.stakingToken,
        config.rewardsToken,
        config.rewardsPerPeriod,
        owner.address
      );
  
      stakingERC721Address = await stakingERC721.getAddress();
  
      // Give staking contract balance to pay rewards
      await rewardToken.connect(owner).transfer(
        await stakingERC721.getAddress(),
        hre.ethers.parseEther("8000000000000")
      );
  
      await stakingToken.connect(owner).mint(stakerA.address, tokenIdA);
      await stakingToken.connect(owner).mint(stakerA.address, tokenIdB);
      await stakingToken.connect(owner).mint(stakerA.address, tokenIdC);
  
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdD);
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdE);
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdF);
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdG);
  
      await stakingToken.connect(owner).mint(owner.address, unStakedTokenId);
  
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);
  
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdD);
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdE);
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdF);
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdG);
    }

    // Call once to set up the contracts
    await reset();
  });

});
