import { Grid } from './components/Grid/Grid';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">Rodium</span>
        <h1>CRM</h1>
      </header>
      <Grid />
    </div>
  );
}

export default App;