const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils, BigNumber } = ethers;

describe("YieldAggregator", function () {
  let YieldAggregator, yieldAggregator;
  let owner, depositor;
  const depositAmount = utils.parseEther('1'); // 1 WETH
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // Mainnet WETH address

  beforeEach(async function () {
    [owner, depositor] = await ethers.getSigners();

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

  it("Should deposit correctly", async function () {
    // Deposit WETH into YieldAggregator
    // Deposit ETH into YieldAggregator
    await yieldAggregator.connect(depositor).deposit({ value: depositAmount });


    // Check depositor's balance in YieldAggregator
    const balance = await yieldAggregator.balances(depositor.address);
    expect(balance.aaveBalance).to.equal(depositAmount);
  });
});
