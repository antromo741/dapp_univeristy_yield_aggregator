import dappLogo from '../assets/logo.png';
import './App.css';
import './main_page/MainPage'

function App() {
  return (
    <div className="App">
      <header className="App-header">
   
      </header>     
      <img src={dappLogo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
    </div>
  );
}

export default App;
