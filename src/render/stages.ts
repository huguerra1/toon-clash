import * as THREE from 'three';
import { ARENA_HALF_WIDTH } from '../combat/constants';
import { addOutline, createToonMaterial } from './toon-material';
import { CPU_CANVAS } from './canvas';

export type StageId = 'rooftop' | 'forest' | 'base' | 'ship' | 'park' | 'sweets';

export interface StageInfo {
  id: StageId;
  name: string;
}

export const STAGES: StageInfo[] = [
  { id: 'rooftop', name: 'Telhado da Cidade' },
  { id: 'forest', name: 'Floresta Alienígena' },
  { id: 'base', name: 'Base Secreta' },
  { id: 'ship', name: 'Nave do Conquistador' },
  { id: 'park', name: 'Parque ao Entardecer' },
  { id: 'sweets', name: 'Reino dos Doces' },
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
  const ctx = canvas.getContext('2d', CPU_CANVAS)!;
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

/** Lotes pequenos e móveis: evita limites de recorte desatualizados nas animações. */
function instances(
  parent: THREE.Object3D,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = name;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  // O descarte comum percorre geometrias; libera também os buffers das instâncias.
  geometry.addEventListener('dispose', () => mesh.dispose());
  parent.add(mesh);
  return mesh;
}

/** Duas fileiras, com corpo e cabeça em apenas duas chamadas de desenho. */
function addAudience(group: THREE.Group, color: number, z = -4.8): (time: number) => void {
  const material = createToonMaterial(color);
  const bodies = instances(
    group,
    'audience-bodies',
    new THREE.CylinderGeometry(0.22, 0.3, 0.65, 5),
    material,
    48,
  );
  const heads = instances(
    group,
    'audience-heads',
    new THREE.IcosahedronGeometry(0.23, 0),
    material,
    48,
  );
  for (let row = 0; row < 2; row++) {
    box(group, [29, 0.3 + row * 0.4, 1], color, [0, row * 0.2, z - row * 1.2], 0);
  }
  const dummy = new THREE.Object3D();
  const update = (time: number) => {
    for (let i = 0; i < bodies.count; i++) {
      const row = Math.floor(i / 24);
      const phase = i * 2.39;
      const size = 0.85 + (i % 5) * 0.07;
      const sway = Math.sin(time * 1.8 + phase) * 0.09;
      const jump = Math.max(0, Math.sin(time * (2.3 + (i % 3) * 0.15) + phase)) * 0.18;
      const x = ((i % 24) - 11.5) * 1.16 + row * 0.25;
      const y = 0.15 + row * 0.4 + jump;
      dummy.position.set(x + sway * 0.35, y + size * 0.38, z - row * 1.2);
      dummy.rotation.set(0, 0, -sway);
      dummy.scale.set(size, size, size);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x + sway, y + size * 0.93, z - row * 1.2);
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
    }
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return update;
}

/** Nuvens opacas em planos distantes, sem transparência ou luzes adicionais. */
function addClouds(
  group: THREE.Group,
  color: number,
  height: number,
  z: number,
  speed: number,
): (time: number) => void {
  const clouds = instances(
    group,
    'clouds',
    new THREE.SphereGeometry(1, 10, 6),
    createToonMaterial(color),
    30,
  );
  const dummy = new THREE.Object3D();
  const update = (time: number) => {
    for (let i = 0; i < 30; i++) {
      const cloud = Math.floor(i / 5);
      const lobe = i % 5;
      const x = ((cloud * 12 + time * speed + 4) % 72) - 36;
      dummy.position.set(
        x + (lobe - 2) * 0.95,
        height + (cloud % 3) * 1.6 + Math.sin(lobe * 2) * 0.35,
        z - (cloud % 2) * 2,
      );
      dummy.scale.set(1.65, 0.65 + (lobe % 2) * 0.25, 0.55);
      dummy.updateMatrix();
      clouds.setMatrixAt(i, dummy.matrix);
    }
    clouds.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return update;
}

function windowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d', CPU_CANVAS)!;
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
  const updateAudience = addAudience(group, 0x29223e, -5.4);
  const updateClouds = addClouds(group, 0x615c86, 11.7, -23, 0.65);
  const windows = windowTexture();
  // Uma segunda linha de prédios recorta o horizonte além das torres principais.
  for (let i = -7; i <= 7; i++) {
    const height = 5 + ((i + 7) % 4) * 1.3;
    box(group, [3.1, height, 2], 0x3a315c, [i * 4, height / 2 + 1, -22], 0);
  }
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
  const signs: THREE.Mesh[] = [];
  for (const [x, y, color] of [
    [-9, 6.5, 0xff6ba9],
    [0, 4.8, 0x55deed],
    [10, 8.5, 0xffbc55],
  ] as const) {
    box(group, [2.1, 1.3, 0.25], 0x25203d, [x, y, -10.8]);
    // Glifos geométricos próprios, sem marcas ou texto de outras obras.
    for (let j = 0; j < 3; j++) {
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.55 + j * 0.18, 0.08),
        glowMaterial(color),
      );
      sign.position.set(x - 0.6 + j * 0.6, y, -10.6);
      sign.rotation.z = j === 1 ? 0.4 : -0.2;
      group.add(sign);
      signs.push(sign);
    }
  }
  const traffic = instances(
    group,
    'traffic',
    new THREE.BoxGeometry(0.8, 0.22, 0.35),
    createToonMaterial(0x343956),
    12,
  );
  const headlights = instances(
    group,
    'headlights',
    new THREE.BoxGeometry(0.12, 0.09, 0.06),
    glowMaterial(0xffdf99),
    24,
  );
  box(group, [52, 0.18, 1], 0x3f355b, [0, 2.1, -10], 0);
  box(group, [52, 0.18, 1], 0x3f355b, [0, 4.1, -19], 0);
  const dummy = new THREE.Object3D();
  return {
    group,
    background: gradientTexture('#140b33', '#6b3fa0'),
    fog: new THREE.Fog(0x3b2566, 18, 45),
    update: (time) => {
      updateAudience(time);
      updateClouds(time);
      antennaLight.visible = Math.sin(time * 3) > 0;
      signs.forEach((sign, i) => {
        (sign.material as THREE.MeshToonMaterial).emissiveIntensity =
          Math.sin(time * 2.2 + Math.floor(i / 3) * 1.9) > -0.75 ? 2.5 : 0.25;
      });
      for (let i = 0; i < traffic.count; i++) {
        const lane = i % 2;
        const travel = (time * (lane ? 2.4 : 3.2) + i * 4.7) % 52;
        const x = lane ? 26 - travel : travel - 26;
        const y = 2.32 + lane * 2;
        const z = -10 - lane * 9;
        dummy.position.set(x, y, z);
        dummy.updateMatrix();
        traffic.setMatrixAt(i, dummy.matrix);
        for (let light = 0; light < 2; light++) {
          dummy.position.set(x - 0.25 + light * 0.5, y, z + 0.2);
          dummy.updateMatrix();
          headlights.setMatrixAt(i * 2 + light, dummy.matrix);
        }
      }
      traffic.instanceMatrix.needsUpdate = true;
      headlights.instanceMatrix.needsUpdate = true;
    },
  };
}

