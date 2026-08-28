import { requestDevServer } from '@/core/network/devServerPortResolver.ts';
import { loadConfig } from '@/core/config/configLoader.ts';

export const MONSTER_CONFIG_URL = '/config/monsterDisplayConfigs.json';
export const MONSTER_STRIPE_PRESET_URL = '/config/monsterStripePresets.json';
export const STRIPE_PRESET_URL = '/config/stripePresets.json';
export const MONSTER_CONFIG_API_PATH = '/api/monster-display-configs';
export const MONSTER_STRIPE_PRESET_API_PATH = '/api/monster-stripe-presets';
export const STRIPE_PRESET_API_PATH = '/api/stripe-presets';

type MonsterApiPath = typeof MONSTER_CONFIG_API_PATH | typeof MONSTER_STRIPE_PRESET_API_PATH | typeof STRIPE_PRESET_API_PATH;

const CONFIG_FILE_BY_API_PATH: Record<MonsterApiPath, string> = {
  [MONSTER_CONFIG_API_PATH]: 'monsterDisplayConfigs.json',
  [MONSTER_STRIPE_PRESET_API_PATH]: 'monsterStripePresets.json',
  [STRIPE_PRESET_API_PATH]: 'stripePresets.json'
};

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
  return loadConfig<T>(CONFIG_FILE_BY_API_PATH[path], {
    devApiPath: path,
    selectDevPayload: (payload) => {
      const record = payload as Record<string, unknown>;
      return ('data' in record ? record.data : record) as T;
    }
  });
};

export const saveMonsterLibrary = async <T = unknown>(path: MonsterApiPath, value: unknown): Promise<T> => {
  const response = await requestDevServer(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  return parsePayload(response) as Promise<T>;
};
