import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import './mainpage.css'
// TODO need to update
import contractABI from '../../abis/YieldAggregator'

const MainPage = ({ account }) => {
  // TODO Replace with your contract's address
  const contractAddress = ''
  const provider = new ethers.providers.Web3Provider(window.ethereum)
  // TODO need to add to onMount so it only runs once.
  const signer = provider.getSigner()
  const contract = new ethers.Contract(contractAddress, contractABI, signer)

  const [amount, setAmount] = useState('')
  const [accountBalance, setAccountBalance] = useState(0)
  const [depositedAmount, setDepositedAmount] = useState(0)
  const [currentProtocol, setCurrentProtocol] = useState('')

  const handleAmountChange = (e) => {
    setAmount(e.target.value)
  }

  // Add handlers for Deposit, Rebalance, and Withdraw here
  const handleDeposit = async () => {
    if (!amount) return
    const weiAmount = ethers.utils.parseEther(amount)

    // Get WETH contract
    const weth = new ethers.Contract(WETH_ADDRESS, WETHcontractABI, signer)

    // Get user's WETH allowance
    const allowance = await weth.allowance(account, contractAddress)

    // Check if allowance is less than deposit amount
    if (allowance.lt(weiAmount)) {
      // Prompt user to approve contract
      await weth.approve(contractAddress, weiAmount)
    }

    // Deposit WETH into YieldAggregator
    await contract.depositToAave(weiAmount)
  }

  const handleWithdraw = async () => {
    await contract.withdrawFromAave()
  }

  const handleRebalance = async () => {
    // TODO: Replace 0 with the protocol that has the highest APY
    // TODO create call to apy
    await contract.rebalance(0)
  }

  useEffect(() => {
    const updateBalance = async () => {
      const balance = await contract.balances(account)
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
  }, [account, contract])

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
          </div>
        </div>
      </div>
    </div>
  )
}

export default MainPage
