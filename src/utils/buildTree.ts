import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import * as fs from "fs";
import * as hre from "hardhat";

const main = async () => {

  const [userA, userB, userC] = await hre.ethers.getSigners();

  const values = [
    [userA.address, 115, 30],
    [userB.address, 200, 12],
    [userC.address, 300, 77],
  ]

  const tree = StandardMerkleTree.of(values, ["address", "uint256", "uint256"]);
  if (!fs.existsSync("output")) {
    fs.mkdirSync("output", { recursive: true });
  }
  fs.writeFileSync("output/tree.json", JSON.stringify(tree.dump(), undefined, 2));
};

main().catch(console.error);