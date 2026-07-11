import React from 'react';
import ReactDOM from 'react-dom/client';
import { TauriGameApp } from './tauriGame/TauriGameApp';
import './tauriGame/tauri-game.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Tauri game root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <TauriGameApp />
  </React.StrictMode>
);
