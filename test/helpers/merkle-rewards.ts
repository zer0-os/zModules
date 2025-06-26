import { StandardMerkleTree } from "@openzeppelin/merkle-tree/dist/standard";

export interface Claims {
  [addr : string] : {
    totalCumulativeRewards : bigint;
    proof : Array<string>;
  };
}

export const getClaimsAndTree = (claimData : Array<[string, bigint]>) => {
  let merkleTree : StandardMerkleTree<[string, bigint]>;
  const claims : Claims = {};

  // eslint-disable-next-line prefer-const
  merkleTree = StandardMerkleTree.of(claimData, ["address", "uint256"]);

  for (const [index, [address, totalCumulativeRewards]] of merkleTree.entries()) {
    claims[address.toLowerCase()] = {
      totalCumulativeRewards,
      proof: merkleTree.getProof(index),
    };
  }

  return {
    merkleTree,
    claims,
  };
};
