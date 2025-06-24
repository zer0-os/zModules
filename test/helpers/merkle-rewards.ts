import { StandardMerkleTree } from "@openzeppelin/merkle-tree/dist/standard";


export const getClaimsAndTree = (claimData : Array<[string, bigint]>) => {
  let merkleTree : StandardMerkleTree<any>;
  const claims : {
    [addr : string] : {
      amount : bigint;
      proof : Array<string>;
    };
  } = {};

  // eslint-disable-next-line prefer-const
  merkleTree = StandardMerkleTree.of(claimData, ["address", "uint256"]);

  for (const [index, [address, amount]] of merkleTree.entries()) {
    claims[address.toLowerCase()] = {
      amount: BigInt(amount),
      proof: merkleTree.getProof(index),
    };
  }

  return {
    merkleTree,
    claims,
  };
};
