vec3 mySpriteApplyColorOverlay(vec3 sourceColor, vec3 overlayColor, float overlayAlpha) {
  return mix(sourceColor, overlayColor, clamp(overlayAlpha, 0.0, 1.0));
}
