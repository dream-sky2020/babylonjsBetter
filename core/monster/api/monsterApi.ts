import { requestDevServer } from '@/core/network/devServerPortResolver.ts';

export const MONSTER_CONFIG_URL = '/config/monsterDisplayConfigs.json';
export const MONSTER_STRIPE_PRESET_URL = '/config/monsterStripePresets.json';
export const STRIPE_PRESET_URL = '/config/stripePresets.json';
export const MONSTER_CONFIG_API_PATH = '/api/monster-display-configs';
export const MONSTER_STRIPE_PRESET_API_PATH = '/api/monster-stripe-presets';
export const STRIPE_PRESET_API_PATH = '/api/stripe-presets';

type MonsterApiPath = typeof MONSTER_CONFIG_API_PATH | typeof MONSTER_STRIPE_PRESET_API_PATH | typeof STRIPE_PRESET_API_PATH;

const parsePayload = async (response: Response) => {
  const text = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (/^\s*(<!doctype|<html)/i.test(text)) throw new Error('接口返回了 HTML，请确认开发服务器 API 已连接');
    throw new Error(`接口返回了非 JSON 内容：${text.slice(0, 120)}`);
  }
  if (!response.ok || payload.success === false) {
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    throw new Error(`${String(payload.message || `HTTP ${response.status}`)}${errors.length ? `：${String(errors[0])}` : ''}`);
  }
  return payload;
};

export const requestMonsterLibrary = async <T = unknown>(path: MonsterApiPath): Promise<T> => {
  const response = await requestDevServer(`${path}?t=${Date.now()}`, { method: 'GET' });
  return parsePayload(response) as Promise<T>;
};

export const saveMonsterLibrary = async <T = unknown>(path: MonsterApiPath, value: unknown): Promise<T> => {
  const response = await requestDevServer(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  return parsePayload(response) as Promise<T>;
};
