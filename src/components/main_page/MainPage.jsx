import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ethers } from 'ethers'
import './mainpage.css'
import contractArtifact from '../../abis/YieldAggregator.json'
import wethContractABI from '../../abis/WETH.json'
import aaveLendingPoolABI from '../../abis/AaveLendingPool.json'
import compoundCTokenABI from '../../abis/Compound.json'

const MainPage = ({ account }) => {
  const yieldAggregatorAddress = '0x021DBfF4A864Aa25c51F0ad2Cd73266Fde66199d'
  const contractABI = contractArtifact.abi
  const provider = new ethers.providers.Web3Provider(window.ethereum)

  const signer = provider.getSigner()
  const contract = new ethers.Contract(
    yieldAggregatorAddress,
    contractABI,
    signer,
  )
  // Contract Address'
  const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
  const cWETH_ADDRESS = '0xA17581A9E3356d9A858b789D68B4d866e593aE94'
  const AAVE_POOL_ADDRESS = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'

  const [amount, setAmount] = useState('')
  const [currentProtocol, setCurrentProtocol] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)
  const [aaveAPY, setAaveAPY] = useState('Loading...')
  const [compoundAPY, setCompoundAPY] = useState('Loading...')
  const [depositedAmount, setDepositedAmount] = useState({
    compoundBalance: ethers.BigNumber.from(0),
    aaveBalance: ethers.BigNumber.from(0),
    interestEarned: ethers.BigNumber.from(0),
    contractBalance: ethers.BigNumber.from(0),
  })

  const handleAmountChange = (e) => {
    setAmount(e.target.value)
  }

  const fetchUserBalance = async () => {
    try {
      const userBalance = await contract.callStatic.getUserBalance(account)
      if (userBalance) {
        setDepositedAmount(userBalance)
      } else {
        setDepositedAmount({
          compoundBalance: ethers.BigNumber.from(0),
          aaveBalance: ethers.BigNumber.from(0),
          interestEarned: ethers.BigNumber.from(0),
          contractBalance: ethers.BigNumber.from(0),
        })
      }
    } catch (error) {
      console.error('Failed to fetch user balance', error)
    }
  }

  useEffect(() => {
    fetchUserBalance()
    calculateAPYs()
    fetchWalletBalance()
  }, [])

  const fetchWalletBalance = async () => {
    const weth = new ethers.Contract(WETH_ADDRESS, wethContractABI, signer)
    const balance = await weth.balanceOf(account)
    setWalletBalance(ethers.utils.formatEther(balance))
  }

  const updateCurrentProtocol = useCallback(async () => {
    if (depositedAmount.aaveBalance.gt(depositedAmount.compoundBalance)) {
      setCurrentProtocol('Aave')
    } else if (
      depositedAmount.compoundBalance.gt(depositedAmount.aaveBalance)
    ) {
      setCurrentProtocol('Compound')
    } else {
      setCurrentProtocol('None')
    }
  }, [depositedAmount.aaveBalance, depositedAmount.compoundBalance])

  useEffect(() => {
    updateCurrentProtocol()
  }, [depositedAmount, updateCurrentProtocol])

  // Handlers for Deposit, Rebalance, and Withdraw here
  const [depositing, setDepositing] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [rebalancing, setRebalancing] = useState(false)

  const handleDeposit = async () => {
    setDepositing(true)
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      alert('Please enter a positive number')
      setDepositing(false)
      return
    }
    const weiAmount = ethers.utils.parseEther(amount)

    // Get WETH contract
    const weth = new ethers.Contract(WETH_ADDRESS, wethContractABI, signer)

    // Get user's WETH balance
    const balance = await weth.balanceOf(account)
    // Check if balance is less than deposit amount
    if (balance.lt(weiAmount)) {
      alert('Not enough WETH balance')
      setDepositing(false)
      return
    }

    // Get user's WETH allowance
    const allowance = await weth.allowance(account, yieldAggregatorAddress)

    try {
      // Check if allowance is less than deposit amount
      if (allowance.lt(weiAmount)) {
        // Prompt user to approve contract
        await weth.approve(yieldAggregatorAddress, weiAmount)
      }

      // Removed the transferFrom call here
    } catch (error) {
      console.error('Failed to approve', error)
      alert('Failed to approve. Please check the console for more details.')
      return
    }
    // Determine which protocol has the highest APY
    const protocol = aaveAPY > compoundAPY ? 0 : 1

    // Deposit WETH into YieldAggregator based on the protocol with the highest APY
    try {
      const tx = await contract.deposit(weiAmount, protocol, {
        gasLimit: 5000000,
      })
      await tx.wait() // Wait for the transaction to be confirmed

      alert('Deposit successful')

      // Fetch user balance and wallet balance
      fetchUserBalance()
      fetchWalletBalance()

      setDepositing(false)
    } catch (error) {
      console.error('Failed to deposit', error)
      alert('Failed to deposit. Please check the console for more details.')
      setDepositing(false)
    }
  }

  const handleWithdraw = async () => {
    setWithdrawing(true)
    // Get user's deposited amount
    console.log('user account', account)
    const depositedAmount = await contract.getUserBalance(account)

    // Check if user has sufficient funds in the protocol
    if (
      ethers.utils.formatEther(depositedAmount.aaveBalance) === '0' &&
      ethers.utils.formatEther(depositedAmount.compoundBalance) === '0'
    ) {
      alert('You have no funds to withdraw')
      setWithdrawing(false)
      return
    }

    // Withdraw from the protocol
    try {
      const tx = await contract.withdraw({ gasLimit: 5000000 })
      await tx.wait() // Wait for the transaction to be confirmed

      alert('Withdrawal successful')

      // Fetch user balance and wallet balance
      fetchUserBalance()

      setWithdrawing(false)
    } catch (error) {
      console.error('Failed to withdraw', error)
      alert('Failed to withdraw. Please deposit funds before you withdraw.')
      setWithdrawing(false)
    }

    try {
      // Transfer WETH back to user's account
      const weth = new ethers.Contract(WETH_ADDRESS, wethContractABI, signer)
      const contractBalance = await weth.balanceOf(yieldAggregatorAddress)
      if (contractBalance.gt(0)) {
        await weth.transfer(account, contractBalance)
        alert('WETH has been transferred back to your account')
        fetchWalletBalance()
        setWithdrawing(false)
      }
    } catch (error) {
      console.error('Failed to transfer WETH back to user', error)
      alert(
        'Failed to transfer WETH back to your account. Please check the console for more details.',
      )
      fetchWalletBalance()
    }
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
      setRebalancing(false)
      return
    }

    // Calculate APYs
    const { aaveAPY, compoundAPY } = await calculateAPYs()

    // Determine which protocol has the highest APY
    const protocol = aaveAPY > compoundAPY ? 0 : 1

    // If funds are already in the protocol with the highest APY, no need to rebalance
    if (
      (protocol === 0 &&
        ethers.utils.formatEther(depositedAmount.aaveBalance) !== '0') ||
      (protocol === 1 &&
        ethers.utils.formatEther(depositedAmount.compoundBalance) !== '0')
    ) {
      alert('Funds are already in the protocol with the highest APY')
      setRebalancing(false)
      return
    }

    // Rebalance
    try {
      await contract.rebalance(protocol, { gasLimit: 500000 })
      alert('Rebalance successful')
      fetchUserBalance()
      setRebalancing(false)
    } catch (error) {
      console.error('Failed to rebalance', error)
      alert('Failed to rebalance. Please check the console for more details.')
      setRebalancing(false)
    }
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

  return (
    <div>
      <h1>Yield Aggregator</h1>
      <div className="main-container">
        <div className="main-row">
          <div className="main-column-left">
            <input
              type="number"
              min="0"
              step="0.01"
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

            <p>Current protocol where funds are deposited: {currentProtocol}</p>
            <p>Aave APY: {parseFloat(aaveAPY).toFixed(2)} %</p>
            <p>Compound APY: {parseFloat(compoundAPY).toFixed(2)} %</p>

            <p>
              Compound Balance:
              {ethers.utils.formatEther(
                depositedAmount.compoundBalance.toString(),
              )}
              ETH
            </p>
            <p>
              Aave Balance:
              {ethers.utils.formatEther(depositedAmount.aaveBalance.toString())}
              ETH
            </p>
            <p>
              Interest Earned:
              {ethers.utils.formatEther(
                depositedAmount.interestEarned.toString(),
              )}
              ETH
            </p>
            <p>
              Contract Balance:
              {ethers.utils.formatEther(
                depositedAmount.contractBalance.toString(),
              )}
              ETH
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MainPage
