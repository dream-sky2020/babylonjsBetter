const DEV_SERVER_HOST = '127.0.0.1';
const DEV_SERVER_PORT_MIN = 4550;
const DEV_SERVER_PORT_MAX = 4600;
const DEV_SERVER_MAX_ATTEMPTS = 50;
const DEFAULT_TIMEOUT_MS = 1800;

let activePort: number | null = null;
let nextCandidatePort = DEV_SERVER_PORT_MIN;

const clampPort = (port: number): number => {
  if (!Number.isFinite(port)) return DEV_SERVER_PORT_MIN;
  const normalized = Math.round(port);
  if (normalized < DEV_SERVER_PORT_MIN || normalized > DEV_SERVER_PORT_MAX) return DEV_SERVER_PORT_MIN;
  return normalized;
};

const nextPort = (port: number): number => {
  if (port >= DEV_SERVER_PORT_MAX) return DEV_SERVER_PORT_MIN;
  return port + 1;
};

const toDevServerUrl = (port: number, pathWithQuery: string): string => {
  const path = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
  return `http://${DEV_SERVER_HOST}:${port}${path}`;
};

const fetchWithTimeout = async (url: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> => {
  const abortController = new AbortController();
  const timeoutId = window.setTimeout(() => abortController.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: abortController.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const tryRequestAtPort = async (port: number, pathWithQuery: string, init?: RequestInit): Promise<Response | null> => {
  try {
    return await fetchWithTimeout(toDevServerUrl(port, pathWithQuery), init);
  } catch {
    return null;
  }
};

const isUsableResponse = (response: Response | null): response is Response => {
  return response !== null && response.status !== 404;
};

export const getResolvedDevServerPort = (): number | null => activePort;

export const requestDevServer = async (pathWithQuery: string, init?: RequestInit): Promise<Response> => {
  if (typeof window === 'undefined') {
    throw new Error('当前环境无法访问浏览器 dev server');
  }

  if (activePort !== null) {
    const directResponse = await tryRequestAtPort(activePort, pathWithQuery, init);
    if (isUsableResponse(directResponse)) {
      nextCandidatePort = nextPort(activePort);
      return directResponse;
    }
    activePort = null;
  }

  let candidatePort = clampPort(nextCandidatePort);
  for (let attempt = 0; attempt < DEV_SERVER_MAX_ATTEMPTS; attempt += 1) {
    const response = await tryRequestAtPort(candidatePort, pathWithQuery, init);
    if (isUsableResponse(response)) {
      activePort = candidatePort;
      nextCandidatePort = nextPort(candidatePort);
      return response;
    }
    candidatePort = nextPort(candidatePort);
  }

  nextCandidatePort = DEV_SERVER_PORT_MIN;
  throw new Error(`无法连接开发服务器（已尝试端口 ${DEV_SERVER_PORT_MIN}-${DEV_SERVER_PORT_MAX}）`);
};

export const probeDevServerConnection = async (pathWithQuery: string): Promise<{ connected: boolean; port: number | null }> => {
  try {
    await requestDevServer(pathWithQuery, { method: 'GET' });
    return { connected: true, port: getResolvedDevServerPort() };
  } catch {
    return { connected: false, port: null };
  }
};
