import { StandardMerkleTree } from "@openzeppelin/merkle-tree/dist/standard";


export const getClaimsAndTree = (claimData : Array<[string, bigint]>) => {
  let merkleTree : StandardMerkleTree<any>;
  const claims : {
    [addr : string] : {
      totalCumulativeRewards : bigint;
      proof : Array<string>;
    };
  } = {};

  // eslint-disable-next-line prefer-const
  merkleTree = StandardMerkleTree.of(claimData, ["address", "uint256"]);

  for (const [index, [address, totalCumulativeRewards]] of merkleTree.entries()) {
    claims[address.toLowerCase()] = {
      totalCumulativeRewards: BigInt(totalCumulativeRewards),
      proof: merkleTree.getProof(index),
    };
  }

  return {
    merkleTree,
    claims,
  };
};
