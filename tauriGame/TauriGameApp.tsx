import { useCallback, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

const isTauriRuntime = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const TauriGameApp = () => {
  const [statusText, setStatusText] = useState('当前是主界面模式');
  const runtimeText = useMemo(() => (isTauriRuntime() ? 'tauri' : 'web'), []);

  const switchToPetMode = useCallback(async () => {
    if (!isTauriRuntime()) {
      setStatusText('当前为网页调试模式，无法切换到桌宠窗口。');
      return;
    }
    try {
      await invoke('switch_to_pet_mode');
      setStatusText('已切换到桌宠模式。');
    } catch {
      setStatusText('切换桌宠模式失败，请检查 Tauri 窗口配置。');
    }
  }, []);

  return (
    <main className="tauri-game-root">
      <section className="tauri-game-panel">
        <h1>Tauri 主界面模式</h1>
        <p>当前仅提供显示模式切换，不加载游戏逻辑。</p>
        <p>运行环境：{runtimeText}</p>
        <p>状态：{statusText}</p>
        <div className="tauri-game-actions">
          <button type="button" onClick={() => { void switchToPetMode(); }}>
            切换到桌宠模式
          </button>
        </div>
      </section>
    </main>
  );
};
