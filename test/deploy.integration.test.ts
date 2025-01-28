import * as hre from "hardhat";
import { getVoting20DeployConfig } from "../src/deploy/missions/voting-erc20/voting20.config";
import { runZModulesCampaign } from "../src/deploy";
import { getBaseZModulesConfig } from "../src/deploy/campaign/get-campaign-config";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getVotingERC20Mission } from "../src/deploy/missions/voting-erc20/voting20.mission";
import { getStakingERC20Mission } from "../src/deploy/missions/staking-erc20/staking20.mission";
import { getStaking20DeployConfig } from "../src/deploy/missions/staking-erc20/staking20.config";
import {
  IStakingERC20DeployArgs,
  IStakingERC721DeployArgs,
  IVotingERC20DeployArgs,
  IVotingERC721DeployArgs,
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
  Addressable,
  Signer,
} from "ethers";
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
  MockERC20, MockERC721,
  StakingERC20,
  StakingERC20__factory,
  StakingERC721,
  StakingERC721__factory,
  ZeroVotingERC20,
  ZeroVotingERC20__factory,
  ZeroVotingERC721,
  ZeroVotingERC721__factory,
} from "../typechain";


describe("zModules Deploy Integration Test", () => {
  let deployAdmin : SignerWithAddress;
  let votingTokenAdmin : SignerWithAddress;
  let stakingContractOwner : SignerWithAddress;

  let baseConfig : IDeployCampaignConfig<Signer>;
  let votingConfig : IVotingERC20DeployArgs | IVotingERC721DeployArgs;
  let stakingConfig : IStakingERC20DeployArgs | IStakingERC721DeployArgs;
  let config : IZModulesConfig;

  let staking : StakingERC20 | StakingERC721;

  let stakeToken : MockERC20 | MockERC721;
  let rewardsToken : MockERC20 | MockERC721;

  let stakeRepToken : ZeroVotingERC20 | ZeroVotingERC721;

  let campaign : DeployCampaign<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZModulesConfig,
  IZModulesContracts
  >;


  before(async () => {
    [ deployAdmin, votingTokenAdmin, stakingContractOwner ] = await hre.ethers.getSigners();
  });

  describe.only("Staking", () => {
    it("Should deploy StakingERC20 with zDC and default config", async () => {
      baseConfig = await getBaseZModulesConfig({
        deployAdmin,
      });

      votingConfig = getVoting20DeployConfig({
        tokenAdmin: votingTokenAdmin,
      });

      stakingConfig = getStaking20DeployConfig({
        contractOwner: stakingContractOwner,
      }) as IStakingERC20DeployArgs;

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
      }) as IStakingERC721DeployArgs;

      config = {
        ...baseConfig,
        votingERC721Config: votingConfig as IVotingERC721DeployArgs,
        stakingERC721Config: stakingConfig as IStakingERC721DeployArgs,
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
});
