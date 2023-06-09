const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils, BigNumber } = ethers;

describe("YieldAggregator", function () {
  let YieldAggregator, yieldAggregator;
  let owner, depositor;
  const depositAmount = ethers.utils.parseEther("0.1");

  // 1 WETH
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

    // Fund the owner account with a larger amount of Ether
    const ownerAddress = await owner.getAddress();
    await ethers.provider.send("eth_sendTransaction", [
      {
        to: ownerAddress,
        from: depositor.address,
        value: ethers.utils.parseEther("10").toHexString() // Adjust the amount as needed
      }
    ]);

    // Approve YieldAggregator to spend depositor's WETH
    await weth.connect(depositor).approve(yieldAggregator.address, depositAmount);
  });

  it("Should deposit correctly", async function () {
    // Deposit WETH into YieldAggregator
    await yieldAggregator.connect(depositor).deposit({ value: depositAmount });

    // Check depositor's balance in YieldAggregator
    const balance = await yieldAggregator.balances(depositor.address);
    expect(balance.aaveBalance).to.equal(depositAmount);
  });
  
  it("Should deposit correctly into Aave", async function () {
    // Set active protocol to Aave
    await yieldAggregator.rebalance(1);

    // Deposit ETH into YieldAggregator
    await yieldAggregator.connect(depositor).deposit(depositAmount, { value: depositAmount });

    // Check depositor's balance in YieldAggregator
    const balance = await yieldAggregator.balances(depositor.address);
    expect(balance.aaveBalance).to.equal(depositAmount);
    expect(balance.compoundBalance).to.equal(0);
  });

  it("Should deposit correctly into Compound", async function () {
    // Set active protocol to Compound
    await yieldAggregator.rebalance(2);

    // Deposit ETH into YieldAggregator
    await yieldAggregator.connect(depositor).deposit(depositAmount, { value: depositAmount });

    // Check depositor's balance in YieldAggregator
    const balance = await yieldAggregator.balances(depositor.address);
    expect(balance.compoundBalance).to.equal(depositAmount);
    expect(balance.aaveBalance).to.equal(0);
  });

  it("Should withdraw correctly", async function () {
    // Deposit WETH into YieldAggregator
    await yieldAggregator.connect(depositor).deposit({ value: depositAmount });

    // Get balance before withdrawal
    const balanceBefore = await ethers.provider.getBalance(depositor.address);
    console.log("Balance before withdrawal:", balanceBefore.toString());

    // Withdraw WETH from YieldAggregator
    try {
      await yieldAggregator.connect(depositor).withdraw(depositAmount, { gasLimit: 3000000 });
    } catch (error) {
      console.error("Withdrawal error:", error);
      console.log("Transaction hash:", error.transactionHash);
    }


    // Get balance after withdrawal
    const balanceAfter = await ethers.provider.getBalance(depositor.address);
    console.log("Balance after withdrawal:", balanceAfter.toString());

    // Check depositor's balance in YieldAggregator
    const balance = await yieldAggregator.balances(depositor.address);
    console.log("Depositor's balance in YieldAggregator:", balance.aaveBalance.toString());

    // Expect the balance in YieldAggregator to be 0 after withdrawal
    expect(balance.aaveBalance).to.equal(0);

    // Expect the balance after withdrawal to be greater than the balance before withdrawal
    expect(balanceAfter).to.be.gt(balanceBefore);
  });




});
