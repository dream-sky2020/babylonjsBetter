vec2 mySpriteVoidUv(vec2 uv, float enabled, float progress, float time, float seed) {
  if (enabled < 0.5 || progress <= 0.001) return uv;
  vec2 p = uv - vec2(0.5);
  float influence = smoothstep(0.72, 0.05, length(p)) * smoothstep(0.0, 0.32, progress);
  float angle = progress * progress * 2.8 * influence + mySpriteNoise(uv * 5.0 + seed + time * 0.02) * 0.12 * influence;
  float c = cos(angle); float s = sin(angle);
  p = mat2(c, -s, s, c) * p;
  p *= 1.0 - progress * 0.22 * influence;
  return clamp(p + vec2(0.5), vec2(0.001), vec2(0.999));
}
float mySpriteVoidField(vec2 uv, float scale, float seed) {
  vec2 p = uv - vec2(0.5); float radius = length(p) * 1.42;
  float spiral = atan(p.y, p.x) / 6.2831853 + radius * 1.8;
  return clamp(radius * 0.86 + mySpriteFbm(vec2(spiral * 4.0, radius * scale) + seed) * 0.2, 0.0, 1.0);
}
