import { useCallback, useMemo, useState } from 'react';
import { getRuntimeKind, invokeNative, isElectronRuntime } from '@/runtime/nativeBridge';

export const MainGameApp = () => {
  const [statusText, setStatusText] = useState('当前是 MainGame 模式');
  const runtimeText = useMemo(() => getRuntimeKind(), []);

  const switchToPetMode = useCallback(async () => {
    if (!isElectronRuntime()) {
      setStatusText('当前为网页调试模式，无法切换到桌宠窗口。');
      return;
    }
    try {
      await invokeNative('window:switch-to-pet-mode');
      setStatusText('已切换到桌宠模式。');
    } catch {
      setStatusText('切换桌宠模式失败，请检查 Electron 窗口配置。');
    }
  }, []);

  return (
    <main className="main-game-root">
      <section className="main-game-panel">
        <h1>MainGame 主界面模式</h1>
        <p>当前仅提供显示模式切换，不加载游戏逻辑。</p>
        <p>运行环境：{runtimeText}</p>
        <p>状态：{statusText}</p>
        <div className="main-game-actions">
          <button type="button" onClick={() => { void switchToPetMode(); }}>
            切换到桌宠模式
          </button>
        </div>
      </section>
    </main>
  );
};
