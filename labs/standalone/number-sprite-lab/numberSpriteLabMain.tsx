import React from 'react';
import { createRoot } from 'react-dom/client';
import { NumberSpriteLab } from './NumberSpriteLab.tsx';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><NumberSpriteLab /></React.StrictMode>
);
