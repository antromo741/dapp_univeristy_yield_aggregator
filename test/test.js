const aaveLendingPoolABI = require('./abis/AaveLendingPool.json');
const compoundCTokenABI = require('./abis/Compound.json');


const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
const cWETH_ADDRESS = '0xA17581A9E3356d9A858b789D68B4d866e593aE94'
const AAVE_POOL_ADDRESS = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils, BigNumber } = ethers;


async function calculateAPYs(signer) {
  console.log('Calculating APYs...')

  // Calculate Aave APY
  // Known Aave Pool address
  const aavePoolAddress = AAVE_POOL_ADDRESS

  const aavePoolContract = new ethers.Contract(
    aavePoolAddress,
    aaveLendingPoolABI,
    signer,
  )

  // Get the reserve data
  const aaveReserveData = await aavePoolContract.getReserveData(WETH_ADDRESS)

  // Get the liquidity rate
  const aaveLiquidityRate = aaveReserveData.currentLiquidityRate / 1e27

  // Convert the liquidity rate to a percentage
  const aaveAPY = aaveLiquidityRate * 100

  console.log('Aave APY:', aaveAPY)

  const compoundContract = new ethers.Contract(
    cWETH_ADDRESS,
    compoundCTokenABI,
    signer,
  )

  // Get the supply rate per block
  const secondsPerYear = 60 * 60 * 24 * 365
  const utilization = await compoundContract.callStatic.getUtilization()
  const supplyRate = await compoundContract.callStatic.getSupplyRate(
    utilization,
  )
  const compoundAPY = (+supplyRate.toString() / 1e18) * secondsPerYear * 100
  console.log('Compound APY:', compoundAPY)

  // Return APYs
  return { aaveAPY, compoundAPY }
}


