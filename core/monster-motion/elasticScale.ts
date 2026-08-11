import type {
  MonsterMotionDefinition,
  MonsterMotionParameterSchema,
  MonsterMotionParameterValues,
} from './types';

export const elasticScaleParameters: MonsterMotionParameterSchema = {
  horizontalScaleAmplitude: {
    type: 'number',
    label: '横向缩放幅度',
    default: 0.08,
    min: -0.8,
    max: 0.8,
    step: 0.01,
    group: '弹性缩放',
  },
  verticalScaleAmplitude: {
    type: 'number',
    label: '纵向缩放幅度',
    default: -0.08,
    min: -0.8,
    max: 0.8,
    step: 0.01,
    group: '弹性缩放',
  },
  scaleCycles: {
    type: 'number',
    label: '弹动次数',
    default: 2,
    min: 1,
    max: 12,
    step: 1,
    group: '弹性缩放',
  },
  scaleDecay: {
    type: 'number',
    label: '弹动衰减',
    default: 0.25,
    min: 0,
    max: 1,
    step: 0.05,
    group: '弹性缩放',
  },
};

const numberParameter = (
  parameters: MonsterMotionParameterValues,
  key: string,
  fallback: number,
) => {
  const value = Number(parameters[key]);
  return Number.isFinite(value) ? value : fallback;
};

export const withElasticScale = (
  definition: MonsterMotionDefinition,
): MonsterMotionDefinition => ({
  ...definition,
  parameters: {
    ...definition.parameters,
    ...elasticScaleParameters,
  },
  sample: (context, parameters) => {
    const sample = definition.sample(context, parameters);
    const cycles = Math.max(1, numberParameter(parameters, 'scaleCycles', 2));
    const decay = Math.min(1, Math.max(0, numberParameter(parameters, 'scaleDecay', 0.25)));
    const envelope = 1 - context.progress * decay;
    const pulse = Math.sin(context.progress * Math.PI * cycles) * envelope;
    const horizontal = numberParameter(parameters, 'horizontalScaleAmplitude', 0.08);
    const vertical = numberParameter(parameters, 'verticalScaleAmplitude', -0.08);

    sample.scaleX *= Math.max(0.05, 1 + horizontal * pulse);
    sample.scaleZ *= Math.max(0.05, 1 + horizontal * pulse);
    sample.scaleY *= Math.max(0.05, 1 + vertical * pulse);
    return sample;
  },
});