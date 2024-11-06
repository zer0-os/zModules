import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  MockERC20,
  MockERC20__factory,
  StakingERC20,
  StakingERC20__factory,
  PolygonZkEVMBridgeV2,
  PolygonZkEVMBridgeV2__factory
} from "../typechain";
import { BRIDGE_ADDRESS, STAKING_ERC20_ADDRESS, TST_ADDRESS } from "./constants";

export const getToken = (signer ?: SignerWithAddress) => {
  const tokenFactory = new MockERC20__factory(signer);
  const token = tokenFactory.attach(TST_ADDRESS) as MockERC20;

  return token;
}

export const getStakingERC20 = (signer ?: SignerWithAddress) => {
  const factory = new StakingERC20__factory(signer);
  const contract = factory.attach(STAKING_ERC20_ADDRESS) as StakingERC20;

  return contract;
};

// TODO export const getStakingERC721

export const getBridge = (signer ?: SignerWithAddress) => {
  const factory = new PolygonZkEVMBridgeV2__factory(signer);
  const bridge = factory.attach(BRIDGE_ADDRESS) as PolygonZkEVMBridgeV2;

  return bridge;
};