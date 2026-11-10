import * as THREE from 'three';
import type { CharacterLook } from '../characters/look';
import { emblemTexture } from './emblems';
import { type MouthShape, mouthTexture } from './face-textures';
import { type BoundRig, DANGLE_PREFIX, PROP_PREFIX, bindRig } from './rig';
import { addOutline } from './toon-material';

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

/** lid: abertura dos olhos (0..1); brow: inclinação (positivo = bravo); browY: altura extra. */
const EXPRESSIONS: Record<
  Expression,
  { lid: number; brow: number; browY: number; mouth: MouthShape }
> = {
  neutral: { lid: 1, brow: 0.15, browY: 0, mouth: 'neutral' },
  angry: { lid: 0.72, brow: 0.55, browY: -0.012, mouth: 'grin' },
  shout: { lid: 1, brow: 0.45, browY: 0.01, mouth: 'shout' },
  pain: { lid: 0.3, brow: -0.45, browY: 0.02, mouth: 'pain' },
  happy: { lid: 0.75, brow: -0.25, browY: 0.025, mouth: 'smile' },
  dizzy: { lid: 0.6, brow: -0.3, browY: 0, mouth: 'wavy' },
  sleepy: { lid: 0.35, brow: -0.1, browY: -0.006, mouth: 'sleepy' },
  ko: { lid: 0, brow: -0.4, browY: 0, mouth: 'pain' },
};

/** Parte que balança com mola (capa, cabelo, cachecol, orelhas). */
interface Dangler {
  pivot: THREE.Object3D;
  rest: number;
  angle: number;
  velocity: number;
  /** Quanto a parte reage ao movimento do corpo. */
  gain: number;
}

