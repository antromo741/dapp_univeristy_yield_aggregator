const ethers = require('ethers');

// Connect to the Ethereum mainnet via Alchemy
const provider = new ethers.providers.JsonRpcProvider('https://eth-mainnet.alchemyapi.io/v2/YOUR_ALCHEMY_PROJECT_ID');

// ABI and address for Compound cToken contract
const cTokenABI = [...];
const cTokenAddress = '...';

// ABI and address for Aave aToken contract
const aTokenABI = [...];
const aTokenAddress = '...';

// Create a contract instance
const cToken = new ethers.Contract(cTokenAddress, cTokenABI, provider);
const aToken = new ethers.Contract(aTokenAddress, aTokenABI, provider);

// ABI and address for YieldAggregator contract
const aggregatorABI = [...];
const aggregatorAddress = '...';

// Create a contract instance
const aggregator = new ethers.Contract(aggregatorAddress, aggregatorABI, provider);

// Create a signer (you need to replace 'YOUR_PRIVATE_KEY' with your actual private key)
const signer = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);

// Create a contract instance that can make transactions
const aggregatorWithSigner = aggregator.connect(signer);


async function calculateAPYs() {
    // Fetch supply rate per block from Compound contract
    const supplyRatePerBlock = await cToken.supplyRatePerBlock();

    // Calculate Compound APY
    const compoundAPY = calculateCompoundAPY(supplyRatePerBlock);

    // Fetch liquidity rate from Aave contract
    const liquidityRate = await aToken.getReserveNormalizedIncome('WETH');

    // Calculate Aave APY
    const aaveAPY = calculateAaveAPY(liquidityRate);

    return { compoundAPY, aaveAPY };
}

// For Compound APY
function calculateCompoundAPY(supplyRatePerBlock) {
    // Constants
    const blocksPerDay = 4 * 60 * 24;  // Roughly 4 blocks in a minute
    const daysPerYear = 365;

    // Convert the supply rate to a decimal
    const supplyRatePerDay = (supplyRatePerBlock / 1e18) * blocksPerDay;

    // Calculate the APY using the formula
    const compoundAPY = ((1 + supplyRatePerDay) ** daysPerYear - 1) * 100;

    return compoundAPY;
}

// For Aave APY
function calculateAaveAPY(liquidityRate) {
    // Constants
    const RAY = 1e27;
    const SECONDS_PER_YEAR = 31536000;

    // Convert the liquidity rate to a decimal
    const liquidityRateDecimal = liquidityRate / RAY;

    // Calculate the APY using the formula
    const aaveAPY = ((1 + liquidityRateDecimal / SECONDS_PER_YEAR) ** SECONDS_PER_YEAR - 1) * 100;

    return aaveAPY;
}

async function calculateAPYsAndRebalance() {
    // Calculate APYs
    const { compoundAPY, aaveAPY } = await calculateAPYs();

    // Decide which protocol to use
    const newProtocol = compoundAPY > aaveAPY ? 2 : 1;

    // Call the rebalance function
    await aggregatorWithSigner.rebalance(newProtocol);
}


calculateAPYsAndRebalance().catch(console.error);
