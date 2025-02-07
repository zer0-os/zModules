import * as hre from "hardhat";
import { getVoting20DeployConfig } from "../src/deploy/missions/voting-erc20/voting20.config";
import { runZModulesCampaign } from "../src/deploy";
import { getBaseZModulesConfig } from "../src/deploy/campaign/get-campaign-config";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getVotingERC20Mission } from "../src/deploy/missions/voting-erc20/voting20.mission";
import { getStakingERC20Mission } from "../src/deploy/missions/staking-erc20/staking20.mission";
import { getStaking20DeployConfig } from "../src/deploy/missions/staking-erc20/staking20.config";
import {
  IDAOConfig,
  IStakingERC20Config,
  IStakingERC721Config,
  ITimelockConfig,
  IVotingERC20Config,
  IVotingERC721Config,
  IZModulesConfig,
  IZModulesContracts,
} from "../src/deploy/campaign/types";
import {
  getMockERC20Mission,
  TokenTypes,
} from "../src/deploy/missions/mocks/mockERC20.mission";
import { getVoting721DeployConfig } from "../src/deploy/missions/voting-erc721/voting721.config";
import { expect } from "chai";
import {
  DeployCampaign,
  IDeployCampaignConfig,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getStaking721DeployConfig } from "../src/deploy/missions/staking-erc721/staking721.config";
import { getMockERC721Mission } from "../src/deploy/missions/mocks/mockERC721.mission";
import { getVotingERC721Mission } from "../src/deploy/missions/voting-erc721/voting721.mission";
import { getStakingERC721Mission } from "../src/deploy/missions/staking-erc721/staking721.mission";
import {
  MockERC20,
  MockERC721,
  StakingERC20,
  StakingERC721,
  ZDAO,
  ZeroVotingERC20,
  ZeroVotingERC721,
} from "../typechain";
import { getDAOConfig } from "../src/deploy/missions/dao/zdao.config";
import { getTimeLockControllerConfig } from "../src/deploy/missions/dao/timelock.config";
import { getTimelockControllerMission } from "../src/deploy/missions/dao/timelock.mission";
import { getDAOMission } from "../src/deploy/missions/dao/zdao.mission";
import { daoConfig } from "../src/environment/configs/dao.configenv";


describe.only("zModules Deploy Integration Test", () => {
  let deployAdmin : SignerWithAddress;
  let votingTokenAdmin : SignerWithAddress;
  let stakingContractOwner : SignerWithAddress;

  let baseConfig : IDeployCampaignConfig<SignerWithAddress>;
  let votingConfig : IVotingERC20Config | IVotingERC721Config;
  let stakingConfig : IStakingERC20Config | IStakingERC721Config;
  let daoCnfg : IDAOConfig;
  let timelockConfig : ITimelockConfig;
  let config : IZModulesConfig;

  let staking : StakingERC20 | StakingERC721;

  let stakeToken : MockERC20 | MockERC721;
  let rewardsToken : MockERC20 | MockERC721;

  let stakeRepToken : ZeroVotingERC20 | ZeroVotingERC721;

  const votingInstanceName = "zeroVotingERC20";

  let campaign : DeployCampaign<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZModulesConfig,
  IZModulesContracts>;


  before(async () => {
    [ deployAdmin, votingTokenAdmin, stakingContractOwner ] = await hre.ethers.getSigners();

    baseConfig = await getBaseZModulesConfig({
      deployAdmin,
    });
    votingConfig = getVoting20DeployConfig({
      tokenAdmin: votingTokenAdmin,
    });
  });

  describe("Staking", () => {
    it("Should deploy VotingERC20 with zDC and default config", async () => {
      config = {
        ...baseConfig,
        votingERC20Config: votingConfig,
      };

      campaign = await runZModulesCampaign({
        config,
        missions: [
          getVotingERC20Mission(),
        ],
      });

      ({ votingErc20: stakeRepToken } = campaign);

      expect(await stakeRepToken.name()).to.eq(votingConfig.name);
      expect(await stakeRepToken.symbol()).to.eq(votingConfig.symbol);
    });

    it("Should deploy StakingERC20 with zDC and default config", async () => {
      stakingConfig = getStaking20DeployConfig({
        contractOwner: stakingContractOwner,
      }) as IStakingERC20Config;

      config = {
        ...baseConfig,
        votingERC20Config: votingConfig,
        stakingERC20Config: stakingConfig,
      };

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
          getVotingERC20Mission(),
          getStakingERC20Mission(),
        ],
      });

      ({
        staking20: staking,
        votingErc20: stakeRepToken,
        mockErc20STK: stakeToken,
        mockErc20REW: rewardsToken,
      } = campaign);

      // tokens
      expect(await staking.getStakingToken()).to.eq(stakeToken.target);
      expect(await staking.getRewardsToken()).to.eq(rewardsToken.target);
      expect(await staking.getStakeRepToken()).to.eq(stakeRepToken.target);

      // config
      expect(
        await staking.getMinimumLockTime()
      ).to.eq(
        stakingConfig.minimumLockTime
      );
      expect(
        await staking.getMinimumRewardsMultiplier()
      ).to.eq(
        stakingConfig.minimumRewardsMultiplier
      );
      expect(
        await staking.getMaximumRewardsMultiplier()
      ).to.eq(
        stakingConfig.maximumRewardsMultiplier
      );
      expect(
        await staking.getRewardsPerPeriod()
      ).to.eq(
        stakingConfig.rewardsPerPeriod
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
      baseConfig = await getBaseZModulesConfig({
        deployAdmin,
      });

      votingConfig = getVoting721DeployConfig({
        tokenAdmin: votingTokenAdmin,
      });

      stakingConfig = getStaking721DeployConfig({
        contractOwner: stakingContractOwner,
      }) as IStakingERC721Config;

      config = {
        ...baseConfig,
        votingERC721Config: votingConfig as IVotingERC721Config,
        stakingERC721Config: stakingConfig as IStakingERC721Config,
      };

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
          getVotingERC721Mission(),
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
      expect(
        await staking.getMinimumLockTime()
      ).to.eq(
        stakingConfig?.minimumLockTime
      );
      expect(
        await staking.getMinimumRewardsMultiplier()
      ).to.eq(
        stakingConfig?.minimumRewardsMultiplier
      );
      expect(
        await staking.getMaximumRewardsMultiplier()
      ).to.eq(
        stakingConfig?.maximumRewardsMultiplier
      );
      expect(
        await staking.getRewardsPerPeriod()
      ).to.eq(
        stakingConfig?.rewardsPerPeriod
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
    it("Should deploy DAO with zDC and default config", async () => {
      daoCnfg = getDAOConfig();
      timelockConfig = getTimeLockControllerConfig({
        timeLockAdmin: deployAdmin,
        votingTokenInstName: votingInstanceName,
      });

      config = {
        ...baseConfig,
        votingERC20Config: votingConfig,
        timelockConfig,
        daoConfig: daoCnfg,
      };

      campaign = await runZModulesCampaign({
        config,
        missions: [
          getVotingERC20Mission("mockVotingToken"),
          getTimelockControllerMission(),
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
          await timelockController.PROPOSER_ROLE(),
          zDao.target
        )
      ).to.eq(
        true
      );

      expect(
        await timelockController.hasRole(
          await timelockController.EXECUTOR_ROLE(),
          zDao.target
        )
      ).to.eq(
        true
      );
    });
  });

  describe("Deploy using ENV vars", () => {});
});
