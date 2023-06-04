import dappLogo from '../assets/logo.png';
import './App.css';
import MainPage from './main_page/MainPage'

function App() {
  return (
    <div className="App">
      <header className="App-header">
   
      </header>     
      <img src={dappLogo} className="App-logo" alt="logo" />
      <MainPage />
    </div>
  );
}

export default App;
