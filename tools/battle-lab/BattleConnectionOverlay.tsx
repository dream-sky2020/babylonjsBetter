// BattleConnectionOverlay.tsx
import React, { useEffect, useRef, useMemo } from 'react';

export interface Point {
  x: number;
  y: number;
}

export interface SkillConnectionData {
  id: string;
  start: Point;
  end: Point;
  startRadius: number;
  endRadius: number;
  isClash: boolean;
}

export type ConnectionMode = 'center-to-center' | 'center-to-edge' | 'edge-to-edge';

interface BattleConnectionOverlayProps {
  connections: SkillConnectionData[];
  draggingLine?: { start: Point; end: Point; startRadius: number; endRadius: number } | null;
  mode?: ConnectionMode;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

interface ConnectionGeometry {
  cx: number;
  cy: number;
  finalStart: Point;
  finalEnd: Point;
  midPoint: Point;
  midY: number;
  angle: number;
}

export interface LineUIInput {
  start: Point;
  end: Point;
  startRadius: number;
  endRadius: number;
}

const calculateEdgePoint = (point: Point, controlPoint: Point, offset: number, isStartPoint: boolean): Point => {
    const dx = controlPoint.x - point.x;
    const dy = controlPoint.y - point.y;
    const length = Math.hypot(dx, dy) || 1;
  
    // 基础偏移（向控制点方向，即曲线内侧）
    let moveX = (dx / length) * offset;
    const moveY = (dy / length) * offset;
  
    // 如果需要更精确的对称性，可以根据起点/终点做轻微调整（可选）
    if (!isStartPoint) {
      // 终点可以稍微多考虑水平方向，避免左右偏差过大
      moveX *= 0.95; // 轻微系数，可根据实际节点大小微调
    }
  
    return {
      x: point.x + moveX,
      y: point.y + moveY
    };
  };


const getConnectionGeometry = ({ start, end, startRadius, endRadius }: LineUIInput, currentMode: ConnectionMode): ConnectionGeometry => {
  const cx = (start.x + end.x) / 2;
  const cy = Math.min(start.y, end.y) - 150;
  const controlPoint = { x: cx, y: cy };

  const edgeStart = calculateEdgePoint(start, controlPoint, startRadius, true);   // true = start
  const edgeEnd = calculateEdgePoint(end, controlPoint, endRadius, false);     // false = end

  const finalStart: Point = currentMode === 'edge-to-edge' ? edgeStart : start;
  const finalEnd: Point = (currentMode === 'center-to-edge' || currentMode === 'edge-to-edge') ? edgeEnd : end;

  const midPoint: Point = {
    x: 0.25 * finalStart.x + 0.5 * cx + 0.25 * finalEnd.x,
    y: 0.25 * finalStart.y + 0.5 * cy + 0.25 * finalEnd.y
  };
  const midY = 0.25 * finalStart.y + 0.5 * cy + 0.25 * finalEnd.y;
  const angle = Math.atan2(finalEnd.y - finalStart.y, finalEnd.x - finalStart.x) * (180 / Math.PI);

  return { cx, cy, finalStart, finalEnd, midPoint, midY, angle };
};

export const BattleConnectionOverlay: React.FC<BattleConnectionOverlayProps> = ({
  connections,
  draggingLine,
  mode = 'edge-to-edge',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const clashPoints = useMemo(() => {
    return connections
      .filter(conn => conn.isClash)
      .map(conn => {
        const geometry = getConnectionGeometry(
          {
            start: conn.start,
            end: conn.end,
            startRadius: conn.startRadius,
            endRadius: conn.endRadius
          },
          mode
        );
        return { x: geometry.midPoint.x, y: geometry.midPoint.y };
      });
  }, [connections, mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    let animationFrameId: number;
    const particles: SparkParticle[] = [];

    const renderParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      clashPoints.forEach(pt => {
        if (Math.random() < 0.4) {
          for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1;
            particles.push({
              x: pt.x,
              y: pt.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1,
              size: Math.random() * 3 + 1,
              color: Math.random() > 0.5 ? '#ffaa00' : '#ffffff'
            });
          }
        }
      });

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(renderParticles);
    };

    renderParticles();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [clashPoints]);

  return (
    <div className="battle-connection-overlay" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
      <canvas className="battle-connection-canvas" ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }} />

      <svg className="battle-connection-svg" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, filter: 'drop-shadow(0 0 5px rgba(0, 255, 255, 0.8))' }}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#00ffff" />
          </marker>
        </defs>

        {connections.map((conn) => {
          const { start, end, isClash } = conn;
          const geometry = getConnectionGeometry(
            {
              start,
              end,
              startRadius: conn.startRadius,
              endRadius: conn.endRadius
            },
            mode
          );

          if (isClash) {
            return (
              <g key={conn.id}>
                <path
                  d={`M ${geometry.finalStart.x} ${geometry.finalStart.y} Q ${geometry.cx} ${geometry.cy} ${geometry.finalEnd.x} ${geometry.finalEnd.y}`}
                  fill="none"
                  stroke="#ff6600"
                  strokeWidth="4"
                  style={{ filter: 'drop-shadow(0 0 8px #ffaa00)' }}
                />
                <path d="M -18 -8 L -3 0 L -18 8 L -14 0 Z" fill="#ffaa00" transform={`translate(${geometry.midPoint.x}, ${geometry.midPoint.y}) rotate(${geometry.angle})`} />
                <path d="M 18 -8 L 3 0 L 18 8 L 14 0 Z" fill="#ffaa00" transform={`translate(${geometry.midPoint.x}, ${geometry.midPoint.y}) rotate(${geometry.angle})`} />
              </g>
            );
          } else {
            return (
              <path
                key={conn.id}
                d={`M ${geometry.finalStart.x} ${geometry.finalStart.y} Q ${geometry.cx} ${geometry.cy} ${geometry.finalEnd.x} ${geometry.finalEnd.y}`}
                fill="none"
                stroke="#00ffff"
                strokeWidth="3"
                strokeDasharray="12 6"
                markerEnd="url(#arrow)"
                className="energy-line-flow"
              />
            );
          }
        })}

        {draggingLine && (
          (() => {
            const geometry = getConnectionGeometry(
              {
                start: draggingLine.start,
                end: draggingLine.end,
                startRadius: draggingLine.startRadius,
                endRadius: draggingLine.endRadius
              },
              mode
            );

            return (
              <path
                d={`M ${geometry.finalStart.x} ${geometry.finalStart.y} Q ${geometry.cx} ${geometry.cy} ${geometry.finalEnd.x} ${geometry.finalEnd.y}`}
                fill="none"
                stroke="#00ffff"
                strokeWidth="3"
                strokeDasharray="12 6"
                markerEnd="url(#arrow)"
              />
            );
          })()
        )}
      </svg>
    </div>
  );
};

export const SkillConnectionOverlay = BattleConnectionOverlay;