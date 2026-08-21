vec3 mySpriteMixVisibleLayers(vec4 foreground, vec4 background, out float alphaOut) {
  float backgroundVisibleAlpha = background.a * (1.0 - foreground.a);
  alphaOut = foreground.a + backgroundVisibleAlpha;
  return mySpriteSafeUnpremultiply(foreground.rgb * foreground.a + background.rgb * backgroundVisibleAlpha, alphaOut);
}
