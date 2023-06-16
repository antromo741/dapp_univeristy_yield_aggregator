import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import './mainpage.css'
import contractArtifact from '../../abis/YieldAggregator.json'
import wethContractABI from '../../abis/WETH.json'
import aaveLendingPoolABI from '../../abis/AaveLendingPool.json'
import compoundCTokenABI from '../../abis/Compound.json'

const MainPage = ({ account }) => {
  // TODO Replace with your contract's address
  const yieldAggregatorAddress = '0x85495222Fd7069B987Ca38C2142732EbBFb7175D'
  const contractABI = contractArtifact.abi
  const provider = new ethers.providers.Web3Provider(window.ethereum)
  // TODO need to add to onMount so it only runs once.
  const signer = provider.getSigner()
  const contract = new ethers.Contract(
    yieldAggregatorAddress,
    contractABI,
    signer,
  )

  const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
  const cWETH_ADDRESS = '0xA17581A9E3356d9A858b789D68B4d866e593aE94'
  const AAVE_POOL_ADDRESS = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'

  const [amount, setAmount] = useState('')
  const [accountBalance, setAccountBalance] = useState(0)
  const [depositedAmount, setDepositedAmount] = useState(0)
  const [currentProtocol, setCurrentProtocol] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)
  const [aaveAPY, setAaveAPY] = useState('Loading...')
  const [compoundAPY, setCompoundAPY] = useState('Loading...')

  const handleAmountChange = (e) => {
    setAmount(e.target.value)
  }

  // Add handlers for Deposit, Rebalance, and Withdraw here
  const [depositing, setDepositing] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [rebalancing, setRebalancing] = useState(false)

  const handleDeposit = async () => {
    if (!amount) return
    const weiAmount = ethers.utils.parseEther(amount)

    // Get WETH contract
    const weth = new ethers.Contract(WETH_ADDRESS, wethContractABI, signer)

    // Get user's WETH balance
    const balance = await weth.balanceOf(account)

    // Check if balance is less than deposit amount
    if (balance.lt(weiAmount)) {
      alert('Not enough WETH balance')
      return
    }

    // Get user's WETH allowance
    const allowance = await weth.allowance(account, yieldAggregatorAddress)

    // Check if allowance is less than deposit amount
    if (allowance.lt(weiAmount)) {
      // Prompt user to approve contract
      await weth.approve(yieldAggregatorAddress, weiAmount)
    }

    // Calculate APYs
    const { aaveAPY, compoundAPY } = await calculateAPYs()

    // Determine which protocol has the highest APY
    const protocol = aaveAPY > compoundAPY ? 0 : 1

    // Deposit WETH into YieldAggregator based on the protocol with the highest APY
    try {
      if (protocol === 0) {
        await contract.depositToAave(weiAmount)
      } else {
        await contract.depositToCompound(weiAmount)
      }
      alert('Deposit successful')
    } catch (error) {
      console.error('Failed to deposit', error)
      alert('Failed to deposit. Please check the console for more details.')
    }
  }

  const handleWithdraw = async () => {
    setWithdrawing(true)
    // Get user's deposited amount
    const depositedAmount = await contract.getUserBalance(account)

    // Check if user has sufficient funds in the protocol
    if (
      depositedAmount.aaveBalance === 0 &&
      depositedAmount.compoundBalance === 0
    ) {
      alert('You have no funds to withdraw')
      return
    }

    // Withdraw from Aave if there are funds
    if (depositedAmount.aaveBalance > 0) {
      try {
        await contract.withdrawFromAave()
        alert('Withdrawal from Aave successful')
      } catch (error) {
        console.error('Failed to withdraw from Aave', error)
        alert(
          'Failed to withdraw from Aave. Please check the console for more details.',
        )
      }
    }

    // Withdraw from Compound if there are funds
    if (depositedAmount.compoundBalance > 0) {
      try {
        await contract.withdrawFromCompound()
        alert('Withdrawal from Compound successful')
      } catch (error) {
        console.error('Failed to withdraw from Compound', error)
        alert(
          'Failed to withdraw from Compound. Please check the console for more details.',
        )
      }
    }
    setWithdrawing(false)
  }

  const handleRebalance = async () => {
    setRebalancing(true)
    // Get user's deposited amount
    const depositedAmount = await contract.getUserBalance(account)

    // Check if user has sufficient funds in the protocol
    if (
      depositedAmount.aaveBalance === 0 &&
      depositedAmount.compoundBalance === 0
    ) {
      alert('You have no funds to rebalance')
      return
    }

    // Calculate APYs
    const { aaveAPY, compoundAPY } = await calculateAPYs()

    // Determine which protocol has the highest APY
    const protocol = aaveAPY > compoundAPY ? 0 : 1

    // If funds are already in the protocol with the highest APY, no need to rebalance
    if (
      (protocol === 0 && depositedAmount.aaveBalance > 0) ||
      (protocol === 1 && depositedAmount.compoundBalance > 0)
    ) {
      alert('Funds are already in the protocol with the highest APY')
      return
    }

    // Rebalance
    try {
      await contract.rebalance(protocol)
      alert('Rebalance successful')
    } catch (error) {
      console.error('Failed to rebalance', error)
      alert('Failed to rebalance. Please check the console for more details.')
    }

    setRebalancing(false)
  }

  const calculateAPYs = async () => {
    console.log('Calculating APYs...')

    // Calculate Aave APY
    // Known Aave Pool address
    const aavePoolAddress = AAVE_POOL_ADDRESS

    const aavePoolContract = new ethers.Contract(
      aavePoolAddress,
      aaveLendingPoolABI,
      signer,
    )

    // Get the reserve data
    const aaveReserveData = await aavePoolContract.getReserveData(WETH_ADDRESS)

    // Get the liquidity rate
    const aaveLiquidityRate = aaveReserveData.currentLiquidityRate / 1e27

    // Convert the liquidity rate to a percentage
    const aaveAPY = aaveLiquidityRate * 100

    console.log('Aave APY:', aaveAPY)
    setAaveAPY(aaveAPY)

    const compoundContract = new ethers.Contract(
      cWETH_ADDRESS,
      compoundCTokenABI,
      signer,
    )

    // Get the supply rate per block
    const secondsPerYear = 60 * 60 * 24 * 365
    const utilization = await compoundContract.callStatic.getUtilization()
    const supplyRate = await compoundContract.callStatic.getSupplyRate(
      utilization,
    )
    const supplyApr = (+supplyRate.toString() / 1e18) * secondsPerYear * 100
    console.log('\tJS - Supply APR', supplyApr, '%')

    setCompoundAPY(supplyApr)
    console.log('Compound APY:', compoundAPY)
    // Return APYs
    return { aaveAPY, compoundAPY }
  }

  useEffect(() => {
    calculateAPYs()
  })

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
            <button
              className="main-button"
              onClick={handleDeposit}
              disabled={depositing}
            >
              {depositing ? 'Depositing...' : 'Deposit'}
            </button>

            <button
              className="main-button"
              onClick={handleWithdraw}
              disabled={withdrawing}
            >
              {withdrawing ? 'Withdrawing...' : 'Withdraw'}
            </button>

            <button
              className="main-button"
              onClick={handleRebalance}
              disabled={rebalancing}
            >
              {rebalancing ? 'Rebalancing...' : 'Rebalance'}
            </button>
          </div>
          <div className="main-column-right">
            <p>Wallet balance: {walletBalance} WETH</p>

            <p>Current balance: {accountBalance}</p>
            <p>
              Amount deposited to the aggregator smart contract:
              {depositedAmount}
            </p>
            <p>Current protocol where funds are deposited: {currentProtocol}</p>
            <p>Aave APY: {aaveAPY} %</p>
            <p>Compound APY: {compoundAPY} %</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MainPage
