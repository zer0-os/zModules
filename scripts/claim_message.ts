import * as hre from "hardhat";

import abi from "./bridge_abi.json";

import * as axios from "axios";
import { PolygonZkEVMBridgeV2, PolygonZkEVMBridgeV2__factory } from "../typechain";
import { BRIDGE_ADDRESS } from "./helpers/constants";
import { getBridge } from "./helpers";

async function main() {
  const [userA, userD] = await hre.ethers.getSigners();

  const api = axios.default.create({
    baseURL: process.env.BRIDGE_API_URL,
  });

  const result = await api.get(
    "/bridge",
    {
      params: {
        deposit_cnt: 1,
        net_id: 1
      }
    }
  );

  // console.log(result.data)

  const deposit = result.data.deposit

  if (!deposit.ready_for_claim) process.exit(1);

  const res = await api.get(
    "/merkle-proof",
    {
      params: {
        deposit_cnt: deposit.deposit_cnt,
        net_id: deposit.network_id, // sep id? zchain id? other?
      },
    }
  );

  console.log(res.data);

  const proof = res.data.proof;
  const mainExitRoot = res.data.main_exit_root;
  const rollupExitRoot = res.data.rollup_exit_root;

  const bridge = getBridge(userD);

  // orig address is sep ztoken address

    const tx = await bridge.connect(userA).claimAsset(
      proof.merkle_proof,
      proof.rollup_merkle_proof,
      0, // global index is empty string, use 0
      proof.main_exit_root,
      proof.rollup_exit_root,
      deposit.orig_net,
      deposit.orig_addr,
      deposit.orig_net,
      deposit.dest_addr,
      deposit.amount,
      deposit.metadata,
      {
        gasLimit: 5000000
      }
    )
  // } catch(e) {
  //   console.log(e);
  // }
  

  const receipt = await tx.wait(3);

  console.log(receipt);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});