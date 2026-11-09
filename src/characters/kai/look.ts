import type { CharacterLook } from '../look';

const base: CharacterLook = {
  skin: 0xf1c27d,
  hair: 0x5a3825,
  top: 0x1fa37a,
  bottom: 0x2d3a4a,
  shoes: 0xf4f4f4,
  accent: 0x7cff4f,
  glow: 0x7cff4f,
  hairStyle: 'spiky',
  scale: 0.95,
  bulk: 1,
  extras: ['watch', 'stripe'],
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
    extras: ['watch', 'rocks'],
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
    extras: ['watch', 'glowEyes', 'glowHands'],
  },
];
