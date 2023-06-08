const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils, BigNumber } = ethers;

describe("YieldAggregator", function () {
  let YieldAggregator, yieldAggregator, MockWETH, weth;
  let owner, depositor;
  const depositAmount = utils.parseEther('1'); // 1 WETH

  beforeEach(async function () {
    [owner, depositor] = await ethers.getSigners();

    // Deploy MockWETH contract
    MockWETH = await ethers.getContractFactory("MockWETH");
    weth = await MockWETH.deploy();
    await weth.deployed();

    // Mint WETH for depositor
    await weth.connect(depositor).deposit({ value: depositAmount });

    // Deploy YieldAggregator contract
    YieldAggregator = await ethers.getContractFactory("YieldAggregator");
    yieldAggregator = await YieldAggregator.deploy();
    await yieldAggregator.deployed();
  });

  it("Should deposit correctly", async function () {
    // Mint WETH for depositor
    await weth.connect(depositor).deposit({ value: depositAmount });
  
    // Approve YieldAggregator to spend depositor's WETH
    await weth.connect(depositor).approve(yieldAggregator.address, depositAmount);
  
    // Deposit WETH into YieldAggregator
    await yieldAggregator.connect(depositor).deposit(depositAmount);
  
    // Check depositor's balance in YieldAggregator
    const balance = await yieldAggregator.balances(depositor.address);
    expect(balance).to.equal(depositAmount);
  });
  
});
