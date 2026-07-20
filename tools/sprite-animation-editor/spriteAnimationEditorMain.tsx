import React from 'react';
import ReactDOM from 'react-dom/client';
import { SpriteAnimationEditor } from './SpriteAnimationEditor';

const rootElement = document.getElementById('root') as HTMLElement;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <SpriteAnimationEditor />
  </React.StrictMode>
);
