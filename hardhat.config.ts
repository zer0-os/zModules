/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-unused-vars */

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
import { setDefaultEnvironment } from "./src/environment/set-env";


setDefaultEnvironment();

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
        version: "0.8.26",
        settings: {
          optimizer: {
            enabled: true,
            runs: 20000,
          },
        },
      },
      {
        version: "0.8.26",
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
  networks: {
    zephyr: {
      url: `${process.env.ZCHAIN_ZEPHYR_RPC_URL}`,
      chainId: 1417429182,
      accounts: [
        `${process.env.TESTNET_PRIVATE_KEY_A}`,
      ],
    },
  },
  etherscan: {
    // apiKey: `${process.env.ETHERSCAN_API_KEY}`,
    customChains: [
      //     {
      //       network: "meowtestnet",
      //       chainId: 883424730,
      //       urls: {
      //         apiURL: "https://meowchain-testnet-blockscout.eu-north-2.gateway.fm/api/",
      //         browserURL: "https://meowchain-testnet-blockscout.eu-north-2.gateway.fm/",
      //       },
      //     },
      {
        network: "zephyr",
        chainId: 1417429182,
        urls: {
          apiURL: "https://zephyr-blockscout.eu-north-2.gateway.fm/api/",
          browserURL: "https://zephyr-blockscout.eu-north-2.gateway.fm/",
        },
      },
    ],
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
