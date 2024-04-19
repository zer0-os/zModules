
let deployer : SignerWithAddress;
let stakerA : SignerWithAddress;
let stakerB : SignerWithAddress;
let stakerC : SignerWithAddress;
let notStaker : SignerWithAddress;

let stakingERC721 : StakingERC721;

let mockERC20 : MockERC20;
let mockERC721 : MockERC721;

// We don't use `PoolConfig` anymore on the contracts but for convenience in testing
// we can leave this type where it is
let config : BaseConfig;

let stakedAtA : bigint;
let stakedAtB : bigint;

let claimedAt : bigint;
let unstakedAt : bigint;
let secondUnstakedAt : bigint;

let balanceAtStakeOne : bigint;
let balanceAtStakeTwo : bigint;

let durationOne : bigint;
let durationTwo : bigint;

// Default token ids
const tokenIdA = 1;
const tokenIdB = 2;
const tokenIdC = 3;
const tokenIdDelayed = 7; // Minted and used in stake at a later point in time
const nonStakedTokenId = 8; // Minted but never used in `stake`
const unmintedTokenId = 9; // Never minted

before(async () => {
  [
    deployer,
    stakerA,
    stakerB,
    stakerC,
    notStaker,
  ] = await hre.ethers.getSigners();

  const mockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
  mockERC20 = await mockERC20Factory.deploy("MEOW", "MEOW");

  const mockERC721Factory = await hre.ethers.getContractFactory("MockERC721");
  mockERC721 = await mockERC721Factory.deploy("WilderWheels", "WW", "0://wheels-base");

  config = await createDefaultConfigs(mockERC20, mockERC721);

  const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
  stakingERC721 = await stakingFactory.deploy(
    "StakingNFT",
    "SNFT",
    config.stakingToken,
    config.rewardsToken,
    config.rewardsPerPeriod,
    config.periodLength,
    config.timeLockPeriod
  ) as StakingERC721;

  // Give staking contract balance to pay rewards
  await mockERC20.connect(deployer).transfer(
    await stakingERC721.getAddress(),
    hre.ethers.parseEther("8000000000000")
  );

  await mockERC721.connect(deployer).mint(stakerA.address, tokenIdA);
  await mockERC721.connect(deployer).mint(stakerA.address, tokenIdB);
  await mockERC721.connect(deployer).mint(stakerA.address, tokenIdC);
  await mockERC721.connect(deployer).mint(deployer.address, nonStakedTokenId);

  await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
  await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
  await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);
});