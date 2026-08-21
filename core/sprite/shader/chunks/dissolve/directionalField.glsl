float mySpriteDirectionalField(vec2 uv, vec2 axis, float grain, float strength) {
  float directional = dot(uv - vec2(0.5), axis) + 0.5;
  return mix(directional, grain, clamp(strength, 0.0, 1.0));
}
