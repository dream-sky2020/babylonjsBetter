import { invokeNative, isElectronRuntime, type AppMemorySample } from '@/runtime/nativeBridge';

type MemoryPerformance = Performance & {
  readonly memory?: { readonly usedJSHeapSize: number };
  measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
};

type MemoryReading = { label: string; title: string; detail?: string };

const formatMemory = (label: string, bytes?: number) =>
  typeof bytes === 'number' && Number.isFinite(bytes) && bytes >= 0
    ? `${label} ${(bytes / 1024 ** 2).toFixed(1)} MiB`
    : `${label} 不可用`;

// The HUD and workbench share one reader. They poll it only while visible.
export function createLabMemoryReader() {
  const browserPerformance = performance as MemoryPerformance;
  const electron = isElectronRuntime();
  const page = globalThis.window;
  const pageSupportIssue = page?.isSecureContext === false
    ? '网页内存测量需要 HTTPS 或本机 localhost / 127.0.0.1 地址。'
    : !page?.crossOriginIsolated
      ? '当前页面未启用跨源隔离，无法测量网页内存。'
      : typeof browserPerformance.measureUserAgentSpecificMemory !== 'function'
        ? '当前浏览器未提供网页内存测量接口。'
        : undefined;
  let pageMeasurementIssue = pageSupportIssue;
  let reading: MemoryReading = {
    label: electron ? 'Electron 应用内存 读取中' : 'JS 堆内存 不可用',
    title: electron ? 'Electron 关联进程的系统内存，不含显存。' : '当前浏览器上下文的 JavaScript 堆用量估算。',
  };
  let pending = false;
  let lastNativeSample = -Infinity;
  let lastPageSample = -Infinity;
  let lastHeapSample = -Infinity;
  let hasPageSample = false;

  async function sampleElectron() {
    pending = true;
    try {
      const sample = await invokeNative<AppMemorySample | null, 'performance:get-app-memory'>('performance:get-app-memory');
      if (sample?.kind === 'private-commit') {
        reading = {
          label: formatMemory('Electron 应用私有提交内存', sample.bytes),
          title: 'Windows 为 Electron 所报告的应用进程提交的私有内存总和，不含显存。',
        };
      } else if (sample?.kind === 'working-set-sum') {
        reading = {
          label: formatMemory('Electron 应用工作集合计', sample.bytes),
          title: 'Electron 所报告的应用进程工作集之和。共享内存可能重复计入。',
        };
      } else {
        reading.label = 'Electron 应用内存 不可用';
      }
    } catch {
      reading.label = 'Electron 应用内存 不可用';
    } finally {
      pending = false;
    }
  }

  async function samplePage() {
    pending = true;
    try {
      const sample = await browserPerformance.measureUserAgentSpecificMemory!();
      hasPageSample = Number.isFinite(sample.bytes) && sample.bytes >= 0;
      pageMeasurementIssue = hasPageSample ? undefined : '浏览器未返回有效的网页内存读数。';
      if (hasPageSample) {
        reading = {
          label: formatMemory('网页内存估算', sample.bytes),
          title: '浏览器对网页相关内存的估算，覆盖 JavaScript、DOM 和相关 Worker 等。',
        };
      }
    } catch (error) {
      hasPageSample = false;
      pageMeasurementIssue = error instanceof DOMException && error.name === 'SecurityError'
        ? '浏览器拒绝测量网页内存。请在独立标签页打开 Lab 后刷新。'
        : '浏览器未能完成网页内存测量，将自动重试。';
    } finally {
      pending = false;
    }
  }

  return () => {
    const now = browserPerformance.now();
    if (electron) {
      if (!pending && now - lastNativeSample >= 1000) {
        lastNativeSample = now;
        void sampleElectron();
      }
    } else {
      // Chromium may trigger a GC to complete the wider page measurement.
      if (!pageSupportIssue && !pending && now - lastPageSample >= 30_000) {
        lastPageSample = now;
        void samplePage();
      }
      if (!hasPageSample && now - lastHeapSample >= 1000) {
        lastHeapSample = now;
        reading = {
          label: formatMemory('JS 堆内存', browserPerformance.memory?.usedJSHeapSize),
          title: '当前浏览器上下文的 JavaScript 堆用量估算。',
        };
      }
      if (!hasPageSample) {
        return pending
          ? { ...reading, label: `${reading.label}（网页内存测量中）` }
          : { ...reading, detail: pageMeasurementIssue };
      }
    }
    return reading;
  };
}
