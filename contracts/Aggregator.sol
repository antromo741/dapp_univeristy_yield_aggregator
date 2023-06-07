pragma solidity ^0.8.0;

// OpenZeppelin Contracts
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// The Aave and Compound interfaces
import "https://github.com/aave/aave-v3-core/blob/master/contracts/interfaces/IPool.sol";
import "https://github.com/Compound-finance/compound-protocol/blob/master/contracts/CErc20.sol";

// Implement the Checks Effects and Interactions Method

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

contract YieldAggregator is ReentrancyGuard {
    // Save the addresses of the Aave and Compound contracts
    IAaveV3Pool public aavePool;
    ICompound public compound;
    uint8 public activeProtocol;
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
    function deposit(uint amount) public {
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

    function _withdrawFromAave(uint amount) public {
        // Check that the user has enough aTokens in the Aave pool
        require(
            aavePool.balanceOf(msg.sender) >= amount,
            "YieldAggregator: Not enough balance in Aave"
        );

        // Withdraw the tokens from the Aave pool
        uint256 result = aavePool.withdraw(
            address(weth),
            amount,
            address(this)
        );
        require(result == 0, "Withdrawal from Aave failed");

        // Transfer the tokens from the contract to the user
        bool success = weth.transfer(msg.sender, amount);
        require(success, "Token transfer failed");

        // Update the user's balance in this contract
        balances[msg.sender].aaveBalance -= amount;

        // Emit a Withdraw event
        emit Withdraw(msg.sender, amount);
    }

    function _withdrawFromCompound(uint amount) public {
        // Check that the user has enough cTokens in the Compound pool
        require(
            compound.balanceOfUnderlying(msg.sender) >= amount,
            "YieldAggregator: Not enough balance in Compound"
        );

        // Withdraw the tokens from the Compound pool
        uint redeemResult = compound.redeemUnderlying(amount);
        require(redeemResult == 0, "Redeem failed");

        // Transfer the tokens from the contract to the user
        bool success = weth.transfer(msg.sender, amount);
        require(success, "Token transfer failed");

        // Update the user's balance in this contract
        balances[msg.sender].compoundBalance -= amount;

        // Emit a Withdraw event
        emit Withdraw(msg.sender, amount);
    }

    function withdraw(uint amount) public nonReentrant {
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
    function rebalance() public {
        // Get APYs from off-chain
        uint8 newProtocol = getAPYs();

        // Rebalance based on the new protocol
        if (newProtocol != activeProtocol) {
            if (newProtocol == 1) {
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
            } else if (newProtocol == 2) {
                // Check that the user has enough aTokens in the Aave pool
                uint256 aaveBalance = balances[msg.sender].aaveBalance;
                require(
                    aavePool.balanceOf(msg.sender) >= aaveBalance,
                    "YieldAggregator: Not enough balance in Aave"
                );

                // Move funds from Aave to Compound
                _withdrawFromAave(aaveBalance);
                _depositToCompound(aaveBalance);

                // Update the user's balance in this contract
                balances[msg.sender].aaveBalance -= aaveBalance;
                balances[msg.sender].compoundBalance += aaveBalance;
            } else {
                revert("YieldAggregator: Invalid protocol");
            }

            // Update the active protocol
            activeProtocol = newProtocol;
        }
    }

    // Additional functions to get interest rates, handle liquidations, etc.
}
