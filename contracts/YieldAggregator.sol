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
        uint256 interestEarned;
        uint256 contractBalance;
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
        // Check user's WETH balance
        uint256 userBalance = IWETH(WETH_ADDRESS).balanceOf(msg.sender);
        require(
            userBalance >= amount,
            "YieldAggregator: Not enough WETH balance"
        );

        // Check user's WETH allowance
        uint256 allowance = IWETH(WETH_ADDRESS).allowance(
            msg.sender,
            address(this)
        );
        require(
            allowance >= amount,
            "YieldAggregator: Not enough WETH allowance"
        );

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

    function withdrawFromAave() public {
        // Get user's Aave balance
        uint256 aaveBalance = balances[msg.sender].aaveBalance;
        require(aaveBalance > 0, "YieldAggregator: Not enough user balance");

        // Withdraw all funds from Aave
        aavePool.withdraw(WETH_ADDRESS, type(uint256).max, address(this));

        // Check WETH balance
        uint256 wethBalance = weth.balanceOf(address(this));
        require(
            wethBalance >= aaveBalance,
            "YieldAggregator: Not enough WETH balance"
        );

        // Calculate interest earned
        uint256 interest = wethBalance - aaveBalance;

        // Update the user's Aave balance and interest earned
        balances[msg.sender].aaveBalance = 0; // Set the Aave balance to 0 as all funds have been withdrawn
        balances[msg.sender].interestEarned += interest;

        // Transfer the WETH to the user
        weth.transfer(msg.sender, wethBalance);

        emit Withdraw(msg.sender, wethBalance);
    }

    function depositToCompound(uint256 amount) public {
        // Check user's WETH balance
        uint256 userBalance = IWETH(WETH_ADDRESS).balanceOf(msg.sender);
        require(
            userBalance >= amount,
            "YieldAggregator: Not enough WETH balance"
        );

        // Check user's WETH allowance
        uint256 allowance = IWETH(WETH_ADDRESS).allowance(
            msg.sender,
            address(this)
        );
        require(
            allowance >= amount,
            "YieldAggregator: Not enough WETH allowance"
        );

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

    function withdrawFromCompound() public {
        // Get user's Compound balance
        uint256 compoundBalance = balances[msg.sender].compoundBalance;
        require(
            compoundBalance > 0,
            "YieldAggregator: Not enough user balance"
        );

        // Withdraw all funds from Compound
        IComet(cWETH_ADDRESS).withdraw(WETH_ADDRESS, type(uint256).max);

        // Check WETH balance
        uint256 wethBalance = weth.balanceOf(address(this));
        require(
            wethBalance >= compoundBalance,
            "YieldAggregator: Not enough WETH balance"
        );

        // Transfer the WETH to the user
        weth.transfer(msg.sender, wethBalance);

        // Update the user's Compound balance
        balances[msg.sender].compoundBalance = 0; // Set the Compound balance to 0 as all funds have been withdrawn

        emit Withdraw(msg.sender, wethBalance);
    }

    // TODO make js function to calculate apys
    function rebalance(uint8 highestAPYProtocol) public {
        // Check that highestAPYProtocol is either 0 or 1
        require(
            highestAPYProtocol == 0 || highestAPYProtocol == 1,
            "YieldAggregator: Invalid protocol"
        );

        // Get the user's balances
        UserBalance storage userBalance = balances[msg.sender];

        if (highestAPYProtocol == 0 && userBalance.aaveBalance > 0) {
            // Move funds from Aave to Compound
            // Get user's Aave balance
            uint256 aaveBalance = userBalance.aaveBalance;

            // Withdraw all funds from Aave
            aavePool.withdraw(WETH_ADDRESS, type(uint256).max, address(this));

            // Check WETH balance
            uint256 wethBalance = weth.balanceOf(address(this));

            // Calculate interest earned
            uint256 interest = wethBalance - aaveBalance;

            // Update the user's Aave balance, contract balance and interest earned
            userBalance.aaveBalance = 0; // Set the Aave balance to 0 as all funds have been withdrawn
            userBalance.contractBalance = wethBalance; // Update the contract balance with the withdrawn amount
            userBalance.interestEarned += interest; // Update the interest earned

            // The contract approves Compound to spend its WETH
            require(
                IWETH(WETH_ADDRESS).approve(cWETH_ADDRESS, wethBalance),
                "Approval failed"
            );

            // The contract deposits the WETH into Compound
            IComet(cWETH_ADDRESS).supply(WETH_ADDRESS, wethBalance);

            // Update the user's Compound balance and contract balance
            userBalance.compoundBalance += wethBalance; // Increment the Compound balance by the deposited amount
            userBalance.contractBalance = 0; // Set the contract balance to 0 as all funds have been deposited into Compound
        } else if (highestAPYProtocol == 1 && userBalance.compoundBalance > 0) {
            // Move funds from Compound to Aave
            // Get user's Compound balance
            uint256 compoundBalance = userBalance.compoundBalance;

            // Withdraw all funds from Compound
            IComet(cWETH_ADDRESS).withdraw(WETH_ADDRESS, type(uint256).max);

            // Check WETH balance
            uint256 wethBalance = weth.balanceOf(address(this));
            require(
                wethBalance >= compoundBalance,
                "YieldAggregator: Not enough WETH balance"
            );

            // Calculate interest earned
            uint256 interest = wethBalance - compoundBalance;

            // Update the user's Compound balance, contract balance and interest earned
            userBalance.compoundBalance = 0; // Set the Compound balance to 0 as all funds have been withdrawn
            userBalance.contractBalance = wethBalance; // Update the contract balance with the withdrawn amount
            userBalance.interestEarned += interest; // Update the interest earned

            // The contract approves Aave to spend its WETH
            require(
                IWETH(WETH_ADDRESS).approve(AAVE_POOL_ADDRESS, wethBalance),
                "Approval failed"
            );

            // The contract deposits the WETH into Aave
            aavePool.supply(WETH_ADDRESS, wethBalance, address(this), 0);

            // Update the user's Aave balance and contract balance
            userBalance.aaveBalance += wethBalance; // Increment the Aave balance by the deposited amount
            userBalance.contractBalance = 0; // Set the contract balance to 0 as all funds have been deposited into Aave
        }

        emit Rebalance(msg.sender);
    }
}
