import React from 'react';
import ReactDOM from 'react-dom/client';
import { OscilloscopeUiLab } from './OscilloscopeUiLab';

const rootElement = document.getElementById('root') as HTMLElement;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <OscilloscopeUiLab />
  </React.StrictMode>
);
