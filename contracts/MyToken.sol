// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MyToken
 * @dev ERC20 token with minting and burning capabilities
 * @notice This contract implements an ERC20 token with an initial supply minted to the deployer
 */
contract MyToken is ERC20, Ownable {

    /**
     * @dev Emitted when tokens are minted
     * @param to The address that received the minted tokens
     * @param amount The amount of tokens minted
     */
    event Mint(address indexed to, uint256 amount);

    /**
     * @dev Emitted when tokens are burned
     * @param from The address that burned the tokens
     * @param amount The amount of tokens burned
     */
    event Burn(address indexed from, uint256 amount);

    /**
     * @dev Constructor that mints the initial supply to the deployer
     * @notice Creates 1,000,000 tokens and assigns them to the contract deployer
     */
    constructor() ERC20("MyToken", "MTK") Ownable(msg.sender) {
        uint256 initialSupply = 1_000_000 * 10**decimals();
        _mint(msg.sender, initialSupply);
        emit Mint(msg.sender, initialSupply);
    }

    /**
     * @dev Burns tokens from the caller's account
     * @param amount The amount of tokens to burn
     * @notice Any token holder can burn their own tokens
     */
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
        emit Burn(msg.sender, amount);
    }

    /**
     * @dev Burns tokens from a specified account (requires allowance)
     * @param from The account to burn tokens from
     * @param amount The amount of tokens to burn
     * @notice Owner can burn tokens from any account, others need allowance
     */
    function burnFrom(address from, uint256 amount) public {
        if (msg.sender != owner()) {
            _spendAllowance(from, msg.sender, amount);
        }
        _burn(from, amount);
        emit Burn(from, amount);
    }
}