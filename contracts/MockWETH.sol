// contracts/MockWETH.sol

pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {}

    function deposit() public payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint wad) public {
        require(balanceOf(msg.sender) >= wad);
        _burn(msg.sender, wad);
        payable(msg.sender).transfer(wad);
    }
}