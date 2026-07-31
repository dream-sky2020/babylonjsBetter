import './pop-number.css';

import type {
    PlayPopNumberOptions,
    PopNumberEffect,
    PopNumberPreset
} from './popNumber.types';

type Projectile = {
    node: HTMLElement;

    x: number;
    y: number;

    vx: number;
    vy: number;

    ageMs: number;
    lifeMs: number;
    gravity: number;
};

const DEFAULT_PRESET: PopNumberPreset = {
    popMode: 'float',
    lifeMs: 800,
    enableGlow: true,
    directionMinDeg: -120,
    directionMaxDeg: -60,
    speedMin: 260,
    speedMax: 460,
    gravity: 900
};

const randomRange = (min: number, max: number) => {
    return min + Math.random() * (max - min);
};

const finiteNumber = (value: unknown, fallback: number) => {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
};

const normalizePreset = (
    source: Partial<PopNumberPreset> | undefined,
    fallback: PopNumberPreset
): PopNumberPreset => {
    const directionMinDeg = finiteNumber(
        source?.directionMinDeg,
        fallback.directionMinDeg
    );

    const directionMaxDeg = Math.max(
        directionMinDeg,
        finiteNumber(
            source?.directionMaxDeg,
            fallback.directionMaxDeg
        )
    );

    const speedMin = Math.max(
        0,
        finiteNumber(source?.speedMin, fallback.speedMin)
    );

    const speedMax = Math.max(
        speedMin,
        finiteNumber(source?.speedMax, fallback.speedMax)
    );

    return {
        popMode:
            source?.popMode === 'projectile'
                ? 'projectile'
                : 'float',

        lifeMs: Math.max(
            1,
            finiteNumber(source?.lifeMs, fallback.lifeMs)
        ),

        enableGlow:
            source?.enableGlow ?? fallback.enableGlow,

        directionMinDeg,
        directionMaxDeg,
        speedMin,
        speedMax,

        gravity: finiteNumber(
            source?.gravity,
            fallback.gravity
        )
    };
};

export const createPopNumberEffect = (
    container: HTMLElement,
    initialPreset: Partial<PopNumberPreset> = {}
): PopNumberEffect => {
    const defaultPreset = normalizePreset(
        initialPreset,
        DEFAULT_PRESET
    );

    const projectiles: Projectile[] = [];
    const removalTimers = new Set<number>();

    let animationFrameId = 0;
    let lastFrameMs = 0;
    let disposed = false;

    const removeNodeLater = (
        node: HTMLElement,
        delayMs: number
    ) => {
        const timerId = window.setTimeout(() => {
            removalTimers.delete(timerId);
            node.remove();
        }, delayMs);

        removalTimers.add(timerId);
    };

    const tickProjectiles = (nowMs: number) => {
        if (disposed || projectiles.length === 0) {
            animationFrameId = 0;
            lastFrameMs = 0;
            return;
        }

        if (lastFrameMs <= 0) {
            lastFrameMs = nowMs;
        }

        // 限制最大步长，避免切换窗口后数字突然飞走。
        const deltaSeconds = Math.max(
            0,
            Math.min(0.05, (nowMs - lastFrameMs) / 1000)
        );

        lastFrameMs = nowMs;

        const width = container.clientWidth;
        const height = container.clientHeight;
        const outsideMargin = 120;

        for (let index = projectiles.length - 1; index >= 0; index -= 1) {
            const projectile = projectiles[index];

            projectile.ageMs += deltaSeconds * 1000;
            projectile.vy += projectile.gravity * deltaSeconds;

            projectile.x += projectile.vx * deltaSeconds;
            projectile.y += projectile.vy * deltaSeconds;

            const remainingLife = Math.max(
                0,
                1 - projectile.ageMs / projectile.lifeMs
            );

            projectile.node.style.left = `${projectile.x}px`;
            projectile.node.style.top = `${projectile.y}px`;
            projectile.node.style.opacity =
                remainingLife.toFixed(3);

            const outside =
                projectile.x < -outsideMargin ||
                projectile.x > width + outsideMargin ||
                projectile.y < -outsideMargin ||
                projectile.y > height + outsideMargin;

            if (remainingLife <= 0 || outside) {
                projectile.node.remove();
                projectiles.splice(index, 1);
            }
        }

        if (projectiles.length > 0) {
            animationFrameId =
                window.requestAnimationFrame(tickProjectiles);
        } else {
            animationFrameId = 0;
            lastFrameMs = 0;
        }
    };

    const ensureAnimationLoop = () => {
        if (animationFrameId || disposed) return;

        lastFrameMs = 0;
        animationFrameId =
            window.requestAnimationFrame(tickProjectiles);
    };

    const play = ({
                      value,
                      x,
                      y,
                      color = '#38bdf8',
                      preset: presetOverride,
                      className
                  }: PlayPopNumberOptions): HTMLElement | null => {
        if (disposed) return null;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

        const preset = normalizePreset(
            presetOverride,
            defaultPreset
        );

        const node = document.createElement('div');

        node.className = 'pop-number';
        node.textContent = String(value);

        node.style.left = `${x}px`;
        node.style.top = `${y}px`;

        node.style.setProperty(
            '--pop-number-color',
            color
        );

        node.style.setProperty(
            '--pop-number-life',
            `${preset.lifeMs}ms`
        );

        if (!preset.enableGlow) {
            node.classList.add('pop-number--no-glow');
        }

        if (className) {
            node.classList.add(className);
        }

        container.appendChild(node);

        if (preset.popMode === 'float') {
            removeNodeLater(node, preset.lifeMs + 50);
            return node;
        }

        node.classList.add('pop-number--projectile');

        const directionDeg = randomRange(
            preset.directionMinDeg,
            preset.directionMaxDeg
        );

        const speed = randomRange(
            preset.speedMin,
            preset.speedMax
        );

        const directionRad =
            directionDeg * Math.PI / 180;

        projectiles.push({
            node,
            x,
            y,

            vx: Math.cos(directionRad) * speed,
            vy: Math.sin(directionRad) * speed,

            ageMs: 0,
            lifeMs: preset.lifeMs,
            gravity: preset.gravity
        });

        ensureAnimationLoop();

        return node;
    };

    const clear = () => {
        if (animationFrameId) {
            window.cancelAnimationFrame(animationFrameId);
            animationFrameId = 0;
        }

        lastFrameMs = 0;

        for (const timerId of removalTimers) {
            window.clearTimeout(timerId);
        }

        removalTimers.clear();

        for (const projectile of projectiles) {
            projectile.node.remove();
        }

        projectiles.length = 0;

        container
            .querySelectorAll('.pop-number')
            .forEach(node => node.remove());
    };

    const dispose = () => {
        if (disposed) return;

        clear();
        disposed = true;
    };

    return {
        play,
        clear,
        dispose
    };
};