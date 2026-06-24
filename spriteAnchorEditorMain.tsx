import React from 'react';
import ReactDOM from 'react-dom/client';
import { SpriteAnchorEditor } from './SpriteAnchorEditor';

const rootElement = document.getElementById('root') as HTMLElement;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <SpriteAnchorEditor />
  </React.StrictMode>
);
