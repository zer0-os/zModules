import * as hre from "hardhat";
import { runZModulesCampaign } from "../src/deploy";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ZModulesZeroVotingERC20DM } from "../src/deploy/missions/voting-erc20/voting20.mission";
import { ZModulesStakingERC20DM } from "../src/deploy/missions/staking-erc20/staking20.mission";
import {
  IZModulesConfig,
  IZModulesContracts,
  ZModulesContract,
} from "../src/deploy/campaign/types";
import {
  getMockERC20Mission,
  TokenTypes,
} from "../src/deploy/missions/mocks/mockERC20.mission";
import { expect } from "chai";
import {
  DeployCampaign,
  MongoDBAdapter,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getMockERC721Mission } from "../src/deploy/missions/mocks/mockERC721.mission";
import { ZModulesZeroVotingERC721DM } from "../src/deploy/missions/voting-erc721/voting721.mission";
import { ZModulesStakingERC721DM } from "../src/deploy/missions/staking-erc721/staking721.mission";
import {
  MockERC20,
  MockERC721,
  StakingERC20,
  StakingERC721,
  ZeroVotingERC20,
  ZeroVotingERC721,
} from "../typechain";
import { ZModulesZDAODM } from "../src/deploy/missions/dao/zdao.mission";
import { daoConfig } from "../src/environment/configs/dao.configenv";
import { ZModulesTimelockControllerDM } from "../src/deploy/missions/dao/timelock.mission";
import { roles } from "../src/deploy/constants";
import { getStaking20SystemConfig, getStaking721SystemConfig } from "../src/deploy/campaign/staking-system-config";
import { staking20Config, staking721Config } from "../src/environment/configs/staking.configenv";
import { IStaking20Environment, IStaking721Environment } from "../src/environment/types";
import {
  getDao20SystemConfig,
  getDao721SystemConfig,
} from "../src/deploy/campaign/dao-system-config";
import { setDefaultEnvironment } from "../src/environment/set-env";
import { DAY_IN_SECONDS, DEFAULT_STAKED_AMOUNT } from "./helpers/constants";
import { time } from "@nomicfoundation/hardhat-network-helpers";


