import { gql, ApolloClient, NormalizedCacheObject, HttpLink, InMemoryCache } from "@apollo/client/core";

export const getUsers = gql`
  query Users($first: Int!, $skip: Int!) {
    accounts(
      first: $first,
      skip: $skip
    ) {
      id
    }
  }
`;

export const dataByPoolByUser = gql`
  query DataByPool(
    $first: Int!,
    $skip: Int!,
    $userAddress: String!,
    $poolAddress: String!
  ) {
    deposits(
      first: $first,
      skip: $skip,
      where: {
        pool: $poolAddress,
        by: $userAddress,
        tokenAmount_gt: 0
      }
    ) {
      id
      by {
        id
      }
      depositId
      tokenAmount
      lockedFrom
      lockedUntil
      pool {
        id
      }
      timestamp
    }
    rewards(
      first: $first,
      skip: $skip,
      where: { pool: $poolAddress, tokenAmount_gt: 0 }) {
      id
      for {
        id
      }
      tokenAmount
      pool {
        id
      }
    }
  }`


// maybe dont need this?
export const rewardsSize = gql`
query DataByPool($first: Int!, $skip: Int!, $poolAddress: String!) {
  rewards(
    first: $first,
    skip: $skip,
    where: {
      tokenAmount_gt: 0,
      pool: $poolAddress,
      and: [
        {for_not: "0x3aC551725ac98C5DCdeA197cEaaE7cDb8a71a2B4"},
        {for_not: "0x9E87a268D42B0Aba399C121428fcE2c626Ea01FF"}
      ]
    }) {
    id
    for {
      id
    }
    tokenAmount
    pool {
      id
    }
  }
}`

