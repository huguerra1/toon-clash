import * as THREE from 'three';
import { ARENA_HALF_WIDTH } from '../combat/constants';
import { addOutline, createToonMaterial } from './toon-material';

export type StageId = 'rooftop' | 'forest' | 'base' | 'ship';

export interface StageInfo {
  id: StageId;
  name: string;
}

export const STAGES: StageInfo[] = [
  { id: 'rooftop', name: 'Telhado da Cidade' },
  { id: 'forest', name: 'Floresta Alienígena' },
  { id: 'base', name: 'Base Secreta' },
  { id: 'ship', name: 'Nave do Conquistador' },
];

export interface BuiltStage {
  group: THREE.Group;
  background: THREE.Texture;
  fog: THREE.Fog;
  /** Animação leve de cenário (luzes piscando, cristais girando). */
  update(time: number): void;
}

function gradientTexture(top: string, bottom: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  color: number,
  position: [number, number, number],
  outline = 0.03,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), createToonMaterial(color));
  mesh.position.set(...position);
  mesh.receiveShadow = true;
  if (outline > 0) addOutline(mesh, outline);
  parent.add(mesh);
  return mesh;
}

function glowMaterial(color: number, strength = 0.9): THREE.MeshToonMaterial {
  const m = createToonMaterial(color);
  m.emissive.setHex(color).multiplyScalar(strength);
  m.emissiveIntensity = 2.5;
  return m;
}

/** Piso comum: plataforma larga um pouco além das paredes invisíveis. */
function floor(group: THREE.Group, color: number, edge: number): void {
  const width = ARENA_HALF_WIDTH * 2 + 10;
  const top = box(group, [width, 0.5, 7], color, [0, -0.25, 0], 0.04);
  top.receiveShadow = true;
  box(group, [width, 0.25, 0.3], edge, [0, -0.05, 3.4], 0);
}

function windowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1b1438';
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 128; y += 14) {
    for (let x = 6; x < 64; x += 14) {
      ctx.fillStyle = (x * 7 + y * 13) % 5 < 2 ? '#ffd86b' : '#2f2660';
      ctx.fillRect(x, y, 8, 8);
    }
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

function buildRooftop(): BuiltStage {
  const group = new THREE.Group();
  floor(group, 0x5d4b7a, 0x3b2f52);
  const windows = windowTexture();
  for (let i = -6; i <= 6; i++) {
    const h = 6 + ((((i * 37) % 7) + 7) % 7) * 1.6;
    const w = 2.4 + (i % 3) * 0.4;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 2),
      new THREE.MeshToonMaterial({ map: windows, emissive: 0x221a44 }),
    );
    mesh.position.set(i * 3.4, h / 2 - 2, -12 - (i % 2) * 3);
    addOutline(mesh, 0.05);
    group.add(mesh);
  }
  const moon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16), glowMaterial(0xfff2b0, 1));
  moon.position.set(9, 12, -28);
  group.add(moon);
  // Caixas d'água e ar-condicionado no telhado
  box(group, [1.2, 0.8, 1], 0x9aa3b5, [-5.5, 0.4, -2.2]);
  box(group, [1, 0.6, 0.9], 0x9aa3b5, [6, 0.3, -2.4]);
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 1.6, 16),
    createToonMaterial(0xb5651d),
  );
  tank.position.set(-8, 2.2, -3.5);
  addOutline(tank, 0.04);
  group.add(tank);
  box(group, [0.15, 1.6, 0.15], 0x3b2f52, [-8.6, 0.8, -3.2], 0.02);
  box(group, [0.15, 1.6, 0.15], 0x3b2f52, [-7.4, 0.8, -3.8], 0.02);
  const antennaLight = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), glowMaterial(0xff3355));
  antennaLight.position.set(4, 5.2, -6);
  group.add(antennaLight);
  box(group, [0.1, 5, 0.1], 0x2d2445, [4, 2.6, -6], 0.02);
  return {
    group,
    background: gradientTexture('#140b33', '#6b3fa0'),
    fog: new THREE.Fog(0x3b2566, 18, 45),
    update: (time) => {
      antennaLight.visible = Math.sin(time * 3) > 0;
    },
  };
}

