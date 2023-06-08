pragma solidity ^0.8.0;

// OpenZeppelin Contracts
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@aave/core-v3/contracts/protocol/tokenization/AToken.sol";

// The Aave and Compound interfaces
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "./CErc20.sol";


// Implement the Checks Effects and Interactions Method

interface IAaveV3Pool {
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

    function getReserveData(
        address asset
    )
        external
        view
        returns (
            uint256 configuration,
            uint128 liquidityIndex,
            uint128 variableBorrowIndex,
            uint128 currentLiquidityRate,
            uint128 currentVariableBorrowRate,
            uint128 currentStableBorrowRate,
            uint40 lastUpdateTimestamp,
            address aTokenAddress,
            address stableDebtTokenAddress,
            address variableDebtTokenAddress,
            address interestRateStrategyAddress,
            uint8 id
        );
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

interface IWETH is IERC20 {
    function deposit() external payable;
}

contract YieldAggregator is ReentrancyGuard, Ownable {
    // Save the addresses of the Aave and Compound contracts
    IAaveV3Pool public aavePool;
    //0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9
    ICompound public compound;
    //0xA17581A9E3356d9A858b789D68B4d866e593aE94
    uint8 public activeProtocol;
    // Save the address of the WETH token contract
    IWETH public weth;
    //0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2

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

    constructor(address _aavePool, address _compound, address _weth) {
        aavePool = IAaveV3Pool(_aavePool);
        compound = ICompound(_compound);
        weth = IWETH(_weth);
        activeProtocol = 1;
    }

    function getATokenAddress() public view returns (address) {
        (, , , , , , , , , , address aTokenAddress, ) = aavePool.getReserveData(
            address(weth)
        );

        return aTokenAddress;
    }

    function _depositToAave(uint256 amount) public {
        emit Debug("Entering _depositToAave");

        // Check if the user has enough balance to deposit
        require(
            weth.balanceOf(msg.sender) >= amount,
            "YieldAggregator: Not enough balance"
        );
        emit Debug("Passed balance check");

        // Check that the user has approved the contract to transfer the tokens
        require(
            weth.allowance(msg.sender, address(this)) >= amount,
            "YieldAggregator: Not enough allowance"
        );
        emit Debug("Passed allowance check");

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

    function _depositToCompound(uint256 amount) public {
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
        weth.transferFrom(msg.sender, address(this), amount);

        // Approve the Compound contract to spend the tokens
        weth.approve(address(compound), amount);

        // Call the mint function on the Compound contract
        uint256 mintResult = compound.mint(amount);
        require(mintResult == 0, "Mint failed");

        // Update the user's balance in this contract
        balances[msg.sender].compoundBalance += amount;

        // Emit an event
        emit Deposit(msg.sender, amount);
    }

    // Main deposit function
    function deposit(uint256 amount) public {
        // Check that the user has approved the contract to transfer the tokens
        require(
            weth.allowance(msg.sender, address(this)) >= amount,
            "YieldAggregator: Not enough allowance"
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

    function depositETH() external payable {
        // Convert the ETH to WETH
        weth.deposit{value: msg.value}();

        // Approve the transfer of WETH from this contract to the Aave or Compound pool
        weth.approve(address(aavePool), msg.value);
        weth.approve(address(compound), msg.value);

        // Now you can use the WETH in your contract
        deposit(msg.value);
    }

    function _withdrawFromAave(uint256 amount) public {
        // Get the aToken contract for the WETH token
        IAaveAToken aToken = IAaveAToken(getATokenAddress());

        // Check that the user has enough aTokens in the Aave pool
        require(
            aToken.balanceOf(msg.sender) >= amount,
            "YieldAggregator: Not enough balance in Aave"
        );

        // Withdraw the tokens from the Aave pool
        aavePool.withdraw(address(weth), amount, address(this));

        // Transfer the tokens from the contract to the user
        bool success = weth.transfer(msg.sender, amount);
        require(success, "Token transfer failed");

        // Update the user's balance in this contract
        balances[msg.sender].aaveBalance -= amount;

        // Emit a Withdraw event
        emit Withdraw(msg.sender, amount);
    }

    function _withdrawFromCompound(uint256 amount) public {
        // Check that the user has enough cTokens in the Compound pool
        require(
            compound.balanceOfUnderlying(msg.sender) >= amount,
            "YieldAggregator: Not enough balance in Compound"
        );

        // Withdraw the tokens from the Compound pool
        uint256 redeemResult = compound.redeemUnderlying(amount);
        require(redeemResult == 0, "Redeem failed");

        // Transfer the tokens from the contract to the user
        bool success = weth.transfer(msg.sender, amount);
        require(success, "Token transfer failed");

        // Update the user's balance in this contract
        balances[msg.sender].compoundBalance -= amount;

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

    // Additional functions to get interest rates, handle liquidations, etc.
}
