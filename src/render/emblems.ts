import * as THREE from 'three';

export type EmblemShape =
  | 'bolt'
  | 'star'
  | 'note'
  | 'leaf'
  | 'gear'
  | 'drop'
  | 'moon'
  | 'crown'
  | 'flame'
  | 'wave'
  | 'cassette'
  | 'shield';

const textures = new Map<string, THREE.CanvasTexture>();

/** Distintivos genéricos compartilhados; não descartar a textura por lutador. */
export function emblemTexture(
  shape: EmblemShape,
  foreground: number,
  background: number,
): THREE.CanvasTexture {
  const key = `${shape}:${foreground}:${background}`;
  const cached = textures.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível criar a textura do emblema.');

  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillStyle = new THREE.Color(background).getStyle(THREE.SRGBColorSpace);
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = new THREE.Color(foreground).getStyle(THREE.SRGBColorSpace);
  ctx.lineWidth = 4;
  drawSymbol(ctx, shape);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textures.set(key, texture);
  return texture;
}

function drawSymbol(ctx: CanvasRenderingContext2D, shape: EmblemShape): void {
  ctx.beginPath();
  switch (shape) {
    case 'bolt':
      polygon(ctx, [
        [65, 28],
        [39, 68],
        [59, 68],
        [52, 100],
        [90, 53],
        [68, 53],
        [78, 28],
      ]);
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const radius = i % 2 === 0 ? 35 : 16;
        const x = 64 + Math.cos(angle) * radius;
        const y = 64 + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      break;
    case 'note':
      ctx.moveTo(67, 83);
      ctx.bezierCurveTo(59, 73, 34, 78, 34, 91);
      ctx.bezierCurveTo(34, 105, 68, 101, 68, 87);
      ctx.lineTo(68, 48);
      ctx.lineTo(92, 55);
      ctx.lineTo(92, 38);
      ctx.lineTo(60, 28);
      ctx.lineTo(60, 81);
      break;
    case 'leaf':
      ctx.moveTo(38, 88);
      ctx.bezierCurveTo(24, 50, 65, 33, 94, 30);
      ctx.bezierCurveTo(100, 62, 83, 100, 46, 89);
      break;
    case 'gear':
      for (let i = 0; i < 32; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 16;
        const radius = i % 4 < 2 ? 35 : 27;
        const x = 64 + Math.cos(angle) * radius;
        const y = 64 + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.moveTo(76, 64);
      ctx.arc(64, 64, 12, 0, Math.PI * 2, true);
      break;
    case 'drop':
      ctx.moveTo(64, 27);
      ctx.bezierCurveTo(57, 43, 37, 62, 37, 76);
      ctx.bezierCurveTo(37, 108, 91, 108, 91, 76);
      ctx.bezierCurveTo(91, 62, 71, 43, 64, 27);
      break;
    case 'moon':
      ctx.moveTo(82, 31);
      ctx.bezierCurveTo(36, 13, 19, 78, 56, 96);
      ctx.bezierCurveTo(71, 104, 88, 94, 96, 80);
      ctx.bezierCurveTo(55, 91, 46, 49, 82, 31);
      break;
    case 'crown':
      polygon(ctx, [
        [36, 90],
        [29, 43],
        [51, 61],
        [64, 29],
        [77, 61],
        [99, 43],
        [92, 90],
      ]);
      break;
    case 'flame':
      ctx.moveTo(64, 99);
      ctx.bezierCurveTo(26, 99, 27, 65, 45, 49);
      ctx.quadraticCurveTo(44, 65, 54, 68);
      ctx.bezierCurveTo(49, 47, 72, 40, 65, 26);
      ctx.bezierCurveTo(88, 40, 86, 55, 81, 63);
      ctx.quadraticCurveTo(90, 60, 92, 53);
      ctx.bezierCurveTo(110, 81, 89, 100, 64, 99);
      break;
    case 'wave':
      ctx.moveTo(28, 79);
      ctx.bezierCurveTo(39, 81, 46, 72, 51, 54);
      ctx.bezierCurveTo(60, 24, 94, 29, 98, 52);
      ctx.bezierCurveTo(75, 37, 63, 66, 82, 77);
      ctx.quadraticCurveTo(91, 83, 102, 78);
      ctx.lineTo(94, 95);
      ctx.lineTo(34, 95);
      break;
    case 'cassette':
      ctx.roundRect(29, 40, 70, 49, 7);
      break;
    case 'shield':
      ctx.moveTo(64, 28);
      ctx.quadraticCurveTo(79, 39, 94, 39);
      ctx.lineTo(90, 68);
      ctx.quadraticCurveTo(86, 88, 64, 101);
      ctx.quadraticCurveTo(42, 88, 38, 68);
      ctx.lineTo(34, 39);
      ctx.quadraticCurveTo(49, 39, 64, 28);
      break;
  }
  ctx.closePath();
  ctx.fill('evenodd');
  ctx.stroke();

  // Detalhes internos mantêm a mesma tinta do contorno, sem introduzir marcas.
  ctx.beginPath();
  switch (shape) {
    case 'leaf':
      ctx.moveTo(34, 97);
      ctx.lineTo(78, 49);
      ctx.moveTo(55, 74);
      ctx.lineTo(53, 57);
      ctx.moveTo(64, 65);
      ctx.lineTo(82, 65);
      break;
    case 'crown':
      ctx.moveTo(38, 80);
      ctx.lineTo(90, 80);
      break;
    case 'cassette':
      ctx.arc(47, 59, 8, 0, Math.PI * 2);
      ctx.moveTo(89, 59);
      ctx.arc(81, 59, 8, 0, Math.PI * 2);
      ctx.moveTo(55, 59);
      ctx.lineTo(73, 59);
      polygon(ctx, [
        [45, 89],
        [51, 76],
        [77, 76],
        [83, 89],
      ]);
      break;
    case 'shield':
      ctx.moveTo(64, 43);
      ctx.lineTo(64, 83);
      break;
  }
  ctx.stroke();
}

function polygon(
  ctx: CanvasRenderingContext2D,
  points: readonly (readonly [number, number])[],
): void {
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}
