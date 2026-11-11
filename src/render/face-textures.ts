import * as THREE from 'three';
import { CPU_CANVAS } from './canvas';

export type MouthShape = 'neutral' | 'grin' | 'shout' | 'pain' | 'smile' | 'wavy' | 'sleepy';

const textures = new Map<MouthShape, THREE.CanvasTexture>();

/** Texturas compartilhadas: quem usa a boca não deve descartá-la individualmente. */
export function mouthTexture(shape: MouthShape): THREE.CanvasTexture {
  const cached = textures.get(shape);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d', CPU_CANVAS);
  if (!ctx) throw new Error('Não foi possível criar a textura da boca.');

  ctx.strokeStyle = '#111111';
  ctx.fillStyle = '#27151e';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  switch (shape) {
    case 'neutral':
      ctx.moveTo(29, 30);
      ctx.quadraticCurveTo(64, 39, 99, 30);
      ctx.stroke();
      break;
    case 'grin':
      ctx.moveTo(29, 17);
      ctx.quadraticCurveTo(64, 12, 99, 17);
      ctx.quadraticCurveTo(105, 30, 98, 45);
      ctx.quadraticCurveTo(64, 50, 30, 45);
      ctx.quadraticCurveTo(23, 32, 29, 17);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(28, 31);
      ctx.lineTo(101, 31);
      for (const x of [45, 64, 83]) {
        ctx.moveTo(x, 17);
        ctx.lineTo(x, 46);
      }
      ctx.stroke();
      break;
    case 'shout':
      ctx.ellipse(64, 32, 26, 25, 0, 0, Math.PI * 2);
      drawOpenMouth(ctx, 39, 9, 50, 10, 64, 53, 19, 13);
      break;
    case 'pain':
      ctx.moveTo(28, 25);
      ctx.bezierCurveTo(44, 5, 49, 27, 64, 17);
      ctx.bezierCurveTo(81, 6, 91, 23, 101, 30);
      ctx.bezierCurveTo(106, 46, 88, 39, 77, 49);
      ctx.bezierCurveTo(62, 61, 54, 39, 40, 47);
      ctx.bezierCurveTo(25, 52, 19, 37, 28, 25);
      ctx.closePath();
      drawOpenMouth(ctx, 26, 13, 76, 10, 69, 51, 22, 10);
      break;
    case 'smile':
      ctx.moveTo(23, 16);
      ctx.quadraticCurveTo(64, 27, 105, 16);
      ctx.bezierCurveTo(98, 66, 30, 66, 23, 16);
      ctx.closePath();
      drawOpenMouth(ctx, 24, 16, 80, 13, 64, 53, 26, 12);
      break;
    case 'wavy':
      ctx.moveTo(25, 30);
      ctx.lineTo(38, 23);
      ctx.lineTo(51, 38);
      ctx.lineTo(64, 23);
      ctx.lineTo(77, 38);
      ctx.lineTo(90, 23);
      ctx.lineTo(103, 30);
      ctx.stroke();
      break;
    case 'sleepy':
      ctx.ellipse(64, 33, 11, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textures.set(shape, texture);
  return texture;
}

/** Recorta dentes e língua no caminho atual para preservar o fundo transparente. */
function drawOpenMouth(
  ctx: CanvasRenderingContext2D,
  teethX: number,
  teethY: number,
  teethWidth: number,
  teethHeight: number,
  tongueX: number,
  tongueY: number,
  tongueWidth: number,
  tongueHeight: number,
): void {
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(teethX, teethY, teethWidth, teethHeight);
  ctx.fillStyle = '#e64a62';
  const tongue = new Path2D();
  tongue.ellipse(tongueX, tongueY, tongueWidth, tongueHeight, 0, 0, Math.PI * 2);
  ctx.fill(tongue);
  ctx.restore();
  ctx.stroke();
}
