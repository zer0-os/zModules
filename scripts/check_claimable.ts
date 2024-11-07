import * as hre from "hardhat";

import abi from "./bridge_abi.json";

import * as axios from "axios";
import { BRIDGE_ADDRESS, SEP_NET_ID } from "./constants";


async function main() {
  const [userA, userD] = await hre.ethers.getSigners();

  const api = axios.default.create({
    baseURL: process.env.BRIDGE_API_URL,
  });

  // Sent from sep bridge to zchain bridge

  // const txhash = "0x668b6310080bc7a89947ba49fb27fff13cb1ea5b86ebc495b8160db88c7b7125"

  // for (let i = 1; i < 5; i++) {
    setTimeout(() => {}, 1000);
    const result = await api.get(
      "/bridge",
      {
        params: {
          deposit_cnt: 8,
          // net_id: 1
        }
      }
    );

    // if (result.status != 500 && result.data.deposit.tx_hash === txhash) {
    //   console.log(i)
    console.log(result.data)
    // }
  // }

  // const result = await api.get(
  //   "/bridge",
  //   // "/bridges/" + BRIDGE_ADDRESS,
  //   {
  //     params: {
  //       deposit_cnt: 2,
  //       // net_id: 1
  //       // limit: 100,
  //       // offset: 0
  //     }
  //   }
  // );

  // console.log(result.data)
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