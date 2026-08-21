float mySpriteHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float mySpriteNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mySpriteHash(i), mySpriteHash(i + vec2(1.0, 0.0)), f.x),
    mix(mySpriteHash(i + vec2(0.0, 1.0)), mySpriteHash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float mySpriteFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * mySpriteNoise(p);
    p = p * 2.03 + vec2(17.13, 9.71);
    amplitude *= 0.5;
  }
  return value;
}
