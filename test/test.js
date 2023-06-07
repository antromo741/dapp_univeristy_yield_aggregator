const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("YieldAggregator", function () {
  let YieldAggregator;
  let yieldAggregator;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  beforeEach(async function () {
    YieldAggregator = await ethers.getContractFactory("YieldAggregator");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    yieldAggregator = await YieldAggregator.deploy();
  });

  describe("Deposit", function () {
    it("Should deposit the correct amount", async function () {
      // We'll use addr1 as the depositor for this test
      const depositor = addr1;

      // The amount to deposit (in wei)
      const depositAmount = ethers.utils.parseEther("1.0"); // 1 ether

      // We need to send the deposit transaction from the depositor's account
      await yieldAggregator.connect(depositor).deposit(depositAmount);

      // After the deposit, the balance of the contract should be increased by the deposit amount
      const balance = await ethers.provider.getBalance(yieldAggregator.address);
      expect(balance).to.equal(depositAmount);
    });
  });
});
