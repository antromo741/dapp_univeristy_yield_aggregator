import dappLogo from '../assets/logo.png';
import './App.css';
import MainPage from './main_page/MainPage'

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <div className='header-row'>
          <div className='app-name'>Romulon Yield Aggregator</div>
          {/* Need to add the conenct wallet button, after connect switch to text */}
          <div className='connect-wallet-address'>
            <button className="header-button">Connect Wallet</button>
            <div className='wallet-address'>Not connected</div>
          </div>
        </div>
      </header>
      <img src={dappLogo} className="App-logo" alt="logo" />
      <MainPage />
    </div>
  );
}

export default App;
