import * as THREE from 'three';
import type { ToonalityKind } from '../combat/types';
import type { Effects } from './effects';
import type { FighterModel } from './fighter-model';
import { addOutline, createToonMaterial, disposeObject } from './toon-material';

/**
 * Animações das Toonalities (finalizações cômicas). São só visuais: a lógica apenas conta o
 * tempo da fase 'toonality'. `tick` é o phaseTick da partida.
 */
export class ToonalityPlayer {
  private readonly group = new THREE.Group();
  private readonly cubes: { mesh: THREE.Mesh; vy: number; vx: number; rest: number }[] = [];
  private anvil: THREE.Object3D | null = null;
  private portal: THREE.Mesh | null = null;
  private herd: THREE.Object3D[] = [];
  private pedestal: THREE.Mesh | null = null;
  private pie: THREE.Object3D | null = null;
  private blob: THREE.Mesh | null = null;
  private speaker: THREE.Object3D | null = null;
  private lastTick = -1;

  constructor(
    private readonly kind: ToonalityKind,
    private readonly victim: FighterModel,
    private readonly effects: Effects,
    scene: THREE.Object3D,
    private readonly glow: number,
  ) {
    scene.add(this.group);
  }

  /** Aplica a animação no quadro atual. Chamado depois das poses normais. */
  update(tick: number, victimX: number, direction: number): void {
    const crossed = (t: number) => this.lastTick < t && tick >= t;
    const v = this.victim;
    switch (this.kind) {
      case 'shrink': {
        const k = Math.min(1, Math.max(0, (tick - 30) / 60));
        v.body.scale.setScalar(v.look.scale * (1 - k * 0.75));
        if (crossed(30)) this.effects.burst(victimX, 1.2, this.glow, 30, 0.1);
        if (tick > 120) {
          const hop = Math.abs(Math.sin(tick * 0.25)) * 0.4;
          v.root.position.x = victimX + direction * (tick - 120) * 0.05;
          v.root.position.y = hop;
        }
        break;
      }
      case 'blocks':
      case 'pixel':
        if (tick >= 50) v.root.visible = false;
        if (crossed(50)) {
          this.effects.burst(victimX, 1, 0xffffff, 20, 0.12);
          if (this.kind === 'pixel') this.effects.word(victimX, 2, true, 'GAME OVER');
          // 'pixel' vira cubinhos de videogame antigo; 'blocks' vira peças nas cores do lutador.
          const colors =
            this.kind === 'pixel'
              ? [0x37ff8b, 0x1f9f55, 0xfff35a, 0x111111]
              : [v.look.top, v.look.bottom, v.look.skin, v.look.hair, v.look.accent];
          for (let i = 0; i < 40; i++) {
            const mesh = new THREE.Mesh(
              new THREE.BoxGeometry(0.22, 0.22, 0.22),
              createToonMaterial(colors[i % colors.length]!),
            );
            addOutline(mesh, 0.02);
            mesh.position.set(
              victimX + (Math.random() - 0.5) * 0.6,
              0.6 + Math.random() * 1.4,
              (Math.random() - 0.5) * 0.6,
            );
            mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
            this.group.add(mesh);
            const layer = Math.floor(i / 12);
            this.cubes.push({
              mesh,
              vy: 0.05 + Math.random() * 0.05,
              vx: (Math.random() - 0.5) * 0.08,
              rest: 0.11 + layer * 0.2,
            });
          }
        }
        for (const c of this.cubes) {
          c.vy -= 0.01;
          c.mesh.position.y += c.vy;
          c.mesh.position.x += c.vx;
          if (c.mesh.position.y <= c.rest) {
            c.mesh.position.y = c.rest;
            c.vy = 0;
            c.vx *= 0.6;
          }
        }
        break;
      case 'portal': {
        if (!this.portal) {
          this.portal = new THREE.Mesh(
            new THREE.CircleGeometry(1, 32),
            new THREE.MeshBasicMaterial({ color: 0x14001f, side: THREE.DoubleSide }),
          );
          this.portal.rotation.x = -Math.PI / 2;
          this.portal.position.set(victimX, 0.02, 0);
          this.portal.scale.setScalar(0.01);
          this.group.add(this.portal);
        }
        const open = Math.min(1, tick / 40) * (tick > 200 ? Math.max(0, 1 - (tick - 200) / 20) : 1);
        this.portal.scale.setScalar(Math.max(0.01, open * 1.3));
        if (tick % 6 === 0 && open > 0.2)
          this.effects.ringPulse(victimX, 0.05, 0x9a3dff, 1.2, true);
        if (tick > 50) {
          const sink = Math.min(3, (tick - 50) * 0.02);
          v.root.position.y = -sink;
          v.root.rotation.y = (tick - 50) * 0.25;
        }
        if (tick >= 190) v.root.visible = false;
        break;
      }
      case 'anvil': {
        if (!this.anvil) {
          const anvil = new THREE.Group();
          const metal = createToonMaterial(0x3a3f4a);
          const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.8), metal);
          top.position.y = 0.7;
          const mid = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), metal);
          mid.position.y = 0.3;
          const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 0.7), metal);
          base.position.y = 0.05;
          for (const m of [top, mid, base]) {
            addOutline(m, 0.03);
            anvil.add(m);
          }
          anvil.position.set(victimX, 14, 0);
          this.group.add(anvil);
          this.anvil = anvil;
        }
        if (tick < 70) {
          this.anvil.position.y = Math.max(0.25, 14 - Math.pow(tick / 70, 2) * 14);
        }
        if (crossed(70)) {
          this.effects.word(victimX, 1.4, true, 'CLANG!');
          this.effects.dust(victimX, 16);
          this.effects.shake = 1;
        }
        if (tick >= 70) {
          v.body.scale.set(v.look.scale * 1.6, v.look.scale * 0.12, v.look.scale * 1.6);
          if (tick > 150) this.anvil.position.y = 0.25 + (tick - 150) * 0.08;
        }
        break;
      }
      case 'star': {
        if (tick > 30) {
          const t = tick - 30;
          v.root.position.y = t * t * 0.004;
          v.root.rotation.z = t * 0.3;
        }
        if (crossed(30)) this.effects.word(victimX, 1.5, true, 'BOING!');
        if (tick >= 150) v.root.visible = false;
        if (crossed(150)) {
          for (let i = 0; i < 3; i++) this.effects.burst(victimX, 9, 0xfff35a, 16, 0.05);
          this.effects.ringPulse(victimX, 9, 0xffffff, 2);
        }
        break;
      }
      case 'stampede': {
        if (this.herd.length === 0) {
          for (let i = 0; i < 6; i++) {
            const animal = new THREE.Group();
            const bodyMesh = new THREE.Mesh(
              new THREE.CapsuleGeometry(0.45, 0.8, 4, 10),
              createToonMaterial(i % 2 ? 0x8a6a4a : 0x6a6a7a),
            );
            bodyMesh.rotation.z = Math.PI / 2;
            bodyMesh.position.y = 0.7;
            const horn = new THREE.Mesh(
              new THREE.ConeGeometry(0.12, 0.45, 8),
              createToonMaterial(0xe8e0c8),
            );
            horn.rotation.z = -1.3;
            horn.position.set(0.95, 0.9, 0);
            for (const m of [bodyMesh, horn]) {
              addOutline(m, 0.03);
              animal.add(m);
            }
            animal.position.set(victimX - direction * (12 + i * 2.2), 0, ((i % 3) - 1) * 0.8);
            animal.rotation.y = direction > 0 ? 0 : Math.PI;
            this.group.add(animal);
            this.herd.push(animal);
          }
        }
        for (const [i, animal] of this.herd.entries()) {
          animal.position.x += direction * 0.22;
          animal.position.y = Math.abs(Math.sin(tick * 0.4 + i)) * 0.25;
          if (Math.abs(animal.position.x - victimX) < 0.5 && tick % 4 === 0)
            this.effects.dust(victimX, 4);
        }
        if (tick > 50) {
          v.body.scale.set(v.look.scale * 1.5, v.look.scale * 0.1, v.look.scale * 1.5);
        }
        if (crossed(55)) {
          this.effects.word(victimX, 1, true, 'SPLAT!');
          this.effects.shake = 0.8;
        }
        break;
      }
      case 'trophy': {
        if (crossed(40)) {
          v.tint(0xf5c542, 0x5a4210);
          this.effects.burst(victimX, 1.2, 0xfff35a, 30, 0.1);
          this.pedestal = new THREE.Mesh(
            new THREE.CylinderGeometry(0.9, 1, 0.5, 20),
            createToonMaterial(0x5a3b2a),
          );
          addOutline(this.pedestal, 0.03);
          this.pedestal.position.set(victimX, 0.25, 0);
          this.group.add(this.pedestal);
        }
        if (tick > 40) {
          v.root.position.y = 0.5;
          v.root.rotation.y = (tick - 40) * 0.02;
          if (tick % 10 === 0)
            this.effects.burst(
              victimX + (Math.random() - 0.5),
              1 + Math.random() * 1.5,
              0xffffff,
              2,
              0.02,
            );
        }
        break;
      }
      case 'pie': {
        // Uma torta gigante cai do céu e o lutador sai com a cara coberta de creme.
        if (!this.pie) {
          const pie = new THREE.Group();
          const crust = new THREE.Mesh(
            new THREE.CylinderGeometry(1.1, 0.9, 0.45, 24),
            createToonMaterial(0xd99a4e),
          );
          const cream = new THREE.Mesh(
            new THREE.SphereGeometry(1.05, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2),
            createToonMaterial(0xfff6e8),
          );
          cream.position.y = 0.2;
          cream.scale.y = 0.45;
          const cherry = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 12, 10),
            createToonMaterial(0xd62828),
          );
          cherry.position.y = 0.72;
          for (const m of [crust, cream, cherry]) {
            addOutline(m, 0.03);
            pie.add(m);
          }
          pie.rotation.x = Math.PI;
          pie.position.set(victimX, 14, 0);
          this.group.add(pie);
          this.pie = pie;
        }
        if (tick < 60) this.pie.position.y = Math.max(1.6, 14 - Math.pow(tick / 60, 2) * 12.4);
        if (crossed(60)) {
          this.effects.word(victimX, 2.2, true, 'SPLAT!');
          this.effects.burst(victimX, 1.4, 0xfff6e8, 40, 0.14);
          this.effects.shake = 0.6;
        }
        if (tick >= 60) {
          v.tint(0xfff6e8);
          v.body.scale.set(v.look.scale, v.look.scale * 0.8, v.look.scale);
          if (tick > 140) this.pie.position.y = 1.6 + (tick - 140) * 0.1;
        }
        break;
      }
      case 'jelly': {
        // O oponente é engolido por uma bolha gigante de gelatina e fica preso balançando.
        if (!this.blob) {
          const material = createToonMaterial(this.glow);
          material.transparent = true;
          material.opacity = 0.55;
          this.blob = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 18), material);
          addOutline(this.blob, 0.03);
          this.blob.position.set(victimX, 1.2, 0);
          this.blob.scale.setScalar(0.01);
          this.group.add(this.blob);
        }
        const grow = Math.min(1, Math.max(0, (tick - 20) / 30));
        const wobble = 1 + Math.sin(tick * 0.3) * 0.06 * grow;
        this.blob.scale.set(grow * wobble, grow / wobble, grow * wobble);
        if (crossed(35)) this.effects.word(victimX, 2.6, true, 'GLUP!');
        if (tick > 50) {
          v.root.position.y = 0.4 + Math.sin(tick * 0.08) * 0.15;
          v.root.rotation.z = Math.sin(tick * 0.05) * 0.6;
          v.body.scale.setScalar(v.look.scale * 0.75);
        }
        break;
      }
      case 'speaker': {
        // Uma caixa de som enorme sobe atrás da DJ e o grave arremessa o oponente para longe.
        if (!this.speaker) {
          const speaker = new THREE.Group();
          const cabinet = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 2.6, 1.2),
            createToonMaterial(0x2a2a33),
          );
          cabinet.position.y = 1.3;
          speaker.add(cabinet);
          addOutline(cabinet, 0.04);
          for (const [y, r] of [
            [0.8, 0.5],
            [1.95, 0.32],
          ] as const) {
            const cone = new THREE.Mesh(
              new THREE.CylinderGeometry(r, r, 0.1, 24),
              createToonMaterial(this.glow),
            );
            cone.rotation.z = Math.PI / 2;
            cone.position.set(0.72, y, 0);
            speaker.add(cone);
          }
          speaker.position.set(victimX - direction * 3.2, -3, 0);
          speaker.rotation.y = direction > 0 ? 0 : Math.PI;
          this.group.add(speaker);
          this.speaker = speaker;
        }
        this.speaker.position.y = Math.min(0, -3 + tick * 0.08);
        if (tick > 50 && tick < 120 && tick % 6 === 0) {
          this.effects.ringPulse(this.speaker.position.x + direction * 0.9, 1.4, this.glow, 1.5);
        }
        if (crossed(60)) {
          this.effects.word(victimX, 2.2, true, 'BOOM!');
          this.effects.shake = 1;
        }
        if (tick > 60) {
          const t = tick - 60;
          v.root.position.x = victimX + direction * t * 0.25;
          v.root.position.y = Math.max(0, t * 0.12 - t * t * 0.0012);
          v.root.rotation.z = -direction * t * 0.25;
        }
        if (tick > 150) v.root.visible = false;
        break;
      }
    }
    this.lastTick = tick;
  }

  dispose(): void {
    disposeObject(this.group);
  }
}
