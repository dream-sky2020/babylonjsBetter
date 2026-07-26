import React from 'react';
import ReactDOM from 'react-dom/client';
import { DbGameSelfstatusLab } from './selfstatusLabApp';

const rootElement = document.getElementById('root') as HTMLElement;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <DbGameSelfstatusLab />
  </React.StrictMode>
);
