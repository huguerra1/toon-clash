import * as THREE from 'three';
import type { CharacterLook } from '../characters/look';
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
export type Pose = Record<Joint, number> & { hipsY: number; hipsRot: number; spread: number };
const POSE_KEYS = [...JOINTS, 'hipsY', 'hipsRot', 'spread'] as const;

export type PropName =
  'sword' | 'hammer' | 'jets' | 'horn' | 'wings' | 'shadowHand' | 'rocket' | 'stars' | 'bigHands';

const THIGH = 0.42;
const SHIN = 0.4;
export const HIP_HEIGHT = THIGH + SHIN + 0.06;

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
  readonly hips = new THREE.Group();
  readonly joints = {} as Record<Joint, THREE.Group>;
  readonly pose: Pose = neutralPose();
  private readonly materials: THREE.MeshToonMaterial[] = [];
  private readonly baseEmissive = new Map<THREE.MeshToonMaterial, THREE.Color>();
  private readonly props = new Map<PropName, THREE.Object3D[]>();
  private readonly hands: THREE.Object3D[] = [];
  private flash = 0;

  constructor(readonly look: CharacterLook) {
    this.root.add(this.body);
    this.body.scale.setScalar(look.scale);
    this.body.add(this.hips);
    this.build();
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial)
        o.castShadow = true;
    });
  }

  /** Aproxima a pose atual da pose alvo (rate 0..1 por quadro de 60 Hz). */
  applyPose(target: Pose, rate: number, dt: number): void {
    const k = 1 - Math.pow(1 - rate, dt * 60);
    for (const key of POSE_KEYS) this.pose[key] += (target[key] - this.pose[key]) * k;
    const p = this.pose;
    this.hips.position.y = HIP_HEIGHT + p.hipsY;
    this.hips.rotation.z = p.hipsRot;
    this.joints.spine.rotation.z = -p.spine;
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
    for (const m of this.materials) {
      const base = this.baseEmissive.get(m)!;
      m.emissive.setRGB(
        base.r + (1 - base.r) * this.flash * 0.8,
        base.g + (1 - base.g) * this.flash * 0.8,
        base.b + (1 - base.b) * this.flash * 0.8,
      );
    }
    const stars = this.props.get('stars')?.[0];
    if (stars?.visible) stars.rotation.y += dt * 4;
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
    const emissive = new THREE.Color(glow ? color : 0x000000);
    if (glow) emissive.multiplyScalar(0.7);
    m.emissive.copy(emissive);
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

    // Tronco
    const spine = this.group(this.hips, [0, 0.02, 0]);
    this.joints.spine = spine;
    this.mesh(new THREE.SphereGeometry(0.19 * b, 14, 10), look.bottom, spine, [0, 0.02, 0]);
    const torso = this.mesh(
      new THREE.CapsuleGeometry(0.2 * b, 0.22, 6, 14),
      look.top,
      spine,
      [0, 0.3, 0],
    );
    torso.scale.set(0.85, 1, 1.05);
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
      const cape = this.mesh(new THREE.BoxGeometry(0.04, 0.95, 0.5 * b), look.hair, spine, [
        -0.2 * b,
        0.05,
        0,
      ]);
      cape.rotation.z = -0.12;
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
    const head = this.group(spine, [0, 0.55, 0]);
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
        const ear = this.mesh(new THREE.ConeGeometry(0.07, 0.22, 6), look.skin, head, [
          0,
          0.3,
          side * 0.24,
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
    const shoulderZ = 0.25 * b + 0.05;
    if (has('shoulderPads')) {
      for (const z of [shoulderZ, -shoulderZ]) {
        this.mesh(new THREE.SphereGeometry(0.14 * b, 10, 8), look.top, spine, [0, 0.47, z]);
      }
    }
    for (const side of ['A', 'B'] as const) {
      const z = side === 'A' ? shoulderZ : -shoulderZ;
      const arm = this.group(spine, [0, 0.45, z]);
      this.mesh(new THREE.CapsuleGeometry(0.075 * b, 0.18, 4, 10), look.top, arm, [0, -0.14, 0]);
      const fore = this.group(arm, [0, -0.3, 0]);
      const gauntlet = has('gauntlets');
      const skinColor = gauntlet ? look.accent : look.skin;
      this.mesh(
        new THREE.CapsuleGeometry(gauntlet ? 0.085 : 0.065 * b, 0.16, 4, 10),
        skinColor,
        fore,
        [0, -0.13, 0],
      );
      const glowHands = has('glowHands');
      const hand = this.mesh(
        new THREE.SphereGeometry(gauntlet ? 0.11 : 0.085 * b, 12, 10),
        glowHands ? look.glow : skinColor,
        fore,
        [0, -0.3, 0],
        {
          glow: glowHands,
        },
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
    for (const side of ['A', 'B'] as const) {
      const z = (side === 'A' ? 1 : -1) * 0.11 * b;
      const leg = this.group(this.hips, [0, -0.02, z]);
      this.mesh(new THREE.CapsuleGeometry(0.09 * b, 0.24, 4, 10), look.bottom, leg, [
        0,
        -THIGH / 2,
        0,
      ]);
      const shin = this.group(leg, [0, -THIGH, 0]);
      this.mesh(new THREE.CapsuleGeometry(0.075 * b, 0.24, 4, 10), look.bottom, shin, [
        0,
        -SHIN / 2 + 0.02,
        0,
      ]);
      this.mesh(new THREE.BoxGeometry(0.26, 0.1, 0.14 * b), look.shoes, shin, [
        0.06,
        -SHIN - 0.01,
        0,
      ]);
      const jet = this.mesh(
        new THREE.ConeGeometry(0.08, 0.3, 8),
        0xff9a2e,
        shin,
        [0, -SHIN - 0.2, 0],
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

  private buildFace(head: THREE.Group, glowEyes: boolean, visor: boolean): void {
    if (visor) {
      this.mesh(new THREE.BoxGeometry(0.06, 0.07, 0.3), this.look.accent, head, [0.23, 0.25, 0], {
        glow: true,
        outline: 0.015,
      });
      return;
    }
    for (const z of [0.085, -0.085]) {
      if (glowEyes) {
        this.mesh(new THREE.SphereGeometry(0.055, 10, 8), this.look.glow, head, [0.21, 0.25, z], {
          glow: true,
          outline: 0.012,
        });
        continue;
      }
      this.mesh(new THREE.SphereGeometry(0.065, 12, 10), 0xffffff, head, [0.2, 0.25, z], {
        outline: 0.012,
      });
      this.mesh(new THREE.SphereGeometry(0.032, 8, 6), 0x111111, head, [0.255, 0.25, z], {
        outline: 0,
      });
    }
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
        this.mesh(new THREE.BoxGeometry(0.14, 0.75, 0.44), look.hair, head, [-0.16, -0.02, 0]);
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

  /** Armas e acessórios que só aparecem durante certos golpes. */
  private buildArmProps(): void {
    const fore = this.joints.foreA;
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
  };
}

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const out = neutralPose();
  for (const key of POSE_KEYS) out[key] = a[key] + (b[key] - a[key]) * t;
  return out;
}
