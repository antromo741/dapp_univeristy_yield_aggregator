import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers';
import './mainpage.css'

const MainPage = ({ account }) => {
  const [amount, setAmount] = useState('')
  const [accountBalance, setAccountBalance] = useState(0)
  const [depositedAmount, setDepositedAmount] = useState(0)
  const [currentProtocol, setCurrentProtocol] = useState('')

  const handleAmountChange = (e) => {
    setAmount(e.target.value)
  }

  // Add handlers for Deposit, Rebalance, and Withdraw here
  const handleDeposit = async () => {
    // Call the deposit function on your smart contract
  }

  const handleRebalance = async () => {
    // Call the rebalance function on your smart contract
  }

  const handleWithdraw = async () => {
    // Call the withdraw function on your smart contract
  }

  useEffect(() => {
    // Fetch the current balance, deposited amount, and current protocol
  }, [account]);

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
            <button className="main-button" onClick={handleDeposit}>Deposit</button>
            <button className="main-button" onClick={handleRebalance}>Rebalance</button>
            <button className="main-button"onClick={handleWithdraw}>Withdraw</button>
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
