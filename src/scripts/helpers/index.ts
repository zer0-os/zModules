import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  MockERC20,
  MockERC20__factory,
  StakingERC20,
  StakingERC20__factory,
  MockERC20Upgradeable,
  // PolygonZkEVMBridgeV2,
  // PolygonZkEVMBridgeV2__factory,
  // MockERC20Upgradeable__factory,
  // MockERC20Upgradeable,
  MockERC721__factory,
  MockERC721,
  MockERC20Upgradeable__factory,
} from "../../../typechain";
import { ContractFactory } from "ethers";
import { BRIDGE_ADDRESS, SEP_TNFT_ADDRESS, SEP_UPGR_TST_ADDRESS, STAKING_ERC20_ADDRESS, ZCHAIN_TST_ADDRESS, ZCHAIN_UPGR_TST_ADDRESS } from "./constants";
import { KindType } from "./types"

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
  let token : MockERC20Upgradeable;

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

export const getContract = async <T extends ContractFactory>(
  factory: T,
  address: string
) => {
  // TODO seems useless to have a one line function like this...
  return factory.attach(address);
}

export const deployContract = async <T extends ContractFactory >(
  factory: T,
  args: any[]
) => {
  const contract = await factory.deploy(...args);

  await contract.waitForDeployment();

  console.log(`Contract successfully deployed at address: ${await contract.getAddress()}`);

  return contract;
};


export const deployUpgradeableContract = async <T extends ContractFactory>(
  factory: T,
  args: any[],
  _initializer: string = "initialize",
  _kind: KindType = "transparent"
) => {
  const tx = await hre.upgrades.deployProxy(factory, ...args, {
    initializer: _initializer,
    kind: _kind,
  });

  const contract = await tx.waitForDeployment();

  console.log(`Contract successfully deployed at address: ${await contract.getAddress()}`);
}