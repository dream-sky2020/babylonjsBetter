import React from 'react';
import ReactDOM from 'react-dom/client';
import { SpecialStatusVisualLab } from './SpecialStatusVisualLab';

const rootElement = document.getElementById('root') as HTMLElement;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <SpecialStatusVisualLab />
  </React.StrictMode>
);
