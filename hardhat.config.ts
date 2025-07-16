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
    zchain: {
      chainId: 9369,
      url: `${process.env.ZCHAIN_RPC_URL}`,
      accounts: [
        // `${process.env.DEPLOY_ADMIN_PRIVATE_KEY}`,
      ],
    },
    zephyr: {
      url: `${process.env.ZCHAIN_ZEPHYR_RPC_URL}`,
      chainId: 1417429182,
      accounts: [
        // `${process.env.DEPLOY_ADMIN_ZCHAIN_ZEPHYR_PK}`,
      ],
      timeout: 10000000,
      loggingEnabled: true,
    },
    fuji: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: [
        // `${process.env.DEPLOY_ADMIN_FUJI_PK}`,
      ],
    },
  },
  etherscan: {
    apiKey: {
      zchain: "placeholder", // any non-empty string will pass, not actually used by Snowtrace
      zephyr: "placeholder",
      fuji: "placeholder",
    },
    customChains: [
      {
        network: "zchain",
        chainId: 9369,
        urls: {
          apiURL: "https://z-chain-blockscout.eu-north-2.gateway.fm/api/",
          browserURL: "https://z-chain-blockscout.eu-north-2.gateway.fm/",
        },
      },
      {
        network: "zephyr",
        chainId: 1417429182,
        urls: {
          apiURL: "https://zephyr-blockscout.eu-north-2.gateway.fm/api/",
          browserURL: "https://zephyr-blockscout.eu-north-2.gateway.fm/",
        },
      },
      {
        network: "fuji",
        chainId: 43113,
        urls: {
          apiURL: "https://api-testnet.snowtrace.io/api",
          browserURL: "https://testnet.snowtrace.io"
        }
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