function buildForest(): BuiltStage {
  const group = new THREE.Group();
  floor(group, 0x3f8f6b, 0x2a6049);
  box(group, [44, 0.3, 22], 0x34755d, [0, -0.2, -14.5], 0);
  const updateAudience = addAudience(group, 0x17473f);
  const crystals: THREE.Mesh[] = [];
  const caps: THREE.Mesh[] = [];
  // Troncos altos no horizonte, separados da fileira de cogumelos.
  for (let i = -5; i <= 5; i++) {
    const trunk = box(group, [0.65, 12 + (i % 3), 0.7], 0x29665e, [i * 4.6, 5, -22], 0.02);
    trunk.rotation.z = Math.sin(i * 2) * 0.12;
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.8, 0),
      createToonMaterial(0x337f70),
    );
    crown.position.set(i * 4.6, 10 + (i % 3), -22);
    crown.scale.set(1, 1.4, 0.6);
    group.add(crown);
  }
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
    caps.push(cap);
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
  const leaves = instances(
    group,
    'swaying-plants',
    new THREE.ConeGeometry(0.23, 1.5, 5),
    createToonMaterial(0x68b985),
    54,
  );
  const fireflyMaterial = glowMaterial(0xd7ff86, 0.65);
  const fireflies = instances(
    group,
    'fireflies',
    new THREE.IcosahedronGeometry(0.055, 0),
    fireflyMaterial,
    40,
  );
  const dummy = new THREE.Object3D();
  return {
    group,
    background: gradientTexture('#0c3a4a', '#47c7a8'),
    fog: new THREE.Fog(0x2a8a7a, 16, 42),
    update: (time) => {
      updateAudience(time);
      crystals.forEach((c, i) => (c.rotation.y = time * 0.8 + i));
      caps.forEach((cap, i) => {
        const pulse = Math.sin(time * 1.3 + i * 1.7) * 0.025;
        cap.scale.set(1 + pulse, 1 - pulse * 0.6, 1 + pulse);
      });
      for (let i = 0; i < leaves.count; i++) {
        const plant = Math.floor(i / 3);
        const tilt = ((i % 3) - 1) * 0.55 + Math.sin(time * 1.5 + plant * 1.2) * 0.14;
        const x = ((plant % 9) - 4) * 3.2;
        const z = -7.2 - Math.floor(plant / 9) * 5;
        dummy.position.set(x - Math.sin(tilt) * 0.65, 0.15 + Math.cos(tilt) * 0.65, z);
        dummy.rotation.set(0, plant * 0.7, tilt);
        dummy.scale.set(1, 0.8 + (plant % 3) * 0.2, 1);
        dummy.updateMatrix();
        leaves.setMatrixAt(i, dummy.matrix);
      }
      dummy.rotation.set(0, 0, 0);
      for (let i = 0; i < fireflies.count; i++) {
        const phase = i * 2.4;
        dummy.position.set(
          ((i * 3.7) % 30) - 15 + Math.sin(time * 0.6 + phase) * 0.6,
          1.4 + ((i * 0.7) % 4) + Math.sin(time * 1.1 + phase) * 0.45,
          -6.5 - (i % 5) * 2 + Math.cos(time * 0.5 + phase) * 0.4,
        );
        dummy.scale.setScalar(0.65 + (Math.sin(time * 2 + phase) + 1) * 0.35);
        dummy.updateMatrix();
        fireflies.setMatrixAt(i, dummy.matrix);
      }
      leaves.instanceMatrix.needsUpdate = true;
      fireflies.instanceMatrix.needsUpdate = true;
    },
  };
}

function stripesTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d', CPU_CANVAS)!;
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
  const updateAudience = addAudience(group, 0x293440, -4.2);
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
  const arms: { shoulder: THREE.Group; elbow: THREE.Group }[] = [];
  for (const x of [-9, -3, 3, 9]) {
    box(group, [1.4, 0.5, 1.2], 0x313d4d, [x, 0.25, -5.9]);
    const shoulder = new THREE.Group();
    shoulder.position.set(x, 0.6, -5.8);
    group.add(shoulder);
    const jointMaterial = createToonMaterial(0xc48a45);
    const jointGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.55, 8);
    const joint = new THREE.Mesh(jointGeometry, jointMaterial);
    joint.rotation.x = Math.PI / 2;
    shoulder.add(joint);
    box(shoulder, [0.38, 1.65, 0.4], 0xa2b2bd, [0, 0.85, 0]);
    const elbow = new THREE.Group();
    elbow.position.y = 1.7;
    shoulder.add(elbow);
    const elbowJoint = new THREE.Mesh(jointGeometry, jointMaterial);
    elbowJoint.rotation.x = Math.PI / 2;
    elbow.add(elbowJoint);
    box(elbow, [0.3, 1.25, 0.35], 0xd0a04a, [0, 0.65, 0]);
    box(elbow, [0.7, 0.18, 0.4], 0x313d4d, [0, 1.3, 0]);
    for (const side of [-1, 1]) {
      box(elbow, [0.12, 0.4, 0.2], 0x93a4b4, [side * 0.28, 1.52, 0]);
    }
    arms.push({ shoulder, elbow });
  }
  const beacons: THREE.Group[] = [];
  for (const x of [-14, 0, 14]) {
    box(group, [0.9, 0.2, 0.8], 0x29323f, [x, 9, -6.1]);
    const beacon = new THREE.Group();
    beacon.position.set(x, 9.3, -6.1);
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.3, 0.5, 8),
      glowMaterial(0xff7c39),
    );
    beacon.add(lamp);
    // A faixa gira com a lente; o brilho é emissivo, sem luz pontual.
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.12), glowMaterial(0xffdf7b));
    lens.position.z = 0.29;
    beacon.add(lens);
    group.add(beacon);
    beacons.push(beacon);
  }
  const steamMaterial = createToonMaterial(0xbac9cb);
  steamMaterial.transparent = true;
  steamMaterial.opacity = 0.23;
  steamMaterial.depthWrite = false;
  const steam = instances(group, 'steam', new THREE.IcosahedronGeometry(1, 0), steamMaterial, 24);
  const vents = [-11, -4.8, 4.8, 11];
  for (const x of vents) {
    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8),
      createToonMaterial(0xc0582a),
    );
    nozzle.position.set(x, 7.35, -5.9);
    addOutline(nozzle, 0.03);
    group.add(nozzle);
  }
  const dummy = new THREE.Object3D();
  return {
    group,
    background: gradientTexture('#1a1f2b', '#3b4658'),
    fog: new THREE.Fog(0x2b3242, 14, 40),
    update: (time) => {
      updateAudience(time);
      screens.forEach((s, i) => {
        (s.material as THREE.MeshToonMaterial).emissiveIntensity =
          0.7 + Math.sin(time * 4 + i) * 0.3;
      });
      arms.forEach(({ shoulder, elbow }, i) => {
        shoulder.rotation.z = Math.sin(time * 0.65 + i * 1.8) * 0.55;
        elbow.rotation.z = 0.8 + Math.sin(time * 0.85 + i * 1.4) * 0.6;
      });
      beacons.forEach((beacon, i) => (beacon.rotation.y = time * 2.5 + i * 2));
      for (let i = 0; i < steam.count; i++) {
        const age = (time * 0.28 + (i % 6) / 6) % 1;
        const vent = Math.floor(i / 6);
        dummy.position.set(
          vents[vent]! + Math.sin(time * 0.7 + i) * age * 0.4,
          7.65 + age * 3,
          -5.9 + Math.sin(i * 2) * age * 0.25,
        );
        dummy.rotation.set(age, i, 0);
        const size = (0.15 + age * 0.6) * Math.sin(age * Math.PI);
        dummy.scale.set(size, size * 1.25, size);
        dummy.updateMatrix();
        steam.setMatrixAt(i, dummy.matrix);
      }
      steam.instanceMatrix.needsUpdate = true;
    },
  };
}

