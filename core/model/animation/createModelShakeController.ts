import { Vector3, type Observer, type Scene, type TransformNode } from '@babylonjs/core';

export type ModelShakeVectorRange = { min: Vector3; max: Vector3 };

export type ModelShakeOptions = {
  durationMs: number;
  frequencyHz: number;
  mode: 'wave' | 'random';
  positionEnabled: boolean;
  rotationEnabled: boolean;
  scaleEnabled: boolean;
  positionAmplitude: Vector3;
  rotationAmplitudeDeg: Vector3;
  /** @deprecated 使用 scaleAmplitudeAxes 分别控制三轴。 */
  scaleAmplitude: number;
  scaleAmplitudeAxes: Vector3;
  positionRange: ModelShakeVectorRange;
  rotationRangeDeg: ModelShakeVectorRange;
  scaleRange: ModelShakeVectorRange;
};

export type ModelShakeController = {
  getOptions: () => ModelShakeOptions;
  setOptions: (options: Partial<ModelShakeOptions>) => void;
  isPlaying: () => boolean;
  play: () => void;
  stop: () => void;
  dispose: () => void;
};

const DEFAULT_OPTIONS: ModelShakeOptions = {
  durationMs: 500,
  frequencyHz: 24,
  mode: 'wave',
  positionEnabled: true,
  rotationEnabled: true,
  scaleEnabled: true,
  positionAmplitude: new Vector3(0.08, 0.03, 0.02),
  rotationAmplitudeDeg: new Vector3(1.5, 1, 4),
  scaleAmplitude: 0,
  scaleAmplitudeAxes: new Vector3(0.035, 0.06, 0.035),
  positionRange: { min: new Vector3(-0.08, -0.03, -0.02), max: new Vector3(0.08, 0.03, 0.02) },
  rotationRangeDeg: { min: new Vector3(-1.5, -1, -4), max: new Vector3(1.5, 1, 4) },
  scaleRange: { min: new Vector3(-0.035, -0.06, -0.035), max: new Vector3(0.035, 0.06, 0.035) }
};

const cloneRange = (range: ModelShakeVectorRange): ModelShakeVectorRange => ({
  min: range.min.clone(),
  max: range.max.clone()
});

const symmetricRange = (amplitude: Vector3): ModelShakeVectorRange => ({
  min: amplitude.scale(-1),
  max: amplitude.clone()
});

const cloneOptions = (options: ModelShakeOptions): ModelShakeOptions => ({
  ...options,
  positionAmplitude: options.positionAmplitude.clone(),
  rotationAmplitudeDeg: options.rotationAmplitudeDeg.clone(),
  scaleAmplitudeAxes: options.scaleAmplitudeAxes.clone(),
  positionRange: cloneRange(options.positionRange),
  rotationRangeDeg: cloneRange(options.rotationRangeDeg),
  scaleRange: cloneRange(options.scaleRange)
});

