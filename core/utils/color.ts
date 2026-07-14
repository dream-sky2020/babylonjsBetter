import {clamp, toFixedNumber} from "@/core/utils/math.ts";

export const rgbToHex = (r: number, g: number, b: number): string => {
    const toHex = (c: number) => clamp(Math.round(c * 255), 0, 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
            r: toFixedNumber(parseInt(result[1], 16) / 255),
            g: toFixedNumber(parseInt(result[2], 16) / 255),
            b: toFixedNumber(parseInt(result[3], 16) / 255)
        }
        : {r: 1, g: 1, b: 1};
};