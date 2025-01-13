import * as axios from "axios";

async function main() {
  const api = axios.default.create({
    baseURL: process.env.BRIDGE_API_URL,
  });
  // transfer gas token to see what it shows as on zchain, 13
  // transfer ownable erc20 to see how it recreates it on zchain (with param) 14
  const userD = "0x0f3b88095e750bdD54A25B2109c7b166A34B6dDb" // userD
  const userE = "0xd5B840269Ac41E070aFF85554dF9aad406A4d091" // userE
  
  const depCnt = 18;

  const result = await api.get(
    "/bridges/" + userD,
    {
      params: {
        deposit_cnt: depCnt,
        // net_id: 1
      }
    }
  );

  for (const deposit of result.data.deposits) {
    if (deposit.deposit_cnt == depCnt) {
      console.log(deposit)
    }
  }

  console.log(result.data.total_cnt)
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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});