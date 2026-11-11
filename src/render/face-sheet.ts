import * as THREE from 'three';
import type { CharacterLook, FaceStyle } from '../characters/look';
import { type MouthShape, mouthTexture } from './face-textures';
import { CPU_CANVAS } from './canvas';

/** Expressões que o rosto desenhado sabe mostrar (as mesmas do modelo do lutador). */
export type FaceExpression =
  'neutral' | 'angry' | 'shout' | 'pain' | 'happy' | 'dizzy' | 'sleepy' | 'ko';

export interface FaceOptions {
  style: FaceStyle;
  /** Cor da pele (pálpebras). */
  skin: number;
  /** Cor dos olhos brilhantes. */
  glow: number;
  /** Desenha a boca no rosto (quem tem focinho usa uma boca separada, à frente do focinho). */
  mouth: boolean;
  /** Desenha um narizinho de traço (o modelo 3D não tem nariz). */
  nose: boolean;
}

export const MOUTH_FOR: Record<FaceExpression, MouthShape> = {
  neutral: 'neutral',
  angry: 'grin',
  shout: 'shout',
  pain: 'pain',
  happy: 'smile',
  dizzy: 'wavy',
  sleepy: 'sleepy',
  ko: 'pain',
};

/** Expressões que já mostram o olho fechado ou desenhado (não piscam). */
const NO_BLINK: ReadonlySet<FaceExpression> = new Set(['happy', 'pain', 'dizzy', 'ko']);

export function canBlink(expression: FaceExpression): boolean {
  return !NO_BLINK.has(expression);
}

/** Estilo do rosto: o escolhido no visual ou um padrão coerente com os acessórios. */
export function faceStyleOf(look: CharacterLook): FaceStyle {
  if (look.face) return look.face;
  if (look.extras.includes('visor')) return 'visor';
  if (look.extras.includes('glowEyes')) return 'glow';
  return 'round';
}

export function faceOptionsOf(look: CharacterLook): FaceOptions {
  return {
    style: faceStyleOf(look),
    skin: look.skin,
    glow: look.glow,
    mouth: !look.extras.includes('snout'),
    nose: !look.extras.includes('snout') && faceStyleOf(look) !== 'visor',
  };
}

/**
 * Pedaço de esfera na frente da cabeça onde o rosto é "pintado". Mesmo centro da cabeça
 * (0.02, 0.22, 0) e raio um pouco maior que o crânio (0.24), virado para +X (a frente).
 * Os ângulos casam com as posições do desenho: olhos em (0.2, 0.25, ±0.085), boca em y≈0.115.
 */
export const FACE_CENTER = new THREE.Vector3(0.02, 0.22, 0);
export const FACE_RADIUS = 0.246;
const FACE_PHI = 1.6;
const FACE_THETA = 1.5;

export function createFacePlate(
  center: THREE.Vector3 = FACE_CENTER,
  radius = FACE_RADIUS,
): THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> {
  const geometry = new THREE.SphereGeometry(
    radius,
    16,
    12,
    Math.PI - FACE_PHI / 2,
    FACE_PHI,
    Math.PI / 2 - 0.75,
    FACE_THETA,
  );
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    // Fica por cima do crânio sem brigar pela profundidade.
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const plate = new THREE.Mesh(geometry, material);
  plate.position.copy(center);
  plate.name = 'face';
  plate.renderOrder = 1;
  plate.castShadow = false;
  plate.userData.noInk = true;
  return plate;
}

const SIZE = 256;
/** Centro dos olhos e da boca no desenho (casam com a curvatura do pedaço de esfera). */
const EYE_Y = 104;
const EYE_X = [72, 184] as const;
const EYE_RX = 27;
const EYE_RY = 34;
const NOSE_Y = 156;
const MOUTH_Y = 198;
const INK = '#15101c';

const cache = new Map<string, THREE.CanvasTexture>();

