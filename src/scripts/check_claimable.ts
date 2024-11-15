import * as axios from "axios";
import { SEP_NET_ID } from "./helpers/constants";

async function main() {
  const api = axios.default.create({
    baseURL: process.env.BRIDGE_API_URL,
  });
  // transfer gas token to see what it shows as on zchain, 13
  // transfer ownable erc20 to see how it recreates it on zchain (with param) 14
  // const destAddress = "0x0f3b88095e750bdD54A25B2109c7b166A34B6dDb" // userD
  const destAddress = "0xd5B840269Ac41E070aFF85554dF9aad406A4d091" // userE
  
  // deploy new that uses msg.sender, transfer ownable erc20 to see how it recreates it on zchain (msg.sender) ___
  const result = await api.get(
    "/bridges/" + destAddress,
    {
      params: {
        // tx_hash: "0x983e5948c75f65d18a87b32e86ea478bd2be44a0de5ab9c387ebd1edddcd5269"
        deposit_cnt: 6, // correct tx for 5, incorrect for 2,
        net_id: 1
        // limit: 20,
        // 2 - incorrect data, points to other tx with same deposit_cnt
        // 3 - incomplete, never ready for claim?
        // 4 - correct, bridge eth
        // 5 - correct, bridge eth
        // 6 - 
      }
    }
  );

    console.log(result.data)
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