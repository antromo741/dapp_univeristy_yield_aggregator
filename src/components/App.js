import { ethers } from 'ethers';
import React, { useState } from 'react';
import dappLogo from '../assets/logo.png';
import './App.css';
import MainPage from './main_page/MainPage'

function App() {
  const [account, setAccount] = useState(null);

  const connectWallet = async () => {
    if (window.ethereum) {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0]);
    } else {
      alert("No Ethereum wallet detected. Install MetaMask!");
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className='header-row'>
          <div className='app-name'>Romulon Yield Aggregator</div>
          <div className='connect-wallet-address'>
            <button className="header-button" onClick={connectWallet}>
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
