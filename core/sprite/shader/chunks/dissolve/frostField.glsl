float mySpriteFrostField(vec2 uv, float grain, float scale) {
  vec2 crystalUv = abs(fract((uv + grain * 0.08) * max(2.0, scale * 0.42)) - vec2(0.5));
  float crystal = 1.0 - smoothstep(0.035, 0.12, min(crystalUv.x, crystalUv.y));
  return clamp(grain * 0.72 + crystal * 0.28, 0.0, 1.0);
}
