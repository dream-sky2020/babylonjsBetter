import React from 'react';
import ReactDOM from 'react-dom/client';
import { DungeonMapCanvasLab } from './DungeonMapCanvasLab';
import './dungeon-map-workbench.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode><DungeonMapCanvasLab /></React.StrictMode>
);
