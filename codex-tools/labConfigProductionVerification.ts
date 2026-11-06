import { loadLabConfig } from '../labs/kit/config/labConfigTransport';
import { LabConfig } from '../labs/kit/config/LabConfig';
import { createPlayerMovementConfig, playerMovementTiming } from '../labs/modules/dungeon/player-movement/playerMovement.config';
try {
  const loaded = await loadLabConfig('dungeon-player-movement-lab');
  const config = new LabConfig(loaded.document);
  const movement = createPlayerMovementConfig(config);
  document.querySelector('#result')!.textContent = JSON.stringify({ passed: true, labId: config.labId, speed: playerMovementTiming(movement).movementSpeed });
} catch (error) {
  document.querySelector('#result')!.textContent = JSON.stringify({ passed: false, error: String(error) });
}
