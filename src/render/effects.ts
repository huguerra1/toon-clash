import * as THREE from 'three';
import type { Projectile } from '../game/match';
import { addOutline, createToonMaterial, disposeObject } from './toon-material';

interface Particle {
  object: THREE.Object3D;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  spin: number;
  life: number;
  maxLife: number;
  grow: number;
  fade: boolean;
}

const HIT_WORDS_LIGHT = ['PÁ!', 'TUM!', 'BAM!', 'TOC!'];
const HIT_WORDS_HEAVY = ['POW!', 'KABUM!', 'CRASH!', 'WHAM!'];

/** Cores dos projéteis por tipo (o resto usa o brilho do personagem). */
const PROJECTILE_COLORS: Record<string, number> = {
  omega: 0x7cff4f,
  shadow: 0x9a3dff,
  cannon: 0x5fd3ff,
  star: 0xfff35a,
  ray: 0xff3030,
  cassette: 0x2a2a33,
  sound: 0x4ff0ff,
};

/** Partículas, palavras de quadrinho, ondas de choque, projéteis e tremor de câmera. */
export class Effects {
  readonly group = new THREE.Group();
  private readonly particles: Particle[] = [];
  private readonly projectileMeshes = new Map<number, THREE.Object3D>();
  private readonly wordTextures = new Map<string, THREE.CanvasTexture>();
  private readonly cube = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  private readonly star = new THREE.OctahedronGeometry(0.1);
  private readonly ring = new THREE.RingGeometry(0.3, 0.42, 32);
  private readonly puff = new THREE.SphereGeometry(0.12, 6, 5);
  private wordIndex = 0;
  shake = 0;

