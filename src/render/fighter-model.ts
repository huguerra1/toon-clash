import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BodyShape, CharacterLook } from '../characters/look';
import { emblemTexture } from './emblems';
import {
  type FaceOptions,
  FACE_CENTER,
  FACE_RADIUS,
  MOUTH_FOR,
  canBlink,
  createFacePlate,
  faceOptionsOf,
  faceTexture,
} from './face-sheet';
import { mouthTexture } from './face-textures';
import { type BoundRig, DANGLE_PREFIX, PROP_PREFIX, bindRig } from './rig';
import { addExtrudedOutline, addOutline, getGradientMap } from './toon-material';

export const JOINTS = [
  'spine',
  'head',
  'armA',
  'foreA',
  'armB',
  'foreB',
  'legA',
  'shinA',
  'legB',
  'shinB',
] as const;
export type Joint = (typeof JOINTS)[number];

/**
 * Pose em radianos. Membros: positivo = gira para a frente. spine/head: positivo = inclina
 * para a frente. hipsRot positivo = tomba de costas. hipsY desloca o quadril (agachar).
 * spread abre os braços para os lados.
 */
export type Pose = Record<Joint, number> & {
  hipsY: number;
  hipsRot: number;
  spread: number;
  /** Giro do tronco (positivo leva o ombro do lado A para a frente). */
  twist: number;
  /** Avanço do quadril para a frente, em unidades do mundo. */
  lunge: number;
};
const POSE_KEYS = [...JOINTS, 'hipsY', 'hipsRot', 'spread', 'twist', 'lunge'] as const;

export type PropName =
  | 'sword'
  | 'hammer'
  | 'jets'
  | 'horn'
  | 'wings'
  | 'shadowHand'
  | 'rocket'
  | 'stars'
  | 'bigHands'
  | 'bread'
  | 'rake'
  | 'lid'
  | 'stretch';

const THIGH = 0.42;
const SHIN = 0.4;

export type Expression =
  'neutral' | 'angry' | 'shout' | 'pain' | 'happy' | 'dizzy' | 'sleepy' | 'ko';

/** Parte que balança com mola (capa, cabelo, cachecol, orelhas). */
interface Dangler {
  pivot: THREE.Object3D;
  rest: number;
  angle: number;
  velocity: number;
  /** Quanto a parte reage ao movimento do corpo. */
  gain: number;
}

/**
 * Quanto os braços abrem a mais para não afundar no tronco. Na pera a barriga é mais larga que os
 * ombros: braço caído entraria na barriga e só a luva apareceria. Só afeta braço caído; braço
 * esticado para a frente quase não muda.
 */
const ARM_CLEARANCE: Partial<Record<BodyShape, number>> = { pear: 0.5 };

export function armClearance(look: CharacterLook): number {
  return ARM_CLEARANCE[look.body ?? 'standard'] ?? 0;
}

/** Modelo low-poly montado com primitivas, com "esqueleto" de grupos para animar. */
export class FighterModel {
  readonly root = new THREE.Group();
  /** Grupo interno: escala do personagem e efeitos (encolher, teleporte). */
  readonly body = new THREE.Group();
  hips: THREE.Object3D = new THREE.Group();
  joints = {} as Record<Joint, THREE.Object3D>;
  readonly pose: Pose = neutralPose();
  private readonly materials: THREE.MeshToonMaterial[] = [];
  private readonly baseEmissive = new Map<THREE.MeshToonMaterial, THREE.Color>();
  private readonly props = new Map<PropName, THREE.Object3D[]>();
  private readonly hands: THREE.Object3D[] = [];
  private flash = 0;
  /** Multiplicador do clarão branco (acessibilidade: flashes reduzidos). */
  flashScale = 1;
  /** Segundos que cada pose fica parada (0 = animação contínua; > 0 = estilo desenho). */
  poseHold = 0;
  private held = 0;
  private heldKey = '';
  /** Altura do quadril, depende do tamanho das pernas de cada lutador. */
  hipHeight: number;
  private readonly thigh: number;
  private readonly shin: number;
  /** Rosto desenhado (olhos, sobrancelhas e boca) num pedaço de esfera na frente da cabeça. */
  private face: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;
  private readonly faceOptions: FaceOptions;
  /** Boca separada, na frente do focinho (só quem tem focinho). */
  private mouth: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
  private blinking = false;
  private expression: Expression = 'neutral';
  private readonly danglers: Dangler[] = [];
  private lastX: number | null = null;
  private lastY = 0;
  private blinkIn = 2 + Math.random() * 3;
  private blinkFor = 0;
  private time = 0;
  private stretch = 1;
  private readonly armOpen: number;