function buildShip(): BuiltStage {
  const group = new THREE.Group();
  floor(group, 0x3a2430, 0x1e121a);
  const updateAudience = addAudience(group, 0x1b1526, -4);
  box(group, [40, 14, 0.5], 0x2a1a24, [0, 6, -8], 0.05);
  for (let i = -4; i <= 4; i++) {
    box(group, [2.2, 3.2, 0.3], 0x5a1a2a, [i * 4.2, 5, -7.6], 0.04);
    const space = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 2.8),
      new THREE.MeshBasicMaterial({ color: 0x05030f }),
    );
    space.position.set(i * 4.2, 5, -7.4);
    group.add(space);
  }
  const stars = instances(
    group,
    'window-stars',
    new THREE.PlaneGeometry(0.045, 0.045),
    new THREE.MeshBasicMaterial({ color: 0xd8edff }),
    108,
  );
  const shuttles: THREE.Group[] = [];
  const shuttleWindows = [-2, -1, 1];
  for (let i = 0; i < 3; i++) {
    const shuttle = new THREE.Group();
    shuttle.name = 'distant-shuttle';
    box(shuttle, [0.32, 0.12, 0.08], 0x9babc6, [0, 0, 0], 0.01);
    const wing = box(shuttle, [0.16, 0.36, 0.06], 0x66768f, [-0.04, 0, -0.02], 0.01);
    wing.rotation.z = -0.5;
    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.04), glowMaterial(0x5fdcff));
    engine.position.set(-0.18, 0, 0.04);
    shuttle.add(engine);
    group.add(shuttle);
    shuttles.push(shuttle);
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
  const dummy = new THREE.Object3D();
  return {
    group,
    background: gradientTexture('#0d0408', '#4a0d1c'),
    fog: new THREE.Fog(0x2a0a14, 14, 38),
    update: (time) => {
      updateAudience(time);
      lights.forEach((light, i) => {
        (light.material as THREE.MeshToonMaterial).emissiveIntensity =
          1.8 + Math.sin(time * 2 + i) * 0.7;
      });
      // Cada lote permanece dentro do vidro, sem vazar sobre os pilares da nave.
      for (let i = 0; i < stars.count; i++) {
        const window = Math.floor(i / 12) - 4;
        const star = i % 12;
        const travel = (star * 0.139 + time * (0.09 + (star % 3) * 0.025)) % 1;
        dummy.position.set(
          window * 4.2 + 0.81 - travel * 1.62,
          3.75 + ((star * 0.317) % 1) * 2.5,
          -7.35,
        );
        dummy.scale.set(0.65 + (star % 3) * 0.3, 0.65 + (star % 3) * 0.3, 1);
        dummy.updateMatrix();
        stars.setMatrixAt(i, dummy.matrix);
      }
      stars.instanceMatrix.needsUpdate = true;
      shuttles.forEach((shuttle, i) => {
        const x = shuttleWindows[i]! * 4.2;
        shuttle.position.set(
          x + ((time * 0.18 + i * 0.31) % 1) * 1.1 - 0.55,
          5 + Math.sin(time * 0.3 + i * 2) * 0.7,
          -7.29,
        );
        shuttle.rotation.z = Math.sin(time * 0.4 + i) * 0.1;
      });
    },
  };
}

