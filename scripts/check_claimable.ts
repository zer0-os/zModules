import * as hre from "hardhat";

import abi from "./bridge_abi.json";

import * as axios from "axios";
import { BRIDGE_ADDRESS } from "./constants";



async function main() {
  const [userA, userD] = await hre.ethers.getSigners();

  const api = axios.default.create({
    baseURL: process.env.BRIDGE_API_URL,
  });

  // Sent from sep bridge to zchain bridge

  const result = await api.get(
    "/bridges/" + BRIDGE_ADDRESS,
    { params: { limit: 100, offset: 0 } }
  );

  console.log(result.data)
  // console.log(`Is message claimable? ${result.data.deposits[]}`);
  // const latestDeposit = result.data.deposits[result.data.deposits.length - 1];

  // const res = await api.get(
  //   "/merkle-proof",
  //   {
  //     params: {
  //       deposit_cnt: latestDeposit.deposit_cnt,
  //       net_id: latestDeposit.orig_net,
  //     },
  //   }
  // );

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});