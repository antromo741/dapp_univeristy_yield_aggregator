pragma solidity ^0.8.10;

// OpenZeppelin Contracts
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";

// Implement the Checks Effects and Interactions Method

struct ReserveData {
    uint256 configuration;
    uint128 liquidityIndex;
    uint128 variableBorrowIndex;
    uint128 currentLiquidityRate;
    uint128 currentVariableBorrowRate;
    uint128 currentStableBorrowRate;
    uint40 lastUpdateTimestamp;
    address aTokenAddress;
    address stableDebtTokenAddress;
    address variableDebtTokenAddress;
    address interestRateStrategyAddress;
    uint8 id;
}

interface ICompound {
    function mint(uint256 mintAmount) external returns (uint256);

    function redeem(uint256 redeemTokens) external returns (uint256);

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);

    function borrow(uint256 borrowAmount) external returns (uint256);

    function repayBorrow(uint256 repayAmount) external returns (uint256);

    function repayBorrowBehalf(
        address borrower,
        uint256 repayAmount
    ) external returns (uint256);

    function balanceOfUnderlying(
        address account
    ) external view returns (uint256);

    function borrowBalanceCurrent(
        address account
    ) external view returns (uint256);

    function supplyRatePerBlock() external view returns (uint256);

    function borrowRatePerBlock() external view returns (uint256);

    function getCash() external view returns (uint256);

    function seize(
        address liquidator,
        address borrower,
        uint256 seizeTokens
    ) external returns (uint256);
}

interface IWETHGateway {
    function depositETH(
        address lendingPool,
        address onBehalfOf,
        uint16 referralCode
    ) external payable;

    function withdrawETH(
        address lendingPool,
        uint256 amount,
        address onBehalfOf
    ) external;
}

interface ICEther {
    function mint() external payable;

    function balanceOfUnderlying(address account) external view returns (uint);

    function redeemUnderlying(uint redeemAmount) external returns (uint);
}

interface IWETH is IERC20 {
    function deposit() external payable;

    function withdraw(uint256 amount) external;
}

contract YieldAggregator is ReentrancyGuard, Ownable {
    // Save the addresses of the Aave and Compound contracts
    IWETHGateway public wethGateway;
    ICEther public cEther;
    IPool public aavePool;
    ICompound public compound;
    uint8 public activeProtocol;
    IWETH public weth;

    address public constant COMPOUND_ADDRESS =
        0xA17581A9E3356d9A858b789D68B4d866e593aE94;

    address public constant AAVE_POOL_ADDRESS =
        0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

    address public constant WETH_ADDRESS =
        0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    ICEther public constant CETHER_ADDRESS =
        ICEther(0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5);

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
    event Debug(string message);

    constructor() {
        aavePool = IPool(AAVE_POOL_ADDRESS);
        compound = ICompound(COMPOUND_ADDRESS);
        weth = IWETH(WETH_ADDRESS);
        cEther = ICEther(CETHER_ADDRESS);
        activeProtocol = 1;
    }

    // need to prompt user in frontend to hit accept
    function depositToAave(uint256 amount) public {
        // The contract transfers WETH from the user to itself
        require(
            IWETH(WETH_ADDRESS).transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        // The contract approves Aave to spend its WETH
        require(
            IWETH(WETH_ADDRESS).approve(AAVE_POOL_ADDRESS, amount),
            "Approval failed"
        );

        // The contract deposits the WETH into Aave
        aavePool.supply(WETH_ADDRESS, amount, address(this), 0);

        // Increment the Aave balance by the deposited amount
        balances[msg.sender].aaveBalance += amount;

        emit Deposit(msg.sender, amount);
    }

    function _withdrawFromAave(uint256 amount) internal returns (uint256) {
        // Check user's Aave balance
        require(
            balances[msg.sender].aaveBalance >= amount,
            "YieldAggregator: Not enough user balance"
        );

        aavePool.withdraw(WETH_ADDRESS, amount, address(this));

        // Check WETH balance
        uint256 wethBalance = weth.balanceOf(address(this));
        require(
            wethBalance >= amount,
            "YieldAggregator: Not enough WETH balance"
        );

        // Unwrap the received WETH to ETH
        weth.withdraw(amount);

        // Transfer the unwrapped ETH to the user
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "YieldAggregator: ETH transfer failed");

        // Update the user's Aave balance
        balances[msg.sender].aaveBalance -= amount; // Decrement the Aave balance by the withdrawn amount

        emit Withdraw(msg.sender, amount);

        return amount; // Return the amount of ETH withdrawn
    }
}