describe("YieldAggregator", function () {
  let YieldAggregator, yieldAggregator;
  let depositor;
  const depositAmount = ethers.utils.parseEther("1.0"); // 1 WETH

  // Mainnet WETH address
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

  beforeEach(async function () {
    [depositor] = await ethers.getSigners();

    // Get WETH contract
    const weth = await ethers.getContractAt("IERC20", WETH_ADDRESS);

    // Deploy YieldAggregator contract
    YieldAggregator = await ethers.getContractFactory("YieldAggregator");
    yieldAggregator = await YieldAggregator.deploy();
    await yieldAggregator.deployed();

    // Wrap ETH to WETH for depositor
    await depositor.sendTransaction({
      to: WETH_ADDRESS,
      value: depositAmount
    });

    // Approve YieldAggregator to spend depositor's WETH
    await weth.connect(depositor).approve(yieldAggregator.address, depositAmount);
  });

  it("Should deposit correctly to Aave", async function () {
    // Deposit WETH into YieldAggregator
    await yieldAggregator.connect(depositor).deposit(depositAmount, 0); // 0 represents Aave

    // Check depositor's balance in YieldAggregator
    const balance = await yieldAggregator.balances(depositor.address);
    expect(balance.aaveBalance).to.equal(depositAmount);
  });

  it("Should deposit to Compound correctly", async function () {
    // Call the deposit function with protocol set to 1 (Compound)
    await yieldAggregator.connect(depositor).deposit(depositAmount, 1);

    // Check depositor's balance in YieldAggregator
    const balance = await yieldAggregator.balances(depositor.address);
    expect(balance.compoundBalance).to.equal(depositAmount);
  });

  it("Should withdraw the entire balance from Aave", async function () {
    // Deposit WETH into YieldAggregator first
    // 0 represents Aave
    await yieldAggregator.connect(depositor).deposit(depositAmount, 0);

    // Get WETH contract
    const weth = await ethers.getContractAt("IERC20", WETH_ADDRESS);

    // Get depositor's WETH balance before withdrawal
    const beforeWithdrawBalance = await weth.balanceOf(depositor.address);

    // Withdraw entire balance from YieldAggregator
    await yieldAggregator.connect(depositor).withdraw();

    // Check depositor's balance in YieldAggregator
    const balance = await yieldAggregator.balances(depositor.address);
    expect(balance.aaveBalance).to.equal(0); // All WETH has been withdrawn from Aave

    // Check depositor's WETH balance after withdrawal
    const afterWithdrawBalance = await weth.balanceOf(depositor.address);
    expect(afterWithdrawBalance).to.be.gt(beforeWithdrawBalance); // Balance should have increased after withdrawal
  });

  it("Should withdraw the entire balance from Compound", async function () {
    // Deposit WETH into YieldAggregator first
    // 1 represents Compound
    await yieldAggregator.connect(depositor).deposit(depositAmount, 1);

    // Get WETH contract
    const weth = await ethers.getContractAt("IERC20", WETH_ADDRESS);

    // Get depositor's WETH balance before withdrawal
    const beforeWithdrawBalance = await weth.balanceOf(depositor.address);

    // Withdraw entire balance from YieldAggregator
    await yieldAggregator.connect(depositor).withdraw();

    // Check depositor's balance in YieldAggregator
    const balance = await yieldAggregator.balances(depositor.address);
    expect(balance.compoundBalance).to.equal(0); // All WETH has been withdrawn from Compound

    // Check depositor's WETH balance after withdrawal
    const afterWithdrawBalance = await weth.balanceOf(depositor.address);
    expect(afterWithdrawBalance).to.be.gt(beforeWithdrawBalance); // Balance should have increased after withdrawal
  });


  it("Should rebalance from Aave to Compound", async function () {
    // Deposit WETH into YieldAggregator (Aave)
    // 0 represents Aave
    await yieldAggregator.connect(depositor).deposit(depositAmount, 0);

    // Check depositor's balance in YieldAggregator
    let balance = await yieldAggregator.balances(depositor.address);
    expect(balance.aaveBalance).to.equal(depositAmount);

    // Rebalance from Aave to Compound
    // 1 represents Compound
    await yieldAggregator.connect(depositor).rebalance(1);

    // Check user's balances after rebalance
    balance = await yieldAggregator.balances(depositor.address);
    expect(balance.aaveBalance).to.equal(0); // All funds should have moved from Aave to Compound
    expect(balance.compoundBalance).to.be.gt(depositAmount); // Compound balance should be at least the deposit amount
    expect(balance.contractBalance).to.equal(0); // Contract balance should be 0 after rebalance
  });

  it("Should rebalance from Compound to Aave", async function () {
    // Deposit WETH into YieldAggregator (Compound)
    // 1 represents Compound
    await yieldAggregator.connect(depositor).deposit(depositAmount, 1);

    // Check depositor's balance in YieldAggregator
    let balance = await yieldAggregator.balances(depositor.address);
    expect(balance.compoundBalance).to.equal(depositAmount);

    // Rebalance from Compound to Aave
    // 0 represents Aave
    await yieldAggregator.connect(depositor).rebalance(0);

    // Check user's balances after rebalance
    balance = await yieldAggregator.balances(depositor.address);
    expect(balance.compoundBalance).to.equal(0); // All funds should have moved from Compound to Aave
    expect(balance.aaveBalance).to.be.gt(depositAmount); // Aave balance should be at least the deposit amount
    expect(balance.contractBalance).to.equal(0); // Contract balance should be 0 after rebalance
  });


  it("Should deposit correctly to Aave after checking APY", async function () {
    // Get APYs
    const { aaveAPY, compoundAPY } = await calculateAPYs(depositor);

    // Determine which protocol has the highest APY
    const protocol = aaveAPY > compoundAPY ? 0 : 1

    // Deposit WETH into YieldAggregator
    await yieldAggregator.connect(depositor).deposit(depositAmount, protocol);

    // Check depositor's balance in YieldAggregator
    const balance = await yieldAggregator.balances(depositor.address);
    expect(balance.aaveBalance).to.equal(depositAmount);
  });

  it("Should rebalance from Compound to Aave after checking the APYs", async function () {
    // Deposit WETH into YieldAggregator (Aave)
    // 0 represents Aave
    await yieldAggregator.connect(depositor).deposit(depositAmount, 1);

    // Check depositor's balance in YieldAggregator
    let balance = await yieldAggregator.balances(depositor.address);
    expect(balance.compoundBalance).to.equal(depositAmount);

    // Calculate APYs
    const { aaveAPY, compoundAPY } = await calculateAPYs(depositor);

    // Determine which protocol has the highest APY
    const protocol = aaveAPY > compoundAPY ? 0 : 1

    // Rebalance from Aave to Compound
    await yieldAggregator.connect(depositor).rebalance(protocol);

    // Check user's balances after rebalance
    balance = await yieldAggregator.balances(depositor.address);
    expect(balance.compoundBalance).to.equal(0); 
    expect(balance.aaveBalance).to.be.gt(depositAmount); 
    expect(balance.contractBalance).to.equal(0); 
  });

  it("Should fail because funds are in the highest apy protocol", async function () {
    // Deposit WETH into YieldAggregator (Aave)
    // 0 represents Aave
    await yieldAggregator.connect(depositor).deposit(depositAmount, 0);

    // Check depositor's balance in YieldAggregator
    let balance = await yieldAggregator.balances(depositor.address);
    expect(balance.aaveBalance).to.equal(depositAmount);

    // Calculate APYs
    const { aaveAPY, compoundAPY } = await calculateAPYs(depositor);

    // Determine which protocol has the highest APY
    const protocol = aaveAPY > compoundAPY ? 0 : 1

    // Rebalance from Aave to Compound
    await expect(yieldAggregator.connect(depositor).rebalance(protocol)).to.be.revertedWith("YieldAggregator: Funds are already in the highest APY protocol");
  });


});

