import React, { useState, useEffect, useMemo } from 'react'
import { ethers } from 'ethers'
import './mainpage.css'
//import contractABI from '../path/to/your/contractABI.json'

// ABI and address for Compound cToken contract
const cTokenABI = [1234]
const cTokenAddress = '1234'

// ABI and address for Aave aToken contract
const aTokenABI = [1234]
const aTokenAddress = '1234'

// ABI and address for YieldAggregator contract
const aggregatorABI = [1234]
const aggregatorAddress = '1234'

// ABI and address for Aave LendingPool contract
const lendingPoolABI = [1234] // replace with actual ABI
const lendingPoolAddress = '1234' // replace with actual address

// Create a new instance of the contract
const lendingPool = useMemo(
  () => new ethers.Contract(lendingPoolAddress, lendingPoolABI, provider),
  [provider],
)


const MainPage = ({ account }) => {
  const provider = useMemo(
    () => new ethers.providers.Web3Provider(window.ethereum),
    [],
  )

  const contract = useMemo(
    () => new ethers.Contract(aggregatorAddress, aggregatorABI, provider),
    [provider],
  )

  const cToken = useMemo(
    () => new ethers.Contract(cTokenAddress, cTokenABI, provider),
    [provider],
  )
  const aToken = useMemo(
    () => new ethers.Contract(aTokenAddress, aTokenABI, provider),
    [provider],
  )

  const [amount, setAmount] = useState('')
  const [accountBalance, setAccountBalance] = useState(0)
  const [depositedAmount, setDepositedAmount] = useState(0)
  const [currentProtocol, setCurrentProtocol] = useState('')
  const [compoundAPY, setCompoundAPY] = useState(0)
  const [aaveAPY, setAaveAPY] = useState(0)

  const handleAmountChange = (e) => {
    setAmount(e.target.value)
  }

  useEffect(() => {
    const fetchDepositedAmount = async () => {
      const depositedAmount = await contract.depositedAmount(account)
      setDepositedAmount(ethers.utils.formatEther(depositedAmount))
    }

    fetchDepositedAmount()
  }, [account, contract])

  useEffect(() => {
    const fetchUserData = async () => {
      // Get the signer
      const signer = provider.getSigner()

      // Get the user's address
      const address = await signer.getAddress()

      // Connect to the contract with the signer
      const contractWithSigner = contract.connect(signer)

      // Fetch the user's balance
      const balance = await provider.getBalance(address)
      setAccountBalance(ethers.utils.formatEther(balance))

      // Fetch the user's deposited amount
      const depositedAmount = await contractWithSigner.getDepositedAmount(
        address,
      )
      setDepositedAmount(ethers.utils.formatEther(depositedAmount))

      // Fetch the current protocol
      const protocol = await contractWithSigner.getCurrentProtocol()
      setCurrentProtocol(protocol === 1 ? 'Aave' : 'Compound')
    }

    fetchUserData()
  }, [amount, provider, contract])

  // Add handlers for Deposit, Rebalance, and Withdraw here

  useEffect(() => {
    const calculateAPYs = async () => {
      const supplyRatePerBlock = await cToken.supplyRatePerBlock()
      const compoundAPY = calculateCompoundAPY(supplyRatePerBlock)
      setCompoundAPY(compoundAPY)

      const liquidityRate = await aToken.getReserveNormalizedIncome('WETH')
      const aaveAPY = calculateAaveAPY(liquidityRate)
      setAaveAPY(aaveAPY)
    }

    calculateAPYs()
  }, [aToken, cToken])

  const calculateCompoundAPY = (supplyRatePerBlock) => {
    const blocksPerDay = 4 * 60 * 24 // Roughly 4 blocks in a minute
    const daysPerYear = 365
    const supplyRatePerDay = (supplyRatePerBlock / 1e18) * blocksPerDay
    const compoundAPY = ((1 + supplyRatePerDay) ** daysPerYear - 1) * 100
    return compoundAPY
  }

  const calculateAaveAPY = (liquidityRate) => {
    const RAY = 1e27
    const SECONDS_PER_YEAR = 31536000
    const liquidityRateDecimal = liquidityRate / RAY
    const aaveAPY =
      ((1 + liquidityRateDecimal / SECONDS_PER_YEAR) ** SECONDS_PER_YEAR - 1) *
      100
    return aaveAPY
  }

  const handleDeposit = async () => {
    // Get the signer
    const signer = provider.getSigner()

    // Connect to the contract with the signer
    const contractWithSigner = contract.connect(signer)

    // Call the deposit function
    const tx = await contractWithSigner.deposit(ethers.utils.parseEther(amount))

    // Wait for the transaction to be mined
    const receipt = await tx.wait()

    // Log the transaction receipt
    console.log(receipt)
  }

  const handleWithdraw = async () => {
    // Get the signer
    const signer = provider.getSigner()

    // Connect to the contract with the signer
    const contractWithSigner = contract.connect(signer)

    // Call the withdraw function
    const tx = await contractWithSigner.withdraw(
      ethers.utils.parseEther(amount),
    )

    // Wait for the transaction to be mined
    const receipt = await tx.wait()

    // Log the transaction receipt
    console.log(receipt)
  }

  const handleRebalance = async () => {
    const signer = provider.getSigner()
    const contractWithSigner = contract.connect(signer)
    const newProtocol = compoundAPY > aaveAPY ? 2 : 1
    const tx = await contractWithSigner.rebalance(newProtocol)
    const receipt = await tx.wait()
    console.log(receipt)
  }

  return (
    <div>
      <h1>Yield Aggregator</h1>
      <div className="main-container">
        <div className="main-row">
          <div className="main-column-left">
            <input
              type="text"
              value={amount}
              onChange={handleAmountChange}
              placeholder="Enter amount to deposit"
            />
            <button className="main-button" onClick={handleDeposit}>
              Deposit
            </button>
            <button className="main-button" onClick={handleRebalance}>
              Rebalance
            </button>
            <button className="main-button" onClick={handleWithdraw}>
              Withdraw
            </button>
          </div>
          <div className="main-column-right">
            <p>Current balance: {accountBalance}</p>
            <p>
              Amount deposited to the aggregator smart contract:
              {depositedAmount}
            </p>
            <p>Current protocol where funds are deposited: {currentProtocol}</p>
            <p>Compound APY: {compoundAPY}</p>
            <p>Aave APY: {aaveAPY}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MainPage
