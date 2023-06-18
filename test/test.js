const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils, BigNumber } = ethers;

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

  it("Should rebalance from Compound to Aave when Aave has higher APY", async function () {
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


});

