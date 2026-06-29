import React from 'react';
import ReactDOM from 'react-dom/client';
import { ParticleEditor } from './ParticleEditor';

const rootElement = document.getElementById('root') as HTMLElement;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ParticleEditor />
  </React.StrictMode>
);
