import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  MockERC20,
  MockERC20__factory,
  StakingERC20,
  StakingERC20__factory,
  PolygonZkEVMBridgeV2,
  PolygonZkEVMBridgeV2__factory,
  MockERC20Upgradeable__factory,
  MockERC20Upgradeable,
  MockERC721__factory,
  MockERC721,
} from "../typechain";
import { BRIDGE_ADDRESS, SEP_TNFT_ADDRESS, SEP_UPGR_TST_ADDRESS, STAKING_ERC20_ADDRESS, ZCHAIN_TST_ADDRESS, ZCHAIN_UPGR_TST_ADDRESS } from "./constants";

export const getToken = (signer ?: SignerWithAddress) => {
  const tokenFactory = new MockERC20__factory(signer);
  const token = tokenFactory.attach(ZCHAIN_TST_ADDRESS) as MockERC20;

  return token;
}

export const getERC721Token = (signer ?: SignerWithAddress) => {
  const tokenFactory = new MockERC721__factory(signer);
  const token = tokenFactory.attach(SEP_TNFT_ADDRESS) as MockERC721;

  return token;
}

export const getUpgradeableToken = async (signer ?: SignerWithAddress) => {
  let token : MockERC20;

  if (hre.network.name == "hardhat") {
    const tx = await hre.upgrades.deployProxy(
      new MockERC20__factory(signer),
      ["TestToken", "TST"]
    );

    token = await tx.waitForDeployment() as unknown as MockERC20Upgradeable;
  } else {
    const address = hre.network.name === "sepolia" ? SEP_UPGR_TST_ADDRESS : ZCHAIN_UPGR_TST_ADDRESS;
    const tokenFactory = new MockERC20Upgradeable__factory(signer);

    token = tokenFactory.attach(address) as MockERC20Upgradeable;
  }

  return token;
}

export const getStakingERC20 = (signer ?: SignerWithAddress) => {
  const factory = new StakingERC20__factory(signer);
  const contract = factory.attach(STAKING_ERC20_ADDRESS) as StakingERC20;

  return contract;
};

// TODO export const getStakingERC721
// and for other zmodules contracts yet to be deployed

export const getBridge = (signer ?: SignerWithAddress) => {
  const factory = new PolygonZkEVMBridgeV2__factory(signer);
  const bridge = factory.attach(BRIDGE_ADDRESS) as PolygonZkEVMBridgeV2;

  return bridge;
};