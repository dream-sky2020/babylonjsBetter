float mySpriteResolveAlpha(vec4 sampleColor, float useMask) {
  return useMask > 0.5 ? sampleColor.a : 1.0;
}
