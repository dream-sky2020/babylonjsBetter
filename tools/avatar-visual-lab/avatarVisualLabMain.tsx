import React from 'react';
import ReactDOM from 'react-dom/client';
import { AvatarVisualLab } from './AvatarVisualLab';

const rootElement = document.getElementById('root') as HTMLElement;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AvatarVisualLab />
  </React.StrictMode>
);