function buildForest(): BuiltStage {
  const group = new THREE.Group();
  floor(group, 0x3f8f6b, 0x2a6049);
  const crystals: THREE.Mesh[] = [];
  for (let i = -5; i <= 5; i++) {
    const z = -6 - Math.abs(i % 3) * 3;
    const h = 2 + ((((i * 53) % 5) + 5) % 5) * 0.7;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.4, h, 10),
      createToonMaterial(0xf2e3c6),
    );
    stem.position.set(i * 3.1, h / 2, z);
    addOutline(stem, 0.03);
    group.add(stem);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(1.2 + (i % 2) * 0.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      createToonMaterial(i % 2 === 0 ? 0xd94f8c : 0x8c4fd9),
    );
    cap.position.set(i * 3.1, h, z);
    addOutline(cap, 0.04);
    group.add(cap);
    if (i % 2 === 0) {
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.5),
        glowMaterial(0x4df2ff, 0.7),
      );
      crystal.position.set(i * 3.1 + 1.4, 0.6, z + 2);
      crystal.scale.set(0.7, 1.6, 0.7);
      addOutline(crystal, 0.03);
      group.add(crystal);
      crystals.push(crystal);
    }
  }
  for (const [x, y, r, c] of [
    [-10, 13, 2.5, 0xffb3e6],
    [6, 16, 1.4, 0xb3fff0],
  ] as const) {
    const moon = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), glowMaterial(c, 1));
    moon.position.set(x, y, -30);
    group.add(moon);
  }
  return {
    group,
    background: gradientTexture('#0c3a4a', '#47c7a8'),
    fog: new THREE.Fog(0x2a8a7a, 16, 42),
    update: (time) => {
      crystals.forEach((c, i) => (c.rotation.y = time * 0.8 + i));
    },
  };
}

function stripesTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffcc00';
  for (let i = -64; i < 128; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 16, 0);
    ctx.lineTo(i + 80, 64);
    ctx.lineTo(i + 64, 64);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(40, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildBase(): BuiltStage {
  const group = new THREE.Group();
  floor(group, 0x8c97a6, 0x56606e);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(ARENA_HALF_WIDTH * 2 + 10, 0.02, 0.4),
    new THREE.MeshToonMaterial({ map: stripesTexture() }),
  );
  stripe.position.set(0, 0.01, 2.9);
  group.add(stripe);
  box(group, [40, 12, 0.5], 0x4a5566, [0, 5, -7], 0.05);
  const screens: THREE.Mesh[] = [];
  for (let i = -3; i <= 3; i++) {
    box(group, [2.6, 1.6, 0.3], 0x2a313c, [i * 4, 3.5, -6.6], 0.04);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.2),
      glowMaterial(i % 2 ? 0x37ff8b : 0x37c8ff, 0.8),
    );
    screen.position.set(i * 4, 3.5, -6.4);
    group.add(screen);
    screens.push(screen);
  }
  for (const y of [7, 8.2]) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 40, 12),
      createToonMaterial(0xc0582a),
    );
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, y, -6.3);
    addOutline(pipe, 0.03);
    group.add(pipe);
  }
  box(group, [1.2, 1.2, 1.2], 0x8a6a3a, [-7, 0.6, -2.5]);
  box(group, [1, 1, 1], 0x8a6a3a, [-6.2, 0.5, -3.6]);
  box(group, [1.2, 1.2, 1.2], 0x8a6a3a, [7.5, 0.6, -3]);
  return {
    group,
    background: gradientTexture('#1a1f2b', '#3b4658'),
    fog: new THREE.Fog(0x2b3242, 14, 40),
    update: (time) => {
      screens.forEach((s, i) => {
        (s.material as THREE.MeshToonMaterial).emissiveIntensity =
          0.7 + Math.sin(time * 4 + i) * 0.3;
      });
    },
  };
}

function buildShip(): BuiltStage {
  const group = new THREE.Group();
  floor(group, 0x3a2430, 0x1e121a);
  box(group, [40, 14, 0.5], 0x2a1a24, [0, 6, -8], 0.05);
  for (let i = -4; i <= 4; i++) {
    box(group, [2.2, 3.2, 0.3], 0x5a1a2a, [i * 4.2, 5, -7.6], 0.04);
    const space = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 2.8),
      new THREE.MeshBasicMaterial({ color: 0x05030f }),
    );
    space.position.set(i * 4.2, 5, -7.4);
    group.add(space);
    for (let s = 0; s < 6; s++) {
      const star = new THREE.Mesh(
        new THREE.PlaneGeometry(0.06, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      star.position.set(i * 4.2 + ((s * 0.71) % 1.6) - 0.8, 5 + ((s * 0.53) % 2.4) - 1.2, -7.35);
      group.add(star);
    }
  }
  const lights: THREE.Mesh[] = [];
  for (let i = -3; i <= 3; i++) {
    box(group, [0.8, 9, 0.8], 0x4a2a38, [i * 6, 4.5, -5], 0.04);
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.2, 0.85), glowMaterial(0xff2a2a));
    light.position.set(i * 6, 7.5, -5);
    group.add(light);
    lights.push(light);
  }
  box(group, [2, 3.5, 1.2], 0x7a1a2a, [0, 1.75, -6], 0.05);
  return {
    group,
    background: gradientTexture('#0d0408', '#4a0d1c'),
    fog: new THREE.Fog(0x2a0a14, 14, 38),
    update: (time) => {
      lights.forEach((l, i) => (l.visible = Math.sin(time * 2 + i) > -0.6));
    },
  };
}

export function buildStage(id: StageId): BuiltStage {
  switch (id) {
    case 'rooftop':
      return buildRooftop();
    case 'forest':
      return buildForest();
    case 'base':
      return buildBase();
    case 'ship':
      return buildShip();
  }
}
