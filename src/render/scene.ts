import * as THREE from 'three';
import { ARENA_HALF_WIDTH } from '../combat/constants';
import type { MatchState as WorldState } from '../game/match';
import { addOutline, createToonMaterial } from './toon-material';

const FIGHTER_COLORS = [0x3ddc84, 0x4a7dff] as const;
const FIGHTER_HEIGHT = 1.8;
/** Distância mínima da câmera até o plano da luta (lutadores próximos). */
const CAMERA_MIN_DISTANCE = 11;
/** Espaço livre além de cada lutador, nas bordas da tela. */
const CAMERA_MARGIN = 1.5;
/** Fração do caminho até o alvo que a câmera anda por quadro (suavização). */
const CAMERA_SMOOTHING = 0.1;

/** Desenha o estado do mundo. Não contém regra de jogo: só lê o WorldState. */
export class GameRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  private readonly fighters: THREE.Group[];

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x2b1d4a);
    this.scene.fog = new THREE.Fog(0x2b1d4a, 14, 30);

    // Câmera lateral, levemente acima, como em Mortal Kombat.
    this.camera.position.set(0, 2.2, CAMERA_MIN_DISTANCE);
    this.camera.lookAt(0, 1.2, 0);

    this.addLights();
    this.addArena();
    this.fighters = FIGHTER_COLORS.map((color) => this.createFighter(color));

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  render(world: WorldState): void {
    world.fighters.forEach((state, i) => {
      const mesh = this.fighters[i]!;
      mesh.position.set(state.x, state.y, 0);
      // Gira o "rosto" (a marca no cubo) para o lado do oponente.
      mesh.rotation.y = state.facing === 1 ? 0 : Math.PI;
      // Respiração de idle, só visual.
      mesh.scale.y = state.crouching ? 0.6 : 1 + Math.sin((world.tick + i * 20) * 0.08) * 0.02;
    });

    this.followFighters(world);

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * A câmera acompanha o centro da luta e se afasta quando os lutadores se separam,
   * para os dois caberem na tela em qualquer proporção de janela.
   */
  private followFighters(world: WorldState): void {
    const [a, b] = world.fighters;
    const center = (a.x + b.x) / 2;
    const halfSpan = Math.abs(b.x - a.x) / 2 + CAMERA_MARGIN;
    const tanHalfFovX =
      Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
    const targetZ = Math.max(CAMERA_MIN_DISTANCE, halfSpan / tanHalfFovX);

    this.camera.position.x += (center - this.camera.position.x) * CAMERA_SMOOTHING;
    this.camera.position.z += (targetZ - this.camera.position.z) * CAMERA_SMOOTHING;
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x3a2a55, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(4, 8, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -ARENA_HALF_WIDTH - 2;
    sun.shadow.camera.right = ARENA_HALF_WIDTH + 2;
    this.scene.add(sun);
  }

  private addArena(): void {
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(ARENA_HALF_WIDTH * 2 + 4, 0.4, 6),
      createToonMaterial(0x8a6bbf),
    );
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    addOutline(floor, 0.03);
    this.scene.add(floor);

    // Pilares de fundo para dar noção de profundidade.
    for (let i = -3; i <= 3; i++) {
      const height = 3 + Math.abs(i) * 0.8;
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(1, height, 1),
        createToonMaterial(i % 2 === 0 ? 0xff8a3d : 0xffc93d),
      );
      pillar.position.set(i * 3, height / 2, -5);
      addOutline(pillar);
      this.scene.add(pillar);
    }
  }

  private createFighter(color: number): THREE.Group {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, FIGHTER_HEIGHT, 0.6),
      createToonMaterial(color),
    );
    body.position.y = FIGHTER_HEIGHT / 2;
    body.castShadow = true;
    addOutline(body);
    group.add(body);

    // Marca na frente do lutador, para ver para onde ele está virado.
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.62),
      createToonMaterial(0xffffff),
    );
    face.position.set(0.3, FIGHTER_HEIGHT * 0.8, 0);
    addOutline(face, 0.02);
    group.add(face);

    this.scene.add(group);
    return group;
  }

  private resize(): void {
    const { clientWidth: width, clientHeight: height } = this.renderer.domElement.parentElement!;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
