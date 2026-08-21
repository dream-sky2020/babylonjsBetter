float mySpriteEdgeBand(float field, float threshold, float width, float softness) {
  return smoothstep(threshold, threshold + width, field)
    * (1.0 - smoothstep(threshold + width, threshold + width + softness, field));
}
