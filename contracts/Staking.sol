// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Staking
 * @dev Contract for staking MyToken tokens with governance voting power
 * @notice Users can stake tokens to participate in governance without earning rewards
 */
contract Staking is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev The ERC20 token being staked
    IERC20 public immutable stakingToken;

    /// @dev Mapping of user addresses to their staked token amounts
    mapping(address => uint256) public stakedBalances;

    /// @dev Total amount of tokens staked in the contract
    uint256 public totalStaked;

    /**
     * @dev Emitted when a user stakes tokens
     * @param user The address of the user who staked
     * @param amount The amount of tokens staked
     */
    event Stake(address indexed user, uint256 amount);

    /**
     * @dev Emitted when a user withdraws tokens
     * @param user The address of the user who withdrew
     * @param amount The amount of tokens withdrawn
     */
    event Withdraw(address indexed user, uint256 amount);

    /**
     * @dev Constructor sets the staking token
     * @param _stakingToken Address of the token to be staked
     */
    constructor(address _stakingToken) {
        require(_stakingToken != address(0), "Staking: invalid token address");
        stakingToken = IERC20(_stakingToken);
    }

    /**
     * @dev Stakes tokens for the caller
     * @param amount The amount of tokens to stake
     * @notice Requires prior approval of tokens to this contract
     */
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Staking: amount must be greater than 0");

        // Update state before external call
        stakedBalances[msg.sender] += amount;
        totalStaked += amount;

        // Transfer tokens from user to this contract
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Stake(msg.sender, amount);
    }

    /**
     * @dev Withdraws staked tokens for the caller
     * @param amount The amount of tokens to withdraw
     * @notice User must have sufficient staked balance
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Staking: amount must be greater than 0");
        require(stakedBalances[msg.sender] >= amount, "Staking: insufficient staked balance");

        // Update state before external call
        stakedBalances[msg.sender] -= amount;
        totalStaked -= amount;

        // Transfer tokens back to user
        stakingToken.safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, amount);
    }

    /**
     * @dev Returns the voting power of a user based on their staked balance
     * @param user The address to check voting power for
     * @return The voting power (equal to staked balance)
     * @notice Used by governance contracts to determine voting weight
     */
    function votingPower(address user) external view returns (uint256) {
        return stakedBalances[user];
    }

    /**
     * @dev Returns the staked balance of a user
     * @param user The address to check balance for
     * @return The amount of tokens staked by the user
     */
    function balanceOf(address user) external view returns (uint256) {
        return stakedBalances[user];
    }
}