// import * as apollo from "@apollo/client/core";
// import pkg from 'graphql';

import { ApolloClient, NormalizedCacheObject, HttpLink, InMemoryCache } from "@apollo/client/core";

import { getUsers } from "./helpers/queries";

import * as hre from "hardhat";

// Must run script in package.json to create type from ABI
import { ZStakeCorePool, ZStakeCorePool__factory } from "../../typechain";
import { Contract } from "ethers";

const url = process.env.QUERY_URL;
const wildToken = "0x2a3bFF78B79A009976EeA096a51A948a3dC00e34";
const wildStakingPool = "0x3aC551725ac98C5DCdeA197cEaaE7cDb8a71a2B4".toLowerCase();
const lpStakingPool = "0x9E87a268D42B0Aba399C121428fcE2c626Ea01FF".toLowerCase();

// lower case
// wild pool: 0x3ac551725ac98c5dcdea197ceaae7cdb8a71a2b4
// LP pool: 0x9e87a268d42b0aba399c121428fce2c626ea01ff

const createApolloClient = (
  subgraphUri: string
): ApolloClient<NormalizedCacheObject> => {
  const client = new ApolloClient({
    link: new HttpLink({ uri: subgraphUri, fetch }),
    cache: new InMemoryCache(),
  });

  return client;
};

const main = async () => {
  // going to have to be multiple queries due to amount of data
  // first get each user, then we can query by user ID to get smaller, manageable data sizes for deposits / rewards
  // deposits and rewards can be grouped into a single query, probably
  // there are 3159 unique users

  const [ userD, userE ] = await hre.ethers.getSigners();

  const client = await createApolloClient(url!);

  let first = 1000;
  let skip = 0;

  // First call to get users
  let userQueryResult = await client.query({
    query: getUsers,
    variables: {
      first: first,
      skip: skip,
    }
  });

  const contract = new Contract(
    wildStakingPool,
    ZStakeCorePool__factory.abi,
    userD
  ) as unknown as ZStakeCorePool;

  for (const user of userQueryResult.data.accounts) {
    console.log(user.id);

    const stakerData = await contract.users(user.id);
    console.log(stakerData);
    break;
  };

  // while (userQueryResult.data.accounts.length > 0) {

  //   for (const deposit of userQueryResult.data.deposits) {

  //   skip += 1000;
  //   userQueryResult = await client.query({
  //     query: getUsers,
  //     variables: {
  //       first: first,
  //       skip: skip,
  //     }
  //   });
  // }


  /** 
   * for (each user)
   *  query deposits and rewards by that users
   *  add to totalDeposits and totalRewards
  */

  // console.log(queryResult.data.rewards.length)

  let totalDeposits = new Map<string, number>();
  let totalRewards = new Map<string, number>();
  let noClaimRewards = new Array<string>(); // for users with 0 reward calls

  // while (queryResult.data.deposits.length > 0) {
  //   console.log(`deposits length: ${queryResult.data.deposits.length}`)
  //   console.log(`rewards length: ${queryResult.data.rewards.length}`)
    
  //   let { deposits, rewards } = queryResult.data;

  //   let iterable = {
  //     deposits: deposits,
  //     rewards: rewards
  //   }
    
  //   for (let i = 0 ; i < queryResult.data.deposits.length ; i++) {

  //     totalDeposits.set(deposits[i].by.id, (totalDeposits.get(deposits[i].by.id) || 0) + deposits[i].tokenAmount)
  //     totalRewards.set(rewards[i].for.id, (totalRewards.get(rewards[i].for.id) || 0) + rewards[i].tokenAmount)
  //   }

  //   console.log("querying again...");

  //   skip += 1000;

  //   queryResult = await client.query({
  //     query: myQuery,
  //     variables: {
  //       first: first,
  //       skip: skip,
  //       poolAddress: wildStakingPool // toLowerCase?
  //     }
  //   });
  // }

  // console.log("Total deposits: ", totalDeposits.size);
  // console.log("Total rewards: ", totalRewards.size);
}

main();
