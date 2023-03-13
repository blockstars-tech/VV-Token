//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;

/// Openzeppelin imports
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract VVToken is ERC20Burnable {

    uint256 public constant INITIALSUPPLY = 1000000000 * (10 ** 18);

    constructor(string memory _name, string memory _symbol)
        ERC20(_name, _symbol) {
        _mint(msg.sender, INITIALSUPPLY);
    }
}
