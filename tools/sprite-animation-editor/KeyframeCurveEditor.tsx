import React, { useMemo, useRef } from 'react';
import {
  toFixedNumber,
  type CurveChannel,
  type SpriteAnimClip
} from '@/core/sprite';

const CHANNELS: CurveChannel[] = ['x', 'y', 'rotationDeg', 'scaleX', 'scaleY'];

interface KeyframeCurveEditorProps {
  clip: SpriteAnimClip | null;
  partId: string;
  channel: CurveChannel;
  selectedKeyTimes: number[];
  duration: number;
  onChannelChange: (channel: CurveChannel) => void;
  onSelectKey: (time: number, multi: boolean) => void;
  onChangePoint: (time: number, value: number) => void;
  onMoveKeyTime: (fromTime: number, toTime: number) => void;
}

export const KeyframeCurveEditor: React.FC<KeyframeCurveEditorProps> = ({
  clip,
  partId,
  channel,
  selectedKeyTimes,
  duration,
  onChannelChange,
  onSelectKey,
  onChangePoint,
  onMoveKeyTime
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    mode: 'value' | 'time';
    time: number;
    startX: number;
    startY: number;
    startValue: number;
    startTime: number;
  } | null>(null);

  const width = 720;
  const height = 140;
  const pad = { left: 36, right: 12, top: 12, bottom: 22 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxTime = Math.max(duration, clip?.keys[clip.keys.length - 1]?.time ?? 1, 0.001);

  const points = useMemo(() => {
    if (!clip || !partId) return [] as Array<{ time: number; value: number }>;
    return clip.keys
      .map((key) => {
        const raw = key.parts[partId]?.[channel];
        if (typeof raw !== 'number') return null;
        return { time: key.time, value: raw };
      })
      .filter((item): item is { time: number; value: number } => item !== null);
  }, [clip, partId, channel]);

  const valueRange = useMemo(() => {
    if (points.length === 0) return { min: -1, max: 1 };
    const values = points.map((p) => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (Math.abs(max - min) < 1e-6) {
      min -= 1;
      max += 1;
    }
    const padValue = (max - min) * 0.15;
    return { min: min - padValue, max: max + padValue };
  }, [points]);

  const xOf = (time: number) => pad.left + (time / maxTime) * plotW;
  const yOf = (value: number) =>
    pad.top + ((valueRange.max - value) / Math.max(1e-6, valueRange.max - valueRange.min)) * plotH;
  const timeOf = (x: number) =>
    toFixedNumber(Math.max(0, Math.min(maxTime, ((x - pad.left) / plotW) * maxTime)));
  const valueOf = (y: number) =>
    toFixedNumber(
      valueRange.max -
        ((y - pad.top) / plotH) * (valueRange.max - valueRange.min)
    );

  const pathD = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xOf(point.time)} ${yOf(point.value)}`)
    .join(' ');

  const onPointerDown = (
    event: React.PointerEvent,
    time: number,
    value: number,
    mode: 'value' | 'time'
  ) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectKey(time, event.ctrlKey || event.metaKey);
    dragRef.current = {
      mode,
      time,
      startX: event.clientX,
      startY: event.clientY,
      startValue: value,
      startTime: time
    };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;
    const rect = svg.getBoundingClientRect();
    const localX = ((event.clientX - rect.left) / rect.width) * width;
    const localY = ((event.clientY - rect.top) / rect.height) * height;
    if (drag.mode === 'value') {
      onChangePoint(drag.time, valueOf(localY));
    } else {
      const nextTime = timeOf(localX);
      if (Math.abs(nextTime - drag.time) >= 1e-4) {
        onMoveKeyTime(drag.time, nextTime);
        drag.time = nextTime;
      }
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: '#8fa0b5', fontSize: 12 }}>曲线通道</span>
        {CHANNELS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChannelChange(item)}
            style={{
              background: item === channel ? '#2f6fed' : '#243044',
              border: `1px solid ${item === channel ? '#2f6fed' : '#3b4b63'}`,
              color: '#e8edf2',
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            {item}
          </button>
        ))}
        <span style={{ color: '#6f8098', fontSize: 11 }}>
          拖圆点改值 · Alt+拖圆点改时间 · Ctrl+点击多选关键帧
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: '100%',
          height: 140,
          background: '#0f131a',
          borderRadius: 8,
          border: '1px solid #2a3344',
          touchAction: 'none'
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <line
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={pad.top + plotH}
          stroke="#334155"
        />
        <line
          x1={pad.left}
          y1={pad.top + plotH}
          x2={pad.left + plotW}
          y2={pad.top + plotH}
          stroke="#334155"
        />
        {pathD ? <path d={pathD} fill="none" stroke="#5b9dff" strokeWidth={2} /> : null}
        {points.map((point) => {
          const selected = selectedKeyTimes.some((t) => Math.abs(t - point.time) < 1e-4);
          return (
            <circle
              key={`${point.time}-${channel}`}
              cx={xOf(point.time)}
              cy={yOf(point.value)}
              r={selected ? 6 : 4.5}
              fill={selected ? '#ffd166' : '#7dcea0'}
              stroke="#0f131a"
              strokeWidth={1.5}
              style={{ cursor: 'pointer' }}
              onPointerDown={(event) =>
                onPointerDown(event, point.time, point.value, event.altKey ? 'time' : 'value')
              }
            />
          );
        })}
        <text x={pad.left} y={height - 4} fill="#6f8098" fontSize={10}>
          0s
        </text>
        <text x={pad.left + plotW - 28} y={height - 4} fill="#6f8098" fontSize={10}>
          {maxTime.toFixed(2)}s
        </text>
        <text x={4} y={pad.top + 4} fill="#6f8098" fontSize={10}>
          {valueRange.max.toFixed(2)}
        </text>
        <text x={4} y={pad.top + plotH} fill="#6f8098" fontSize={10}>
          {valueRange.min.toFixed(2)}
        </text>
      </svg>
    </div>
  );
};