const gradient = (() => {
  const tones = new Uint8Array([90, 170, 255]);
  const texture = new THREE.DataTexture(tones, tones.length, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
})();

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
  /** Altura do quadril, depende do tamanho das pernas de cada lutador. */
  hipHeight: number;
  private readonly thigh: number;
  private readonly shin: number;
  private readonly eyes: { pupil: THREE.Object3D | null; lid: THREE.Object3D }[] = [];
  private readonly brows: { mesh: THREE.Object3D; side: 1 | -1; y: number }[] = [];
  private mouth: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
  private expression: Expression = 'neutral';
  private readonly danglers: Dangler[] = [];
  private lastX: number | null = null;
  private lastY = 0;
  private blinkIn = 2 + Math.random() * 3;
  private blinkFor = 0;
  private time = 0;
  private stretch = 1;

  /**
   * @param source modelo carregado de um .glb (feito no Blender). Sem ele, o lutador é montado
   * com primitivas. O .glb precisa ter nós com os nomes de `RIG_JOINTS` (veja docs/MODELOS-3D.md).
   */
  constructor(
    readonly look: CharacterLook,
    source?: THREE.Object3D,
  ) {
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
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.userData.outline) o.castShadow = true;
    });
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
      addOutline(mesh, 0.02);
    }
    for (const [name, objects] of rig.props) {
      for (const o of objects) this.addProp(name as PropName, o);
    }
    for (const pivot of rig.danglers) {
      const rest = pivot.rotation.z;
      this.danglers.push({ pivot, rest, angle: rest, velocity: 0, gain: 1 });
    }
    this.eyes.push(...rig.eyes);
    this.hands.push(...rig.hands);
    this.addEmblem(rig.joints.spine);
    for (const brow of rig.brows) {
      this.brows.push({ mesh: brow, side: brow.position.z >= 0 ? 1 : -1, y: brow.position.y });
    }
    if (rig.mouth) {
      const mouth = new THREE.Mesh(
        new THREE.PlaneGeometry(0.17, 0.085),
        new THREE.MeshBasicMaterial({ map: mouthTexture('neutral'), transparent: true }),
      );
      mouth.rotation.y = Math.PI / 2;
      rig.mouth.add(mouth);
      this.mouth = mouth;
    }
    this.expression = 'ko';
    this.setExpression('neutral');
  }

  /** Aproxima a pose atual da pose alvo (rate 0..1 por quadro de 60 Hz). */
  applyPose(target: Pose, rate: number, dt: number): void {
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
    this.joints.armA.rotation.x = -p.spread;
    this.joints.armB.rotation.x = p.spread;
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
    const e = EXPRESSIONS[expression];
    if (this.mouth) this.mouth.material.map = mouthTexture(e.mouth);
    for (const brow of this.brows) {
      brow.mesh.rotation.x = -brow.side * e.brow;
      brow.mesh.position.y = brow.y + e.browY;
    }
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
    const e = EXPRESSIONS[this.expression];
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkFor = 0.12;
      this.blinkIn = 2 + Math.random() * 3.5;
    }
    this.blinkFor = Math.max(0, this.blinkFor - dt);
    const open = this.blinkFor > 0 ? 0 : e.lid;
    // Pálpebra = meia esfera girando na frente do olho: -90° fecha, +90° abre.
    const angle = -Math.PI / 2 + open * Math.PI;
    for (const eye of this.eyes) {
      eye.lid.rotation.z += (angle - eye.lid.rotation.z) * Math.min(1, dt * 25);
      if (!eye.pupil) continue;
      if (this.expression === 'dizzy') {
        eye.pupil.position.y = Math.sin(this.time * 8) * 0.025;
        eye.pupil.position.z = Math.cos(this.time * 8) * 0.025;
      } else {
        eye.pupil.position.y = 0;
        eye.pupil.position.z = 0;
      }
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
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }

  // -------------------------------------------------------------------------

  private material(color: number, glow = false): THREE.MeshToonMaterial {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: gradient });
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
    this.buildFace(head, has('glowEyes'), has('visor'));
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

  /** Olhos com pálpebra e pupila, sobrancelhas e boca trocável (expressões). */
  private buildFace(head: THREE.Group, glowEyes: boolean, visor: boolean): void {
    const { look } = this;
    const snout = look.extras.includes('snout');
    if (visor) {
      this.mesh(new THREE.BoxGeometry(0.06, 0.07, 0.3), look.accent, head, [0.23, 0.25, 0], {
        glow: true,
        outline: 0.015,
      });
    } else {
      for (const side of [1, -1] as const) {
        const z = side * 0.085;
        const eye = this.group(head, [0.2, 0.25, z]);
        eye.name = 'eye';
        const radius = glowEyes ? 0.058 : 0.068;
        this.mesh(
          new THREE.SphereGeometry(radius, 14, 10),
          glowEyes ? look.glow : 0xffffff,
          eye,
          [0, 0, 0],
          {
            glow: glowEyes,
            outline: 0.012,
          },
        );
        let pupil: THREE.Group | null = null;
        if (!glowEyes) {
          pupil = this.group(eye, [0, 0, 0]);
          pupil.name = 'pupil';
          this.mesh(new THREE.SphereGeometry(0.034, 10, 8), 0x111111, pupil, [0.052, 0, 0], {
            outline: 0,
          });
          // Brilhinho no olho, típico de desenho animado.
          this.mesh(new THREE.SphereGeometry(0.011, 6, 4), 0xffffff, pupil, [0.08, 0.016, 0.01], {
            outline: 0,
          });
        }
        // Pálpebra: meia esfera da cor da pele que gira para cobrir o olho.
        const lid = this.mesh(
          new THREE.SphereGeometry(radius * 1.12, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          look.skin,
          eye,
          [0, 0, 0],
          { outline: 0 },
        );
        lid.rotation.z = Math.PI / 2;
        lid.name = 'lid';
        this.eyes.push({ pupil, lid });
        const browY = 0.36;
        const brow = this.mesh(new THREE.BoxGeometry(0.028, 0.03, 0.12), darker(look.hair), head, [
          0.215,
          browY,
          z,
        ]);
        brow.rotation.order = 'ZXY';
        brow.name = 'brow';
        brow.rotation.z = -0.35;
        this.brows.push({ mesh: brow, side, y: browY });
      }
    }
    const mouth = new THREE.Mesh(
      new THREE.PlaneGeometry(0.17, 0.085),
      new THREE.MeshBasicMaterial({ map: mouthTexture('neutral'), transparent: true }),
    );
    mouth.position.set(snout ? 0.348 : 0.248, snout ? 0.085 : 0.115, 0);
    mouth.rotation.y = Math.PI / 2;
    mouth.name = 'mouth';
    head.add(mouth);
    this.mouth = mouth;
    this.expression = 'ko';
    this.setExpression('neutral');
  }

  /** Emblema do lutador no peito (desenhado em textura, por cima da roupa). */
  private addEmblem(spine: THREE.Object3D): void {
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
    emblem.position.set(0.172 * look.bulk + 0.004, 0.34 * t, 0);
    emblem.rotation.y = Math.PI / 2;
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

/** Cor um pouco mais escura (sobrancelhas). */
function darker(color: number): number {
  return new THREE.Color(color).multiplyScalar(0.6).getHex();
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
