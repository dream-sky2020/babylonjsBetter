import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BattleConnectionOverlay } from './BattleConnectionOverlay';
import type { Point, SkillConnectionData, ConnectionMode } from './BattleConnectionOverlay';

type NodeItem = { id: string; label: string };
type NodeUIData = { center: Point; radius: number };

const NODE_ROWS: NodeItem[][] = [
  [
    { id: 'node-1-1', label: '1' },
    { id: 'node-1-2', label: '2' },
    { id: 'node-1-3', label: '3' },
    { id: 'node-1-4', label: '4' }
  ],
  [
    { id: 'node-2-1', label: '5' },
    { id: 'node-2-2', label: '6' },
    { id: 'node-2-3', label: '7' },
    { id: 'node-2-4', label: '8' }
  ]
];

export const TargetConnectionDemo: React.FC = () => {
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [connections, setConnections] = useState<Record<string, string>>({});
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [nodeUIDataMap, setNodeUIDataMap] = useState<Record<string, NodeUIData>>({});
  const [mode, setMode] = useState<ConnectionMode>('edge-to-edge');

  const getNodeUIDataFromDom = useCallback((nodeId: string): NodeUIData | null => {
    const element = nodeRefs.current[nodeId];
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      radius: Math.min(rect.width, rect.height) / 2
    };
  }, []);

  const refreshNodeUIData = useCallback(() => {
    const nextNodeUIData: Record<string, NodeUIData> = {};
    NODE_ROWS.flat().forEach((node) => {
      const uiData = getNodeUIDataFromDom(node.id);
      if (uiData) {
        nextNodeUIData[node.id] = uiData;
      }
    });
    setNodeUIDataMap(nextNodeUIData);
  }, [getNodeUIDataFromDom]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!activeNodeId) return;
      setMousePos({ x: event.clientX, y: event.clientY });
    };

    const onMouseUp = () => {
      if (!activeNodeId) return;
      setActiveNodeId(null);
    };

    const onResize = () => {
      refreshNodeUIData();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onResize);
    const frame = requestAnimationFrame(() => {
      refreshNodeUIData();
    });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frame);
    };
  }, [activeNodeId, refreshNodeUIData]);

  const overlayConnections = useMemo<SkillConnectionData[]>(() => {
    const clashPairs = new Set<string>();
    const result: SkillConnectionData[] = [];

    Object.entries(connections).forEach(([sourceId, targetId]) => {
      const startNode = nodeUIDataMap[sourceId];
      const endNode = nodeUIDataMap[targetId];
      if (!startNode || !endNode) return;

      const isClash = connections[targetId] === sourceId;
      if (isClash) {
        const pairKey = [sourceId, targetId].sort().join('--');
        if (clashPairs.has(pairKey)) return;
        clashPairs.add(pairKey);
        result.push({
          id: `clash-${pairKey}`,
          start: startNode.center,
          end: endNode.center,
          startRadius: startNode.radius,
          endRadius: endNode.radius,
          isClash: true
        });
        return;
      }

      result.push({
        id: `link-${sourceId}-${targetId}`,
        start: startNode.center,
        end: endNode.center,
        startRadius: startNode.radius,
        endRadius: endNode.radius,
        isClash: false
      });
    });

    return result;
  }, [connections, nodeUIDataMap]);

  const clashingNodeIds = useMemo(() => {
    const clashing = new Set<string>();
    Object.entries(connections).forEach(([sourceId, targetId]) => {
      if (connections[targetId] === sourceId) {
        clashing.add(sourceId);
        clashing.add(targetId);
      }
    });
    return clashing;
  }, [connections]);

  const draggingLine = useMemo(() => {
    if (!activeNodeId) {
      return null;
    }
    const startNode = nodeUIDataMap[activeNodeId];
    if (!startNode) {
      return null;
    }
    return {
      start: startNode.center,
      end: mousePos,
      startRadius: startNode.radius,
      endRadius: 0
    };
  }, [activeNodeId, mousePos, nodeUIDataMap]);

  const onNodeMouseDown = (nodeId: string, event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    refreshNodeUIData();
    setConnections((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
    setActiveNodeId(nodeId);
    setMousePos({ x: event.clientX, y: event.clientY });
  };

  const onNodeMouseUp = (nodeId: string, event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    refreshNodeUIData();
    if (!activeNodeId || activeNodeId === nodeId) {
      setActiveNodeId(null);
      return;
    }

    setConnections((prev) => ({
      ...prev,
      [activeNodeId]: nodeId
    }));
    setActiveNodeId(null);
  };

  return (
    <div className="target-page">
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.7)',
          padding: '15px',
          borderRadius: '8px',
          color: '#00ffff',
          border: '1px solid #00ffff',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>算法测试控制台</div>
        <label style={{ cursor: 'pointer' }}>
          <input
            type="radio"
            checked={mode === 'center-to-center'}
            onChange={() => setMode('center-to-center')}
          />
          中心到中心 (Center to Center)
        </label>
        <label style={{ cursor: 'pointer' }}>
          <input
            type="radio"
            checked={mode === 'center-to-edge'}
            onChange={() => setMode('center-to-edge')}
          />
          中心到边缘 (Center to Edge)
        </label>
        <label style={{ cursor: 'pointer' }}>
          <input
            type="radio"
            checked={mode === 'edge-to-edge'}
            onChange={() => setMode('edge-to-edge')}
          />
          边缘到边缘 (Edge to Edge) 【推荐】
        </label>
      </div>

      <BattleConnectionOverlay
        connections={overlayConnections}
        draggingLine={draggingLine}
        mode={mode}
      />

      {NODE_ROWS.map((row, rowIndex) => (
        <div className="target-row" key={`row-${rowIndex}`}>
          {row.map((node) => (
            <div
              key={node.id}
              className={`target-node ${clashingNodeIds.has(node.id) ? 'clashing' : ''}`}
              ref={(element) => {
                nodeRefs.current[node.id] = element;
              }}
              onMouseDown={(event) => onNodeMouseDown(node.id, event)}
              onMouseUp={(event) => onNodeMouseUp(node.id, event)}
            >
              {node.label}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
