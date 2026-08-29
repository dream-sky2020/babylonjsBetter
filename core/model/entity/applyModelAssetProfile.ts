import type { ModelAssetProfile } from '../types/model-asset-profile.types';
import type { ModelEntity } from '../types/model.types';

const radians = Math.PI / 180;
export const applyModelAssetProfile = (entity: ModelEntity, profile: ModelAssetProfile): void => {
  entity.normalizationRoot.position.set(profile.positionOffset.x, profile.positionOffset.y, profile.positionOffset.z);
  entity.normalizationRoot.rotation.set(
    profile.rotationDeg.x * radians,
    profile.rotationDeg.y * radians,
    profile.rotationDeg.z * radians,
  );
  entity.normalizationRoot.scaling.setAll(profile.uniformScale);
};
