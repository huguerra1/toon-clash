import type { CharacterLook } from '../look';

const base: CharacterLook = {
  skin: 0xf1c27d,
  hair: 0x1b1b1b,
  top: 0xd9452b,
  bottom: 0x2d3a4a,
  shoes: 0xf4f4f4,
  accent: 0x3dd6ff,
  glow: 0x3dd6ff,
  hairStyle: 'messy',
  scale: 0.95,
  bulk: 1,
  body: 'standard',
  headShape: 'round',
  extras: ['watch'],
  emblem: 'bolt',
  personality: 'hero',
  outfit: {
    sleeves: 'short',
    trim: 0xf4f4f4,
    pantsPockets: true,
    rolledCuffs: 0x4a6a8a,
    shoeTrim: 0x3dd6ff,
  },
  proportions: { head: 1.12, legs: 0.95 },
};

/** Kai, Rochedo (forma de pedra) e Faísca (forma elétrica). */
export const kaiLooks: CharacterLook[] = [
  base,
  {
    ...base,
    skin: 0x8d7b68,
    top: 0x6b5b4b,
    bottom: 0x544536,
    shoes: 0x3d3229,
    hairStyle: 'bald',
    glow: 0xffa040,
    scale: 1.1,
    bulk: 1.4,
    body: 'block',
    headShape: 'small',
    extras: ['watch', 'rocks'],
    personality: 'brute',
    // Corpo de pedra: sem roupa de pano por cima.
    outfit: { sleeves: 'none' },
    proportions: { head: 0.95, arms: 1.15, torso: 1.1, legs: 0.9 },
  },
  {
    ...base,
    skin: 0x5ad1ff,
    hair: 0xfff35a,
    top: 0x1e3a8a,
    bottom: 0x1e3a8a,
    shoes: 0xfff35a,
    hairStyle: 'crest',
    glow: 0x9ff7ff,
    bulk: 0.85,
    body: 'slim',
    headShape: 'tall',
    extras: ['watch', 'glowEyes', 'glowHands'],
    // Macacão elétrico com listras.
    outfit: {
      sleeves: 'long',
      trim: 0xfff35a,
      stripes: 0xfff35a,
      zipper: true,
      shoeTrim: 0x1e3a8a,
    },
    proportions: { head: 1.05, legs: 1.08 },
  },
];