describe("zModules Deploy Integration Test", () => {
  let deployAdmin : SignerWithAddress;
  let votingAdmin : SignerWithAddress;
  let timelockAdmin : SignerWithAddress;
  let stakingAdmin : SignerWithAddress;
  let staker : SignerWithAddress;
  let contractOwner : SignerWithAddress;

  let stakingConfig : IStaking20Environment | IStaking721Environment;
  let config : IZModulesConfig;

  let staking : StakingERC20 | StakingERC721;
  let stakeToken : MockERC20 | MockERC721;
  let rewardsToken : MockERC20 | MockERC721;
  let stakeRepToken : ZeroVotingERC20 | ZeroVotingERC721;

  let campaign : DeployCampaign<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZModulesConfig,
  IZModulesContracts>;
  let dbAdapter : MongoDBAdapter;

  const {
    DEFAULT_ADMIN_ROLE,
    PROPOSER_ROLE,
    EXECUTOR_ROLE,
    CANCELLER_ROLE,
  } = roles.timelock;


  before(async () => {
    [ deployAdmin, votingAdmin, timelockAdmin, stakingAdmin, staker ] = await hre.ethers.getSigners();
  });

  after(async () => {
    await dbAdapter.dropDB();
  });

  describe("Staking", () => {
    it("Should deploy StakingERC20 with zDC and default config", async () => {
      config = await getStaking20SystemConfig(deployAdmin, votingAdmin, stakingAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          getMockERC20Mission({
            tokenType: TokenTypes.staking,
            tokenName: "Staking Token",
            tokenSymbol: "STK",
          }),
          getMockERC20Mission({
            tokenType: TokenTypes.rewards,
            tokenName: "Rewards Token",
            tokenSymbol: "RWD",
          }),
          ZModulesZeroVotingERC20DM,
          ZModulesStakingERC20DM,
        ],
      });

      ({
        staking20: staking,
        votingErc20: stakeRepToken,
        mockErc20STK: stakeToken,
        mockErc20REW: rewardsToken,
        dbAdapter,
      } = campaign);

      // tokens
      expect(await staking.stakingToken()).to.eq(stakeToken.target);
      expect(await staking.rewardsToken()).to.eq(rewardsToken.target);
      expect(await staking.stakeRepToken()).to.eq(stakeRepToken.target);

      // config
      stakingConfig = staking20Config;
      const {
        rewardsPerPeriod,
        periodLength,
        minimumLockTime,
        minimumRewardsMultiplier,
        maximumRewardsMultiplier,
        canExit,
      } = await staking.getLatestConfig();

      expect(
        minimumLockTime
      ).to.eq(
        stakingConfig.STAKING20_MIN_LOCK_TIME
      );
      expect(
        minimumRewardsMultiplier
      ).to.eq(
        stakingConfig.STAKING20_MIN_REWARDS_MULTIPLIER
      );
      expect(
        maximumRewardsMultiplier
      ).to.eq(
        stakingConfig.STAKING20_MAX_REWARDS_MULTIPLIER
      );
      expect(
        rewardsPerPeriod
      ).to.eq(
        stakingConfig.STAKING20_REWARDS_PER_PERIOD
      );
      expect(
        periodLength
      ).to.eq(
        stakingConfig.STAKING20_PERIOD_LENGTH
      );
      expect(
        canExit
      ).to.eq(
        false
      );
    });

    it("StakingERC20 should have MINTER_ROLE and BURNER_ROLE of StakeRepToken", async () => {
      expect(
        await stakeRepToken.hasRole(roles.voting.MINTER_ROLE, staking.target)
      ).to.eq(
        true
      );
      expect(
        await stakeRepToken.hasRole(roles.voting.BURNER_ROLE, staking.target)
      ).to.eq(
        true
      );
    });

    it("Should deploy StakingERC721 with zDC and default config", async () => {
      config = await getStaking721SystemConfig(deployAdmin, votingAdmin, stakingAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          getMockERC721Mission({
            tokenType: TokenTypes.staking,
            tokenName: "Staking Token",
            tokenSymbol: "STK",
            baseUri: "0://NFT/",
          }),
          getMockERC20Mission({
            tokenType: TokenTypes.rewards,
            tokenName: "Rewards Token",
            tokenSymbol: "RWD",
          }),
          ZModulesZeroVotingERC721DM,
          ZModulesStakingERC721DM,
        ],
      });

      ({
        staking721: staking,
        votingErc721: stakeRepToken,
        mockErc721STK: stakeToken,
        mockErc20REW: rewardsToken,
      } = campaign);

      // config
      stakingConfig = staking721Config;
      const {
        rewardsPerPeriod,
        periodLength,
        minimumLockTime,
        minimumRewardsMultiplier,
        maximumRewardsMultiplier,
      } = await staking.getLatestConfig();

      expect(
        minimumLockTime
      ).to.eq(
        stakingConfig.STAKING721_MIN_LOCK_TIME
      );
      expect(
        minimumRewardsMultiplier
      ).to.eq(
        stakingConfig.STAKING721_MIN_REWARDS_MULTIPLIER
      );
      expect(
        maximumRewardsMultiplier
      ).to.eq(
        stakingConfig.STAKING721_MAX_REWARDS_MULTIPLIER
      );
      expect(
        rewardsPerPeriod
      ).to.eq(
        stakingConfig.STAKING721_REWARDS_PER_PERIOD
      );
      expect(
        periodLength
      ).to.eq(
        stakingConfig.STAKING721_PERIOD_LENGTH
      );
    });

    it("StakingERC721 should have MINTER_ROLE and BURNER_ROLE of StakeRepToken", async () => {
      expect(
        await stakeRepToken.hasRole(roles.voting.MINTER_ROLE, staking.target)
      ).to.eq(
        true
      );
      expect(
        await stakeRepToken.hasRole(roles.voting.BURNER_ROLE, staking.target)
      ).to.eq(
        true
      );
    });
  });

  describe("DAO", () => {
    it("Should deploy DAO with ERC20 token zDC and default config", async () => {
      config = await getDao20SystemConfig(deployAdmin, timelockAdmin, votingAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          ZModulesZeroVotingERC20DM,
          ZModulesTimelockControllerDM,
          ZModulesZDAODM,
        ],
      });

      const {
        zDao,
      } = campaign;

      // defaults. expected result
      const {
        DAO_VOTING_DELAY,
        DAO_VOTING_PERIOD,
        DAO_PROPOSAL_THRESHOLD,
      } = daoConfig;

      expect(await zDao.votingDelay()).to.eq(DAO_VOTING_DELAY);
      expect(await zDao.votingPeriod()).to.eq(DAO_VOTING_PERIOD);
      expect(await zDao.proposalThreshold()).to.eq(DAO_PROPOSAL_THRESHOLD);
    });

    it("DAO should have PROPOSER_ROLE, EXECUTOR_ROLE and CANCELLER_ROLE of Timelock", async () => {
      const {
        timelockController,
        zDao,
      } = campaign;

      expect(
        await timelockController.hasRole(
          PROPOSER_ROLE,
          zDao.target
        )
      ).to.eq(
        true
      );

      expect(
        await timelockController.hasRole(
          EXECUTOR_ROLE,
          zDao.target
        )
      ).to.eq(
        true
      );

      expect(
        await timelockController.hasRole(
          CANCELLER_ROLE,
          zDao.target
        )
      ).to.eq(
        true
      );

      expect(
        await timelockController.hasRole(
          DEFAULT_ADMIN_ROLE,
          deployAdmin.address
        )
      ).to.eq(
        false
      );
    });

    it("Should NOT have DEFAULT_ADMIN_ROLE, revoked by defualt", async () => {
      const {
        timelockController,
      } = campaign;

      expect(
        await timelockController.hasRole(
          DEFAULT_ADMIN_ROLE,
          deployAdmin.address
        )
      ).to.eq(
        false
      );
    });
  });

  describe("Deploy using ENV vars", () => {
    let stakeToken20 : ZModulesContract;
    let stakeToken721 : ZModulesContract;
    let rewardsToken20 : ZModulesContract;
    let timelockController : ZModulesContract;

    let envCampaign : DeployCampaign<
    HardhatRuntimeEnvironment,
    SignerWithAddress,
    IZModulesConfig,
    IZModulesContracts>;

    // Staking env vars
    const envRewardsPerPeriod = "30";
    const envPeriodLength = (86400n * 365n * 2n).toString();  // 2 years in seconds
    const envMinLockTime = (86400n * 30n * 2n).toString();   // 2 months in seconds
    const envMinRewardsMultiplier = "10";
    const envMaxRewardsMultiplier = "100";

    // DAO env vars
    const envVotingDelay = "1"; // 1 second
    const envVotingPeriod = "5"; // 5 blocks
    const envProposalThreshold = "5"; // 5 tokens
    const envQuorumPercentage = "5"; // 5%
    const envVoteExtension = "2"; // 2 blocks

    before(async () => {
      await dbAdapter.dropDB();

      [ contractOwner ] = await hre.ethers.getSigners();

      config = await getDao20SystemConfig(deployAdmin, timelockAdmin, votingAdmin);

      // a separate campaign with "pre-deployed" tokens
      envCampaign = await runZModulesCampaign({
        config,
        missions: [
          getMockERC20Mission({
            tokenType: TokenTypes.staking,
            tokenName: "Staking Token",
            tokenSymbol: "STK",
          }),
          getMockERC20Mission({
            tokenType: TokenTypes.rewards,
            tokenName: "Rewards Token",
            tokenSymbol: "RWD",
          }),
          getMockERC721Mission({
            tokenType: TokenTypes.staking,
            tokenName: "Staking Token",
            tokenSymbol: "STK",
            baseUri: "0://NFT/",
          }),
          ZModulesTimelockControllerDM,
        ],
      });

      ({
        mockErc20STK: stakeToken20,
        mockErc20REW: rewardsToken20,
        mockErc721STK: stakeToken721,
        timelockController,
      } = envCampaign.state.contracts);
    });

    afterEach(async () => {
      await dbAdapter.dropDB();

      Object.keys(process.env).forEach(key => {
        if (key.startsWith("DAO_") ||
            key.startsWith("STAKING20_") ||
            key.startsWith("STAKING721_")
        ) {
          delete process.env[key];
        }
      });

      setDefaultEnvironment();

      // to be clear
      campaign = undefined!;
      config = undefined!;
    });

    it("Should deploy StakingERC20 with zDC", async () => {
      // set env vars
      const stakingTokenAddress = stakeToken20.target.toString();
      const rewardsTokenAddress = rewardsToken20.target.toString();
      const contractOwnerAddress = contractOwner.address.toString();

      process.env.STAKING20_STAKING_TOKEN = stakingTokenAddress;
      process.env.STAKING20_REWARDS_TOKEN = rewardsTokenAddress;
      process.env.STAKING20_CONTRACT_OWNER = contractOwnerAddress;
      process.env.STAKING20_REWARDS_PER_PERIOD = envRewardsPerPeriod;
      process.env.STAKING20_PERIOD_LENGTH = envPeriodLength;
      process.env.STAKING20_MIN_LOCK_TIME = envMinLockTime;
      process.env.STAKING20_MIN_REWARDS_MULTIPLIER = envMinRewardsMultiplier;
      process.env.STAKING20_MAX_REWARDS_MULTIPLIER = envMaxRewardsMultiplier;
      process.env.STAKING20_CAN_EXIT = "true";

      config = await getStaking20SystemConfig(deployAdmin, deployAdmin, deployAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          ZModulesZeroVotingERC20DM,
          ZModulesStakingERC20DM,
        ],
      });

      ({
        staking20: staking,
      } = campaign);

      const {
        rewardsPerPeriod,
        periodLength,
        minimumLockTime,
        minimumRewardsMultiplier,
        maximumRewardsMultiplier,
        canExit,
      } = await staking.getLatestConfig();

      // config
      expect(
        minimumLockTime
      ).to.eq(
        envMinLockTime
      );
      expect(
        minimumRewardsMultiplier
      ).to.eq(
        envMinRewardsMultiplier
      );
      expect(
        maximumRewardsMultiplier
      ).to.eq(
        envMaxRewardsMultiplier
      );
      expect(
        rewardsPerPeriod
      ).to.eq(
        envRewardsPerPeriod
      );
      expect(
        periodLength
      ).to.eq(
        envPeriodLength
      );
      expect(
        canExit
      ).to.eq(
        true
      );
      expect(
        await staking.owner()
      ).to.eq(
        contractOwnerAddress
      );

      // tokens
      expect(await staking.stakingToken()).to.eq(stakingTokenAddress);
      expect(await staking.rewardsToken()).to.eq(rewardsTokenAddress);
    });

    it("Should deploy StakingERC721 with zDC", async () => {
      const stakingTokenAddress = stakeToken721.target.toString();
      const rewardsTokenAddress = rewardsToken20.target.toString();
      const contractOwnerAddress = contractOwner.address.toString();

      process.env.STAKING721_STAKING_TOKEN = stakingTokenAddress;
      process.env.STAKING721_REWARDS_TOKEN = rewardsTokenAddress;
      process.env.STAKING721_CONTRACT_OWNER = contractOwnerAddress;
      process.env.STAKING721_REWARDS_PER_PERIOD = envRewardsPerPeriod;
      process.env.STAKING721_PERIOD_LENGTH = envPeriodLength;
      process.env.STAKING721_MIN_LOCK_TIME = envMinLockTime;
      process.env.STAKING721_MIN_REWARDS_MULTIPLIER = envMinRewardsMultiplier;
      process.env.STAKING721_MAX_REWARDS_MULTIPLIER = envMaxRewardsMultiplier;
      process.env.STAKING721_CAN_EXIT = "true";

      config = await getStaking721SystemConfig(deployAdmin, deployAdmin, deployAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          ZModulesZeroVotingERC721DM,
          ZModulesStakingERC721DM,
        ],
      });

      ({
        staking721: staking,
      } = campaign);

      const {
        rewardsPerPeriod,
        periodLength,
        minimumLockTime,
        minimumRewardsMultiplier,
        maximumRewardsMultiplier,
        canExit,
      } = await staking.getLatestConfig();

      // config
      expect(
        minimumLockTime
      ).to.eq(
        envMinLockTime
      );
      expect(
        minimumRewardsMultiplier
      ).to.eq(
        envMinRewardsMultiplier
      );
      expect(
        maximumRewardsMultiplier
      ).to.eq(
        envMaxRewardsMultiplier
      );
      expect(
        rewardsPerPeriod
      ).to.eq(
        envRewardsPerPeriod
      );
      expect(
        periodLength
      ).to.eq(
        envPeriodLength
      );
      expect(
        canExit
      ).to.eq(
        true
      );
      expect(
        await staking.owner()
      ).to.eq(
        contractOwnerAddress
      );

      // tokens
      expect(await staking.stakingToken()).to.eq(stakingTokenAddress);
      expect(await staking.rewardsToken()).to.eq(rewardsTokenAddress);
    });

    it("Should deploy StakingERC20 with zDC and gas token", async () => {
      process.env.STAKING20_STAKING_TOKEN = hre.ethers.ZeroAddress;
      process.env.STAKING20_REWARDS_TOKEN = hre.ethers.ZeroAddress;
      process.env.STAKING20_CONTRACT_OWNER = contractOwner.address;
      process.env.STAKING20_REWARDS_PER_PERIOD = envRewardsPerPeriod;
      process.env.STAKING20_PERIOD_LENGTH = envPeriodLength;
      process.env.STAKING20_MIN_LOCK_TIME = envMinLockTime;
      process.env.STAKING20_MIN_REWARDS_MULTIPLIER = envMinRewardsMultiplier;
      process.env.STAKING20_MAX_REWARDS_MULTIPLIER = envMaxRewardsMultiplier;

      config = await getStaking20SystemConfig(deployAdmin, votingAdmin, stakingAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          ZModulesZeroVotingERC20DM,
          ZModulesStakingERC20DM,
        ],
      });

      const {
        staking20,
      } = campaign;

      const {
        rewardsPerPeriod,
        periodLength,
        minimumLockTime,
        minimumRewardsMultiplier,
        maximumRewardsMultiplier,
      } = await staking20.getLatestConfig();

      // config
      expect(
        minimumLockTime
      ).to.eq(
        envMinLockTime
      );
      expect(
        minimumRewardsMultiplier
      ).to.eq(
        envMinRewardsMultiplier
      );
      expect(
        maximumRewardsMultiplier
      ).to.eq(
        envMaxRewardsMultiplier
      );
      expect(
        rewardsPerPeriod
      ).to.eq(
        envRewardsPerPeriod
      );
      expect(
        periodLength
      ).to.eq(
        envPeriodLength
      );

      // gas token
      expect(await staking20.stakingToken()).to.eq(hre.ethers.ZeroAddress);

      // staking
      // with lock
      const lockTime = DAY_IN_SECONDS * 112n;
      await staking20.connect(staker).stakeWithLock(
        DEFAULT_STAKED_AMOUNT, lockTime,
        { value: DEFAULT_STAKED_AMOUNT }
      );

      const stakerData = await staking20.connect(staker).stakers(staker.address);
      expect(stakerData.amountStakedLocked).to.eq(DEFAULT_STAKED_AMOUNT);

      await time.increase(lockTime + 1n);
      const initialBalance = await hre.ethers.provider.getBalance(staker.address);
      await staking20.connect(staker).claim();

      const finalBalance = await hre.ethers.provider.getBalance(staker.address);
      expect(finalBalance).to.be.gt(initialBalance);

      // without lock
      await staking20.connect(staker).stakeWithoutLock(
        DEFAULT_STAKED_AMOUNT + 1n,
        { value: DEFAULT_STAKED_AMOUNT + 1n }
      );

      const stakerData2 = await staking20.connect(staker).stakers(staker.address);
      expect(stakerData2.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT + 1n);

      const initialBalance2 = await hre.ethers.provider.getBalance(staker.address);
      await time.increase(lockTime + 1n);
      await staking20.connect(staker).claim();

      const finalBalance2 = await hre.ethers.provider.getBalance(staker.address);
      expect(finalBalance2).to.be.gt(initialBalance2);
    });

    it("Should deploy DAO with ERC20 token using zDC", async () => {
      const votingTokenAddress = stakeToken20.target.toString();
      const timelockAddress = timelockController.target.toString();

      process.env.DAO_VOTING_TOKEN = votingTokenAddress;
      process.env.DAO_TIMELOCK_CONTROLLER = timelockAddress;
      process.env.DAO_VOTING_DELAY = envVotingDelay;
      process.env.DAO_VOTING_PERIOD = envVotingPeriod;
      process.env.DAO_PROPOSAL_THRESHOLD = envProposalThreshold;
      process.env.DAO_QUORUM_PERCENTAGE = envQuorumPercentage;
      process.env.DAO_VOTE_EXTENSION = envVoteExtension;
      process.env.DAO_REVOKE_ADMIN_ROLE = "false";

      config = await getDao20SystemConfig(deployAdmin, timelockAdmin, votingAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          ZModulesZDAODM,
        ],
      });

      const {
        zDao,
      } = campaign;

      expect(await zDao.votingDelay()).to.eq(envVotingDelay);
      expect(await zDao.votingPeriod()).to.eq(envVotingPeriod);
      expect(await zDao.proposalThreshold()).to.eq(envProposalThreshold);

      // tokens
      expect(await zDao.token()).to.eq(votingTokenAddress);
    });

    it("Should deploy DAO with ERC721 token using zDC", async () => {
      const votingTokenAddress = stakeToken721.target.toString();
      const timelockAddress = timelockController.target.toString();

      process.env.DAO_VOTING_TOKEN = votingTokenAddress;
      process.env.DAO_TIMELOCK_CONTROLLER = timelockAddress;
      process.env.DAO_VOTING_DELAY = envVotingDelay;
      process.env.DAO_VOTING_PERIOD = envVotingPeriod;
      process.env.DAO_PROPOSAL_THRESHOLD = envProposalThreshold;
      process.env.DAO_QUORUM_PERCENTAGE = envQuorumPercentage;
      process.env.DAO_VOTE_EXTENSION = envVoteExtension;
      process.env.DAO_REVOKE_ADMIN_ROLE = "false";

      config = await getDao721SystemConfig(deployAdmin, timelockAdmin, votingAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          ZModulesZDAODM,
        ],
      });

      const {
        zDao,
      } = campaign;

      expect(await zDao.votingDelay()).to.eq(envVotingDelay);
      expect(await zDao.votingPeriod()).to.eq(envVotingPeriod);
      expect(await zDao.proposalThreshold()).to.eq(envProposalThreshold);

      // tokens
      expect(await zDao.token()).to.eq(votingTokenAddress);
    });

    it("Should deploy DAO with ERC20 token using zDC and revoke admin role", async () => {
      const votingTokenAddress = stakeToken20.target.toString();
      const timelockAddress = timelockController.target.toString();

      process.env.DAO_VOTING_TOKEN = votingTokenAddress;
      process.env.DAO_TIMELOCK_CONTROLLER = timelockAddress;
      process.env.DAO_VOTING_DELAY = envVotingDelay;
      process.env.DAO_VOTING_PERIOD = envVotingPeriod;
      process.env.DAO_PROPOSAL_THRESHOLD = envProposalThreshold;
      process.env.DAO_QUORUM_PERCENTAGE = envQuorumPercentage;
      process.env.DAO_VOTE_EXTENSION = envVoteExtension;
      process.env.DAO_REVOKE_ADMIN_ROLE = "true";

      config = await getDao20SystemConfig(deployAdmin, timelockAdmin, votingAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          ZModulesZDAODM,
        ],
      });

      const {
        timelockController: campaignTimelockController,
      } = envCampaign;

      const {
        zDao,
      } = campaign;

      expect(
        await campaignTimelockController.hasRole(DEFAULT_ADMIN_ROLE, zDao)
      ).to.eq(false);
    });

    it("Should deploy DAO with ERC721 token using zDC and revoke admin role", async () => {
      const votingTokenAddress = stakeToken721.target.toString();
      const timelockAddress = timelockController.target.toString();

      process.env.DAO_VOTING_TOKEN = votingTokenAddress;
      process.env.DAO_TIMELOCK_CONTROLLER = timelockAddress;
      process.env.DAO_VOTING_DELAY = envVotingDelay;
      process.env.DAO_VOTING_PERIOD = envVotingPeriod;
      process.env.DAO_PROPOSAL_THRESHOLD = envProposalThreshold;
      process.env.DAO_QUORUM_PERCENTAGE = envQuorumPercentage;
      process.env.DAO_VOTE_EXTENSION = envVoteExtension;
      process.env.DAO_REVOKE_ADMIN_ROLE = "true";

      config = await getDao721SystemConfig(deployAdmin, timelockAdmin, votingAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          ZModulesZDAODM,
        ],
      });

      const {
        timelockController: campaignTimelockController,
      } = envCampaign;

      expect(
        await campaignTimelockController.hasRole(DEFAULT_ADMIN_ROLE, staking)
      ).to.eq(false);
    });

    it("Should deploy StakingERC20 with zDC and revoke the admin role", async () => {
      const stakingTokenAddress = stakeToken20.target.toString();
      const rewardsTokenAddress = rewardsToken20.target.toString();
      const contractOwnerAddress = contractOwner.address.toString();

      process.env.STAKING20_STAKING_TOKEN = stakingTokenAddress;
      process.env.STAKING20_REWARDS_TOKEN = rewardsTokenAddress;
      process.env.STAKING20_CONTRACT_OWNER = contractOwnerAddress;
      process.env.STAKING20_REWARDS_PER_PERIOD = envRewardsPerPeriod;
      process.env.STAKING20_PERIOD_LENGTH = envPeriodLength;
      process.env.STAKING20_MIN_LOCK_TIME = envMinLockTime;
      process.env.STAKING20_MIN_REWARDS_MULTIPLIER = envMinRewardsMultiplier;
      process.env.STAKING20_MAX_REWARDS_MULTIPLIER = envMaxRewardsMultiplier;
      process.env.STAKING20_REVOKE_ADMIN_ROLE = "true";

      config = await getStaking20SystemConfig(deployAdmin, votingAdmin, stakingAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          ZModulesZeroVotingERC20DM,
          ZModulesStakingERC20DM,
        ],
      });

      const {
        votingErc20: campaignVoting,
      } = campaign;

      expect(
        await campaignVoting.hasRole(roles.voting.DEFAULT_ADMIN_ROLE, deployAdmin)
      ).to.be.eq(false);
    });

    it("Should deploy StakingERC721 with zDC and revoke the admin role", async () => {
      const stakingTokenAddress = stakeToken721.target.toString();
      const rewardsTokenAddress = rewardsToken20.target.toString();
      const contractOwnerAddress = contractOwner.address.toString();

      process.env.STAKING721_STAKING_TOKEN = stakingTokenAddress;
      process.env.STAKING721_REWARDS_TOKEN = rewardsTokenAddress;
      process.env.STAKING721_CONTRACT_OWNER = contractOwnerAddress;
      process.env.STAKING721_REWARDS_PER_PERIOD = envRewardsPerPeriod;
      process.env.STAKING721_PERIOD_LENGTH = envPeriodLength;
      process.env.STAKING721_MIN_LOCK_TIME = envMinLockTime;
      process.env.STAKING721_MIN_REWARDS_MULTIPLIER = envMinRewardsMultiplier;
      process.env.STAKING721_MAX_REWARDS_MULTIPLIER = envMaxRewardsMultiplier;
      process.env.STAKING721_REVOKE_ADMIN_ROLE = "true";

      config = await getStaking721SystemConfig(deployAdmin, votingAdmin, stakingAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          ZModulesZeroVotingERC721DM,
          ZModulesStakingERC721DM,
        ],
      });

      const {
        votingErc721: campaignVoting,
      } = campaign;

      expect(
        await campaignVoting.hasRole(roles.voting.DEFAULT_ADMIN_ROLE, deployAdmin)
      ).to.be.eq(false);
    });

    it("Should deploy DAO with ERC20 token using zDC and DO NOT revoke the admin role", async () => {
      const votingTokenAddress = stakeToken20.target.toString();
      const timelockAddress = timelockController.target.toString();

      process.env.DAO_VOTING_TOKEN = votingTokenAddress;
      process.env.DAO_TIMELOCK_CONTROLLER = timelockAddress;
      process.env.DAO_VOTING_DELAY = envVotingDelay;
      process.env.DAO_VOTING_PERIOD = envVotingPeriod;
      process.env.DAO_PROPOSAL_THRESHOLD = envProposalThreshold;
      process.env.DAO_QUORUM_PERCENTAGE = envQuorumPercentage;
      process.env.DAO_VOTE_EXTENSION = envVoteExtension;
      process.env.DAO_REVOKE_ADMIN_ROLE = "false";

      config = await getDao20SystemConfig(deployAdmin, timelockAdmin, votingAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          ZModulesZDAODM,
        ],
      });

      const {
        timelockController: campaignTimelockController,
      } = envCampaign;

      expect(
        await campaignTimelockController.hasRole(DEFAULT_ADMIN_ROLE, timelockAdmin)
      ).to.eq(true);
    });

    it("Should deploy DAO with ERC721 token using zDC and DO NOT revoke the admin role", async () => {
      const votingTokenAddress = stakeToken721.target.toString();
      const timelockAddress = timelockController.target.toString();

      process.env.DAO_VOTING_TOKEN = votingTokenAddress;
      process.env.DAO_TIMELOCK_CONTROLLER = timelockAddress;
      process.env.DAO_VOTING_DELAY = envVotingDelay;
      process.env.DAO_VOTING_PERIOD = envVotingPeriod;
      process.env.DAO_PROPOSAL_THRESHOLD = envProposalThreshold;
      process.env.DAO_QUORUM_PERCENTAGE = envQuorumPercentage;
      process.env.DAO_VOTE_EXTENSION = envVoteExtension;
      process.env.DAO_REVOKE_ADMIN_ROLE = "false";

      config = await getDao721SystemConfig(deployAdmin, timelockAdmin, votingAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          ZModulesZDAODM,
        ],
      });

      const {
        timelockController: campaignTimelockController,
      } = envCampaign;

      expect(
        await campaignTimelockController.hasRole(DEFAULT_ADMIN_ROLE, timelockAdmin)
      ).to.eq(true);
    });

    it("Should deploy StakingERC20 with zDC and DO NOT revoke the admin role", async () => {
      const stakingTokenAddress = stakeToken20.target.toString();
      const rewardsTokenAddress = rewardsToken20.target.toString();
      const contractOwnerAddress = contractOwner.address.toString();

      process.env.STAKING20_STAKING_TOKEN = stakingTokenAddress;
      process.env.STAKING20_REWARDS_TOKEN = rewardsTokenAddress;
      process.env.STAKING20_CONTRACT_OWNER = contractOwnerAddress;
      process.env.STAKING20_REWARDS_PER_PERIOD = envRewardsPerPeriod;
      process.env.STAKING20_PERIOD_LENGTH = envPeriodLength;
      process.env.STAKING20_MIN_LOCK_TIME = envMinLockTime;
      process.env.STAKING20_MIN_REWARDS_MULTIPLIER = envMinRewardsMultiplier;
      process.env.STAKING20_MAX_REWARDS_MULTIPLIER = envMaxRewardsMultiplier;
      process.env.STAKING20_REVOKE_ADMIN_ROLE = "false";

      config = await getStaking20SystemConfig(deployAdmin, deployAdmin, deployAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          ZModulesZeroVotingERC20DM,
          ZModulesStakingERC20DM,
        ],
      });

      const {
        votingErc20: campaignVoting,
      } = campaign;

      expect(
        await campaignVoting.hasRole(roles.voting.DEFAULT_ADMIN_ROLE, deployAdmin)
      ).to.be.eq(true);
    });

    it("Should stop deploy StakingERC721 with zDC and DO NOT revoke the admin role", async () => {
      const stakingTokenAddress = stakeToken721.target.toString();
      const rewardsTokenAddress = rewardsToken20.target.toString();
      const contractOwnerAddress = contractOwner.address.toString();

      process.env.STAKING721_STAKING_TOKEN = stakingTokenAddress;
      process.env.STAKING721_REWARDS_TOKEN = rewardsTokenAddress;
      process.env.STAKING721_CONTRACT_OWNER = contractOwnerAddress;
      process.env.STAKING721_REWARDS_PER_PERIOD = envRewardsPerPeriod;
      process.env.STAKING721_PERIOD_LENGTH = envPeriodLength;
      process.env.STAKING721_MIN_LOCK_TIME = envMinLockTime;
      process.env.STAKING721_MIN_REWARDS_MULTIPLIER = envMinRewardsMultiplier;
      process.env.STAKING721_MAX_REWARDS_MULTIPLIER = envMaxRewardsMultiplier;
      process.env.STAKING721_REVOKE_ADMIN_ROLE = "false";

      config = await getStaking721SystemConfig(deployAdmin, deployAdmin, deployAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          ZModulesZeroVotingERC721DM,
          ZModulesStakingERC721DM,
        ],
      });

      const {
        votingErc721: campaignVoting,
      } = campaign;

      expect(
        await campaignVoting.hasRole(roles.voting.DEFAULT_ADMIN_ROLE, deployAdmin)
      ).to.be.eq(true);
    });

    describe("Fails", () => {
      it("Should stop deploy StakingERC20 using zDC and no staking token", async () => {
        const rewardsTokenAddress = rewardsToken20.target.toString();
        const contractOwnerAddress = contractOwner.address.toString();

        process.env.STAKING20_REWARDS_TOKEN = rewardsTokenAddress;
        process.env.STAKING20_CONTRACT_OWNER = contractOwnerAddress;
        process.env.STAKING20_REWARDS_PER_PERIOD = envRewardsPerPeriod;
        process.env.STAKING20_PERIOD_LENGTH = envPeriodLength;
        process.env.STAKING20_MIN_LOCK_TIME = envMinLockTime;
        process.env.STAKING20_MIN_REWARDS_MULTIPLIER = envMinRewardsMultiplier;
        process.env.STAKING20_MAX_REWARDS_MULTIPLIER = envMaxRewardsMultiplier;

        config = await getStaking20SystemConfig(deployAdmin, deployAdmin, deployAdmin);

        await expect(
          runZModulesCampaign({
            config,
            missions: [
              ZModulesZeroVotingERC20DM,
              ZModulesStakingERC20DM,
            ],
          })
        ).to.be.rejectedWith(
          "Must provide Staking and Reward tokens if not mocking"
        );
      });

      it("Should stop deploy StakingERC20 using zDC and no rewards token", async () => {
        const stakingTokenAddress = stakeToken20.target.toString();
        const contractOwnerAddress = contractOwner.address.toString();

        process.env.STAKING20_STAKING_TOKEN = stakingTokenAddress;
        process.env.STAKING20_CONTRACT_OWNER = contractOwnerAddress;
        process.env.STAKING20_REWARDS_PER_PERIOD = envRewardsPerPeriod;
        process.env.STAKING20_PERIOD_LENGTH = envPeriodLength;
        process.env.STAKING20_MIN_LOCK_TIME = envMinLockTime;
        process.env.STAKING20_MIN_REWARDS_MULTIPLIER = envMinRewardsMultiplier;
        process.env.STAKING20_MAX_REWARDS_MULTIPLIER = envMaxRewardsMultiplier;

        config = await getStaking20SystemConfig(deployAdmin, deployAdmin, deployAdmin);

        await expect(
          runZModulesCampaign({
            config,
            missions: [
              ZModulesZeroVotingERC20DM,
              ZModulesStakingERC20DM,
            ],
          })
        ).to.be.rejectedWith(
          "Must provide Staking and Reward tokens if not mocking"
        );
      });

      it("Should stop deploy DAO with ERC20 token using zDC and no timelock controller", async () => {
        const votingTokenAddress = stakeToken20.target.toString();

        process.env.DAO_VOTING_TOKEN = votingTokenAddress;
        process.env.DAO_VOTING_DELAY = envVotingDelay;
        process.env.DAO_VOTING_PERIOD = envVotingPeriod;
        process.env.DAO_PROPOSAL_THRESHOLD = envProposalThreshold;
        process.env.DAO_QUORUM_PERCENTAGE = envQuorumPercentage;
        process.env.DAO_VOTE_EXTENSION = envVoteExtension;
        process.env.DAO_REVOKE_ADMIN_ROLE = "false";

        config = await getDao20SystemConfig(deployAdmin, timelockAdmin, votingAdmin);

        await expect(
          runZModulesCampaign({
            config,
            missions: [
              ZModulesZDAODM,
            ],
          })
        ).to.be.rejectedWith(
          "No timelock controller provided for zDAO!"
        );
      });

      it("Should stop deploy DAO with ERC721 token using zDC and no timelock controller", async () => {
        const votingTokenAddress = stakeToken721.target.toString();

        process.env.DAO_VOTING_TOKEN = votingTokenAddress;
        process.env.DAO_VOTING_DELAY = envVotingDelay;
        process.env.DAO_VOTING_PERIOD = envVotingPeriod;
        process.env.DAO_PROPOSAL_THRESHOLD = envProposalThreshold;
        process.env.DAO_QUORUM_PERCENTAGE = envQuorumPercentage;
        process.env.DAO_VOTE_EXTENSION = envVoteExtension;
        process.env.DAO_REVOKE_ADMIN_ROLE = "false";

        config = await getDao721SystemConfig(deployAdmin, timelockAdmin, votingAdmin);

        await expect(
          runZModulesCampaign({
            config,
            missions: [
              ZModulesZDAODM,
            ],
          })
        ).to.be.rejectedWith(
          "No timelock controller provided for zDAO!"
        );
      });
    });
  });
});
