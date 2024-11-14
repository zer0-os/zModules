import { BaseContract, ContractTransactionResponse } from "ethers";

export type KindType = "transparent" | "uups" | "beacon";
export type ContractV6 = BaseContract & { deploymentTransaction(): ContractTransactionResponse } & Omit<BaseContract, keyof BaseContract>