pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Import the Aave and Compound interfaces
import "https://github.com/aave/aave-v3-core/blob/master/contracts/interfaces/IPool.sol";
import "add_path_to_compound_interface/CErc20.sol";

// Implement the Checks Effects and Interactions Method
// Grabbed some of the functions, may not need all
// add the compound interface next
interface IAaveV3Pool {
    function mintUnbacked(address onBehalfOf, uint256 amount) external;

    function supply(address onBehalfOf, uint256 amount) external;

    function withdraw(address onBehalfOf, uint256 amount) external;

    function borrow(address onBehalfOf, uint256 amount) external;

    function repay(address onBehalfOf, uint256 amount) external;

    function swapBorrowRateMode(address onBehalfOf) external;

    function rebalanceStableBorrowRate(address onBehalfOf) external;
}

contract YieldAggregator {
    // Save the addresses of the Aave and Compound contracts
    IAaveV3Pool public aavePool;
    CErc20 public compound;

    // Save the address of the WETH token contract
    IERC20 public weth;

    // To keep track of the user balances
    mapping(address => UserBalance) public balances;

    // Struct to represent user balances
    struct UserBalance {
        uint256 compoundBalance;
        uint256 aaveBalance;
    }

    // Events
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Rebalance(address indexed user);

    constructor(address _aavePool, address _compound, address _weth) {
        aavePool = IAaveV3Pool(_aavePool);
        compound = CErc20(_compound);
        weth = IERC20(_weth);
    }

    function deposit(uint amount) public {
        // Code to deposit funds into Aave or Compound
        // From aave doc
        // TODO: look how to handle token approvals
        // Check that the user has approved the contract to transfer the tokens
        require(
            weth.allowance(msg.sender, address(this)) >= amount,
            "YieldAggregator: Not enough allowance"
        );

        // Transfer the tokens from the user to the contract
        weth.transferFrom(msg.sender, address(this), amount);

        // Supply the tokens to the Aave pool
        aavePool.supply(msg.sender, amount);

        // Emit a Deposit event
        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint amount) public {
        // Code to withdraw funds from Aave or Compound
        // From aave doc
        // TODO: Need to check user's balance
        // Check that the user has enough aTokens in the Aave pool
        // similar pattern to deposit, work backwards
        require(
            aavePool.balanceOf(msg.sender) >= amount,
            "YieldAggregator: Not enough balance"
        );

        // Withdraw the tokens from the Aave pool
        aavePool.withdraw(msg.sender, amount);

        // Transfer the tokens from the contract to the user
        weth.transfer(msg.sender, amount);

        // Emit a Withdraw event
        emit Withdraw(msg.sender, amount);
    }

    function rebalance() public {
        // Code to rebalance funds between Aave and Compound
        // From aave doc
        // TODO: Make decisions based on current interest rates
        // aavePool.rebalanceStableBorrowRate(msg.sender);
        // Check that the user has enough aTokens in the Aave pool
        require(
            aavePool.balanceOf(msg.sender) >= amountToAave,
            "YieldAggregator: Not enough balance in Aave"
        );

        // Check that the user has enough cTokens in the Compound pool
        require(
            compound.balanceOf(msg.sender) >= amountToCompound,
            "YieldAggregator: Not enough balance in Compound"
        );

        // Withdraw the tokens from the Aave pool
        aavePool.withdraw(msg.sender, amountToAave);

        // Withdraw the tokens from the Compound pool
        compound.redeemUnderlying(amountToCompound);

        // Supply the tokens to the Aave pool
        aavePool.supply(msg.sender, amountToCompound);

        // Supply the tokens to the Compound pool
        compound.mint(amountToAave);

        // Emit a Rebalance event
        emit Rebalance(msg.sender, amountToCompound, amountToAave);
    }

    // Additional functions to get interest rates, handle liquidations, etc.
}
