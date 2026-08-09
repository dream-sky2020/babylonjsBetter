import React from 'react';
import ReactDOM from 'react-dom/client';
import { ParticleMotionLab } from './ParticleMotionLab';
import './particle-motion-lab.css';

const root = document.getElementById('root');
if (!root) throw new Error('缺少 #root 元素');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ParticleMotionLab />
  </React.StrictMode>
);
