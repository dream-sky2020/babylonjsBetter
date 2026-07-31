export type PopNumberMode = 'float' | 'projectile';

export type PopNumberPreset = {
    popMode: PopNumberMode;
    lifeMs: number;
    enableGlow: boolean;
    directionMinDeg: number;
    directionMaxDeg: number;
    speedMin: number;
    speedMax: number;
    gravity: number;
};

export type PlayPopNumberOptions = {
    /**
     * 要显示的内容。
     * 由游戏的伤害、治疗或提示系统决定，不由特效随机生成。
     */
    value: number | string;

    /**
     * 相对于特效层左上角的 CSS 像素坐标。
     */
    x: number;
    y: number;

    color?: string;
    preset?: Partial<PopNumberPreset>;

    /**
     * 可选附加 class，例如暴击、治疗等。
     */
    className?: string;
};

export type PopNumberEffect = {
    play: (options: PlayPopNumberOptions) => HTMLElement | null;
    clear: () => void;
    dispose: () => void;
};