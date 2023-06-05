pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// Need to add the interfaces for Aave and Compound

contract YieldAggregator is Initializable {
    // Save the addresses of the Aave and Compound contracts would go here
    address public aave;
    address public compound;

    // Save the address of the WETH token contract, we can look this up and its in dapps document
    address public weth;

    // Add events to emit, heres an example from bootcamp2.0
    event Transfer(address indexed from, address indexed to, uint256 value);

    // Structs to represent user balances and other data would go here, nice example from blockchain2.0
    struct _Order {
        // Attributes of an order
        uint256 id; // Unique identifier for order
        address user; // User who made order
        address tokenGet; // Address of the token they receive
        uint256 amountGet; // Amount they receive
        address tokenGive; // Address of token they give
        uint256 amountGive; // Amount they give
        uint256 timestamp; // When order was created
    }

    // Userbalance placeholder
    struct UserBalance {
        address user;
        uint256 compoundBalance;
        uint256 aaveBalance;
    }

    // Create constructor and assign variables

    function initialize(
        address _aave,
        address _compound,
        address _weth
    ) public initializer {
        aave = _aave;
        compound = _compound;
        weth = _weth;
    }

    function deposit(uint amount) public {
        // Placeholder for code to deposit funds into Aave or Compound
    }

    function withdraw(uint amount) public {
        // Placeholder for code to withdraw funds from Aave or Compound
    }

    function rebalance() public {
        // Placeholder for code to rebalance funds between Aave and Compound
    }

    // Additional functions to get interest rates, handle liquidations, etc. would go here
    // once I finish reading both documentations. I think this is a good start point.
}
