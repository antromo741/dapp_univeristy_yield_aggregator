import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import './mainpage.css'
import contractArtifact from '../../abis/YieldAggregator.json'
import wethContractABI from '../../abis/WETH.json'

const MainPage = ({ account }) => {
  // TODO Replace with your contract's address
  const yieldAggregatorAddress = '0x30426D33a78afdb8788597D5BFaBdADc3Be95698'
  const contractABI = contractArtifact.abi
  const provider = new ethers.providers.Web3Provider(window.ethereum)
  // TODO need to add to onMount so it only runs once.
  const signer = provider.getSigner()
  const contract = new ethers.Contract(
    yieldAggregatorAddress,
    contractABI,
    signer,
  )

  const [amount, setAmount] = useState('')
  const [accountBalance, setAccountBalance] = useState(0)
  const [depositedAmount, setDepositedAmount] = useState(0)
  const [currentProtocol, setCurrentProtocol] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)

  const handleAmountChange = (e) => {
    setAmount(e.target.value)
  }

  // Add handlers for Deposit, Rebalance, and Withdraw here
  const [depositing, setDepositing] = useState(false)

  const handleDeposit = async () => {
    if (!amount) return
    const weiAmount = ethers.utils.parseEther(amount)

    // Get WETH contract
    const weth = new ethers.Contract(
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      wethContractABI,
      signer,
    )

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

    // Start depositing
    setDepositing(true)

    try {
      // Deposit WETH into YieldAggregator
      await contract.depositToAave(weiAmount)
    } catch (error) {
      console.error('Failed to deposit', error)
    } finally {
      // Finish depositing
      setDepositing(false)
    }
  }

  const handleWithdraw = async () => {
    await contract.withdrawFromAave()
  }

  const handleRebalance = async () => {
    // TODO: Replace 0 with the protocol that has the highest APY
    // TODO create call to apy
    await contract.rebalance(0)
  }

/*   useEffect(() => {
    const updateBalance = async () => {
      const balance = await contract.getUserBalance(account)

      setDepositedAmount(ethers.utils.formatEther(balance.aaveBalance))
      setCurrentProtocol(balance.aaveBalance.gt(0) ? 'Aave' : 'Compound')
    }

    // Listen for Deposit, Withdraw, and Rebalance events
    contract.on('Deposit', updateBalance)
    contract.on('Withdraw', updateBalance)
    contract.on('Rebalance', updateBalance)

    // Call updateBalance once to set the initial balance
    updateBalance()

    return () => {
      // Remove event listeners
      contract.off('Deposit', updateBalance)
      contract.off('Withdraw', updateBalance)
      contract.off('Rebalance', updateBalance)
    }
  }, [account, contract]) */

  const updateWalletBalance = async () => {
    // Get WETH contract
    const weth = new ethers.Contract(
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      wethContractABI,
      signer,
    )

    // Get user's WETH balance
    const balance = await weth.balanceOf(account)

    // Update wallet balance
    setWalletBalance(ethers.utils.formatEther(balance))
  }

  useEffect(() => {
    updateWalletBalance()
  }, [account])

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

            <button className="main-button" onClick={handleRebalance}>
              Rebalance
            </button>
            <button className="main-button" onClick={handleWithdraw}>
              Withdraw
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
          </div>
        </div>
      </div>
    </div>
  )
}

export default MainPage
