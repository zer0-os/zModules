import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import * as fs from "fs";

const createMerkleTree = async () => {
  let data;

  // `merkle_data.json` is the output of the `getStakerData` script in the `token-subgraphs` repo
  if (fs.existsSync("output/merkle_data.json")) {
    data = JSON.parse(fs.readFileSync("output/merkle_data.json", "utf-8"));
  } else {
    // Temporarily stub data in place of file read
    data = [
      ["0x123", 100n, 100n],
    ];
  }

  const merkleTree = StandardMerkleTree.of(data, ["address", "uint256", "uint256"]);
  console.log("Merkle root: ", merkleTree.root);
};

createMerkleTree().then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });