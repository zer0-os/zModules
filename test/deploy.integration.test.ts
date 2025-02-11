import * as hre from "hardhat";
import { contractNames, runZModulesCampaign } from "../src/deploy";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ZModulesZeroVotingERC20DM } from "../src/deploy/missions/voting-erc20/voting20.mission";
import { getStakingERC20Mission } from "../src/deploy/missions/staking-erc20/staking20.mission";
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
import { getVotingERC721Mission, ZModulesZeroVotingERC721DM } from "../src/deploy/missions/voting-erc721/voting721.mission";
import { getStakingERC721Mission } from "../src/deploy/missions/staking-erc721/staking721.mission";
import {
  MockERC20,
  MockERC721,
  StakingERC20,
  StakingERC721,
  ZeroVotingERC20,
  ZeroVotingERC721,
} from "../typechain";
import { getDAOMission } from "../src/deploy/missions/dao/zdao.mission";
import { daoConfig } from "../src/environment/configs/dao.configenv";
import { ZModulesTimelockControllerDM } from "../src/deploy/missions/dao/timelock.mission";
import { roles } from "../src/deploy/constants";
import { getStaking20SystemConfig, getStaking721SystemConfig } from "../src/deploy/campaign/staking-system-config";
import { staking20Config, staking721Config } from "../src/environment/configs/staking.configenv";
import { IStaking20Environment, IStaking721Environment } from "../src/environment/types";
import { getDaoSystemConfig } from "../src/deploy/campaign/dao-system-config";


