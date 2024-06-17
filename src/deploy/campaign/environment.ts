import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IERC20DeployArgs } from "../types.campaign";


export const getConfig = async (
  env : string,
  deployAdmin : SignerWithAddress,
  postDeploy : {
    tenderlyProjectSlug : string;
    monitorContracts : boolean;
    verifyContracts : boolean;
  },
  owner : SignerWithAddress,
  stakingERC20Config : IERC20DeployArgs,
) =>  {

  let deployAdminAddress;
  if (deployAdmin && Object.keys(deployAdmin).includes("address")) {
    deployAdminAddress = deployAdmin.address;
  } else if (deployAdmin) {
    deployAdminAddress = await deployAdmin.getAddress();
  } else {
    throw new Error("Must provide deployAdmin");
  }


  let ownerAddress;
  if (owner && Object.keys(owner).includes("address")) {
    ownerAddress = owner.address;
  } else if (owner) {
    ownerAddress = await owner.getAddress();
  } else {
    throw new Error("Must provide owner");
  }

  if (env === undefined) {
    throw new Error("Must provide ENV_LEVEL");
  }

  return {
    env,
    deployAdminAddress,
    postDeploy,
    ownerAddress,
    stakingERC20Config,
  };
};