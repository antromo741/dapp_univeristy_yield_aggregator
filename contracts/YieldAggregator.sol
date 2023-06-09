pragma solidity ^0.8.10;

// OpenZeppelin Contracts
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Implement the Checks Effects and Interactions Method

interface IAaveV3Pool {
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

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

    function getReserveData(
        address asset
    ) external view returns (ReserveData memory);
}

// Aave v3 IAToken interface
interface IAaveAToken {
    function UNDERLYING_ASSET_ADDRESS() external view returns (address);

    function POOL() external view returns (address);

    function balanceOf(address _user) external view returns (uint256);

    function scaledBalanceOf(address _user) external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function scaledTotalSupply() external view returns (uint256);

    function transfer(
        address recipient,
        uint256 amount
    ) external returns (bool);

    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);
}

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
    IAaveV3Pool public aavePool;
    ICompound public compound;
    uint8 public activeProtocol;
    IWETH public weth;

    address public constant COMPOUND_ADDRESS =
        0xA17581A9E3356d9A858b789D68B4d866e593aE94;
    address public constant AAVE_POOL_ADDRESS =
        0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
    address public constant WETH_ADDRESS =
        0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    IWETHGateway public constant WETH_GATEWAY_ADDRESS =
        IWETHGateway(0xDcD33426BA191383f1c9B431A342498fdac73488);
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
        aavePool = IAaveV3Pool(AAVE_POOL_ADDRESS);
        compound = ICompound(COMPOUND_ADDRESS);
        weth = IWETH(WETH_ADDRESS);
        wethGateway = IWETHGateway(WETH_GATEWAY_ADDRESS);
        cEther = ICEther(CETHER_ADDRESS);
        activeProtocol = 1;
    }

    function getATokenAddress() public view returns (address) {
        ReserveData memory data = aavePool.getReserveData(address(weth));
        return data.aTokenAddress;
    }

    function _depositToAave(uint256 amount) public payable {
        require(msg.value == amount, "YieldAggregator: ETH amount mismatch");
        // Transfer WETH from the contract to Aave
        weth.transfer(AAVE_POOL_ADDRESS, amount);
        balances[msg.sender].aaveBalance += amount; // Increment the Aave balance by the deposited amount
        emit Deposit(msg.sender, amount);
    }

    function _depositToCompound(uint256 amount) public payable {
        // Check if the amount of ETH sent matches the specified amount
        require(msg.value == amount, "YieldAggregator: ETH amount mismatch");

        // Deposit ETH directly into Compound
        weth.transfer(COMPOUND_ADDRESS, amount);

        // Update the user's balance in this contract
        balances[msg.sender].compoundBalance += msg.value;

        // Emit a Deposit event
        emit Deposit(msg.sender, amount);
    }

    // Main deposit function
    function deposit(uint256 amount) public payable nonReentrant {
        require(
            amount > 0,
            "YieldAggregator: deposit amount must be greater than 0"
        );
        require(
            msg.value == amount,
            "YieldAggregator: Ether sent does not match the specified amount"
        );

        // Wrap ETH to WETH
        weth.deposit{value: amount}();

        // Check that the contract has received the WETH
        require(
            weth.balanceOf(address(this)) >= amount,
            "YieldAggregator: WETH transfer failed"
        );

        // Deposit based on the active protocol
        if (activeProtocol == 1) {
            _depositToAave(amount);
        } else if (activeProtocol == 2) {
            _depositToCompound(amount);
        } else {
            revert("YieldAggregator: Invalid protocol");
        }

        // Emit a Deposit event
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

    function _withdrawFromCompound(uint256 amount) public {
        // Check that the user has enough balance in Compound
        require(
            cEther.balanceOfUnderlying(msg.sender) >= amount,
            "YieldAggregator: Not enough balance in Compound"
        );

        // Withdraw ETH directly from Compound
        uint redeemResult = cEther.redeemUnderlying(amount);
        require(redeemResult == 0, "Redeem failed");

        // Update the user's balance in this contract
        balances[msg.sender].compoundBalance =
            balances[msg.sender].compoundBalance -
            amount;

        // Emit a Withdraw event
        emit Withdraw(msg.sender, amount);
    }

    function withdraw(uint256 amount) public nonReentrant {
        uint256 balanceBefore = weth.balanceOf(msg.sender);

        // Withdraw based on the active protocol
        if (activeProtocol == 1) {
            require(
                balances[msg.sender].aaveBalance >= amount,
                "YieldAggregator: Not enough balance in Aave"
            );
            _withdrawFromAave(amount);
        } else if (activeProtocol == 2) {
            require(
                balances[msg.sender].compoundBalance >= amount,
                "YieldAggregator: Not enough balance in Compound"
            );
            _withdrawFromCompound(amount);
        } else {
            revert("YieldAggregator: Invalid protocol");
        }

        uint256 balanceAfter = weth.balanceOf(msg.sender);
        require(
            balanceAfter > balanceBefore,
            "YieldAggregator: Withdrawal didn't increase balance"
        );

        emit Withdraw(msg.sender, amount);
    }

    function setActiveProtocol(uint8 newProtocol) external onlyOwner {
        require(
            newProtocol == 1 || newProtocol == 2,
            "YieldAggregator: Invalid protocol"
        );

        activeProtocol = newProtocol;
    }

    // TODO This uses a javascript function to check apys
    // TODO Emit Events
    function rebalance(uint8 newProtocol) public onlyOwner {
        // Rebalance based on the new protocol
        if (newProtocol != activeProtocol) {
            if (newProtocol == 1) {
                moveFundsFromCompoundToAave();
            } else if (newProtocol == 2) {
                moveFundsFromAaveToCompound();
            } else {
                revert("YieldAggregator: Invalid protocol");
            }

            // Update the active protocol
            activeProtocol = newProtocol;
        }
    }

    function moveFundsFromCompoundToAave() private {
        // Check that the user has enough cTokens in the Compound pool
        uint256 compoundBalance = balances[msg.sender].compoundBalance;
        require(
            compound.balanceOfUnderlying(msg.sender) >= compoundBalance,
            "YieldAggregator: Not enough balance in Compound"
        );

        // Move funds from Compound to Aave
        _withdrawFromCompound(compoundBalance);
        _depositToAave(compoundBalance);

        // Update the user's balance in this contract
        balances[msg.sender].compoundBalance -= compoundBalance;
        balances[msg.sender].aaveBalance += compoundBalance;
    }

    function moveFundsFromAaveToCompound() private {
        // Check that the user has enough aTokens in the Aave pool
        uint256 aaveBalance = balances[msg.sender].aaveBalance;
        IAaveAToken aToken = IAaveAToken(getATokenAddress());

        require(
            aToken.balanceOf(msg.sender) >= aaveBalance,
            "YieldAggregator: Not enough balance in Aave"
        );

        // Move funds from Aave to Compound
        _withdrawFromAave(aaveBalance);
        _depositToCompound(aaveBalance);

        // Update the user's balance in this contract
        balances[msg.sender].aaveBalance -= aaveBalance;
        balances[msg.sender].compoundBalance += aaveBalance;
    }
}