function buildSweets(): BuiltStage {
  const group = new THREE.Group();
  floor(group, 0xe6ba93, 0xae735e);
  box(group, [54, 0.35, 27], 0xe5aeb0, [0, -0.23, -17], 0);
  const updateAudience = addAudience(group, 0x77526c);
  const updateClouds = addClouds(group, 0xffd1e6, 10, -25, 0.4);
  const scoopGeometry = new THREE.SphereGeometry(1, 12, 8);
  const scoopColors = [0xffc0cd, 0xb5dbbb, 0xffe2ad];
  for (let i = -3; i <= 3; i++) {
    const x = i * 7;
    const height = 3.5 + ((i + 3) % 3) * 0.8;
    const scoopMaterial = createToonMaterial(scoopColors[(i + 3) % 3]!);
    const hill = new THREE.Mesh(scoopGeometry, scoopMaterial);
    hill.position.set(x, 0.6, -24 - Math.abs(i % 2) * 3);
    hill.scale.set(4.8, height, 2.8);
    addOutline(hill, 0.025);
    group.add(hill);
    const top = new THREE.Mesh(scoopGeometry, scoopMaterial);
    top.position.set(x + 0.5, height - 0.3, hill.position.z);
    top.scale.set(2.4, 1.9, 2);
    addOutline(top, 0.025);
    group.add(top);
  }

  // Castelo de biscoito: recheio, ameias e gotas de chocolate na fachada.
  box(group, [8, 3.8, 1.8], 0xcb8e56, [3, 1.9, -18]);
  box(group, [8.3, 0.25, 2], 0xffedc3, [3, 3.6, -18]);
  box(group, [8.3, 0.2, 2], 0x81513f, [3, 0.8, -18], 0.02);
  for (let i = 0; i < 8; i++) {
    box(group, [0.65, 0.65, 1.9], 0xdfa267, [-0.5 + i, 4.1, -18], 0.025);
  }
  for (const x of [-1.8, 7.8]) {
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1, 5.5, 10),
      createToonMaterial(0xd8a067),
    );
    tower.position.set(x, 2.75, -17.7);
    addOutline(tower, 0.04);
    group.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.5, 10), createToonMaterial(0xc49dce));
    roof.position.set(x, 6.1, -17.7);
    addOutline(roof, 0.035);
    group.add(roof);
    box(group, [0.45, 0.9, 0.2], 0x714b60, [x, 4.15, -16.8], 0.02);
  }
  box(group, [1.3, 1.8, 0.2], 0x714b49, [3, 0.9, -17.02], 0.02);
  const arch = new THREE.Mesh(
    new THREE.CircleGeometry(0.65, 12, 0, Math.PI),
    createToonMaterial(0x714b49),
  );
  arch.position.set(3, 1.8, -16.9);
  group.add(arch);
  const chips = instances(
    group,
    'cookie-chips',
    new THREE.IcosahedronGeometry(0.09, 0),
    createToonMaterial(0x885641),
    28,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < chips.count; i++) {
    const column = i % 7;
    const row = Math.floor(i / 7);
    dummy.position.set(-0.3 + column * 1.1, 0.4 + row * 0.95, -17.03);
    dummy.scale.set(1, 0.8 + (i % 3) * 0.2, 0.4);
    dummy.updateMatrix();
    chips.setMatrixAt(i, dummy.matrix);
  }
  chips.instanceMatrix.needsUpdate = true;

  const trees: THREE.Group[] = [];
  const stickGeometry = new THREE.CylinderGeometry(0.085, 0.085, 2.7, 8);
  const stickMaterial = createToonMaterial(0xffefd6);
  const candyGeometry = new THREE.SphereGeometry(0.85, 16, 10);
  const ringGeometry = new THREE.TorusGeometry(0.5, 0.1, 6, 20);
  for (let i = 0; i < 8; i++) {
    const tree = new THREE.Group();
    tree.position.set(-16 + (i % 4) * 10.5, 0, -8.8 - Math.floor(i / 4) * 5.2);
    const stick = new THREE.Mesh(stickGeometry, stickMaterial);
    stick.position.y = 1.35;
    addOutline(stick, 0.02);
    tree.add(stick);
    const candy = new THREE.Mesh(candyGeometry, createToonMaterial(i % 2 ? 0xdf81a5 : 0x89c7c5));
    candy.position.y = 2.9;
    candy.scale.z = 0.3;
    addOutline(candy, 0.03);
    tree.add(candy);
    const ring = new THREE.Mesh(ringGeometry, stickMaterial);
    ring.position.set(0, 2.9, 0.25);
    tree.add(ring);
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), stickMaterial);
    center.position.set(0, 2.9, 0.27);
    center.scale.z = 0.5;
    tree.add(center);
    group.add(tree);
    trees.push(tree);
  }

  // Rio sinuoso entre o público e o castelo, todo atrás da plataforma de luta.
  const syrupMaterial = createToonMaterial(0x98573d);
  const river = new THREE.Mesh(new THREE.PlaneGeometry(48, 2.5, 48, 1), syrupMaterial);
  const positions = river.geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    positions.setY(i, positions.getY(i) + Math.sin(positions.getX(i) * 0.2) * 1.3);
  }
  river.geometry.computeVertexNormals();
  river.rotation.x = -Math.PI / 2;
  river.position.set(0, 0.015, -9.7);
  group.add(river);
  const ripples = instances(
    group,
    'syrup-ripples',
    new THREE.SphereGeometry(1, 8, 4),
    createToonMaterial(0xd08d59),
    26,
  );
  return {
    group,
    background: gradientTexture('#aeb9e6', '#ffe0c7'),
    fog: new THREE.Fog(0xe6c0cc, 24, 64),
    update: (time) => {
      updateAudience(time);
      updateClouds(time);
      trees.forEach((tree, i) => (tree.rotation.z = Math.sin(time * 0.7 + i * 1.4) * 0.025));
      dummy.rotation.set(0, 0, 0);
      for (let i = 0; i < ripples.count; i++) {
        const x = ((i * 1.85 + time * 0.55) % 46) - 23;
        dummy.position.set(x, 0.06, -9.7 - Math.sin(x * 0.2) * 1.3 + ((i % 3) - 1) * 0.6);
        dummy.scale.set(0.25 + Math.sin(time * 1.5 + i) * 0.04, 0.025, 0.07);
        dummy.updateMatrix();
        ripples.setMatrixAt(i, dummy.matrix);
      }
      ripples.instanceMatrix.needsUpdate = true;
    },
  };
}

