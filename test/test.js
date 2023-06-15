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
    await yieldAggregator.connect(depositor).depositToAave(depositAmount);

    // Check depositor's balance in YieldAggregator
    const balance = await yieldAggregator.balances(depositor.address);
    expect(balance.aaveBalance).to.equal(depositAmount);
  });

  it("Should withdraw the entire balance from Aave", async function () {
    // Deposit WETH into YieldAggregator first
    await yieldAggregator.connect(depositor).depositToAave(depositAmount);

    // Get WETH contract
    const weth = await ethers.getContractAt("IERC20", WETH_ADDRESS);

    // Get depositor's WETH balance before withdrawal
    const beforeWithdrawBalance = await weth.balanceOf(depositor.address);

    // Get depositor's balance in YieldAggregator
    const aaveBalance = (await yieldAggregator.balances(depositor.address)).aaveBalance;

    // Withdraw entire balance from YieldAggregator
    await yieldAggregator.connect(depositor).withdrawFromAave(aaveBalance);

    // Check depositor's balance in YieldAggregator
    const balance = await yieldAggregator.balances(depositor.address);
    expect(balance.aaveBalance).to.equal(0); // All WETH has been withdrawn

    // Check depositor's WETH balance after withdrawal
    const afterWithdrawBalance = await weth.balanceOf(depositor.address);
    expect(afterWithdrawBalance).to.equal(beforeWithdrawBalance.add(aaveBalance));
  });

  it("Should deposit to Compound correctly", async function () {
    // Call the depositToCompound function
    await yieldAggregator.connect(depositor).depositToCompound(depositAmount);

    // Check depositor's balance in YieldAggregator
    const balance = await yieldAggregator.balances(depositor.address);
    expect(balance.compoundBalance).to.equal(depositAmount);
  });

  it("Should withdraw the entire balance from Compound", async function () {
    // Deposit WETH into YieldAggregator first
    await yieldAggregator.connect(depositor).depositToCompound(depositAmount);

    // Get WETH contract
    const weth = await ethers.getContractAt("IERC20", WETH_ADDRESS);

    // Get depositor's WETH balance before withdrawal
    const beforeWithdrawBalance = await weth.balanceOf(depositor.address);

    // Get depositor's balance in YieldAggregator
    const compoundBalance = (await yieldAggregator.balances(depositor.address)).compoundBalance;

    // Withdraw entire balance from YieldAggregator
    await yieldAggregator.connect(depositor).withdrawFromCompound(compoundBalance);

    // Check depositor's balance in YieldAggregator
    const balance = await yieldAggregator.balances(depositor.address);
    expect(balance.compoundBalance).to.equal(0); // All WETH has been withdrawn

    // Check depositor's WETH balance after withdrawal
    const afterWithdrawBalance = await weth.balanceOf(depositor.address);
    expect(afterWithdrawBalance).to.equal(beforeWithdrawBalance.add(compoundBalance));
  });

  it("Should rebalance from Aave to Compound", async function () {
    console.log("start rebalance");

    // User deposits 1 WETH into Aave
    await yieldAggregator.connect(depositor).depositToAave(depositAmount);
    console.log("Just deposited to aave");

    // Check depositor's balance in YieldAggregator
    let balance = await yieldAggregator.balances(depositor.address);
    console.log("Just got balance", balance);
    expect(balance.aaveBalance).to.equal(depositAmount);
    console.log("Just got aave balance", balance.aaveBalance);
    
    // Check user's Aave balance
    /* let aaveBalance = await yieldAggregator.balances(depositor.address).aaveBalance;
    console.log("Just got balance", aaveBalance);

    expect(aaveBalance).to.equal(depositAmount);
    console.log("Just checked balance"); */

    // Rebalance from Aave to Compound
    await yieldAggregator.connect(depositor).rebalance(0); // 0 represents Compound
    console.log("Started rebalance", balance.aaveBalance);

    // Check user's balances after rebalance
    balance = await yieldAggregator.balances(depositor.address).aaveBalance;
    let compoundBalance = await yieldAggregator.balances(depositor.address).compoundBalance;

    expect(balance.aaveBalance).to.equal(0); // All funds should have moved from Aave to Compound
    expect(balance.compoundBalance).to.equal(depositAmount); // All funds should now be in Compound
  });


});

