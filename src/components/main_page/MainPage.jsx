import React, { useState } from 'react'
import './mainpage.css'

const MainPage = () => {
  const [amount, setAmount] = useState('')
  const [accountBalance, setAccountBalance] = useState(0)
  const [depositedAmount, setDepositedAmount] = useState(0)
  const [currentProtocol, setCurrentProtocol] = useState('')

  const handleAmountChange = (e) => {
    setAmount(e.target.value)
  }

  // Add handlers for Deposit, Rebalance, and Withdraw here

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
            <button className="main-button">Deposit</button>
            <button className="main-button">Rebalance</button>
            <button className="main-button">Withdraw</button>
          </div>
          <div className="main-column-right">
            <p>Current balance: {accountBalance}</p>
            <p>
              Amount deposited to the aggregator smart contract:{' '}
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