function buildPark(): BuiltStage {
  const group = new THREE.Group();
  floor(group, 0xc17c61, 0x754954);
  box(group, [54, 0.3, 28], 0x91636e, [0, -0.2, -17], 0);
  const updateAudience = addAudience(group, 0x513c59);
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(3, 20, 12),
    new THREE.MeshBasicMaterial({ color: 0xffbe78 }),
  );
  sun.position.set(12, 9, -32);
  group.add(sun);
  for (let i = -4; i <= 4; i++) {
    const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), createToonMaterial(0x805d7b));
    hill.position.set(i * 6.5, 0, -26);
    hill.scale.set(6, 3 + (i % 3), 2);
    group.add(hill);
  }

  const wheel = new THREE.Group();
  wheel.name = 'ferris-wheel';
  wheel.position.set(-7, 6.2, -18);
  group.add(wheel);
  for (const side of [-1, 1]) {
    const support = box(group, [0.35, 6.4, 0.5], 0xeee1c4, [-7 + side * 1.3, 3, -17.4]);
    support.rotation.z = side * 0.4;
  }
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 1, 10),
    createToonMaterial(0xeee1c4),
  );
  hub.rotation.x = Math.PI / 2;
  hub.position.set(-7, 6.2, -17.6);
  addOutline(hub, 0.025);
  group.add(hub);
  const rimGeometry = new THREE.TorusGeometry(4.2, 0.12, 6, 48);
  const rimMaterial = createToonMaterial(0xe9bd8d);
  for (const z of [0, -0.45]) {
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.position.z = z;
    addOutline(rim, 0.025);
    wheel.add(rim);
  }
  for (let i = 0; i < 4; i++) {
    const spoke = box(wheel, [8.4, 0.1, 0.12], 0xe9bd8d, [0, 0, 0], 0);
    spoke.rotation.z = (i * Math.PI) / 4;
  }
  const cabins: THREE.Group[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const cabin = new THREE.Group();
    cabin.position.set(Math.cos(angle) * 4.2, Math.sin(angle) * 4.2, 0.2);
    box(cabin, [0.08, 0.45, 0.08], 0xe9bd8d, [0, -0.15, 0], 0);
    box(cabin, [0.85, 0.6, 0.65], i % 2 ? 0x5cbab0 : 0xd66385, [0, -0.65, 0]);
    box(cabin, [0.63, 0.24, 0.03], 0x3b405e, [0, -0.48, 0.34], 0);
    wheel.add(cabin);
    cabins.push(cabin);
  }
  const wheelLightMaterial = glowMaterial(0xffd982, 0.7);
  const wheelLights = instances(
    wheel,
    'wheel-lights',
    new THREE.IcosahedronGeometry(0.09, 0),
    wheelLightMaterial,
    40,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < wheelLights.count; i++) {
    const angle = (i * Math.PI * 2) / wheelLights.count;
    dummy.position.set(Math.cos(angle) * 4.2, Math.sin(angle) * 4.2, 0.16);
    dummy.updateMatrix();
    wheelLights.setMatrixAt(i, dummy.matrix);
  }
  wheelLights.instanceMatrix.needsUpdate = true;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d', CPU_CANVAS)!;
  for (let x = 0; x < 64; x += 8) {
    ctx.fillStyle = x % 16 === 0 ? '#f5dfb9' : '#bb4f78';
    ctx.fillRect(x, 0, 8, 64);
  }
  const fabric = new THREE.CanvasTexture(canvas);
  fabric.colorSpace = THREE.SRGBColorSpace;
  const canopyMaterial = createToonMaterial(0xffffff);
  canopyMaterial.map = fabric;
  for (let i = 0; i < 4; i++) {
    const x = -14 + i * 8.5;
    const z = -11 - (i % 2) * 2;
    box(group, [3.2, 1.2, 1.6], i % 2 ? 0x529c9b : 0xc69554, [x, 0.6, z]);
    box(group, [3.4, 0.16, 1.9], 0xf3dca9, [x, 1.25, z]);
    for (const side of [-1, 1]) {
      box(group, [0.12, 1.6, 0.12], 0xf3dca9, [x + side * 1.4, 2, z], 0.015);
    }
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1, 4), canopyMaterial);
    canopy.rotation.y = Math.PI / 4;
    canopy.scale.z = 0.65;
    canopy.position.set(x, 3.1, z);
    addOutline(canopy, 0.035);
    group.add(canopy);
  }
  const arcadeScreens: THREE.Mesh[] = [];
  for (const x of [-11, -8.5, 8.5, 11]) {
    const z = -6.8;
    box(group, [1.05, 1.8, 0.85], x < 0 ? 0x486c98 : 0x9f4f77, [x, 0.9, z]);
    box(group, [1.12, 0.15, 0.95], 0x343452, [x, 0.95, z + 0.22]);
    box(group, [0.85, 0.62, 0.08], 0x24243f, [x, 1.38, z + 0.46], 0.02);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.42), glowMaterial(0x63dfcc, 0.5));
    screen.position.set(x, 1.38, z + 0.51);
    group.add(screen);
    arcadeScreens.push(screen);
    // Pequeno labirinto abstrato na tela do fliperama.
    for (let j = 0; j < 3; j++) {
      box(group, [0.06, 0.12 + j * 0.06, 0.02], 0x325575, [x - 0.22 + j * 0.22, 1.38, z + 0.53], 0);
    }
    const marquee = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.16, 0.08),
      glowMaterial(0xffd28a, 0.6),
    );
    marquee.position.set(x, 1.8, z + 0.46);
    group.add(marquee);
  }
  const bulbs = instances(
    group,
    'party-lights',
    new THREE.SphereGeometry(0.1, 6, 4),
    glowMaterial(0xffcb7a),
    54,
  );
  for (let row = 0; row < 3; row++) {
    const points: THREE.Vector3[] = [];
    for (let j = 0; j <= 18; j++) {
      points.push(
        new THREE.Vector3(
          -17 + j * (34 / 18),
          7.5 + row * 1.2 - Math.sin((j / 18) * Math.PI) * 1.5,
          -8.5 - row * 4,
        ),
      );
    }
    const wire = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.025, 4, false),
      createToonMaterial(0x493748),
    );
    group.add(wire);
  }
  return {
    group,
    background: gradientTexture('#75528d', '#f8b17e'),
    fog: new THREE.Fog(0xc58a95, 22, 60),
    update: (time) => {
      updateAudience(time);
      wheel.rotation.z = time * 0.12;
      cabins.forEach((cabin) => (cabin.rotation.z = -wheel.rotation.z));
      wheelLightMaterial.emissiveIntensity = 1.8 + Math.sin(time * 1.4) * 0.5;
      arcadeScreens.forEach((screen, i) => {
        (screen.material as THREE.MeshToonMaterial).emissiveIntensity =
          1.7 + Math.sin(time * 2 + i * 2) * 0.4;
      });
      for (let i = 0; i < bulbs.count; i++) {
        const row = Math.floor(i / 18);
        const u = ((i % 18) + 0.5) / 18;
        dummy.position.set(
          -17 + u * 34,
          7.35 + row * 1.2 - Math.sin(u * Math.PI) * 1.5,
          -8.5 - row * 4,
        );
        dummy.scale.setScalar(Math.sin(time * 2.3 + i * 0.7) > -0.5 ? 1 : 0.35);
        dummy.updateMatrix();
        bulbs.setMatrixAt(i, dummy.matrix);
      }
      bulbs.instanceMatrix.needsUpdate = true;
    },
  };
}

export function buildStage(id: StageId): BuiltStage {
  const builders = {
    rooftop: buildRooftop,
    forest: buildForest,
    base: buildBase,
    ship: buildShip,
    park: buildPark,
    sweets: buildSweets,
  };
  const stage = builders[id]();
  // O primeiro desenho já recebe as instâncias nas posições corretas.
  stage.update(0);
  return stage;
}