  burst(
    x: number,
    y: number,
    color: number,
    count: number,
    speed = 0.08,
    shape: 'cube' | 'star' = 'star',
  ): void {
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true });
      const mesh = new THREE.Mesh(shape === 'cube' ? this.cube : this.star, material);
      mesh.position.set(x, y, 0.3);
      const angle = Math.random() * Math.PI * 2;
      const s = speed * (0.5 + Math.random());
      this.spawn(mesh, {
        vx: Math.cos(angle) * s,
        vy: Math.sin(angle) * s,
        vz: (Math.random() - 0.5) * s,
        gravity: 0.004,
        spin: (Math.random() - 0.5) * 0.4,
        life: 22 + Math.random() * 14,
        grow: 0,
        fade: true,
      });
    }
  }

  ringPulse(x: number, y: number, color: number, size = 1, flat = false): void {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.ring, material);
    mesh.position.set(x, y, 0.4);
    if (flat) mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(size);
    this.spawn(mesh, {
      vx: 0,
      vy: 0,
      vz: 0,
      gravity: 0,
      spin: 0,
      life: 18,
      // Crescimento multiplicativo por tick: ~3x ao longo da vida do anel.
      grow: 0.065,
      fade: true,
    });
  }

  dust(x: number, count = 8): void {
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({ color: 0xd9c9a8, transparent: true });
      const mesh = new THREE.Mesh(this.puff, material);
      mesh.position.set(x + (Math.random() - 0.5) * 0.6, 0.08, (Math.random() - 0.5) * 0.5);
      this.spawn(mesh, {
        vx: (Math.random() - 0.5) * 0.06,
        vy: 0.01 + Math.random() * 0.02,
        vz: (Math.random() - 0.5) * 0.03,
        gravity: 0,
        spin: 0,
        life: 26,
        grow: 0.04,
        fade: true,
      });
    }
  }

  /** Palavra de história em quadrinhos ("POW!") no ponto do impacto. */
  word(x: number, y: number, heavy: boolean, text?: string): void {
    const words = heavy ? HIT_WORDS_HEAVY : HIT_WORDS_LIGHT;
    const label = text ?? words[this.wordIndex++ % words.length]!;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.wordTexture(label, heavy),
        transparent: true,
        depthTest: false,
      }),
    );
    sprite.position.set(x, y + 0.4, 0.6);
    const scale = heavy ? 1.3 : 0.9;
    sprite.scale.set(scale * 2, scale, 1);
    sprite.renderOrder = 10;
    this.spawn(sprite, {
      vx: 0,
      vy: 0.012,
      vz: 0,
      gravity: 0,
      spin: 0,
      life: 32,
      grow: 0,
      fade: true,
    });
  }

  private wordTexture(text: string, heavy: boolean): THREE.CanvasTexture {
    const key = `${text}|${heavy}`;
    const cached = this.wordTextures.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(128, 64);
    ctx.rotate(-0.12);
    // Estrela de explosão atrás do texto
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const r = i % 2 === 0 ? 62 : 40;
      const a = (i / 24) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * r * 1.8, Math.sin(a) * r * 0.9);
    }
    ctx.closePath();
    ctx.fillStyle = heavy ? '#ff4d2e' : '#ffd23f';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#111';
    ctx.stroke();
    ctx.font = `900 ${heavy ? 52 : 44}px Impact, "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#111';
    ctx.strokeText(text, 0, 4);
    ctx.fillStyle = heavy ? '#fff35a' : '#ffffff';
    ctx.fillText(text, 0, 4);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.wordTextures.set(key, texture);
    return texture;
  }

  /** Sincroniza os projéteis da partida com malhas na cena. */
  syncProjectiles(projectiles: readonly Projectile[], glowOf: (owner: 0 | 1) => number): void {
    const alive = new Set<number>();
    for (const p of projectiles) {
      alive.add(p.id);
      let mesh = this.projectileMeshes.get(p.id);
      if (!mesh) {
        mesh = this.createProjectile(p, PROJECTILE_COLORS[p.visual] ?? glowOf(p.owner));
        this.projectileMeshes.set(p.id, mesh);
        this.group.add(mesh);
      }
      mesh.position.set(p.x, p.y, 0);
      mesh.rotation.z += 0.2 * Math.sign(p.vx);
      mesh.rotation.y = p.vx > 0 ? 0 : Math.PI;
      if (Math.random() < 0.6) {
        const color = PROJECTILE_COLORS[p.visual] ?? glowOf(p.owner);
        this.trail(p.x - Math.sign(p.vx) * 0.3, p.y, color);
      }
    }
    for (const [id, mesh] of this.projectileMeshes) {
      if (alive.has(id)) continue;
      this.burst(mesh.position.x, mesh.position.y, 0xffffff, 10, 0.06);
      disposeObject(mesh);
      this.projectileMeshes.delete(id);
    }
  }

  private createProjectile(p: Projectile, color: number): THREE.Object3D {
    const group = new THREE.Group();
    const material = createToonMaterial(color);
    material.emissive.setHex(color).multiplyScalar(0.8);
    material.emissiveIntensity = 3;
    let core: THREE.Mesh;
    switch (p.visual) {
      case 'star':
        core = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), material);
        core.scale.set(1, 1, 0.5);
        break;
      case 'cannon':
      case 'ray':
        core = new THREE.Mesh(new THREE.CapsuleGeometry(p.h / 2, p.w, 6, 12), material);
        core.rotation.z = Math.PI / 2;
        break;
      case 'cassette':
        core = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, 0.1), material);
        break;
      case 'sound':
        // Onda sonora: anel de pé, de frente para o oponente.
        core = new THREE.Mesh(new THREE.TorusGeometry(p.h / 2, 0.06, 8, 24), material);
        core.rotation.y = Math.PI / 2;
        break;
      default:
        core = new THREE.Mesh(new THREE.IcosahedronGeometry(p.w / 2, 1), material);
    }
    addOutline(core, 0.03);
    group.add(core);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(p.w, p.h) * 0.75, 12, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25 }),
    );
    group.add(halo);
    return group;
  }

  private trail(x: number, y: number, color: number): void {
    const mesh = new THREE.Mesh(
      this.cube,
      new THREE.MeshBasicMaterial({ color, transparent: true }),
    );
    mesh.position.set(x, y + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2);
    this.spawn(mesh, {
      vx: 0,
      vy: 0.002,
      vz: 0,
      gravity: 0,
      spin: 0.2,
      life: 14,
      grow: -0.05,
      fade: true,
    });
  }

  spawn(object: THREE.Object3D, p: Omit<Particle, 'object' | 'maxLife'>): void {
    this.group.add(object);
    this.particles.push({ object, ...p, maxLife: p.life });
  }

  update(dt: number): void {
    const steps = dt * 60;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= steps;
      p.vy -= p.gravity * steps;
      p.object.position.x += p.vx * steps;
      p.object.position.y += p.vy * steps;
      p.object.position.z += p.vz * steps;
      p.object.rotation.z += p.spin * steps;
      if (p.grow !== 0) p.object.scale.multiplyScalar(Math.max(0.01, 1 + p.grow * steps));
      if (p.fade) {
        const material = (p.object as THREE.Mesh | THREE.Sprite).material as THREE.Material & {
          opacity: number;
        };
        material.opacity = Math.max(0, p.life / p.maxLife);
      }
      if (p.life <= 0) {
        this.removeParticle(p);
        this.particles.splice(i, 1);
      }
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }

  /** Geometrias das partículas são compartilhadas; só o material é de cada uma. */
  private removeParticle(p: Particle): void {
    p.object.removeFromParent();
    ((p.object as THREE.Mesh | THREE.Sprite).material as THREE.Material).dispose();
  }

  clear(): void {
    for (const p of this.particles) this.removeParticle(p);
    this.particles.length = 0;
    for (const mesh of this.projectileMeshes.values()) disposeObject(mesh);
    this.projectileMeshes.clear();
    this.shake = 0;
  }
}
