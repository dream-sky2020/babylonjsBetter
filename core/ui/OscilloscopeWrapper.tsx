import React from 'react';
import {
  OscilloscopeMaskPanel,
  type OscilloscopeBackgroundConfig,
  type OscilloscopeMaskPanelHandle,
  type OscilloscopeMaskPanelProps,
  type OscilloscopePanelConfig
} from './OscilloscopeMaskPanel';

type OscilloscopeWrapperProps = {
  className?: string;
  style?: React.CSSProperties;
  panelStyle?: React.CSSProperties;
  children?: React.ReactNode;
  config?: Partial<OscilloscopePanelConfig>;
  background?: Partial<OscilloscopeBackgroundConfig>;
  onPlacement?: OscilloscopeMaskPanelProps['onPlacement'];
  contentPointerEvents?: React.CSSProperties['pointerEvents'];
  waveExpand?: number;
  lockHitAreaToHost?: boolean;
};

export const OscilloscopeWrapper: React.FC<OscilloscopeWrapperProps> = ({
  className,
  style,
  panelStyle,
  children,
  config,
  background,
  onPlacement,
  contentPointerEvents = 'auto',
  waveExpand = 40,
  lockHitAreaToHost = false
}) => {
  const expand = Math.max(0, Math.floor(waveExpand));
  const panelRef = React.useRef<OscilloscopeMaskPanelHandle | null>(null);
  const shouldAutoInjectOnPointerDown = config?.autoInjectOnPointerDown ?? true;

  const mergedConfig = React.useMemo<Partial<OscilloscopePanelConfig>>(
    () => ({
      ...(config ?? {}),
      autoInjectOnPointerDown: lockHitAreaToHost ? false : config?.autoInjectOnPointerDown,
      edgePadding: expand
    }),
    [config, expand, lockHitAreaToHost]
  );

  const handlePointerDownCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!lockHitAreaToHost || !shouldAutoInjectOnPointerDown) return;
      const hostRect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - hostRect.left + expand;
      const y = event.clientY - hostRect.top + expand;
      panelRef.current?.triggerWaveAtPoint(x, y);
    },
    [expand, lockHitAreaToHost, shouldAutoInjectOnPointerDown]
  );

  return (
    <div
      className={className}
      onPointerDownCapture={handlePointerDownCapture}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        ...style
      }}
    >
      <div
        style={{
          margin: -expand,
          pointerEvents: 'none',
          height: `calc(100% + ${expand * 2}px)`
        }}
      >
        <OscilloscopeMaskPanel
          ref={panelRef}
          config={mergedConfig}
          background={background}
          onPlacement={onPlacement}
          contentPointerEvents="auto"
          canvasPointerEvents={lockHitAreaToHost ? 'none' : 'auto'}
          style={{
            height: '100%',
            ...panelStyle,
            pointerEvents: lockHitAreaToHost ? 'none' : 'auto'
          }}
        >
          <div
            style={{
              padding: expand,
              pointerEvents: contentPointerEvents,
              height: '100%',
              boxSizing: 'border-box'
            }}
          >
            {children}
          </div>
        </OscilloscopeMaskPanel>
      </div>
    </div>
  );
};
