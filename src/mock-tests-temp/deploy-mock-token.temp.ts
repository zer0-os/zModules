import * as hre from "hardhat";


const deployMockToken = async () => {
  const [ deployer ] = await hre.ethers.getSigners();

  const Factory = await hre.ethers.getContractFactory(
    "TestMockERC20",
    deployer,
  );

  const token = await Factory.deploy(
    "DEV",
    "DEV",
    deployer.address,
  );

  console.log("Token deployed, awaiting confirmation...");

  const deployTx = token.deploymentTransaction();

  let receipt;
  if (deployTx) {
    receipt = await deployTx.wait(2);
  } else {
    throw new Error("No deployment transaction found!");
  }

  console.log(`
  Deploy tx confirmed: ${receipt?.hash}.
  Token deployed at: ${token.target}.
  `);
};

deployMockToken()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