  /**
   * @param source modelo carregado de um .glb (feito no Blender). Sem ele, o lutador é montado
   * com primitivas. O .glb precisa ter nós com os nomes de `RIG_JOINTS` (veja docs/MODELOS-3D.md).
   */
  constructor(
    readonly look: CharacterLook,
    source?: THREE.Object3D,
  ) {
    this.faceOptions = faceOptionsOf(look);
    this.armOpen = armClearance(look);
    const legs = look.proportions?.legs ?? 1;
    this.thigh = THIGH * legs;
    this.shin = SHIN * legs;
    this.hipHeight = this.thigh + this.shin + 0.06;
    this.root.add(this.body);
    this.body.scale.setScalar(look.scale);
    const bound = source ? bindRig(source) : null;
    if (source && bound && !('missing' in bound)) {
      this.adopt(source, bound);
    } else {
      if (bound && 'missing' in bound) {
        console.warn(
          `Modelo 3D sem as partes: ${bound.missing.join(', ')}. Usando o modelo padrão.`,
        );
      }
      this.body.add(this.hips);
      this.build();
      this.nameParts();
    }
    this.mergeStatic();
    this.root.traverse((o) => {
      // Só peças de verdade fazem sombra (rosto, boca e emblema são planos com transparência).
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial) {
        o.castShadow = true;
      }
    });
    if (look.translucent) this.hideInnerOutlines();
  }

  /**
   * Corpo de gelatina: o contorno é uma casca escura por trás do corpo, e através do corpo
   * semitransparente apareciam manchas dela. Desenhando o contorno depois do corpo (que grava
   * profundidade), só sobra a borda de fora.
   */
  private hideInnerOutlines(): void {
    let late: THREE.Material | null = null;
    this.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !o.userData.outline) return;
      late ??= Object.assign((o.material as THREE.Material).clone(), { transparent: true });
      o.material = late;
      o.renderOrder = 2;
    });
  }

  /**
   * Junta as peças fixas de cada articulação num só objeto, com as cores nos vértices.
   * Um lutador tinha ~150 peças (300 desenhos por quadro com os contornos, o dobro com sombra);
   * juntando por articulação ficam ~25. O que se mexe sozinho (pálpebras, sobrancelhas, boca,
   * acessórios de golpe) continua separado.
   */
  private mergeStatic(): void {
    const keep = new Set<THREE.Object3D>();
    for (const objects of this.props.values()) for (const o of objects) keep.add(o);
    if (this.face) keep.add(this.face);
    if (this.mouth) keep.add(this.mouth);

    const nodes: THREE.Object3D[] = [];
    this.body.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) nodes.push(node);
    });
    for (const node of nodes) {
      const buckets = new Map<string, { glow: boolean; color: number; meshes: THREE.Mesh[] }>();
      for (const child of node.children) {
        if (!(child instanceof THREE.Mesh) || child.userData.outline || keep.has(child)) continue;
        if (!(child.material instanceof THREE.MeshToonMaterial)) continue;
        // Peça com filhos de verdade (não só o contorno) fica como está.
        if (child.children.some((c) => !c.userData.outline)) continue;
        const glow = child.material.emissiveIntensity > 1;
        const color = child.material.color.getHex();
        // Partes que brilham precisam do próprio emissivo; o resto divide um material só.
        const key = glow ? `glow:${color}` : 'base';
        const bucket = buckets.get(key) ?? { glow, color, meshes: [] };
        bucket.meshes.push(child);
        buckets.set(key, bucket);
      }
      for (const { glow, color, meshes } of buckets.values()) {
        if (meshes.length < 2) continue;
        const merged = new THREE.Mesh(
          mergeColored(meshes),
          this.material(glow ? color : 0xffffff, glow),
        );
        if (!glow) merged.material.vertexColors = true;
        for (const m of meshes) {
          node.remove(m);
          this.forgetMaterial(m.material as THREE.MeshToonMaterial);
        }
        node.add(merged);
        addExtrudedOutline(merged, 0.022);
      }
    }
  }

  private forgetMaterial(m: THREE.MeshToonMaterial): void {
    const i = this.materials.indexOf(m);
    if (i >= 0) this.materials.splice(i, 1);
    this.baseEmissive.delete(m);
  }

  /** Dá nomes padronizados às partes, para exportar como .glb e editar no Blender. */
  private nameParts(): void {
    this.hips.name = 'hips';
    for (const joint of JOINTS) this.joints[joint].name = joint;
    for (const [name, objects] of this.props)
      for (const o of objects) o.name = `${PROP_PREFIX}${name}`;
    this.danglers.forEach((d, i) => (d.pivot.name = `${DANGLE_PREFIX}${i}`));
  }

  /** Usa um modelo carregado: troca os materiais pelo toon do jogo e liga rosto, acessórios e molas. */
  private adopt(source: THREE.Object3D, rig: BoundRig): void {
    this.body.add(source);
    this.hips = rig.hips;
    this.joints = rig.joints;
    this.hipHeight = rig.hips.position.y;
    const meshes: THREE.Mesh[] = [];
    source.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.userData.outline && o.name !== 'mouth') meshes.push(o);
    });
    for (const mesh of meshes) {
      const old = mesh.material as THREE.MeshStandardMaterial;
      const glow = (old.emissive?.getHex() ?? 0) !== 0;
      const toon = this.material(old.color?.getHex() ?? 0xffffff, glow);
      if (old.map) toon.map = old.map;
      mesh.material = toon;
      // Contorno pela normal: acompanha formas torneadas fora do centro (tronco, membros).
      addExtrudedOutline(mesh, 0.02);
    }
    for (const [name, objects] of rig.props) {
      for (const o of objects) this.addProp(name as PropName, o);
    }
    for (const pivot of rig.danglers) {
      const rest = pivot.rotation.z;
      this.danglers.push({ pivot, rest, angle: rest, velocity: 0, gain: 1 });
    }
    this.hands.push(...rig.hands);
    this.addEmblem(rig.emblem?.parent ?? rig.joints.spine, rig.emblem?.position);
    // Olhos e sobrancelhas 3D de modelos antigos saem: o rosto agora é desenhado.
    for (const eye of rig.eyes) eye.lid.parent?.removeFromParent();
    for (const brow of rig.brows) brow.removeFromParent();
    // O nó 'face' (opcional) marca o centro da cabeça; a escala dele são os raios (elipsoide).
    const anchor = rig.face;
    const radii = anchor ? anchor.scale : new THREE.Vector3().setScalar(FACE_RADIUS);
    this.attachFace(
      anchor?.parent ?? rig.joints.head,
      anchor?.position ?? FACE_CENTER,
      radii,
      rig.mouth,
    );
  }

  /** Cola o rosto desenhado na cabeça (e a boca no focinho, se houver). */
  private attachFace(
    head: THREE.Object3D,
    center: THREE.Vector3,
    radii: THREE.Vector3,
    mouthAt: THREE.Object3D | null,
  ): void {
    this.face = createFacePlate(center, 1);
    this.face.scale.copy(radii);
    head.add(this.face);
    if (!this.faceOptions.mouth) {
      const mouth = new THREE.Mesh(
        new THREE.PlaneGeometry(0.17, 0.085),
        new THREE.MeshBasicMaterial({ map: mouthTexture('neutral'), transparent: true }),
      );
      mouth.rotation.y = Math.PI / 2;
      mouth.name = 'mouth';
      if (mouthAt) mouthAt.add(mouth);
      else {
        mouth.position.set(0.348, 0.085, 0);
        head.add(mouth);
      }
      mouth.userData.noInk = true;
      this.mouth = mouth;
    }
    this.expression = 'ko';
    this.setExpression('neutral');
  }

  /**
   * Aproxima a pose atual da pose alvo (rate 0..1 por quadro de 60 Hz).
   * Com `poseHold`, a pose só muda de tempos em tempos (como desenho animado feito à mão),
   * mas troca na hora quando `key` muda (começo de golpe, golpe ativo, apanhar).
   */
  applyPose(target: Pose, rate: number, dt: number, key = ''): void {
    if (this.poseHold > 0) {
      this.held += dt;
      if (key === this.heldKey && this.held < this.poseHold) return;
      // Cada desenho novo avança pelo menos um intervalo inteiro: numa troca logo após outro
      // desenho, a pose não fica parada a 20% do caminho.
      dt = Math.max(this.held, this.poseHold);
      this.held = 0;
      this.heldKey = key;
    }
    const k = 1 - Math.pow(1 - rate, dt * 60);
    for (const key of POSE_KEYS) this.pose[key] += (target[key] - this.pose[key]) * k;
    const p = this.pose;
    this.hips.position.y = this.hipHeight + p.hipsY;
    this.hips.position.x = p.lunge;
    this.hips.rotation.z = p.hipsRot;
    this.joints.spine.rotation.z = -p.spine;
    this.joints.spine.rotation.y = p.twist;
    this.joints.head.rotation.z = -p.head;
    for (const joint of [
      'armA',
      'foreA',
      'armB',
      'foreB',
      'legA',
      'shinA',
      'legB',
      'shinB',
    ] as const) {
      this.joints[joint].rotation.z = p[joint];
    }
    this.joints.armA.rotation.x = -(p.spread + this.armOpen);
    this.joints.armB.rotation.x = p.spread + this.armOpen;
  }

  /** Assume o lugar de outro modelo (troca de forma): posição, giro e pose atuais. */
  takeOver(other: FighterModel): void {
    this.root.position.copy(other.root.position);
    this.root.rotation.copy(other.root.rotation);
    Object.assign(this.pose, other.pose);
    this.lastX = null;
    this.held = 0;
    this.heldKey = '';
  }

  /** Clarão branco quando apanha. */
  hitFlash(): void {
    this.flash = 1;
  }

  update(dt: number): void {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);
    const glow = this.flash * 0.8 * this.flashScale;
    for (const m of this.materials) {
      const base = this.baseEmissive.get(m)!;
      m.emissive.setRGB(
        base.r + (1 - base.r) * glow,
        base.g + (1 - base.g) * glow,
        base.b + (1 - base.b) * glow,
      );
    }
    const stars = this.props.get('stars')?.[0];
    if (stars?.visible) stars.rotation.y += dt * 4;
    this.time += dt;
    this.updateFace(dt);
    this.updateDanglers(dt);
  }

  /** Muda a cara do lutador (olhos, sobrancelhas e boca). */
  setExpression(expression: Expression): void {
    if (expression === this.expression) return;
    this.expression = expression;
    // Expressão de olho já fechado/desenhado não pisca: evita desenhar o rosto duas vezes.
    if (!canBlink(expression)) this.blinking = false;
    if (this.mouth) this.mouth.material.map = mouthTexture(MOUTH_FOR[expression]);
    this.drawFace();
  }

  private drawFace(): void {
    if (!this.face) return;
    const material = this.face.material;
    // Só recompila o material na primeira textura; depois é só trocar.
    if (!material.map) material.needsUpdate = true;
    material.map = faceTexture(this.expression, this.blinking, this.faceOptions);
  }

  /**
   * Esticar/achatar (squash & stretch), mantendo o volume aproximado.
   * stretch > 1 estica na vertical; < 1 achata.
   */
  setStretch(target: number, dt: number): void {
    // Chega rápido no alvo e volta com um leve "boing".
    this.stretch += (target - this.stretch) * Math.min(1, dt * 22);
    const s = this.stretch;
    const side = 1 / Math.sqrt(s);
    this.body.scale.set(this.look.scale * side, this.look.scale * s, this.look.scale * side);
  }

  private updateFace(dt: number): void {
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkFor = 0.12;
      this.blinkIn = 2 + Math.random() * 3.5;
    }
    this.blinkFor = Math.max(0, this.blinkFor - dt);
    const blinking = this.blinkFor > 0 && canBlink(this.expression);
    if (blinking !== this.blinking) {
      this.blinking = blinking;
      this.drawFace();
    }
  }

  /** Molas simples: as partes soltas atrasam e balançam conforme o corpo se move. */
  private updateDanglers(dt: number): void {
    const x = this.root.position.x;
    const y = this.root.position.y;
    const facing = Math.cos(this.root.rotation.y) >= 0 ? 1 : -1;
    const vx = this.lastX === null ? 0 : ((x - this.lastX) / Math.max(dt, 1e-3)) * facing;
    const vy = (y - this.lastY) / Math.max(dt, 1e-3);
    this.lastX = x;
    this.lastY = y;
    const steps = Math.min(4, Math.ceil(dt * 120));
    const h = dt / steps;
    for (const d of this.danglers) {
      // Andar para a frente joga a parte para trás; subir a puxa para baixo.
      const target = d.rest + THREE.MathUtils.clamp(vx * 0.12 - vy * 0.06, -0.9, 0.9) * d.gain;
      for (let s = 0; s < steps; s++) {
        d.velocity += ((target - d.angle) * 90 - d.velocity * 9) * h;
        d.angle += d.velocity * h;
      }
      d.pivot.rotation.z = d.angle;
    }
  }

  /** Cria um ponto de articulação para uma parte que balança. */
  private dangler(
    parent: THREE.Object3D,
    position: [number, number, number],
    rest: number,
    gain = 1,
  ): THREE.Group {
    const pivot = this.group(parent, position);
    pivot.rotation.z = rest;
    this.danglers.push({ pivot, rest, angle: rest, velocity: 0, gain });
    return pivot;
  }

  /** Pinta o modelo inteiro de uma cor (ex.: virar troféu de ouro). */
  tint(color: number, emissive = 0): void {
    for (const m of this.materials) {
      // Peças juntadas guardam a cor nos vértices: desliga para pintar tudo da mesma cor.
      if (m.vertexColors) {
        m.vertexColors = false;
        m.needsUpdate = true;
      }
      m.color.setHex(color);
      this.baseEmissive.get(m)!.setHex(emissive);
    }
  }

  setProp(name: PropName, visible: boolean): void {
    if (name === 'bigHands') {
      for (const hand of this.hands) hand.scale.setScalar(visible ? 2 : 1);
      return;
    }
    if (name === 'stretch') {
      // Braço de borracha: o antebraço estica para a frente durante o golpe.
      this.joints.foreA.scale.y = visible ? 4 : 1;
      return;
    }
    for (const prop of this.props.get(name) ?? []) prop.visible = visible;
  }

  private addProp(name: PropName, object: THREE.Object3D): void {
    object.visible = false;
    this.props.set(name, [...(this.props.get(name) ?? []), object]);
  }

  dispose(): void {
    this.root.removeFromParent();
    // Materiais próprios (toon, rosto, boca, emblema, contorno do translúcido). O contorno
    // compartilhado e as texturas em cache (rosto, boca, emblema) ficam para os outros.
    const owned = new Set<THREE.Material>(this.materials);
    this.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      const material = o.material as THREE.Material;
      if (!o.userData.outline || material.transparent) owned.add(material);
    });
    for (const m of owned) m.dispose();
  }

  // -------------------------------------------------------------------------

  private material(color: number, glow = false): THREE.MeshToonMaterial {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: getGradientMap() });
    if (this.look.translucent) {
      m.transparent = true;
      m.opacity = 0.78;
    }
    const emissive = new THREE.Color(glow ? color : 0x000000);
    if (glow) emissive.multiplyScalar(0.7);
    m.emissive.copy(emissive);
    // Partes que brilham ficam bem acima da luz normal, para só elas ativarem o bloom.
    if (glow) m.emissiveIntensity = 3;
    this.baseEmissive.set(m, emissive);
    this.materials.push(m);
    return m;
  }

  private mesh(
    geometry: THREE.BufferGeometry,
    color: number,
    parent: THREE.Object3D,
    position: [number, number, number] = [0, 0, 0],
    options: { glow?: boolean; outline?: number } = {},
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.material(color, options.glow));
    mesh.position.set(...position);
    parent.add(mesh);
    if (options.outline !== 0) addOutline(mesh, options.outline ?? 0.025);
    return mesh;
  }

  private group(parent: THREE.Object3D, position: [number, number, number]): THREE.Group {
    const g = new THREE.Group();
    g.position.set(...position);
    parent.add(g);
    return g;
  }

  private build(): void {
    const { look } = this;
    const b = look.bulk;
    const has = (extra: (typeof look.extras)[number]) => look.extras.includes(extra);
    const t = look.proportions?.torso ?? 1;

    // Tronco
    const spine = this.group(this.hips, [0, 0.02, 0]);
    this.joints.spine = spine;
    this.mesh(new THREE.SphereGeometry(0.19 * b, 14, 10), look.bottom, spine, [0, 0.02, 0]);
    const torso = this.mesh(new THREE.CapsuleGeometry(0.2 * b, 0.22 * t, 6, 14), look.top, spine, [
      0,
      0.3 * t,
      0,
    ]);
    torso.scale.set(0.85, 1, 1.05);
    // Gola: dá acabamento entre o tronco e o pescoço.
    this.mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 16), look.top, spine, [0, 0.52 * t, 0], {
      outline: 0,
    }).rotation.x = Math.PI / 2;
    this.addEmblem(spine);
    if (has('stripe')) {
      this.mesh(new THREE.BoxGeometry(0.06, 0.34, 0.42 * b), 0xf4f4f4, spine, [0.15 * b, 0.3, 0], {
        outline: 0,
      });
    }
    if (has('armor')) {
      this.mesh(
        new THREE.BoxGeometry(0.16, 0.36, 0.44 * b),
        look.accent,
        spine,
        [0.12 * b, 0.32, 0],
        {
          outline: 0.02,
        },
      );
    }
    if (has('belt')) {
      this.mesh(new THREE.TorusGeometry(0.18 * b, 0.035, 6, 18), look.accent, spine, [0, 0.1, 0], {
        outline: 0,
      }).rotation.x = Math.PI / 2;
    }
    if (has('cape')) {
      const pivot = this.dangler(spine, [-0.18 * b, 0.5 * t, 0], -0.12, 1.2);
      this.mesh(new THREE.BoxGeometry(0.04, 0.95, 0.5 * b), look.hair, pivot, [0, -0.47, 0]);
    }
    if (has('rocks')) {
      for (const [x, y, z] of [
        [-0.12, 0.45, 0.15],
        [-0.15, 0.3, -0.12],
        [0.05, 0.52, -0.2],
      ] as const) {
        this.mesh(new THREE.DodecahedronGeometry(0.1), 0x6b5b4b, spine, [x * b, y, z * b]);
      }
    }

    // Cabeça
    const head = this.group(spine, [0, 0.55 * t, 0]);
    head.scale.setScalar(look.proportions?.head ?? 1);
    this.joints.head = head;
    this.mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 8), look.skin, head, [0, 0.0, 0], {
      outline: 0,
    });
    this.mesh(new THREE.SphereGeometry(0.24, 18, 14), look.skin, head, [0.02, 0.22, 0]);
    this.buildFace(head, has('visor'));
    this.buildHair(head);
    if (has('goggles')) {
      const band = this.mesh(
        new THREE.TorusGeometry(0.235, 0.03, 6, 20),
        0x222222,
        head,
        [0.02, 0.33, 0],
        {
          outline: 0,
        },
      );
      band.rotation.x = Math.PI / 2;
      for (const z of [0.09, -0.09]) {
        this.mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12),
          look.accent,
          head,
          [0.22, 0.34, z],
          {
            glow: true,
            outline: 0.015,
          },
        ).rotation.z = Math.PI / 2;
      }
    }
    if (has('ears')) {
      for (const side of [1, -1]) {
        // Orelhas pontudas com mola: balançam quando o lutador pula ou anda.
        const pivot = this.dangler(head, [0, 0.3, side * 0.2], 0, 0.6);
        const ear = this.mesh(new THREE.ConeGeometry(0.07, 0.22, 6), look.hair, pivot, [
          0,
          0,
          side * 0.06,
        ]);
        ear.rotation.x = side * 1.2;
      }
    }
    if (has('gem')) {
      this.mesh(new THREE.OctahedronGeometry(0.04), look.accent, head, [0.25, 0.32, 0], {
        glow: true,
        outline: 0.01,
      });
    }
    if (has('tentacles')) {
      for (const z of [-0.1, -0.03, 0.04, 0.11]) {
        const t = this.mesh(new THREE.CapsuleGeometry(0.025, 0.14, 4, 6), look.skin, head, [
          0.17,
          0.05,
          z,
        ]);
        t.rotation.z = 0.2;
      }
    }
    this.buildHeadwear(spine, head);
    const stars = this.group(head, [0, 0.62, 0]);
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      this.mesh(
        new THREE.OctahedronGeometry(0.07),
        0xffe14d,
        stars,
        [Math.cos(angle) * 0.3, 0, Math.sin(angle) * 0.3],
        {
          glow: true,
          outline: 0.01,
        },
      );
    }
    this.addProp('stars', stars);
    const horn = this.mesh(new THREE.ConeGeometry(0.08, 0.35, 8), 0xe8e0c8, head, [0.3, 0.3, 0]);
    horn.rotation.z = -1.2;
    this.addProp('horn', horn);

    // Braços
    const a = look.proportions?.arms ?? 1;
    const shoulderZ = 0.25 * b + 0.05;
    const shoulderY = 0.45 * t;
    if (has('shoulderPads')) {
      for (const z of [shoulderZ, -shoulderZ]) {
        this.mesh(new THREE.SphereGeometry(0.14 * b, 10, 8), look.top, spine, [
          0,
          shoulderY + 0.02,
          z,
        ]);
      }
    }
    for (const side of ['A', 'B'] as const) {
      const z = side === 'A' ? shoulderZ : -shoulderZ;
      const arm = this.group(spine, [0, shoulderY, z]);
      this.mesh(new THREE.CapsuleGeometry(0.075 * b, 0.18 * a, 4, 10), look.top, arm, [
        0,
        -0.14 * a,
        0,
      ]);
      const fore = this.group(arm, [0, -0.3 * a, 0]);
      const gauntlet = has('gauntlets');
      const skinColor = gauntlet ? look.accent : look.skin;
      this.mesh(
        new THREE.CapsuleGeometry(gauntlet ? 0.085 : 0.065 * b, 0.16 * a, 4, 10),
        skinColor,
        fore,
        [0, -0.13 * a, 0],
      );
      const glowHands = has('glowHands');
      const hand = this.buildHand(
        fore,
        -0.3 * a,
        gauntlet ? 0.11 : 0.085 * b,
        glowHands ? look.glow : skinColor,
        glowHands,
        side === 'A' ? 1 : -1,
      );
      this.hands.push(hand);
      if (side === 'A' && has('watch')) {
        this.mesh(
          new THREE.CylinderGeometry(0.085, 0.085, 0.07, 12),
          look.accent,
          fore,
          [0, -0.2, 0],
          {
            glow: true,
            outline: 0.015,
          },
        );
      }
      if (side === 'B' && has('cannonArm')) {
        this.mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 12), 0x8a96a3, fore, [0, -0.25, 0]);
        this.mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12),
          look.glow,
          fore,
          [0, -0.41, 0],
          {
            glow: true,
            outline: 0,
          },
        );
      }
      this.joints[`arm${side}`] = arm;
      this.joints[`fore${side}`] = fore;
    }
    this.buildArmProps();

    // Pernas
    const thigh = this.thigh;
    const shinLength = this.shin;
    for (const side of ['A', 'B'] as const) {
      const z = (side === 'A' ? 1 : -1) * 0.11 * b;
      const leg = this.group(this.hips, [0, -0.02, z]);
      this.mesh(new THREE.CapsuleGeometry(0.09 * b, thigh - 0.18, 4, 10), look.bottom, leg, [
        0,
        -thigh / 2,
        0,
      ]);
      const shin = this.group(leg, [0, -thigh, 0]);
      this.mesh(new THREE.CapsuleGeometry(0.075 * b, shinLength - 0.16, 4, 10), look.bottom, shin, [
        0,
        -shinLength / 2 + 0.02,
        0,
      ]);
      // Tênis de desenho: biqueira arredondada + sola clara.
      this.mesh(new THREE.BoxGeometry(0.24, 0.1, 0.14 * b), look.shoes, shin, [
        0.05,
        -shinLength - 0.01,
        0,
      ]);
      this.mesh(
        new THREE.SphereGeometry(0.075 * b, 10, 8),
        look.shoes,
        shin,
        [0.16, -shinLength - 0.02, 0],
        {
          outline: 0.015,
        },
      ).scale.set(1, 0.75, 0.95);
      this.mesh(
        new THREE.BoxGeometry(0.3, 0.03, 0.15 * b),
        0xf2f2f2,
        shin,
        [0.07, -shinLength - 0.065, 0],
        {
          outline: 0.01,
        },
      );
      const jet = this.mesh(
        new THREE.ConeGeometry(0.08, 0.3, 8),
        0xff9a2e,
        shin,
        [0, -shinLength - 0.2, 0],
        {
          glow: true,
          outline: 0,
        },
      );
      jet.rotation.z = Math.PI;
      this.addProp('jets', jet);
      this.joints[`leg${side}`] = leg;
      this.joints[`shin${side}`] = shin;
    }
  }

  /** Rosto desenhado; o visor de quem tem fica por cima, brilhando. */
  private buildFace(head: THREE.Group, visor: boolean): void {
    if (visor) {
      this.mesh(new THREE.BoxGeometry(0.06, 0.07, 0.3), this.look.accent, head, [0.23, 0.25, 0], {
        glow: true,
        outline: 0.015,
      });
    }
    this.attachFace(head, FACE_CENTER, new THREE.Vector3().setScalar(FACE_RADIUS), null);
  }

  /** Emblema do lutador no peito (desenhado em textura, por cima da roupa). */
  private addEmblem(spine: THREE.Object3D, at?: THREE.Vector3): void {
    const { look } = this;
    if (!look.emblem) return;
    const t = look.proportions?.torso ?? 1;
    const emblem = new THREE.Mesh(
      new THREE.PlaneGeometry(0.17, 0.17),
      new THREE.MeshBasicMaterial({
        map: emblemTexture(look.emblem, look.accent, look.top),
        transparent: true,
      }),
    );
    if (at) emblem.position.copy(at);
    else emblem.position.set(0.172 * look.bulk + 0.004, 0.34 * t, 0);
    emblem.rotation.y = Math.PI / 2;
    emblem.userData.noInk = true;
    spine.add(emblem);
  }

  /** Mão de luva de desenho: palma arredondada e polegar. */
  private buildHand(
    fore: THREE.Group,
    y: number,
    size: number,
    color: number,
    glow: boolean,
    side: 1 | -1,
  ): THREE.Group {
    const hand = this.group(fore, [0, y, 0]);
    hand.name = 'hand';
    this.mesh(new THREE.SphereGeometry(size, 12, 10), color, hand, [0, 0, 0], { glow }).scale.set(
      1.05,
      0.92,
      1.15,
    );
    this.mesh(
      new THREE.SphereGeometry(size * 0.42, 8, 6),
      color,
      hand,
      [size * 0.55, size * 0.35, side * size * 0.75],
      {
        glow,
        outline: 0.012,
      },
    );
    return hand;
  }

  private buildHair(head: THREE.Group): void {
    const { look } = this;
    const cap = (radius: number, color: number) =>
      this.mesh(
        new THREE.SphereGeometry(radius, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        color,
        head,
        [-0.01, 0.25, 0],
      );
    switch (look.hairStyle) {
      case 'spiky':
        cap(0.255, look.hair);
        for (const [x, y, z, rz, rx] of [
          [0.12, 0.43, 0, -0.9, 0],
          [0, 0.47, 0.08, -0.3, 0.4],
          [0, 0.47, -0.08, -0.3, -0.4],
          [-0.14, 0.42, 0, 0.6, 0],
          [-0.1, 0.38, 0.15, 0.4, 0.8],
          [-0.1, 0.38, -0.15, 0.4, -0.8],
        ] as const) {
          const spike = this.mesh(new THREE.ConeGeometry(0.08, 0.22, 6), look.hair, head, [
            x,
            y,
            z,
          ]);
          spike.rotation.set(rx, 0, rz);
        }
        break;
      case 'messy':
        cap(0.26, look.hair);
        for (const [x, z, r] of [
          [0.1, 0.1, -0.5],
          [0.12, -0.08, -0.7],
          [-0.15, 0, 0.6],
        ] as const) {
          const tuft = this.mesh(new THREE.ConeGeometry(0.07, 0.18, 6), look.hair, head, [
            x,
            0.42,
            z,
          ]);
          tuft.rotation.z = r;
        }
        break;
      case 'long':
        cap(0.26, look.hair);
        // Cabelo comprido preso pela nuca: balança com o movimento.
        this.mesh(
          new THREE.BoxGeometry(0.14, 0.75, 0.44),
          look.hair,
          this.dangler(head, [-0.16, 0.33, 0], 0, 0.8),
          [0, -0.35, 0],
        );
        break;
      case 'hood': {
        this.mesh(
          new THREE.SphereGeometry(0.31, 18, 12, Math.PI * 0.55, Math.PI * 1.9),
          look.top,
          head,
          [-0.02, 0.22, 0],
        );
        const tip = this.mesh(
          new THREE.ConeGeometry(0.12, 0.25, 8),
          look.top,
          head,
          [-0.25, 0.32, 0],
        );
        tip.rotation.z = 1.2;
        break;
      }
      case 'crest':
        for (const [x, h] of [
          [0.08, 0.3],
          [-0.04, 0.38],
          [-0.15, 0.28],
        ] as const) {
          this.mesh(new THREE.ConeGeometry(0.08, h, 6), look.hair, head, [x, 0.42 + h / 3, 0], {
            glow: true,
          });
        }
        break;
      case 'bald':
        break;
    }
  }

  /** Chapéus, orelhas, focinho e o que vai nas costas. */
  private buildHeadwear(spine: THREE.Group, head: THREE.Group): void {
    const { look } = this;
    const has = (extra: (typeof look.extras)[number]) => look.extras.includes(extra);
    if (has('potHelmet')) {
      this.mesh(new THREE.CylinderGeometry(0.27, 0.25, 0.22, 18), 0xb8c0c8, head, [-0.01, 0.4, 0]);
      const handle = this.mesh(
        new THREE.BoxGeometry(0.3, 0.05, 0.07),
        0x3a3a3a,
        head,
        [-0.3, 0.42, 0],
      );
      handle.rotation.z = 0.15;
    }
    if (has('cap')) {
      this.mesh(
        new THREE.SphereGeometry(0.255, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        look.accent,
        head,
        [-0.01, 0.27, 0],
      );
      this.mesh(new THREE.BoxGeometry(0.2, 0.03, 0.3), look.accent, head, [0.22, 0.29, 0]);
    }
    if (has('snout')) {
      this.mesh(new THREE.BoxGeometry(0.2, 0.17, 0.24), look.skin, head, [0.24, 0.13, 0]);
      this.mesh(new THREE.BoxGeometry(0.04, 0.05, 0.16), 0x2a1a10, head, [0.345, 0.17, 0], {
        outline: 0,
      });
    }
    if (has('roundEars')) {
      for (const side of [1, -1]) {
        this.mesh(new THREE.SphereGeometry(0.06, 8, 6), look.skin, head, [
          -0.04,
          0.42,
          side * 0.18,
        ]);
      }
    }
    if (has('headphones')) {
      const band = this.mesh(
        new THREE.TorusGeometry(0.26, 0.03, 6, 20, Math.PI),
        0x222222,
        head,
        [0, 0.22, 0],
        {
          outline: 0,
        },
      );
      band.rotation.y = Math.PI / 2;
      for (const side of [1, -1]) {
        this.mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 14), look.accent, head, [
          0,
          0.22,
          side * 0.25,
        ]).rotation.x = Math.PI / 2;
      }
    }
    if (has('scarf')) {
      this.mesh(
        new THREE.TorusGeometry(0.13, 0.05, 6, 16),
        look.accent,
        spine,
        [0, 0.52, 0],
      ).rotation.x = Math.PI / 2;
      const tail = this.dangler(spine, [-0.12, 0.5, 0.08], -0.4, 1.4);
      this.mesh(new THREE.BoxGeometry(0.06, 0.3, 0.1), look.accent, tail, [0, -0.15, 0]);
    }
    if (has('boombox')) {
      this.mesh(new THREE.BoxGeometry(0.2, 0.32, 0.5), 0x2a2a33, spine, [-0.3, 0.32, 0]);
      for (const z of [0.13, -0.13]) {
        this.mesh(
          new THREE.CylinderGeometry(0.09, 0.09, 0.03, 16),
          look.glow,
          spine,
          [-0.41, 0.32, z],
          {
            glow: true,
            outline: 0.01,
          },
        ).rotation.z = Math.PI / 2;
      }
    }
  }

  /** Armas e acessórios que só aparecem durante certos golpes. */
  private buildArmProps(): void {
    const fore = this.joints.foreA;

    const bread = this.group(fore, [0, -0.35, 0]);
    this.mesh(new THREE.CapsuleGeometry(0.08, 0.95, 4, 10), 0xd9a25a, bread, [0, -0.55, 0], {
      glow: true,
    });
    for (let i = 0; i < 4; i++) {
      this.mesh(
        new THREE.BoxGeometry(0.1, 0.02, 0.17),
        0xa86a2a,
        bread,
        [0.05, -0.25 - i * 0.2, 0],
        {
          outline: 0,
        },
      ).rotation.x = 0.5;
    }
    this.addProp('bread', bread);

    const rake = this.group(fore, [0, -0.3, 0]);
    this.mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), 0x8a5a2a, rake, [0, -0.6, 0]);
    this.mesh(new THREE.BoxGeometry(0.1, 0.06, 0.5), 0x7a7f88, rake, [0, -1.2, 0]);
    for (let i = -2; i <= 2; i++) {
      this.mesh(new THREE.BoxGeometry(0.16, 0.025, 0.025), 0x7a7f88, rake, [0.08, -1.2, i * 0.11], {
        outline: 0,
      });
    }
    this.addProp('rake', rake);

    const lid = this.mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.05, 20),
      0xb8c0c8,
      this.joints.foreB,
      [0.1, -0.2, 0],
    );
    lid.rotation.z = Math.PI / 2;
    this.mesh(new THREE.SphereGeometry(0.05, 8, 6), 0x3a3a3a, lid, [0, 0.04, 0], { outline: 0 });
    this.addProp('lid', lid);

    const sword = this.group(fore, [0, -0.35, 0]);
    this.mesh(new THREE.BoxGeometry(0.05, 1.1, 0.12), this.look.accent, sword, [0, -0.55, 0], {
      glow: true,
    });
    this.addProp('sword', sword);

    const hammer = this.group(fore, [0, -0.3, 0]);
    this.mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), 0x555566, hammer, [0, -0.3, 0]);
    this.mesh(new THREE.BoxGeometry(0.45, 0.3, 0.3), this.look.accent, hammer, [0, -0.65, 0], {
      glow: true,
    });
    this.addProp('hammer', hammer);

    const shadow = this.group(fore, [0, -0.3, 0]);
    this.mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.9, 8), 0x2a0a45, shadow, [0, -0.95, 0], {
      glow: true,
    });
    this.mesh(new THREE.SphereGeometry(0.22, 10, 8), 0x7a2bd1, shadow, [0, -1.95, 0], {
      glow: true,
    });
    this.addProp('shadowHand', shadow);

    const rocket = this.mesh(new THREE.ConeGeometry(0.1, 0.35, 8), 0xff9a2e, fore, [0, -0.1, 0], {
      glow: true,
      outline: 0,
    });
    this.addProp('rocket', rocket);

    const wings = this.group(this.joints.spine, [-0.1, 0.4, 0]);
    for (const side of [1, -1]) {
      const wing = this.mesh(new THREE.BoxGeometry(0.4, 0.05, 0.9), this.look.hair, wings, [
        -0.1,
        0,
        side * 0.5,
      ]);
      wing.rotation.x = side * 0.3;
    }
    this.addProp('wings', wings);
  }
}

/**
 * Junta várias peças (filhas diretas do mesmo nó) numa geometria só, com a cor de cada peça
 * nos vértices. Fica só posição, normal e cor, para peças de origens diferentes combinarem.
 */
function mergeColored(meshes: THREE.Mesh[]): THREE.BufferGeometry {
  const parts = meshes.map((mesh) => {
    mesh.updateMatrix();
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    g.morphAttributes = {};
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(mesh.matrix);
    const { r, g: green, b } = (mesh.material as THREE.MeshToonMaterial).color;
    const count = g.attributes.position!.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colors.set([r, green, b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  });
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error('Não foi possível juntar as peças do lutador.');
  return merged;
}

export function neutralPose(): Pose {
  return {
    spine: 0,
    head: 0,
    armA: 0,
    foreA: 0,
    armB: 0,
    foreB: 0,
    legA: 0,
    shinA: 0,
    legB: 0,
    shinB: 0,
    hipsY: 0,
    hipsRot: 0,
    spread: 0,
    twist: 0,
    lunge: 0,
  };
}

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const out = neutralPose();
  for (const key of POSE_KEYS) out[key] = a[key] + (b[key] - a[key]) * t;
  return out;
}
