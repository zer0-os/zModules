import * as axios from "axios";

async function main() {
  const api = axios.default.create({
    baseURL: process.env.BRIDGE_API_URL,
  });
  // transfer gas token to see what it shows as on zchain, 13
  // transfer ownable erc20 to see how it recreates it on zchain (with param) 14
  
  // deploy new that uses msg.sender, transfer ownable erc20 to see how it recreates it on zchain (msg.sender) ___
  const result = await api.get(
    "/bridge",///" + "0xbE57e0450ae99b62997f2F4731bF8D950e06D124",
    {
      params: {
        // tx_hash: "0x983e5948c75f65d18a87b32e86ea478bd2be44a0de5ab9c387ebd1edddcd5269"
        // deposit_cnt: 2, // correct tx for 5, incorrect for 2,
        limit: 20,
        global_index: "18446744073709551617"
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