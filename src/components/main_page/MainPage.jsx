import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import './mainpage.css'
// TODO need to update
import contractABI from '../../abis/YieldAggregator';


const MainPage = ({ account }) => {
  // TODO Replace with your contract's address
  const contractAddress = '0xC220Ed128102d888af857d137a54b9B7573A41b2'
  const provider = new ethers.providers.Web3Provider(window.ethereum)
  // TODO need to add to onMount so it only runs once.
  const contract = new ethers.Contract(contractAddress, contractABI, provider)

  const [amount, setAmount] = useState('')
  const [accountBalance, setAccountBalance] = useState(0)
  const [depositedAmount, setDepositedAmount] = useState(0)
  const [currentProtocol, setCurrentProtocol] = useState('')

  const handleAmountChange = (e) => {
    setAmount(e.target.value)
  }
 /*  useEffect(() => {
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

  useEffect(() => {
    const fetchDepositedAmount = async () => {
      const depositedAmount = await contract.deposit(account)
      setDepositedAmount(ethers.utils.formatEther(depositedAmount))
    }

    fetchDepositedAmount()
  }, [account, contract])


 */
  // Add handlers for Deposit, Rebalance, and Withdraw here
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

  /* const handleWithdraw = async () => {
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
    // Get the signer
    const signer = provider.getSigner()

    // Connect to the contract with the signer
    const contractWithSigner = contract.connect(signer)

    // Call the rebalance function
    const tx = await contractWithSigner.rebalance()

    // Wait for the transaction to be mined
    const receipt = await tx.wait()

    // Log the transaction receipt
    console.log(receipt)
  } */

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
            <button className="main-button" onClick={console.log("I do not work yet")}>
              Rebalance
            </button>
            <button className="main-button" onClick={console.log("I do not work yet")}>
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