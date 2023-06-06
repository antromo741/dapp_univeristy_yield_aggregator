pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Import the Aave and Compound interfaces
import "https://github.com/aave/aave-v3-core/blob/master/contracts/interfaces/IPool.sol";
import "https://github.com/Compound-finance/compound-protocol/blob/master/contracts/CErc20.sol";

// Implement the Checks Effects and Interactions Method
// Grabbed some of the functions, may not need all
// add the compound interface next
interface IAavePool {
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    function withdraw(address asset, uint256 amount, address to) external;

    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external;

    function repay(
        address asset,
        uint256 amount,
        uint256 rateMode,
        address onBehalfOf
    ) external;

    function swapBorrowRateMode(address asset, uint256 rateMode) external;

    function rebalanceStableBorrowRate(address asset, address user) external;
}

interface ICompound {
    function mint(uint mintAmount) external returns (uint);

    function redeem(uint redeemTokens) external returns (uint);

    function redeemUnderlying(uint redeemAmount) external returns (uint);

    function borrow(uint borrowAmount) external returns (uint);

    function repayBorrow(uint repayAmount) external returns (uint);

    function repayBorrowBehalf(
        address borrower,
        uint repayAmount
    ) external returns (uint);

    function balanceOfUnderlying(address account) external view returns (uint);

    function borrowBalanceCurrent(address account) external view returns (uint);

    function supplyRatePerBlock() external view returns (uint);

    function borrowRatePerBlock() external view returns (uint);

    function getCash() external view returns (uint);

    function seize(
        address liquidator,
        address borrower,
        uint seizeTokens
    ) external returns (uint);
}

contract YieldAggregator {
    // Save the addresses of the Aave and Compound contracts
    IAaveV3Pool public aavePool;
    ICompound public compound;

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
        compound = ICompound(_compound);
        weth = IERC20(_weth);
    }

    function _depositToAave(uint amount) public {
        // Code to deposit funds into Aave
        // From aave doc
        // TODO: look how to handle token approvals
        // Check that the user has approved the contract to transfer the tokens
        require(
            weth.allowance(msg.sender, address(this)) >= amount,
            "YieldAggregator: Not enough allowance"
        );

        // Transfer the tokens from the user to the contract
        weth.transferFrom(msg.sender, address(this), amount);

        // Approve the Aave pool to spend the tokens
        weth.approve(address(aavePool), amount);

        // Supply the tokens to the Aave pool
        // 0 is a placeholder for the referal code,
        // in case this ever goes to production
        aavePool.supply(address(weth), amount, msg.sender, 0);

        // Emit a Deposit event
        emit Deposit(msg.sender, amount);
    }

    // Internal function to handle deposit to Compound
    function depositToCompound(uint amount) public {
        // Check if the user has enough balance to deposit
        require(
            weth.balanceOf(msg.sender) >= amount,
            "YieldAggregator: Not enough balance"
        );

        // Check that the user has approved the contract to transfer the tokens
        require(
            weth.allowance(msg.sender, address(this)) >= amount,
            "YieldAggregator: Not enough allowance"
        );
        
        // Transfer the tokens from the user to this contract
        IERC20(weth).transferFrom(msg.sender, address(this), amount);

        // Approve the Compound contract to spend the tokens
        IERC20(weth).approve(address(compound), amount);

        // Call the mint function on the Compound contract
        uint mintResult = compound.mint(amount);
        require(mintResult == 0, "Mint failed");

        // Update the user's balance in this contract
        balances[msg.sender].compoundBalance += amount;

        // Emit an event
        emit Deposit(msg.sender, amount);
    }

    // Main deposit function
    function deposit(uint amount, uint8 protocol) public {
        // Check that the user has approved the contract to transfer the tokens
        require(
            weth.allowance(msg.sender, address(this)) >= amount,
            "YieldAggregator: Not enough allowance"
        );

        if (protocol == 1) {
            _depositToAave(amount);
        } else if (protocol == 2) {
            _depositToCompound(amount);
        } else {
            revert("YieldAggregator: Invalid protocol");
        }

        // Emit a Deposit event
        emit Deposit(msg.sender, amount, protocol);
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
