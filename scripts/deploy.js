const hre = require("hardhat");

async function main() {
  const YieldAggregator = await hre.ethers.getContractFactory("YieldAggregator");
  const yieldAggregator = await YieldAggregator.deploy();

  await yieldAggregator.deployed();

  console.log(`Yield Aggregator deployed to ${yieldAggregator.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
