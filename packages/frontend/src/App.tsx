import { useState } from 'react';
import { logger } from './utils/logger';
import './App.css';

function App() {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    logger.info('Button clicked', { count: count + 1 });
    setCount((prev) => prev + 1);
  };

  return (
    <div className="app">
      <h1>AutoDev</h1>
      <p>SDLC developer automation</p>
      <button onClick={handleClick}>Count: {count}</button>
    </div>
  );
}

export default App;
