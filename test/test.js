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
});

