import type { SpriteAnchorPresetMap } from '@/core/sprite/types/sprite-anchors.types.ts';
import {
  getResolvedDevServerPort,
  probeDevServerConnection,
  requestDevServer
} from '@/core/network/devServerPortResolver.ts';
import { parsePresetMap } from '@/core/sprite/preset/spritePresetValidation.ts';
import type { SpritePresetValidationReport } from '@/core/sprite/preset/spritePresetValidation.ts';

const SPRITE_ANCHOR_CONFIG_JSON_URL = '/config/spriteAnchorPresets.json';
const SPRITE_ANCHOR_DEV_API_PATH = '/api/sprite-anchor-presets';

export const readConfigJson = async (): Promise<SpriteAnchorPresetMap> => {
  if (typeof window === 'undefined') return {};
  try {
    const response = await fetch(`${SPRITE_ANCHOR_CONFIG_JSON_URL}?t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!response.ok) return {};
    const json = (await response.json()) as unknown;
    return parsePresetMap(json);
  } catch {
    return {};
  }
};

export const writeConfigJsonInDevServer = async (presets: SpriteAnchorPresetMap): Promise<void> => {
  const response = await requestDevServer(SPRITE_ANCHOR_DEV_API_PATH, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(presets)
  });
  if (!response.ok) {
    let detail = '';
    try {
      const payload = (await response.json()) as { message?: string; errors?: string[] };
      const headline = payload.message ? String(payload.message) : '';
      const firstError =
        Array.isArray(payload.errors) && payload.errors.length > 0 ? String(payload.errors[0]) : '';
      detail = [headline, firstError].filter(Boolean).join('；');
    } catch {
      // ignore json parse failure and use status code only
    }
    throw new Error(`保存失败（HTTP ${response.status}${detail ? `: ${detail}` : ''}）`);
  }
};

export const fetchSpritePresetServerConnection = async (): Promise<{
  connected: boolean;
  port: number | null;
}> => {
  return probeDevServerConnection(SPRITE_ANCHOR_DEV_API_PATH);
};

export const fetchSpritePresetValidationReport = async (): Promise<SpritePresetValidationReport> => {
  try {
    const response = await requestDevServer(`${SPRITE_ANCHOR_DEV_API_PATH}?t=${Date.now()}`, {
      method: 'GET'
    });
    const port = getResolvedDevServerPort() ?? undefined;
    if (!response.ok) {
      let message = `校验接口请求失败（HTTP ${response.status}）`;
      try {
        const payload = (await response.json()) as { message?: string };
        if (payload.message) message = String(payload.message);
      } catch {
        // ignore parse failure
      }
      return {
        reachable: false,
        valid: false,
        errors: [],
        message,
        port
      };
    }

    const payload = (await response.json()) as {
      success?: boolean;
      valid?: boolean;
      errors?: unknown;
      message?: string;
    };
    const errors = Array.isArray(payload.errors) ? payload.errors.map((item) => String(item)) : [];
    return {
      reachable: true,
      valid: payload.valid === undefined ? errors.length === 0 : Boolean(payload.valid),
      errors,
      message: payload.message ? String(payload.message) : undefined,
      port
    };
  } catch {
    return {
      reachable: false,
      valid: false,
      errors: [],
      message: '无法连接 python/server.py 校验接口',
      port: undefined
    };
  }
};
