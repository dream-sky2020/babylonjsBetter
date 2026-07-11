import React from 'react';
import ReactDOM from 'react-dom/client';
import { DesktopPetApp } from './desktopPet/DesktopPetApp';
import './desktopPet/desktop-pet.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Desktop pet root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <DesktopPetApp />
  </React.StrictMode>
);
