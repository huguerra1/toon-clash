import { VRButton } from 'three/addons/webxr/VRButton.js';
import type { GameRenderer } from './scene';

/** Onde o espectador fica em VR: de pé, de frente para a arena, a alguns metros. */
const SPECTATOR_SPOT = { x: 0, y: 0, z: 6.5 };

/**
 * Modo espectador em realidade virtual (WebXR). Só aparece em navegadores/óculos com suporte
 * a 'immersive-vr'. A luta continua sendo jogada com teclado ou controle.
 */
export async function setupXr(game: GameRenderer): Promise<void> {
  const xr = navigator.xr;
  if (!xr) return;
  const supported = await xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!supported) return;

  const renderer = game.renderer;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.addEventListener('sessionstart', () => {
    game.cameraRig.position.set(SPECTATOR_SPOT.x, SPECTATOR_SPOT.y, SPECTATOR_SPOT.z);
  });
  renderer.xr.addEventListener('sessionend', () => {
    game.cameraRig.position.set(0, 0, 0);
    game.resize();
  });
  document.body.appendChild(VRButton.createButton(renderer));
}
