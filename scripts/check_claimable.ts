import * as axios from "axios";

async function main() {
  const api = axios.default.create({
    baseURL: process.env.BRIDGE_API_URL,
  });
  // transfer gas token to see what it shows as on zchain, 13
  // transfer ownable erc20 to see how it recreates it on zchain (with param) 14
  
  // deploy new that uses msg.sender, transfer ownable erc20 to see how it recreates it on zchain (msg.sender) ___
  const result = await api.get(
    "/bridge",
    {
      params: {
        deposit_cnt: 13,
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