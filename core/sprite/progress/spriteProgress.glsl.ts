export const SPRITE_PROGRESS_GLSL = /* glsl */ `
const float SPRITE_PROGRESS_PI = 3.14159265358979323846;
float spriteProgressCoordinate(vec2 uv, float shape, float direction, float angle, float startAngle, float sweepAngle, float innerRadius, float outerRadius, vec2 centerOffsetPx, vec2 axisScale) {
  vec2 safeRenderSize = max(uRenderSizePx, vec2(1.0));
  float referenceSize = max(1.0, min(safeRenderSize.x, safeRenderSize.y));
  vec2 safeAxisScale = max(abs(axisScale), vec2(0.001));
  vec2 centeredUv = ((uv - vec2(0.5)) * safeRenderSize - centerOffsetPx) / referenceSize / safeAxisScale;
  float coordinate = 0.0;
  if (shape < 1.5) {
    vec2 linearUv = uv - vec2(0.5); vec2 axis = vec2(cos(angle), sin(angle));
    float extent = max(0.0001, 0.5 * (abs(axis.x) + abs(axis.y)));
    coordinate = dot(linearUv, axis) / (2.0 * extent) + 0.5;
  } else if (shape < 2.5) coordinate = clamp(length(centeredUv) * 2.0, 0.0, 1.0);
  else if (shape < 4.5) {
    float clockwiseAngle = atan(centeredUv.x, centeredUv.y);
    float sweep = clamp(abs(sweepAngle), 0.0001, 2.0 * SPRITE_PROGRESS_PI);
    float turn = abs(direction - 2.0) > 0.25 ? mod(clockwiseAngle - startAngle + 2.0 * SPRITE_PROGRESS_PI, 2.0 * SPRITE_PROGRESS_PI) : mod(startAngle - clockwiseAngle + 2.0 * SPRITE_PROGRESS_PI, 2.0 * SPRITE_PROGRESS_PI);
    float radius = length(centeredUv) * 2.0;
    if (turn > sweep || (shape > 3.5 && (radius < innerRadius || radius > outerRadius))) return 2.0;
    coordinate = turn / sweep; direction = 1.0;
  } else if (shape < 5.5) coordinate = clamp((abs(centeredUv.x) + abs(centeredUv.y)) * 2.0, 0.0, 1.0);
  else if (shape < 6.5) coordinate = clamp(max(abs(centeredUv.x), abs(centeredUv.y)) * 2.0, 0.0, 1.0);
  else {
    vec2 p = centeredUv * 2.0; float edgeDistance = max(abs(p.x), abs(p.y));
    if (edgeDistance < innerRadius || edgeDistance > outerRadius) return 2.0;
    coordinate = mod(atan(p.y, p.x) - startAngle + 2.0 * SPRITE_PROGRESS_PI, 2.0 * SPRITE_PROGRESS_PI) / (2.0 * SPRITE_PROGRESS_PI);
  }
  if (direction > 2.5 && direction < 3.5) return clamp(abs(coordinate - 0.5) * 2.0, 0.0, 1.0);
  if (direction > 3.5) return clamp(1.0 - abs(coordinate - 0.5) * 2.0, 0.0, 1.0);
  if (direction > 1.5) return 1.0 - coordinate;
  return coordinate;
}
vec4 applySpriteLayerProgress(vec4 layer, float enabled, float progress, float shape, float direction, float angle, float startAngle, float sweepAngle, float innerRadius, float outerRadius, float softness, vec2 centerOffsetPx, vec2 axisScale, float filledUseTexture, vec3 filledColor, float filledOpacity, float unfilledUseTexture, vec3 unfilledColor, float unfilledOpacity) {
  if (enabled < 0.5 || layer.a <= 0.0001) return layer;
  float coordinate = spriteProgressCoordinate(vUV, shape, direction, angle, startAngle, sweepAngle, innerRadius, outerRadius, centerOffsetPx, axisScale);
  float edge = clamp(softness, 0.0, 0.5);
  float filled = edge <= 0.0001 ? step(coordinate, progress) : 1.0 - smoothstep(progress - edge, progress + edge, coordinate);
  float useTexture = mix(unfilledUseTexture, filledUseTexture, filled);
  vec3 regionColor = mix(unfilledColor, filledColor, filled);
  float regionOpacity = mix(unfilledOpacity, filledOpacity, filled);
  return vec4(mix(regionColor, layer.rgb, useTexture), layer.a * clamp(regionOpacity, 0.0, 1.0));
}
`;
