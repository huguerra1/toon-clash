import type { CharacterLook } from '../look';

export const umbraLook: CharacterLook = {
  skin: 0xe8c9a0,
  hair: 0x0f2a26,
  top: 0x14332e,
  bottom: 0x10201d,
  shoes: 0x0b1614,
  accent: 0xc8d6d2,
  glow: 0x3dffb0,
  hairStyle: 'hood',
  scale: 0.95,
  bulk: 0.9,
  face: 'glow',
  body: 'slim',
  headShape: 'round',
  extras: ['cape'],
  emblem: 'moon',
  personality: 'mystic',
  outfit: {
    sleeves: 'long',
    trim: 0xc8d6d2,
    buttons: { count: 3, color: 0xc8d6d2 },
    shoeTrim: 0xc8d6d2,
  },
  proportions: { legs: 1.08, head: 0.95 },
};
