import React from 'react';
import ReactDOM from 'react-dom/client';
import { TargetConnectionDemo } from './TargetConnectionDemo';
import './target-connection.css';

const rootElement = document.getElementById('root') as HTMLElement;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <TargetConnectionDemo />
  </React.StrictMode>
);
