import React from 'react';
import ReactDOM from 'react-dom/client';
import { MainGameApp } from './MainGameApp';
import './main-game.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('MainGame root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <MainGameApp />
  </React.StrictMode>
);
