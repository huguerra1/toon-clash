import type { CharacterId } from '../combat/types';
import { capiLook } from './capi/look';
import { feralLook } from './feral/look';
import { ferrumLook } from './ferrum/look';
import { gelatinoLook } from './gelatino/look';
import { kaiLooks } from './kai/look';
import { lolaLook } from './lola/look';
import type { CharacterLook } from './look';
import { nyxLook } from './nyx/look';
import { pipocaLook } from './pipoca/look';
import { solaraLook } from './solara/look';
import { umbraLook } from './umbra/look';
import { zhaarLook } from './zhaar/look';

/** Um visual por forma. Só Kai Volt tem mais de uma. */
export const LOOKS: Record<CharacterId, CharacterLook[]> = {
  kai: kaiLooks,
  nyx: [nyxLook],
  umbra: [umbraLook],
  ferrum: [ferrumLook],
  solara: [solaraLook],
  feral: [feralLook],
  pipoca: [pipocaLook],
  gelatino: [gelatinoLook],
  capi: [capiLook],
  lola: [lolaLook],
  zhaar: [zhaarLook],
};

export function getLook(id: CharacterId, form = 0): CharacterLook {
  const looks = LOOKS[id];
  return looks[form] ?? looks[0]!;
}
