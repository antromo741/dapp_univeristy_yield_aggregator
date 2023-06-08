import { ethers } from 'ethers';
import React, { useState, useEffect } from 'react';
import dappLogo from '../assets/logo.png';
import './App.css';
import MainPage from './main_page/MainPage'

function App() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);

  const connectWallet = async () => {
    setLoading(true);
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
      } else {
        alert("No Ethereum wallet detected. Install MetaMask!");
      }
    } catch (error) {
      console.error("Failed to connect wallet", error);
      alert("Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        setAccount(accounts[0]);
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <div className='header-row'>
          <div className='app-name'>Romulon Yield Aggregator</div>
          <div className='connect-wallet-address'>
            <button className="header-button" onClick={connectWallet} disabled={loading}>
              {account ? `Connected: ${account}` : 'Connect Wallet'}
            </button>
          </div>
        </div>
      </header>
      <img src={dappLogo} className="App-logo" alt="logo" />
      {account && <MainPage account={account} />}
    </div>
  );
}

export default App;
