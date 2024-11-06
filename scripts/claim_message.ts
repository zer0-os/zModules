import * as hre from "hardhat";

import abi from "./bridge_abi.json";

import * as axios from "axios";
import { PolygonZkEVMBridgeV2, PolygonZkEVMBridgeV2__factory } from "../typechain";
import { BRIDGE_ADDRESS } from "./constants";

async function main() {
  const [userA, userD] = await hre.ethers.getSigners();

  const api = axios.default.create({
    baseURL: process.env.BRIDGE_API_URL,
  });

  // Sent from sep bridge to zchain bridge
  const result = await api.get(
    "/bridges/" + BRIDGE_ADDRESS,
    { 
      params: { 
        limit: 100, 
        offset: 0 
      }
    }
  );

  const latestDeposit = result.data.deposits[result.data.deposits.length - 1];

  // if ready_to_claim

  const res = await api.get(
    "/merkle-proof",
    {
      params: {
        deposit_cnt: latestDeposit.deposit_cnt,
        net_id: latestDeposit.orig_net,
      },
    }
  );

  const proof = res.data.proof;
  const mainExitRoot = res.data.main_exit_root;
  const rollupExitRoot = res.data.rollup_exit_root;

  // Get bridge on zchain
  const factory = new hre.ethers.ContractFactory(abi.abi, abi.bytecode) as PolygonZkEVMBridgeV2__factory;
  const bridge = await factory.attach(BRIDGE_ADDRESS) as PolygonZkEVMBridgeV2;

  try {
    const tx = await bridge.connect(userA).claimMessage(
      proof.merkle_proof,
      proof.rollup_merkle_proof,
      latestDeposit.global_index,
      proof.main_exit_root,
      proof.rollup_exit_root,
      latestDeposit.orig_net,
      latestDeposit.orig_addr,
      latestDeposit.dest_net,
      latestDeposit.dest_addr,
      latestDeposit.amount,
      latestDeposit.metadata,
      {
        gasLimit: 5000000
      }
    )
  } catch(e) {
    console.log(e);
  }
  

  // const receipt = await tx.wait(3);

  // console.log(receipt);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});