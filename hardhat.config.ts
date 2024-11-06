/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-unused-vars */

require("dotenv").config();

import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-toolbox/network-helpers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@openzeppelin/hardhat-upgrades";
import "solidity-coverage";
import "solidity-docgen";
import "hardhat-gas-reporter";

// import "@nomicfoundation/hardhat-ignition-ethers";

import { HardhatUserConfig } from "hardhat/config";


const config : HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 20000,
          },
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: {
    outDir: "typechain",
  },
  mocha: {
    timeout: 5000000,
  },
  gasReporter: {
    enabled: false,
  },
  etherscan: {
    // For all networks
    apiKey: `${process.env.ETHERSCAN_API_KEY}`,
    customChains: [
      {
        network: "zchain",
        chainId: Number(process.env.ZCHAIN_ID),
        urls: {
          apiURL: `${process.env.BLOCKSCOUT_API_URL}`,
          browserURL: `${process.env.BLOCKSCOUT_EXPLORER_URL}`,
        }
      }
    ]
  },
  sourcify: {
    enabled: false,
  },
  networks: {
    // mainnet: {
    // //   url: `${process.env.MAINNET_RPC_URL}`,
    // //   gasPrice: 80000000000,
    // },
    zchain: {
      url: `${process.env.ZCHAIN_RPC_URL}`,
      timeout: 10000000,
      
      accounts: [
        // `${process.env.PRIVATE_KEY_A}`,
        `${process.env.PRIVATE_KEY_D}`,
      ],
      // // Must have to avoid instead failing as `invalid length for result data` error
      // throwOnCallFailures: false, // not sure if this even works
    },
    sepolia: {
      url: `${process.env.SEPOLIA_RPC_URL}`,
      timeout: 10000000,
      accounts: [ // Comment out for CI, uncomment this when using Sepolia
        `${process.env.PRIVATE_KEY_D}`
      ],
      // // Must have to avoid instead failing as `invalid length for result data` error
      // throwOnCallFailures: false, // not sure if this even works
    },
  },
  // docgen: {
  //   pages: "files",
  //   templates: "docs/docgen-templates",
  //   outputDir: "docs/contracts",
  //   exclude: [
  //     "mock/",
  //   ],
  // },
};

export default config;
