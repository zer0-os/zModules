import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  MockERC20__factory,
  StakingERC20,
  StakingERC20__factory,
  // PolygonZkEVMBridgeV2,
  // PolygonZkEVMBridgeV2__factory,
  // MockERC20Upgradeable__factory,
  MockERC721__factory,
  MockERC20Upgradeable__factory,
} from "../../../typechain";
import { Contract, ContractFactory } from "ethers";
import { BRIDGE_ADDRESS, SEP_TNFT_ADDRESS, SEP_TST_ADDRESS, SEP_UPGR_TST_ADDRESS, ZCHAIN_STAKING_ERC20_ADDRESS, ZCHAIN_TNFT_ADDRESS, ZCHAIN_TST_ADDRESS, ZCHAIN_UPGR_TST_ADDRESS } from "./constants";
import { ContractV6, KindType } from "./types"

export const getERC20 = async (signer ?: SignerWithAddress) => {
  const address = hre.network.name === "sepolia" ? SEP_TST_ADDRESS : ZCHAIN_TST_ADDRESS;

  return await getContract(
    new MockERC20__factory(signer),
    ["TestToken", "TST"],
    address
  );
}

export const getERC20Upgradeable = async (signer ?: SignerWithAddress) => {
  const address = hre.network.name === "sepolia" ? SEP_UPGR_TST_ADDRESS : ZCHAIN_UPGR_TST_ADDRESS;

  return await getContract(
    new MockERC20Upgradeable__factory(signer),
    ["TestToken", "TST"],
    address,
    true
  );
}

export const getERC721Token = async (signer ?: SignerWithAddress) => {
  const address = hre.network.name === "sepolia" ? SEP_TNFT_ADDRESS : ZCHAIN_TNFT_ADDRESS;

  return await getContract(
    new MockERC721__factory(signer),
    ["TestNFT", "TNFT", "0://tnft/"],
    address
  );
}

// TODO getERC721Upgradeable

export const getStakingERC20 = (signer ?: SignerWithAddress) => {
  const factory = new StakingERC20__factory(signer);
  const contract = factory.attach(ZCHAIN_STAKING_ERC20_ADDRESS) as StakingERC20;

  return contract;
};

// TODO export const getStakingERC721
// and for other zmodules contracts yet to be deployed

// export const getBridge = (signer ?: SignerWithAddress) => {
//   const factory = new PolygonZkEVMBridgeV2__factory(signer);
//   const bridge = factory.attach(BRIDGE_ADDRESS) as PolygonZkEVMBridgeV2;

//   return bridge;
// };

const getContract = async <T extends ContractFactory, V extends Contract>(
  factory : T,
  args ?: any[],
  address ?: string,
  upgradeable : boolean = false
) => {
  let contract : Contract;

  if (hre.network.name == "hardhat") {
    if (!args) throw Error("Arguments are required for hardhat network");

    let tx : Contract | ContractV6;
    if (upgradeable) {
      tx = await hre.upgrades.deployProxy(factory, args);
    } else {
      tx = await factory.deploy(...args);
    }

    contract = await tx.waitForDeployment() as V;
  } else {
    if (!address) throw Error("Address is required for non-hardhat network");
    contract = factory.attach(address) as V;
  }

  return contract;
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