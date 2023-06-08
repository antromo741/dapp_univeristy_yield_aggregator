
require("@nomicfoundation/hardhat-toolbox")
require("dotenv").config()
const privateKeys = process.env.PRIVATE_KEYS || ""

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.10",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      forking: {
        url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      }
    }
  }
};
