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

import { HardhatUserConfig, subtask } from "hardhat/config";
import { mochaGlobalSetup, mochaGlobalTeardown } from "./test/mongo-global";
import { TASK_TEST_RUN_MOCHA_TESTS } from "hardhat/builtin-tasks/task-names";

subtask(TASK_TEST_RUN_MOCHA_TESTS)
  .setAction(async (args, hre, runSuper) => {
    await mochaGlobalSetup();
    const testFailures = await runSuper(args);
    await mochaGlobalTeardown();

    return testFailures;
  });

const config : HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
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
  networks: {
    // mainnet: {
    // //   url: `${process.env.MAINNET_RPC_URL}`,
    // //   gasPrice: 80000000000,
    // },
    // sepolia: {
    //   // url: `${process.env.SEPOLIA_RPC_URL}`,
    //   // timeout: 10000000,
    //   // accounts: [ // Comment out for CI, uncomment this when using Sepolia
    //   //   `${process.env.TESTNET_PRIVATE_KEY_A}`,
    //   //   `${process.env.TESTNET_PRIVATE_KEY_B}`,
    //   //   `${process.env.TESTNET_PRIVATE_KEY_C}`,
    //   //   `${process.env.TESTNET_PRIVATE_KEY_D}`,
    //   //   `${process.env.TESTNET_PRIVATE_KEY_E}`,
    //   //   `${process.env.TESTNET_PRIVATE_KEY_F}`,
    //   // ],
    //   // // Must have to avoid instead failing as `invalid length for result data` error
    //   // throwOnCallFailures: false, // not sure if this even works
    // },
  },
  docgen: {
    pages: "files",
    templates: "docs/docgen-templates",
    outputDir: "docs/contracts",
    exclude: [
      "mock/",
    ],
  },
};

export default config;
