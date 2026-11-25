import { outlineAntialiasRadius, pressureWidthLimit } from './outlineStyle';

export const outlineVertex = `
attribute vec2 position;
varying vec2 vUV;
uniform vec4 drawBounds;
void main(void) {
  vUV = mix(drawBounds.xy, drawBounds.zw, position * 0.5 + 0.5);
  gl_Position = vec4(vUV * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const outlineStyleRows = 7;

export const outlineFragment = `
precision highp float;
varying vec2 vUV;
uniform sampler2D maskSampler;
uniform sampler2D depthSampler;
uniform sampler2D styleSampler;
uniform vec2 screenSize;
uniform vec2 styleSize;
uniform float maxWidth;
uniform vec2 clipDepth;
uniform vec2 clipW;
uniform mat4 inverseViewProjection;

vec4 readStyle(float id, float row) {
  vec2 cell = vec2(mod(id, styleSize.x), floor(id / styleSize.x) * ${outlineStyleRows}.0 + row);
  return texture2D(styleSampler, (cell + 0.5) / styleSize);
}

// The mask stores Babylon's linear depth metric. Rebuild the originating
// surface point so the brush texture follows the model, not the viewport.
vec3 localPoint(vec2 uv, vec2 mask) {
  float z = mask.y * clipDepth.x + clipDepth.y;
  float w = z * clipW.x + clipW.y;
  vec4 world = inverseViewProjection * vec4((uv * 2.0 - 1.0) * w, z, w);
  mat4 worldToLocal = mat4(readStyle(mask.x, 1.0), readStyle(mask.x, 2.0), readStyle(mask.x, 3.0), readStyle(mask.x, 4.0));
  return (worldToLocal * (world / world.w)).xyz;
}

float hash(vec3 cell) {
  vec3 p = fract(cell * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float brushNoise(vec3 p) {
  vec3 cell = floor(p), weight = fract(p);
  weight = weight * weight * (3.0 - 2.0 * weight);
  return mix(
    mix(mix(hash(cell), hash(cell + vec3(1,0,0)), weight.x), mix(hash(cell + vec3(0,1,0)), hash(cell + vec3(1,1,0)), weight.x), weight.y),
    mix(mix(hash(cell + vec3(0,0,1)), hash(cell + vec3(1,0,1)), weight.x), mix(hash(cell + vec3(0,1,1)), hash(cell + vec3(1,1,1)), weight.x), weight.y),
    weight.z);
}

float pressureWidth(vec2 uv, vec2 mask, float width, vec2 range) {
  vec4 bounds = readStyle(mask.x, 5.0);
  vec3 p = (localPoint(uv, mask) - bounds.xyz) * bounds.w;
  // Slow, repeatable pressure changes across the whole object, including on
  // small assets whose model-space coordinates might otherwise barely vary.
  float phase = dot(p, vec3(15.0, 12.0, 17.0)) + 0.75 * sin(dot(p, vec3(7.0, 11.0, -9.0)));
  float pressure = smoothstep(0.12, 0.88, 0.5 + 0.5 * sin(phase));
  if (pressure <= 0.5) return mix(range.x, width, pressure * 2.0);
  return mix(width, range.y, pressure * 2.0 - 1.0);
}

void main(void) {
  // Keep the line outside the silhouette so a 1–2 px stroke leaves the
  // interior of a small, distant asset readable.
  if (texture2D(maskSampler, vUV).r > 0.5) discard;
  float targetDepth = -1.0;
  float maxDistance = maxWidth * maxWidth;
  float bestDistance = maxDistance + 1.0;
  vec2 bestMask = vec2(0.0, 1.0), bestUV = vUV;
  vec4 bestStyle = vec4(0.0);
  float bestCoverage = 1.0;
  #if __VERSION__ >= 300
    int radius = int(maxWidth);
    for (int y = -radius; y <= radius; ++y) {
      for (int x = -radius; x <= radius; ++x) {
  #else
    for (int y = -${pressureWidthLimit}; y <= ${pressureWidthLimit}; ++y) {
      if (abs(float(y)) <= maxWidth) for (int x = -${pressureWidthLimit}; x <= ${pressureWidthLimit}; ++x) {
  #endif
      vec2 offset = vec2(float(x), float(y));
      float distanceSquared = dot(offset, offset);
      if (distanceSquared == 0.0 || distanceSquared > maxDistance || distanceSquared > bestDistance) continue;
      vec2 uv = vUV + offset / screenSize;
      if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) continue;
      vec2 mask = texture2D(maskSampler, uv).rg;
      if (mask.x < 0.5 || (distanceSquared == bestDistance && mask.y >= bestMask.y)) continue;
      mask.x = floor(mask.x + 0.5);
      vec4 style = readStyle(mask.x, 0.0);
      float width = mod(style.a, 8.0);
      bool pressureBrush = mod(style.a, 32.0) >= 24.0;
      float feather = step(32.0, style.a) * ${outlineAntialiasRadius};
      vec2 range = vec2(width);
      if (pressureBrush) range = readStyle(mask.x, 6.0).xy;
      float candidateLimit = range.y + feather;
      if (distanceSquared > candidateLimit * candidateLimit) continue;
      if (targetDepth < 0.0) targetDepth = texture2D(depthSampler, vUV).r;
      if (mask.y > targetDepth + 0.0001 || mask.y > texture2D(depthSampler, uv).r + 0.0001) continue;
      if (pressureBrush) {
        float solidWidth = max(0.0, range.x - feather);
        if (distanceSquared > solidWidth * solidWidth) width = pressureWidth(uv, mask, width, range);
        else width = range.x;
      }
      float coverage = 1.0;
      if (feather > 0.0) {
        coverage = 1.0 - smoothstep(width - feather, width + feather, sqrt(distanceSquared));
        if (coverage <= 0.0) continue;
      } else if (distanceSquared > width * width) continue;
      bestDistance = distanceSquared;
      bestMask = mask;
      bestUV = uv;
      bestStyle = style;
      bestCoverage = coverage;
    }
  }
  if (bestMask.x < 0.5) discard;

  float brush = floor(mod(bestStyle.a, 32.0) / 8.0);
  float alpha = 1.0;
  if (brush > 0.5 && brush < 2.5) {
    vec3 local = localPoint(bestUV, bestMask);
    float texture = brushNoise(local * 16.0);
    float width = mod(bestStyle.a, 8.0);
    float distance = sqrt(bestDistance);
    if (brush < 1.5) {
      float grain = brushNoise(local * 38.0 + vec3(7.0));
      alpha = distance <= 1.0 ? mix(0.62, 1.0, texture) : smoothstep(0.28, 0.73, texture * 0.72 + grain * 0.28);
    } else {
      alpha = mix(0.42, 0.78, texture) * mix(1.0, 0.34, (distance - 1.0) / max(width - 1.0, 1.0));
    }
  }
  gl_FragColor = vec4(bestStyle.rgb, alpha * bestCoverage);
}
`;
