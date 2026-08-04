import React from 'react';
import { createRoot } from 'react-dom/client';
import { ExclamationMarkLab } from './ExclamationMarkLab.tsx';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ExclamationMarkLab /></React.StrictMode>
);