describe.only("zModules Deploy Integration Test", () => {
  let deployAdmin : SignerWithAddress;
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
  } = roles.timelock;


  before(async () => {
    [ deployAdmin ] = await hre.ethers.getSigners();
  });

  describe("Staking", () => {
    it("Should deploy StakingERC20 with zDC and default config", async () => {
      config = await getStaking20SystemConfig(deployAdmin);

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
          getStakingERC20Mission(),
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
      expect(await staking.getStakingToken()).to.eq(stakeToken.target);
      expect(await staking.getRewardsToken()).to.eq(rewardsToken.target);
      expect(await staking.getStakeRepToken()).to.eq(stakeRepToken.target);

      // config
      stakingConfig = staking20Config;
      expect(
        await staking.getMinimumLockTime()
      ).to.eq(
        stakingConfig.STAKING20_MIN_LOCK_TIME
      );
      expect(
        await staking.getMinimumRewardsMultiplier()
      ).to.eq(
        stakingConfig.STAKING20_MIN_REWARDS_MULTIPLIER
      );
      expect(
        await staking.getMaximumRewardsMultiplier()
      ).to.eq(
        stakingConfig.STAKING20_MAX_REWARDS_MULTIPLIER
      );
      expect(
        await staking.getRewardsPerPeriod()
      ).to.eq(
        stakingConfig.STAKING20_REWARDS_PER_PERIOD
      );
    });

    it("StakingERC20 should have MINTER_ROLE and BURNER_ROLE of StakeRepToken", async () => {
      expect(
        await stakeRepToken.hasRole(await stakeRepToken.MINTER_ROLE(), staking.target)
      ).to.eq(
        true
      );
      expect(
        await stakeRepToken.hasRole(await stakeRepToken.BURNER_ROLE(), staking.target)
      ).to.eq(
        true
      );
    });

    it("Should deploy StakingERC721 with zDC and default config", async () => {
      config = await getStaking721SystemConfig(deployAdmin);

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
          getStakingERC721Mission(),
        ],
      });

      ({
        staking721: staking,
        votingErc721: stakeRepToken,
        mockErc721STK: stakeToken,
        mockErc20REW: rewardsToken,
      } = campaign);

      // tokens
      expect(await staking.getStakingToken()).to.eq(stakeToken.target);
      expect(await staking.getRewardsToken()).to.eq(rewardsToken.target);
      expect(await staking.getStakeRepToken()).to.eq(stakeRepToken.target);

      // config
      stakingConfig = staking721Config;

      expect(
        await staking.getMinimumLockTime()
      ).to.eq(
        stakingConfig.STAKING721_MIN_LOCK_TIME
      );
      expect(
        await staking.getMinimumRewardsMultiplier()
      ).to.eq(
        stakingConfig.STAKING721_MIN_REWARDS_MULTIPLIER
      );
      expect(
        await staking.getMaximumRewardsMultiplier()
      ).to.eq(
        stakingConfig.STAKING721_MAX_REWARDS_MULTIPLIER
      );
      expect(
        await staking.getRewardsPerPeriod()
      ).to.eq(
        stakingConfig.STAKING721_REWARDS_PER_PERIOD
      );
    });

    it("StakingERC721 should have MINTER_ROLE and BURNER_ROLE of StakeRepToken", async () => {
      expect(
        await stakeRepToken.hasRole(await stakeRepToken.MINTER_ROLE(), staking.target)
      ).to.eq(
        true
      );
      expect(
        await stakeRepToken.hasRole(await stakeRepToken.BURNER_ROLE(), staking.target)
      ).to.eq(
        true
      );
    });

    // TODO dep: add test and logic for staking deploy with gas token !!!
  });

  describe("DAO", () => {
    it("Should deploy DAO with ERC20 token zDC and default config", async () => {

      config = await getDaoSystemConfig(deployAdmin, contractNames.votingERC20.instance);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          ZModulesZeroVotingERC20DM,
          ZModulesTimelockControllerDM,
          getDAOMission(),
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

    it("DAO should have PROPOSER_ROLE and EXECUTOR_ROLE of Timelock", async () => {
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

    let envCampaign : DeployCampaign<
    HardhatRuntimeEnvironment,
    SignerWithAddress,
    IZModulesConfig,
    IZModulesContracts>;

    // env vars
    const rewardsPerPeriod = "30";
    const periodLength = (86400n * 365n * 2n).toString();  // 2 years in seconds
    const minLockTime = (86400n * 30n * 2n).toString();   // 2 months in seconds
    const minRewardsMultiplier = "10";
    const maxRewardsMultiplier = "100";

    before(async () => {
      await dbAdapter.dropDB();

      [ contractOwner ] = await hre.ethers.getSigners();

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
        ],
      });

      ({
        mockErc20STK: stakeToken20,
        mockErc20REW: rewardsToken20,
        mockErc721STK: stakeToken721,
      } = envCampaign.state.contracts);
    });

    it("Should deploy StakingERC20 with zDC", async () => {
      // set env vars
      const stakingTokenAddress = stakeToken20.target.toString();
      const rewardsTokenAddress = rewardsToken20.target.toString();
      const contractOwnerAddress = contractOwner.address.toString();

      process.env.STAKING20_STAKING_TOKEN = stakingTokenAddress;
      process.env.STAKING20_REWARDS_TOKEN = rewardsTokenAddress;
      process.env.STAKING20_CONTRACT_OWNER = contractOwnerAddress;
      process.env.STAKING20_REWARDS_PER_PERIOD = rewardsPerPeriod;
      process.env.STAKING20_PERIOD_LENGTH = periodLength;
      process.env.STAKING20_MIN_LOCK_TIME = minLockTime;
      process.env.STAKING20_MIN_REWARDS_MULTIPLIER = minRewardsMultiplier;
      process.env.STAKING20_MAX_REWARDS_MULTIPLIER = maxRewardsMultiplier;

      config = await getStaking20SystemConfig(deployAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          ZModulesZeroVotingERC20DM,
          getStakingERC20Mission(),
        ],
      });

      ({
        staking20: staking,
      } = campaign);

      // tokens
      expect(await staking.getStakingToken()).to.eq(stakeToken20.target);
      expect(await staking.getRewardsToken()).to.eq(rewardsToken20.target);
      expect(await staking.getStakeRepToken()).to.eq(campaign.state.contracts.votingErc20.target);

      // config
      expect(
        await staking.getMinimumLockTime()
      ).to.eq(
        minLockTime
      );
      expect(
        await staking.getMinimumRewardsMultiplier()
      ).to.eq(
        minRewardsMultiplier
      );
      expect(
        await staking.getMaximumRewardsMultiplier()
      ).to.eq(
        maxRewardsMultiplier
      );
      expect(
        await staking.getRewardsPerPeriod()
      ).to.eq(
        rewardsPerPeriod
      );
    });

    it("Should deploy StakingERC721 with zDC", async () => {
      const stakingTokenAddress = stakeToken721.target.toString();
      const rewardsTokenAddress = rewardsToken20.target.toString();
      const contractOwnerAddress = contractOwner.address.toString();

      process.env.STAKING721_STAKING_TOKEN = stakingTokenAddress;
      process.env.STAKING721_REWARDS_TOKEN = rewardsTokenAddress;
      process.env.STAKING721_CONTRACT_OWNER = contractOwnerAddress;
      process.env.STAKING721_REWARDS_PER_PERIOD = rewardsPerPeriod;
      process.env.STAKING721_PERIOD_LENGTH = periodLength;
      process.env.STAKING721_MIN_LOCK_TIME = minLockTime;
      process.env.STAKING721_MIN_REWARDS_MULTIPLIER = minRewardsMultiplier;
      process.env.STAKING721_MAX_REWARDS_MULTIPLIER = maxRewardsMultiplier;

      config = await getStaking721SystemConfig(deployAdmin);

      campaign = await runZModulesCampaign({
        config,
        missions: [
          ZModulesZeroVotingERC721DM,
          getStakingERC721Mission(),
        ],
      });

      ({
        staking721: staking,
      } = campaign);

      // tokens
      expect(await staking.getStakingToken()).to.eq(stakeToken721.target);
      expect(await staking.getRewardsToken()).to.eq(rewardsToken20.target);
      expect(await staking.getStakeRepToken()).to.eq(campaign.state.contracts.votingErc721.target);

      // config
      expect(
        await staking.getMinimumLockTime()
      ).to.eq(
        minLockTime
      );
      expect(
        await staking.getMinimumRewardsMultiplier()
      ).to.eq(
        minRewardsMultiplier
      );
      expect(
        await staking.getMaximumRewardsMultiplier()
      ).to.eq(
        maxRewardsMultiplier
      );
      expect(
        await staking.getRewardsPerPeriod()
      ).to.eq(
        rewardsPerPeriod
      );
    });
  });
});
