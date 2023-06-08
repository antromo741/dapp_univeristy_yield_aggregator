const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("YieldAggregator", function () {
  let accounts;
  let yieldAggregator;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    const YieldAggregator = await ethers.getContractFactory("YieldAggregator");

    // To deploy our contract, we just have to call YieldAggregator.deploy() and await
    // for it to be deployed(), which happens onces its transaction has been mined.
    yieldAggregator = await YieldAggregator.deploy();

    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
  });

  // You can nest describe calls to create subsections.
  describe("Deposit", function () {
    it("Should deposit ETH", async function () {
      // We'll use one of our Signers (owner) to send the transaction.
      const depositTx = await yieldAggregator.connect(owner).depositETH({
        value: ethers.utils.parseEther("1.0"), // Sends along 1 ETH.
      });

      // Wait for the transaction to be mined, and get the transaction receipt.
      const depositTxReceipt = await depositTx.wait();

      // Check that the contract's balance has been increased.
      const contractBalance = await ethers.provider.getBalance(yieldAggregator.address);
      expect(ethers.utils.formatEther(contractBalance)).to.equal("1.0");
    });
  });
});
