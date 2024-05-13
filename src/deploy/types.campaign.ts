import { IContractState } from "@zero-tech/zdc";
import { StakingERC20, StakingERC721 } from "../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// export interface Config {
//   contracts : Array<{
//     name : string;
//     amount : number;
//   }>;
//   env : string;
//   deployAdmin : SignerWithAddress;
//   postDeploy : {
//     tenderlyProjectSlug : string;
//     monitorContracts : boolean;
//     verifyContracts : boolean;
//   };
// }

export type ZModulesContract =
  StakingERC20 |
  StakingERC721;

export interface IZModulesContracts extends IContractState<ZModulesContract> {
  stakingERC20: StakingERC20;
  stakingERC721: StakingERC721;
}