export const createModelShakeController = (
  scene: Scene,
  target: TransformNode,
  initialOptions: Partial<ModelShakeOptions> = {}
): ModelShakeController => {
  let options: ModelShakeOptions = {
    ...cloneOptions(DEFAULT_OPTIONS),
    ...initialOptions,
    positionAmplitude: initialOptions.positionAmplitude?.clone() ?? DEFAULT_OPTIONS.positionAmplitude.clone(),
    rotationAmplitudeDeg: initialOptions.rotationAmplitudeDeg?.clone() ?? DEFAULT_OPTIONS.rotationAmplitudeDeg.clone(),
    scaleAmplitudeAxes: initialOptions.scaleAmplitudeAxes?.clone() ?? DEFAULT_OPTIONS.scaleAmplitudeAxes.clone(),
    positionRange: initialOptions.positionRange
      ? cloneRange(initialOptions.positionRange)
      : initialOptions.positionAmplitude ? symmetricRange(initialOptions.positionAmplitude) : cloneRange(DEFAULT_OPTIONS.positionRange),
    rotationRangeDeg: initialOptions.rotationRangeDeg
      ? cloneRange(initialOptions.rotationRangeDeg)
      : initialOptions.rotationAmplitudeDeg ? symmetricRange(initialOptions.rotationAmplitudeDeg) : cloneRange(DEFAULT_OPTIONS.rotationRangeDeg),
    scaleRange: initialOptions.scaleRange
      ? cloneRange(initialOptions.scaleRange)
      : initialOptions.scaleAmplitudeAxes
        ? symmetricRange(initialOptions.scaleAmplitudeAxes)
        : initialOptions.scaleAmplitude
          ? symmetricRange(new Vector3(initialOptions.scaleAmplitude, initialOptions.scaleAmplitude, initialOptions.scaleAmplitude))
          : cloneRange(DEFAULT_OPTIONS.scaleRange)
  };
  let elapsedMs = 0;
  let playing = false;
  let disposed = false;
  let observer: Observer<Scene> | null = null;
  const basePosition = new Vector3();
  const baseRotation = new Vector3();
  const baseScaling = new Vector3(1, 1, 1);
  const randomCurrent = [new Vector3(), new Vector3(), new Vector3()];
  const randomNext = [new Vector3(), new Vector3(), new Vector3()];
  const positionWave = new Vector3();
  const rotationWave = new Vector3();
  const scaleWave = new Vector3();
  let randomSegmentIndex = 0;

  const randomizeVector = (vector: Vector3) => vector.set(
    Math.random() * 2 - 1,
    Math.random() * 2 - 1,
    Math.random() * 2 - 1
  );

  const resetRandomState = () => {
    randomSegmentIndex = 0;
    for (let index = 0; index < randomCurrent.length; index += 1) {
      randomizeVector(randomCurrent[index]);
      randomizeVector(randomNext[index]);
    }
  };

  const restore = () => {
    target.position.copyFrom(basePosition);
    target.rotation.copyFrom(baseRotation);
    target.scaling.copyFrom(baseScaling);
  };

  const stop = () => {
    if (!playing) return;
    playing = false;
    restore();
  };

  const update = () => {
    if (!playing) return;
    elapsedMs += scene.getEngine().getDeltaTime();
    const duration = Math.max(1, options.durationMs);
    const progress = Math.min(elapsedMs / duration, 1);
    if (progress >= 1) {
      stop();
      return;
    }
    const attack = Math.min(progress / 0.12, 1);
    const decay = Math.pow(1 - progress, 1.6);
    const envelope = attack * decay;
    const frequency = Math.max(0.1, options.frequencyHz);
    const phase = elapsedMs / 1000 * frequency * Math.PI * 2;
    const waveX = Math.sin(phase) * 0.72 + Math.sin(phase * 1.91 + 0.8) * 0.28;
    const waveY = Math.sin(phase * 1.37 + 2.1) * 0.7 + Math.sin(phase * 2.23) * 0.3;
    const waveZ = Math.sin(phase * 1.73 + 4.2) * 0.75 + Math.sin(phase * 2.57 + 1.3) * 0.25;
    positionWave.set(waveX, waveY, waveZ);
    rotationWave.set(waveY, waveZ, waveX);
    scaleWave.set(waveY, -waveY, waveY);
    if (options.mode === 'random') {
      const segment = elapsedMs / 1000 * frequency;
      const nextSegmentIndex = Math.floor(segment);
      while (randomSegmentIndex < nextSegmentIndex) {
        for (let index = 0; index < randomCurrent.length; index += 1) {
          randomCurrent[index].copyFrom(randomNext[index]);
          randomizeVector(randomNext[index]);
        }
        randomSegmentIndex += 1;
      }
      const segmentProgress = segment - nextSegmentIndex;
      const smoothProgress = segmentProgress * segmentProgress * (3 - 2 * segmentProgress);
      Vector3.LerpToRef(randomCurrent[0], randomNext[0], smoothProgress, positionWave);
      Vector3.LerpToRef(randomCurrent[1], randomNext[1], smoothProgress, rotationWave);
      Vector3.LerpToRef(randomCurrent[2], randomNext[2], smoothProgress, scaleWave);
    }
    const sample = (wave: number, min: number, max: number) => min + (wave + 1) * 0.5 * (max - min);
    if (options.positionEnabled) {
      target.position.set(
        basePosition.x + sample(positionWave.x, options.positionRange.min.x, options.positionRange.max.x) * envelope,
        basePosition.y + sample(positionWave.y, options.positionRange.min.y, options.positionRange.max.y) * envelope,
        basePosition.z + sample(positionWave.z, options.positionRange.min.z, options.positionRange.max.z) * envelope
      );
    } else target.position.copyFrom(basePosition);
    if (options.rotationEnabled) {
      target.rotation.set(
        baseRotation.x + sample(rotationWave.x, options.rotationRangeDeg.min.x, options.rotationRangeDeg.max.x) * Math.PI / 180 * envelope,
        baseRotation.y + sample(rotationWave.y, options.rotationRangeDeg.min.y, options.rotationRangeDeg.max.y) * Math.PI / 180 * envelope,
        baseRotation.z + sample(rotationWave.z, options.rotationRangeDeg.min.z, options.rotationRangeDeg.max.z) * Math.PI / 180 * envelope
      );
    } else target.rotation.copyFrom(baseRotation);
    const scaleX = 1 + sample(scaleWave.x, options.scaleRange.min.x, options.scaleRange.max.x) * envelope;
    const scaleY = 1 + sample(scaleWave.y, options.scaleRange.min.y, options.scaleRange.max.y) * envelope;
    const scaleZ = 1 + sample(scaleWave.z, options.scaleRange.min.z, options.scaleRange.max.z) * envelope;
    if (options.scaleEnabled) target.scaling.set(baseScaling.x * scaleX, baseScaling.y * scaleY, baseScaling.z * scaleZ);
    else target.scaling.copyFrom(baseScaling);
  };

  observer = scene.onBeforeRenderObservable.add(update);

  return {
    getOptions: () => cloneOptions(options),
    setOptions: (next) => {
      options = {
        ...options,
        ...next,
        positionAmplitude: next.positionAmplitude?.clone() ?? options.positionAmplitude,
        rotationAmplitudeDeg: next.rotationAmplitudeDeg?.clone() ?? options.rotationAmplitudeDeg,
        scaleAmplitudeAxes: next.scaleAmplitudeAxes?.clone() ?? options.scaleAmplitudeAxes,
        positionRange: next.positionRange
          ? cloneRange(next.positionRange)
          : next.positionAmplitude ? symmetricRange(next.positionAmplitude) : options.positionRange,
        rotationRangeDeg: next.rotationRangeDeg
          ? cloneRange(next.rotationRangeDeg)
          : next.rotationAmplitudeDeg ? symmetricRange(next.rotationAmplitudeDeg) : options.rotationRangeDeg,
        scaleRange: next.scaleRange
          ? cloneRange(next.scaleRange)
          : next.scaleAmplitudeAxes
            ? symmetricRange(next.scaleAmplitudeAxes)
            : next.scaleAmplitude
              ? symmetricRange(new Vector3(next.scaleAmplitude, next.scaleAmplitude, next.scaleAmplitude))
              : options.scaleRange
      };
    },
    isPlaying: () => playing,
    play: () => {
      if (disposed) return;
      if (playing) restore();
      target.rotationQuaternion = null;
      basePosition.copyFrom(target.position);
      baseRotation.copyFrom(target.rotation);
      baseScaling.copyFrom(target.scaling);
      elapsedMs = 0;
      resetRandomState();
      playing = true;
    },
    stop,
    dispose: () => {
      if (disposed) return;
      stop();
      disposed = true;
      if (observer) scene.onBeforeRenderObservable.remove(observer);
      observer = null;
    }
  };
};
