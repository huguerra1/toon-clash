import type { CharacterDef, CharacterId } from '../combat/types';
import { capi } from './capi/data';
import { feral } from './feral/data';
import { ferrum } from './ferrum/data';
import { gelatino } from './gelatino/data';
import { kai } from './kai/data';
import { lola } from './lola/data';
import { nyx } from './nyx/data';
import { pipoca } from './pipoca/data';
import { solara } from './solara/data';
import { umbra } from './umbra/data';
import { zhaar } from './zhaar/data';

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  kai,
  nyx,
  umbra,
  ferrum,
  solara,
  feral,
  pipoca,
  gelatino,
  capi,
  lola,
  zhaar,
};

/** Lutadores jogáveis desde o início (o chefe é liberado ao zerar o arcade). */
export const STARTING_ROSTER: CharacterId[] = [
  'kai',
  'nyx',
  'umbra',
  'ferrum',
  'solara',
  'feral',
  'pipoca',
  'gelatino',
  'capi',
  'lola',
];

export function getCharacter(id: CharacterId): CharacterDef {
  return CHARACTERS[id];
}
