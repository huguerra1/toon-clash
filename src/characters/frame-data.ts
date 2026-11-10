import { CHIP_FACTOR } from '../combat/constants';
import type { AttackHeight, CharacterDef, CharacterId, MoveDef } from '../combat/types';
import type { AttackButton } from '../core/input';
import { BUTTON_NAMES, notation } from '../ui/notation';
import { CHARACTERS } from './roster';

export interface MoveFrameData {
  id: string;
  name: string;
  input: string;
  startup: number;
  active: number;
  recovery: number;
  total: number;
  damage: number;
  chip: number;
  hitstun?: number;
  blockstun?: number;
  hitAdvantage?: number;
  blockAdvantage?: number;
  properties: string[];
}

export interface CharacterFrameData {
  id: CharacterId;
  name: string;
  form?: string;
  damageMul: number;
  speedMul: number;
  moves: MoveFrameData[];
}

const HEIGHT_NAMES: Record<AttackHeight, string> = {
  high: 'alto',
  mid: 'médio',
  low: 'baixo',
  overhead: 'overhead (defesa em pé)',
};

function moveInput(def: CharacterDef, id: string): string {
  const commands = def.specials.filter((special) => special.move === id);
  if (commands.length) {
    return commands
      .map(
        (special) => `${special.air ? '(no ar) ' : ''}${notation(special.motion, special.button)}`,
      )
      .join(' / ');
  }
  if (id === 'throw') return `→ + ${BUTTON_NAMES.lp} (de perto)`;
  const button = id.replace(/^[dj]_/, '');
  if (Object.hasOwn(BUTTON_NAMES, button)) {
    const prefix = id.startsWith('d_') ? '↓ + ' : id.startsWith('j_') ? '(no ar) ' : '';
    return `${prefix}${BUTTON_NAMES[button as AttackButton]}`;
  }
  return 'Sem comando cadastrado';
}

function moveProperties(move: MoveDef): string[] {
  const properties: string[] = [];
  if (move.height) properties.push(HEIGHT_NAMES[move.height]);
  if (move.special) properties.push('especial');
  if (move.projectile) properties.push('projétil (médio)');
  if (move.throw) properties.push('agarrão (indefensável)');
  if (move.launch) properties.push('lançador');
  if (move.knockdown || move.projectile?.knockdown) properties.push('derruba');
  if (move.dash) properties.push('avanço');
  if (move.rise) properties.push('salto ascendente');
  if (move.teleport) properties.push('teleporte');
  if (move.armor) properties.push('armadura (absorve 1 golpe)');
  if (move.invulnerable) properties.push(`invencível por ${move.invulnerable} frames`);
  if (move.cycleForm) properties.push('troca de forma');
  if (move.chain?.length) properties.push(`emenda em: ${move.chain.join(', ')}`);
  return properties;
}

/**
 * Extrai os dados sem alterar o roster. Vantagens nominais usam stun − recovery;
 * não simulam distância, frames ativos restantes, cancelamentos ou aterrissagem.
 * Campos de stun ausentes não são preenchidos com os padrões da simulação.
 */
export function buildFrameData(
  characters: readonly CharacterDef[] = Object.values(CHARACTERS),
): CharacterFrameData[] {
  return characters.flatMap((def) =>
    (def.forms?.length ? def.forms : [undefined]).map((form) => {
      const multiplier = def.damageMul * (form?.damageMul ?? 1);
      return {
        id: def.id,
        name: def.name,
        form: form?.name,
        damageMul: multiplier,
        speedMul: form?.speedMul ?? 1,
        moves: Object.entries(def.moves).map(([id, move]) => {
          // Projéteis recebem o multiplicador ao nascer; chip usa esse dano já arredondado.
          const damage = Math.round((move.projectile?.damage ?? move.damage) * multiplier);
          const canBlock = !move.throw && !!(move.hitbox || move.projectile);
          const hitstun = move.projectile?.hitstun ?? move.hitstun;
          const blockstun = canBlock ? move.blockstun : undefined;
          const hasHitAdvantage =
            !!move.hitbox && !move.projectile && !move.throw && !move.launch && !move.knockdown;
          return {
            id,
            name: move.name,
            input: moveInput(def, id),
            startup: move.startup,
            active: move.active,
            recovery: move.recovery,
            total: move.startup + move.active + move.recovery,
            damage,
            chip:
              canBlock && move.special
                ? Math.round((move.projectile ? damage : move.damage * multiplier) * CHIP_FACTOR)
                : 0,
            hitstun,
            blockstun,
            hitAdvantage:
              hasHitAdvantage && hitstun !== undefined ? hitstun - move.recovery : undefined,
            blockAdvantage:
              canBlock && !move.projectile && blockstun !== undefined
                ? blockstun - move.recovery
                : undefined,
            properties: moveProperties(move),
          };
        }),
      };
    }),
  );
}
