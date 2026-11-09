import type { CharacterId } from '../combat/types';
import { feralLook } from './feral/look';
import { ferrumLook } from './ferrum/look';
import { kaiLooks } from './kai/look';
import type { CharacterLook } from './look';
import { nyxLook } from './nyx/look';
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
  zhaar: [zhaarLook],
};

export function getLook(id: CharacterId, form = 0): CharacterLook {
  const looks = LOOKS[id];
  return looks[form] ?? looks[0]!;
}
