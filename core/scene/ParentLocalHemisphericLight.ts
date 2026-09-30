import { HemisphericLight, Vector3, type Effect } from '@babylonjs/core';

/** Babylon's hemispheric light ignores its parent's rotation when uploading direction. */
export class ParentLocalHemisphericLight extends HemisphericLight {
  private withWorldDirection<T>(upload: () => T): T {
    const local = this.direction;
    if (this.parent) this.direction = Vector3.TransformNormal(local, this.parent.computeWorldMatrix(true));
    try { return upload(); } finally { this.direction = local; }
  }

  override transferToEffect(effect: Effect, lightIndex: string): HemisphericLight {
    return this.withWorldDirection(() => super.transferToEffect(effect, lightIndex));
  }

  override transferToNodeMaterialEffect(effect: Effect, lightDataUniformName: string): this {
    return this.withWorldDirection(() => super.transferToNodeMaterialEffect(effect, lightDataUniformName));
  }
}
