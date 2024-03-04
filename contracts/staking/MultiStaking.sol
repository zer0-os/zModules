// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import { IERC721Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

// TODO idea, maybe receival of SNFT is what triggers unstake?
// import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

// ERC721Wrapper makes the underlying token to be immutable, but we want to be able to change it

contract MultiStaking is ERC721Upgradeable {

  // The necessary details of a single staking implementation
  struct StakeConfig { // TODO move to interface when one exists
    IERC721Upgradeable stakingToken; // should these types be upgradeable? does it matter?
    IERC20Upgradeable rewardsToken;
    uint256 rewardsPerBlock; // including this allows for multiple staking configurations for the same token
  }

  // Only the admin of the contract
  modifier onlyAdmin() {
    require(msg.sender == admin, "only admin");
    _;
  }

  // Only the owner of the representative stake NFT
  modifier onlySNFTOwner(bytes32 stakeId) {
    require(
      ownerOf(uint256(stakeId)) == msg.sender,
      "Caller is not the owner of the representative stake token"
    );
    _;
  }

  // Only the original NFT owner
  modifier onlyNFTOwner(bytes32 poolId, uint256 tokenId) {
    require(
      configs[poolId].stakingToken.ownerOf(tokenId) == msg.sender,
      "Caller is not the owner of the NFT to stake"
    );
    _;
  }

  // Staking can only occur if the admin has set a staking configuration
  modifier onlyExists(bytes32 poolId) {
    require(
      // TODO update this to check all configured variables in a stake config,
      // not just the staking token, otherwise will fail because we want
      // to allow multiple pools of the same staking token
      address(configs[poolId].stakingToken) != address(0),
      "Staking pool for NFT contract does not exist"
    );
    _;
  }

  // The operator of this contract
  address admin; // so one staking contract per org? can we do one contract in total?

  // Mapping of staking configurations
  mapping(bytes32 poolId => StakeConfig config) public configs;

  // Mapping to track when a token was last accessed by the system
  mapping(bytes32 stakeId => uint256 blockNumber) public stakedOrClaimedAt;

  // We track the original staker of the NFT to allow the SNFT to be transferable
  // and still return the original NFT to the original staker on unstake
  mapping(bytes32 stakeId => address staker) public originalStakers;

  function initialize(
    string memory name,
    string memory symbol
  ) public initializer {
    admin = msg.sender;
    __ERC721_init(name, symbol);
  }

  // add createPoolBulk to allow multiple staking configurations to be set at once
  function createPool(
    StakeConfig memory _config
  ) public onlyAdmin {
    // TODO we don't save this which could be a vulnerability
    // the `onlyExists` modifier just checks the value of the poolId given to the function
    // not that we have created one, and so it could be hashed off chain regardless of if one has been set
    // then staked, even if the admin hasn't set it up to do so yet.
    bytes32 poolId =
      keccak256(
        abi.encodePacked( // 0 checks here?
          _config.stakingToken,
          _config.rewardsToken,
          _config.rewardsPerBlock
          // should we include rewards per block in ID?
          // if we do, other staking configs can be set the same with different rewards per block
          // but we dont have to include it in the ID to find it,
          // we can still find it with id => config.rewardsPerBlock
          // and if we don't include it, a ERC721 and ERC20 pair is unique
          // so a staking pool can is 1:1 for a contract
        )
      );

    require(
      // TODO if we want to allow multiple pools of the same staking token
      // this will fail, need to update to check all values don't conflict
      // check mapping that this unique stake ID doesnt exist, when we create that mapping
      address(configs[poolId].stakingToken) == address(0),
      "Staking configuration already exists"
    );

    configs[poolId] = _config;
    // emit ConfigSet(stakingToken, rewardsToken, rewardsPerBlock);
  }

  function getPoolId(
    StakeConfig memory _config
  ) public pure returns (bytes32) {
    return _getPoolId(_config);
  }

  // unguarded functions
  // getAdmin
  // isStaking or configurationExists for a token contract
  // getPendingRewards(bytes32 poolId, uint256 tokenId)
  // getRewardsPerBlock(bytes32 poolId)
  // getStakingToken(bytes32 poolId)
  // getRewardsToken(bytes32 poolId)

  // onlyAdmin functions
  // setConfig => create new config

  // a change to an existing config would create a new poolId
  // so just make a new staking config instead?
  // setRewardsPerBlock => edit existing config
  // setStakingToken => edit existing config
  // setRewardsToken => edit existing config

  // stake
  function stake(
    bytes32 poolId,
    uint256 tokenId
  ) public onlyExists(poolId) onlyNFTOwner(poolId, tokenId) {
    // without tying the tokenId to the poolId somehow, they are not bound in any way
    // this means a user who staked in Pool A could successfully call unstake from Pool B
    // with their SNFT, because the system only sees "this token is staked" not *where* it is staked
    bytes32 stakeId = keccak256(abi.encodePacked(poolId, tokenId));

    // Mark the staking block number
    stakedOrClaimedAt[stakeId] = block.number;

    // Transfer the staker's NFT
    configs[poolId].stakingToken.transferFrom(msg.sender, address(this), tokenId);

    // Mark the user as the original staker for return in unstake
    originalStakers[stakeId] = msg.sender;

    // Mint the owner an SNFT
    _mint(msg.sender, uint256(stakeId));
    // emit Staked(msg.sender, stakeId, poolId);
  }

  // unstake
  function unstake(
    bytes32 poolId,
    uint256 tokenId
  ) public {
    // TODO maybe original NFT owner has to allow the SNFT owner to call unstake
    // otherwise the original NFT would have to resubmit to stake again if they didn't
    // want to exit.
    bytes32 stakeId = keccak256(abi.encodePacked(poolId, tokenId));

    require(
      ownerOf(uint256(stakeId)) == msg.sender,
      "Caller is not the owner of the representative stake token"
    );

    // Bring mapping into memory instead of accessing storage 3 times
    StakeConfig memory config = configs[poolId];

    // Return NFT to the original staker
    config.stakingToken.transferFrom(address(this), originalStakers[stakeId], tokenId);

    // Burn the SNFT
    _burn(uint256(stakeId));

    // Calculate the rewards
    uint256 rewards = config.rewardsPerBlock * (block.number - stakedOrClaimedAt[stakeId]);

    // Update staked mappings
    stakedOrClaimedAt[stakeId] = 0;
    originalStakers[stakeId] = address(0);

    // Transfer the rewards
    config.rewardsToken.transfer(msg.sender, rewards);
    // emit Unstaked(msg.sender, tokenId, poolId, rewards);
  }

  // claim
  function claim(
    bytes32 poolId,
    bytes32 stakeId // TODO dont need original tokenId here but symmetry if we add it instead
  ) public onlySNFTOwner(stakeId) {

    // Calculate and transfer rewards
    uint256 rewards = configs[poolId].rewardsPerBlock * (block.number - stakedOrClaimedAt[stakeId]);
    configs[poolId].rewardsToken.transfer(msg.sender, rewards);

    // Update to most recently claimed block
    stakedOrClaimedAt[stakeId] = block.number;
    // emit Claimed(msg.sender, tokenId, poolId, rewards);
  }

  function deletePool(bytes32 poolId) public onlyAdmin {
    delete configs[poolId];
    // emit
  }

  function deletePoolFromConfig(StakeConfig memory _config) public onlyAdmin {
    bytes32 poolId = _getPoolId(_config);
    delete configs[poolId];
    // emit
  }

  function _getPoolId(StakeConfig memory _config) internal pure returns (bytes32) {
    return keccak256(
      abi.encodePacked(
        _config.stakingToken,
        _config.rewardsToken,
        _config.rewardsPerBlock
      )
    );
  }
}