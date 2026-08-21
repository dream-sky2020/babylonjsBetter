vec3 mySpriteSafeUnpremultiply(vec3 premultiplied, float alpha) {
  return alpha > 0.0001 ? premultiplied / alpha : vec3(0.0);
}
