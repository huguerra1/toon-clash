import * as THREE from 'three';
import { getLook } from '../characters/looks';
import { getCharacter } from '../characters/roster';
import { createFighter } from '../combat/fighter';
import type { CharacterId } from '../combat/types';
import { getFighterSource } from './fighter-assets';
import { FighterModel } from './fighter-model';
import { targetPose } from './poses';

const WIDTH = 192;
const HEIGHT = 224;

/**
 * Tira "fotos" dos lutadores (cabeça e tronco) para a tela de seleção.
 * Usa um renderer pequeno próprio, criado só na primeira foto e reaproveitado.
 */
class PortraitStudio {
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(26, WIDTH / HEIGHT, 0.1, 20);
  private readonly cache = new Map<CharacterId, string>();

  constructor() {
    this.scene.add(new THREE.AmbientLight(0xd8d4f0, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(3, 4, 5);
    this.scene.add(key);
  }

  portrait(id: CharacterId): string {
    const cached = this.cache.get(id);
    if (cached) return cached;
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(WIDTH, HEIGHT);
    }
    const look = getLook(id);
    const model = new FighterModel(look, getFighterSource(id, 0));
    const fighter = { ...createFighter(id, 0), state: 'idle' as const };
    model.applyPose(targetPose(fighter, getCharacter(id), 0.3, look.personality).pose, 1, 1);
    // Virado três-quartos para a câmera.
    model.root.rotation.y = -0.85;
    for (let i = 0; i < 4; i++) model.update(0.05);
    this.scene.add(model.root);

    // Enquadra pela cabeça (a caixa do modelo inteiro incluiria acessórios escondidos).
    model.root.updateMatrixWorld(true);
    const head = model.joints.head.getWorldPosition(new THREE.Vector3());
    const focusY = head.y + 0.05 * look.scale;
    this.camera.position.set(0.15, focusY + 0.08, 3.1 * look.scale);
    this.camera.lookAt(0.05, focusY - 0.12 * look.scale, 0);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');

    model.dispose();
    this.cache.set(id, url);
    return url;
  }
}

const studio = new PortraitStudio();

/** Imagem (data URL) do rosto do lutador para os cartões da seleção. */
export function fighterPortrait(id: CharacterId): string {
  return studio.portrait(id);
}
