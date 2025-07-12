import { IRewardsVaultConfig } from "../../campaign/types";


export const getRewardsVaultConfig = () : IRewardsVaultConfig => {
  if (
    !process.env.REWARDS_VAULT_TOKEN ||
    !process.env.REWARDS_VAULT_OWNER
  )
    throw new Error("Missing required env variables for Rewards Vault!");

  const operators = process.env.REWARDS_VAULT_OPERATORS
    ? process.env.REWARDS_VAULT_OPERATORS.split(",").map(addr => addr.trim()).filter(Boolean)
    : [];

  return {
    owner: process.env.REWARDS_VAULT_OWNER || "",
    token: process.env.REWARDS_VAULT_TOKEN,
    operators,
  };
};
