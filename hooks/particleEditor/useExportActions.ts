import { useCallback } from 'react';
import { getAllParticleEffectDefinitions } from '@/core/particle';

interface UseExportActionsParams {
  setMessage: (message: string) => void;
}

interface UseExportActionsResult {
  exportJson: () => void;
}

export const useExportActions = ({ setMessage }: UseExportActionsParams): UseExportActionsResult => {
  const exportJson = useCallback(() => {
    const all = getAllParticleEffectDefinitions();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'particleEffects.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('已导出粒子配置 JSON');
  }, [setMessage]);

  return { exportJson };
};
