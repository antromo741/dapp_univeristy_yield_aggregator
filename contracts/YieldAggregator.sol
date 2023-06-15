pragma solidity ^0.8.10;

// OpenZeppelin Contracts
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";

// Implement the Checks Effects and Interactions Method
library CometStructs {
    struct AssetInfo {
        uint8 offset;
        address asset;
        address priceFeed;
        uint64 scale;
        uint64 borrowCollateralFactor;
        uint64 liquidateCollateralFactor;
        uint64 liquidationFactor;
        uint128 supplyCap;
    }

    struct UserBasic {
        int104 principal;
        uint64 baseTrackingIndex;
        uint64 baseTrackingAccrued;
        uint16 assetsIn;
        uint8 _reserved;
    }

    struct TotalsBasic {
        uint64 baseSupplyIndex;
        uint64 baseBorrowIndex;
        uint64 trackingSupplyIndex;
        uint64 trackingBorrowIndex;
        uint104 totalSupplyBase;
        uint104 totalBorrowBase;
        uint40 lastAccrualTime;
        uint8 pauseFlags;
    }

    struct UserCollateral {
        uint128 balance;
        uint128 _reserved;
    }

    struct RewardOwed {
        address token;
        uint owed;
    }

    struct TotalsCollateral {
        uint128 totalSupplyAsset;
        uint128 _reserved;
    }
}

interface IComet {
    function supply(address asset, uint amount) external;

    function withdraw(address asset, uint amount) external;

    function baseToken() external view returns (address);

    function balanceOf(address account) external view returns (uint256);

    function allow(address manager, bool isAllowed) external;
}

interface CometRewards {
    function getRewardOwed(
        address comet,
        address account
    ) external returns (CometStructs.RewardOwed memory);

    function claim(address comet, address src, bool shouldAccrue) external;
}

interface IWETH is IERC20 {
    function deposit() external payable;

    function withdraw(uint256 amount) external;
}

contract YieldAggregator is ReentrancyGuard, Ownable {
    // Save the addresses of the Aave and Compound contracts
    IPool public aavePool;
    IComet public compound;
    uint8 public activeProtocol;
    IWETH public weth;

    address public constant cWETH_ADDRESS =
        0xA17581A9E3356d9A858b789D68B4d866e593aE94;

    address public constant AAVE_POOL_ADDRESS =
        0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

    address public constant WETH_ADDRESS =
        0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

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
        compound = IComet(cWETH_ADDRESS);
        weth = IWETH(WETH_ADDRESS);
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

    function withdrawFromAave(uint256 amount) public {
        // Check user's Aave balance
        require(
            balances[msg.sender].aaveBalance >= amount,
            "YieldAggregator: Not enough user balance"
        );

        // Withdraw WETH from Aave
        aavePool.withdraw(WETH_ADDRESS, amount, address(this));

        // Check WETH balance
        uint256 wethBalance = weth.balanceOf(address(this));
        require(
            wethBalance >= amount,
            "YieldAggregator: Not enough WETH balance"
        );

        // Transfer the WETH to the user
        weth.transfer(msg.sender, amount);

        // Update the user's Aave balance
        balances[msg.sender].aaveBalance -= amount; // Decrement the Aave balance by the withdrawn amount

        emit Withdraw(msg.sender, amount);
    }

    function depositToCompound(uint256 amount) public {
        // The user approves the contract to transfer WETH on their behalf
        require(
            IWETH(WETH_ADDRESS).approve(cWETH_ADDRESS, amount),
            "Approval failed"
        );

        // The contract transfers WETH from the user to itself
        require(
            IWETH(WETH_ADDRESS).transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        // The contract deposits the WETH into Compound
        IComet(cWETH_ADDRESS).supply(WETH_ADDRESS, amount);


        balances[msg.sender].compoundBalance += amount; // Increment the Compound balance by the deposited amount
        emit Deposit(msg.sender, amount);
    }
}