/**
 * Rosto desenhado (olhos, sobrancelhas e boca) para colar na frente da cabeça.
 * Traço grosso e formas simples, no estilo de desenho animado de TV — sem olhos de vidro.
 * Texturas compartilhadas por chave: quem usa não deve descartá-las.
 */
export function faceTexture(
  expression: FaceExpression,
  blink: boolean,
  options: FaceOptions,
): THREE.CanvasTexture {
  const key = `${options.style}|${options.skin}|${options.glow}|${options.mouth}|${options.nose}|${expression}|${blink}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', CPU_CANVAS);
  if (!ctx) throw new Error('Não foi possível criar a textura do rosto.');
  drawFace(ctx, expression, blink, options);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  cache.set(key, texture);
  return texture;
}

/** Desenha o rosto num contexto 2D de 256×256 (separado para dar para testar e gerar prévias). */
export function drawFace(
  ctx: CanvasRenderingContext2D,
  expression: FaceExpression,
  blink: boolean,
  options: FaceOptions,
): void {
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (options.style !== 'visor') {
    EYE_X.forEach((x, i) => drawEye(ctx, x, i === 0 ? -1 : 1, expression, blink, options));
    drawBrows(ctx, expression, options.style);
  }
  if (options.nose) {
    // Narizinho em gancho, de perfil para a frente: um traço só, como no desenho de TV.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(124, NOSE_Y - 14);
    ctx.quadraticCurveTo(116, NOSE_Y + 4, 130, NOSE_Y + 6);
    ctx.stroke();
  }
  if (options.mouth) {
    const mouth = mouthTexture(MOUTH_FOR[expression]).image as CanvasImageSource;
    ctx.drawImage(mouth, 128 - 56, MOUTH_Y - 28, 112, 56);
  }
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Sobrancelhas grossas: a inclinação conta a emoção. */
function drawBrows(ctx: CanvasRenderingContext2D, expression: FaceExpression, style: FaceStyle) {
  // [subida do lado de dentro, subida do lado de fora, altura extra] em pixels.
  const shapes: Record<FaceExpression, [number, number, number]> = {
    neutral: [2, 4, 0],
    angry: [-16, 8, 6],
    shout: [-12, 6, -6],
    pain: [14, -6, -2],
    happy: [6, 4, -8],
    dizzy: [10, -4, -4],
    sleepy: [0, -2, 8],
    ko: [12, -6, 0],
  };
  const [inner, outer, lift] = shapes[expression];
  ctx.strokeStyle = INK;
  ctx.lineWidth = style === 'lashes' ? 7 : 12;
  EYE_X.forEach((x, i) => {
    const side = i === 0 ? -1 : 1;
    const y = EYE_Y - EYE_RY - 14 + lift;
    const innerX = x - side * 26;
    const outerX = x + side * 28;
    ctx.beginPath();
    ctx.moveTo(innerX, y - inner);
    ctx.quadraticCurveTo(x, y - (inner + outer) / 2 - 7, outerX, y - outer);
    ctx.stroke();
  });
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  side: number,
  expression: FaceExpression,
  blink: boolean,
  options: FaceOptions,
): void {
  const y = EYE_Y;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;

  // Expressões com olho "desenhado" (sem o globo): fechado, ^^, >_<, X e espiral.
  if (expression === 'happy') {
    ctx.beginPath();
    ctx.arc(x, y + 12, 22, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    return;
  }
  if (blink && canBlink(expression)) {
    ctx.beginPath();
    ctx.moveTo(x - 24, y + 4);
    ctx.quadraticCurveTo(x, y + 14, x + 24, y + 4);
    ctx.stroke();
    return;
  }
  if (expression === 'pain') {
    ctx.beginPath();
    ctx.moveTo(x + side * 20, y - 16);
    ctx.lineTo(x - side * 16, y);
    ctx.lineTo(x + side * 20, y + 16);
    ctx.stroke();
    return;
  }
  if (expression === 'ko') {
    ctx.beginPath();
    ctx.moveTo(x - 17, y - 17);
    ctx.lineTo(x + 17, y + 17);
    ctx.moveTo(x + 17, y - 17);
    ctx.lineTo(x - 17, y + 17);
    ctx.stroke();
    return;
  }
  if (expression === 'dizzy') {
    ctx.lineWidth = 6;
    ctx.beginPath();
    let first = true;
    for (let a = 0; a < Math.PI * 5; a += 0.2) {
      const r = 2 + a * 1.5;
      const px = x + Math.cos(a * side) * r;
      const py = y + Math.sin(a * side) * r;
      if (first) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
      first = false;
    }
    ctx.stroke();
    return;
  }

  // Olho aberto. Grito arregala; raiva, sono e o estilo "afiado" fecham parte com a pálpebra.
  const grow = expression === 'shout' ? 1.12 : 1;
  const sharp = options.style === 'sharp';
  const rx = EYE_RX * grow * (sharp ? 1.08 : 1);
  const ry = EYE_RY * grow * (sharp ? 0.8 : 1);
  let open = expression === 'angry' ? 0.68 : expression === 'sleepy' ? 0.45 : 1;
  if (options.style === 'sleepy') open *= 0.6;
  if (sharp) open = Math.min(open, 0.78);

  if (options.style === 'dot') {
    // Olhinho de ponto, sem branco (personagem mais "bobo").
    ctx.fillStyle = INK;
    ctx.beginPath();
    const h = 15 * grow * Math.max(0.3, open);
    ctx.ellipse(x, y + (1 - open) * 10, 11 * grow, h, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (options.style === 'glow') {
    ctx.fillStyle = hex(options.glow);
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(x - side * 4, y - 8, rx * 0.45, ry * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.clip();
    // Pupila grande, chapada, olhando para a frente (para o oponente).
    ctx.fillStyle = INK;
    ctx.beginPath();
    const pupil = options.style === 'sleepy' ? 0.8 : 1;
    ctx.ellipse(x - side * 4, y + 4, 12 * grow * pupil, 16 * grow * pupil, 0, 0, Math.PI * 2);
    ctx.fill();
    // Um único brilho chapado (desenho de TV, não "olho de vidro").
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - side * 8, y - 4, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Pálpebra da cor da pele cobrindo a parte de cima; na raiva, inclinada para o meio.
  const cover = 1 - open;
  if (cover > 0.02) {
    const edge = y - ry + ry * 2 * cover;
    const tilt = expression === 'angry' || sharp ? 9 : 0;
    const innerEdge = edge + tilt;
    const outerEdge = edge - tilt * 0.4;
    const innerX = x - side * (rx + 2);
    const outerX = x + side * (rx + 2);
    ctx.fillStyle = hex(options.skin);
    ctx.beginPath();
    ctx.moveTo(innerX, y - ry - 4);
    ctx.lineTo(outerX, y - ry - 4);
    ctx.lineTo(outerX, outerEdge);
    ctx.lineTo(innerX, innerEdge);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(innerX, innerEdge);
    ctx.lineTo(outerX, outerEdge);
    ctx.stroke();
  }
  ctx.restore();

  // Contorno do olho por fora da área recortada.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.beginPath();
  if (cover > 0.02) {
    // Só a parte de baixo do contorno: a de cima ficou atrás da pálpebra.
    const start = Math.asin(Math.min(1, Math.max(-1, (2 * cover - 1) * 0.98)));
    ctx.ellipse(x, y, rx, ry, 0, start, Math.PI - start);
  } else {
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  }
  ctx.stroke();

  if (options.style === 'lashes') {
    // Cílios em gancho no canto de fora.
    ctx.lineWidth = 6;
    for (const k of [0, 1, 2]) {
      const a = -Math.PI / 2 + side * (0.75 + k * 0.3);
      const bx = x + Math.cos(a) * rx;
      const by = y + Math.sin(a) * ry;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + side * 9, by - 9 + k * 4);
      ctx.stroke();
    }
  }
}
