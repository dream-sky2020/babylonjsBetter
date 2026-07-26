import React from 'react';
import ReactDOM from 'react-dom/client';
import { AtlasJsonEditor } from './AtlasJsonEditor';

const rootElement = document.getElementById('root') as HTMLElement;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AtlasJsonEditor />
  </React.StrictMode>
);
