import { GETUP_TICKS } from '../combat/constants';
import { type FighterState, currentMove } from '../combat/fighter';
import type { Personality } from '../characters/look';
import type { AnimKind, CharacterDef } from '../combat/types';
import { type Pose, mixPose, neutralPose } from './fighter-model';

type PosePatch = Partial<Pose>;

function pose(base: Pose, patch: PosePatch): Pose {
  return { ...base, ...patch };
}

/** Guarda de luta, com respiração e o jeito de cada personalidade. */
function guard(time: number, personality?: Personality): Pose {
  const breath = Math.sin(time * 5) * 0.015;
  const base = pose(neutralPose(), {
    hipsY: -0.04 + breath,
    spine: 0.08,
    head: -0.08,
    armA: 0.65,
    foreA: 1.9,
    armB: 0.45,
    foreB: 2.0,
    legA: 0.28,
    shinA: -0.22,
    legB: -0.25,
    shinB: -0.12,
  });
  const bob = Math.sin(time * 3);
  switch (personality) {
    case 'cool':
      return pose(base, { spine: -0.05, armA: 0.35, foreA: 1.6, armB: 0.1, foreB: 1.2, head: 0 });
    case 'mystic':
      return pose(base, {
        hipsY: -0.02 + bob * 0.03,
        armA: 1.1,
        foreA: 0.6,
        armB: 0.9,
        foreB: 0.7,
        spread: 0.25,
      });
    case 'brute':
      return pose(base, {
        hipsY: -0.12,
        spine: 0.2,
        armA: 0.5,
        foreA: 1.5,
        armB: 0.3,
        foreB: 1.6,
        spread: 0.35,
        legA: 0.45,
        legB: -0.45,
      });
    case 'royal':
      return pose(base, {
        spine: -0.04,
        head: 0.05,
        armB: -0.2,
        foreB: 2.2,
        spread: 0.15,
        armA: 0.8,
        foreA: 1.4,
      });
    case 'wild':
      return pose(base, {
        hipsY: -0.16,
        spine: 0.35,
        head: -0.3,
        armA: 0.9,
        foreA: 0.9,
        armB: 0.7,
        foreB: 1.0,
        legA: 0.55,
        shinA: -0.6,
      });
    case 'knight':
      return pose(base, { armA: 1.2, foreA: 0.6, armB: 0.3, foreB: 2.2, spine: 0.12 });
    case 'goofy':
      return pose(base, {
        spine: bob * 0.12,
        head: -bob * 0.15,
        hipsY: -0.06 + Math.abs(bob) * 0.03,
        armA: 0.4,
        foreA: 1.0,
        armB: 0.2,
        foreB: 1.1,
      });
    case 'lazy':
      return pose(base, {
        hipsY: -0.06 + breath * 2,
        spine: 0.25,
        head: 0.1,
        armA: 0.15,
        foreA: 0.6,
        armB: 0.05,
        foreB: 0.5,
      });
    case 'dancer': {
      const beat = Math.abs(Math.sin(time * 6));
      return pose(base, {
        hipsY: -0.08 + beat * 0.06,
        spine: Math.sin(time * 6) * 0.08,
        armA: 0.6 + beat * 0.3,
        armB: 0.4 + (1 - beat) * 0.3,
      });
    }
    case 'villain':
      return pose(base, {
        spine: -0.06,
        head: 0.08,
        armA: 0.9,
        foreA: 2.3,
        armB: 0.85,
        foreB: 2.4,
        legA: 0.18,
        legB: -0.18,
      });
    default:
      return base;
  }
}

/** Comemoração de vitória de cada personalidade. */
function victory(time: number, personality?: Personality): Pose {
  const bounce = Math.abs(Math.sin(time * 4)) * 0.05;
  const wave = Math.sin(time * 6);
  const base = pose(neutralPose(), {
    hipsY: bounce,
    armA: 3.0,
    foreA: 0.2,
    armB: 0.3,
    foreB: 1.6,
    head: -0.2,
    spread: 0.2,
    legA: 0.15,
    legB: -0.15,
  });
  switch (personality) {
    case 'cool':
    case 'villain':
      // Braços cruzados, olhando por cima.
      return pose(base, {
        hipsY: 0,
        armA: 1.1,
        foreA: 2.3,
        armB: 1.0,
        foreB: 2.4,
        head: 0.15,
        spine: -0.1,
        spread: 0,
      });
    case 'brute':
      // Mostrando os músculos.
      return pose(base, {
        hipsY: -0.1,
        armA: 1.6,
        foreA: 2.4,
        armB: 1.6,
        foreB: 2.4,
        spread: 1.2,
        head: -0.1,
      });
    case 'royal':
    case 'mystic':
      return pose(base, {
        hipsY: 0.05 + bounce,
        armA: 2.6,
        armB: 2.6,
        foreA: 0.2,
        foreB: 0.2,
        spread: 0.9,
        head: -0.3,
      });
    case 'wild':
      return pose(base, {
        hipsY: Math.abs(Math.sin(time * 8)) * 0.15,
        armA: 2.8,
        armB: 2.8,
        spread: 0.6,
        spine: -0.2,
      });
    case 'goofy':
    case 'dancer':
      return pose(base, {
        armA: 2.2 + wave * 0.6,
        armB: 2.2 - wave * 0.6,
        foreA: 0.6,
        foreB: 0.6,
        spine: wave * 0.15,
        hipsY: bounce * 2,
      });
    case 'lazy':
      // Espreguiçando.
      return pose(base, {
        hipsY: 0,
        armA: 3.0,
        armB: 3.0,
        foreA: 0.4,
        foreB: 0.4,
        spine: -0.25,
        head: -0.4,
        spread: 0.3,
      });
    case 'knight':
      return pose(base, { armA: 2.9, foreA: 0.05, armB: 0.5, foreB: 2.0, spine: -0.08 });
    default:
      return base;
  }
}

function crouch(): Pose {
  return pose(neutralPose(), {
    hipsY: -0.38,
    spine: 0.35,
    head: -0.3,
    armA: 0.9,
    foreA: 1.9,
    armB: 0.7,
    foreB: 2.0,
    legA: 1.2,
    shinA: -2.0,
    legB: 0.55,
    shinB: -1.9,
  });
}

function airTuck(rising: boolean): Pose {
  return pose(neutralPose(), {
    spine: 0.1,
    armA: 0.9,
    foreA: 1.6,
    armB: 0.5,
    foreB: 1.8,
    legA: rising ? 1.3 : 0.9,
    shinA: rising ? -1.8 : -1.0,
    legB: rising ? 0.9 : 0.4,
    shinB: rising ? -1.6 : -0.9,
  });
}

function lying(): Pose {
  return pose(neutralPose(), {
    hipsY: -0.65,
    hipsRot: 1.5,
    armA: 2.7,
    foreA: 0.4,
    armB: 2.4,
    foreB: 0.6,
    legA: 0.2,
    legB: 0.5,
    shinB: -0.6,
  });
}

/** Pose de preparação (W) e de golpe (S) para cada tipo de animação de ataque. */
// twist > 0 leva o ombro A (lado da câmera) para a frente; < 0 leva o ombro B.
// lunge é o passo do quadril para a frente (negativo = recua o corpo, como nos chutes).
const STRIKES: Record<AnimKind, { w: PosePatch; s: PosePatch; base?: 'crouch' | 'air' }> = {
  jab: {
    w: { armA: 0.75, foreA: 2.3, twist: -0.15 },
    s: { armA: 1.6, foreA: 0.05, spine: 0.2, twist: 0.35, lunge: 0.07, head: 0.05 },
  },
  cross: {
    w: { armB: 0.2, foreB: 2.4, spine: -0.12, twist: 0.3, lunge: -0.04 },
    s: { armB: 1.62, foreB: 0, spine: 0.32, legB: -0.55, twist: -0.75, lunge: 0.16, head: 0.1 },
  },
  frontKick: {
    w: { legA: 1.35, shinA: -2.0, spine: -0.05, lunge: -0.03 },
    s: { legA: 1.55, shinA: 0, spine: -0.25, armA: 0.3, lunge: -0.06 },
  },
  roundhouse: {
    w: { legB: 0.9, shinB: -1.8, spine: -0.2, twist: 0.45 },
    s: {
      legB: 1.95,
      shinB: -0.05,
      spine: -0.5,
      armB: -0.5,
      hipsY: 0.03,
      twist: -0.85,
      lunge: -0.04,
    },
  },
  crouchJab: {
    base: 'crouch',
    w: { armA: 0.75, foreA: 2.3, twist: -0.1 },
    s: { armA: 1.55, foreA: 0.05, twist: 0.3, lunge: 0.05 },
  },
  uppercut: {
    base: 'crouch',
    w: { armB: 0.1, foreB: 2.5, twist: 0.35, hipsY: -0.45 },
    s: {
      hipsY: 0.04,
      spine: -0.15,
      head: -0.3,
      armB: 3.0,
      foreB: 0.25,
      legA: 0.3,
      shinA: -0.2,
      legB: -0.2,
      shinB: -0.1,
      twist: -0.6,
      lunge: 0.08,
    },
  },
  lowKick: {
    base: 'crouch',
    w: { legA: 0.8, shinA: -2.1 },
    s: { legA: 1.6, shinA: -0.05, hipsY: -0.44, lunge: 0.05 },
  },
  sweep: {
    base: 'crouch',
    w: { legB: 0.3, twist: 0.3 },
    s: { legB: 1.65, shinB: 0, spine: 0.6, hipsY: -0.52, twist: -0.9 },
  },
  airPunch: {
    base: 'air',
    w: { armA: 0.5, foreA: 2.2, twist: -0.15 },
    s: { armA: 1.15, foreA: 0.05, twist: 0.35 },
  },
  airKick: {
    base: 'air',
    w: { legA: 1.4, shinA: -1.8 },
    s: { legA: 1.0, shinA: -0.05, legB: 0.2, shinB: -1.6, spine: -0.25 },
  },
  throw: {
    w: { armA: 1.4, foreA: 0.5, armB: 1.4, foreB: 0.5 },
    s: { armA: 2.7, armB: 2.7, foreA: 0.3, foreB: 0.3, spine: -0.45 },
  },
  projectile: {
    w: { armA: 0.4, foreA: 2.3, armB: 0.4, foreB: 2.3, spine: -0.15 },
    s: { armA: 1.57, foreA: 0, armB: 1.57, foreB: 0, spine: 0.2 },
  },
  dash: {
    w: { spine: 0.3, armA: 0.3, foreA: 2.0 },
    s: {
      spine: 0.65,
      armA: 0.3,
      foreA: 2.0,
      armB: -0.8,
      legA: 0.9,
      shinA: -0.6,
      legB: -0.7,
      shinB: -0.5,
    },
  },
  slash: {
    w: { armA: 2.8, foreA: 0.4, spine: -0.3, twist: -0.4 },
    s: { armA: 0.9, foreA: 0, spine: 0.4, legA: 0.6, twist: 0.6, lunge: 0.14 },
  },
  slam: {
    w: { armA: 3.0, armB: 3.0, foreA: 0.2, foreB: 0.2, spine: -0.35 },
    s: { armA: 1.1, armB: 1.1, foreA: 0, foreB: 0, spine: 0.55, hipsY: -0.15 },
  },
  rising: {
    w: { hipsY: -0.2, armA: 0.4, foreA: 2.3 },
    s: { armA: 2.95, foreA: 0.2, legA: 1.2, shinA: -1.5, spine: -0.1, head: -0.3 },
  },
  teleport: {
    w: { spine: 0.5, armA: -0.5, armB: -0.5 },
    s: { spine: 0.5, armA: -0.6, armB: -0.6 },
  },
  burst: {
    w: { armA: 1.2, foreA: 2.4, armB: 1.2, foreB: 2.4, hipsY: -0.2, spine: 0.45 },
    s: { armA: 2.3, armB: 2.3, foreA: 0, foreB: 0, spread: 0.9, spine: -0.3, head: -0.3 },
  },
  transform: {
    w: { armA: 0.4, armB: 0.4, foreA: 2.5, foreB: 2.5, hipsY: -0.15, spine: 0.3 },
    s: { armA: 2.8, armB: 2.8, foreA: 0.1, foreB: 0.1, spread: 0.6, spine: -0.35, head: -0.3 },
  },
  grab: {
    w: { armA: 0.8, foreA: 1.6, spine: -0.1 },
    s: { armA: 1.6, foreA: 0, spine: 0.3 },
  },
  stomp: {
    w: { legA: 1.6, shinA: -1.0, armA: 2.5, armB: 2.5, foreA: 0.4, foreB: 0.4 },
    s: { legA: 0.3, shinA: -0.3, hipsY: -0.2, armA: 1.0, armB: 1.0, spine: 0.45 },
  },
};

function attackPose(
  f: FighterState,
  def: CharacterDef,
  time: number,
  personality?: Personality,
): Pose {
  const move = currentMove(f, def);
  if (!move) return guard(time, personality);
  const strike = STRIKES[move.anim];
  const base =
    strike.base === 'crouch'
      ? crouch()
      : strike.base === 'air'
        ? airTuck(f.vy > 0)
        : guard(time, personality);
  const windup = pose(base, strike.w);
  const hit = pose(base, strike.s);
  return strikeTimeline(base, windup, hit, f.stateTick, move.startup, move.active, move.recovery);
}

/** Último golpe que o lutador levou: forte ou fraco, na cabeça ou no corpo. */
export interface HitReaction {
  heavy: boolean;
  high: boolean;
}

/**
 * Reação de quem apanha: golpe alto joga a cabeça para trás, golpe no corpo faz o lutador se
 * curvar; golpe forte reage mais. Começa no máximo e se recupera até o fim do atordoamento.
 */
function hitReaction(
  f: FighterState,
  time: number,
  personality: Personality | undefined,
  reaction: HitReaction = { heavy: false, high: true },
): Pose {
  const base = f.crouching ? crouch() : guard(time, personality);
  const total = f.stateTick + Math.max(1, f.stun);
  const r = (1 - easeOut(Math.min(1, f.stateTick / total))) * (reaction.heavy ? 1.35 : 1);
  if (reaction.high && !f.crouching) {
    return pose(base, {
      spine: base.spine - 0.5 * r,
      head: base.head - 0.7 * r,
      armA: base.armA - 0.9 * r,
      foreA: base.foreA - 1.2 * r,
      armB: base.armB - 0.3 * r,
      foreB: base.foreB - 1.3 * r,
      twist: 0.25 * r,
      lunge: -0.12 * r,
    });
  }
  return pose(base, {
    spine: base.spine + 0.45 * r,
    head: base.head + 0.35 * r,
    hipsY: base.hipsY - 0.08 * r,
    armA: 0.6,
    foreA: 2.3,
    armB: 0.5,
    foreB: 2.4,
    twist: -0.2 * r,
    lunge: -0.1 * r,
  });
}

const easeInOut = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
/** Passa um pouco do ponto e volta (o "estalo" do golpe de desenho animado). */
const easeOutBack = (t: number) => {
  const s = 1.9;
  const u = t - 1;
  return 1 + u * u * ((s + 1) * u + s);
};

/**
 * Ritmo do golpe, em ticks: preparação suave → estalo rápido que passa do ponto → segura no
 * impacto → volta. Exportado para teste.
 */
export function strikeTimeline(
  base: Pose,
  windup: Pose,
  hit: Pose,
  t: number,
  startup: number,
  active: number,
  recovery: number,
): Pose {
  if (t < startup) {
    // A preparação usa ~60% do startup; o golpe "estala" nos ticks finais.
    const k = startup === 0 ? 1 : t / startup;
    if (k < 0.6) return mixPose(base, windup, easeInOut(k / 0.6));
    return mixPose(windup, hit, easeOutBack((k - 0.6) / 0.4));
  }
  if (t < startup + active) return hit;
  // Segura a pose um instante (follow-through) e só então volta.
  const k = Math.min(1, (t - startup - active) / Math.max(1, recovery));
  return k < 0.25 ? hit : mixPose(hit, base, easeOut((k - 0.25) / 0.75));
}

/** Pose alvo do lutador neste quadro e a velocidade com que o modelo deve chegar nela. */
export function targetPose(
  f: FighterState,
  def: CharacterDef,
  time: number,
  personality?: Personality,
  /** Fase dos passos pela distância andada; sem ela, usa o relógio. */
  walkPhase?: number,
  /** Como foi o último golpe recebido (muda a reação de quem apanha). */
  reaction?: HitReaction,
): { pose: Pose; rate: number } {
  switch (f.state) {
    case 'idle':
      return { pose: guard(time, personality), rate: 0.25 };
    case 'walk': {
      const forward = Math.sign(f.vx) === f.facing ? 1 : -1;
      const phase = (walkPhase ?? time * 10) * forward;
      const s = Math.sin(phase);
      return {
        pose: pose(guard(time, personality), {
          legA: 0.1 + s * 0.45,
          legB: -0.1 - s * 0.45,
          shinA: -0.2 - Math.max(0, -s) * 0.7,
          shinB: -0.2 - Math.max(0, s) * 0.7,
          hipsY: -0.04 + Math.abs(s) * 0.03,
        }),
        rate: 0.35,
      };
    }
    case 'crouch':
      return { pose: crouch(), rate: 0.4 };
    case 'block':
    case 'blockstun': {
      const base = f.crouching ? crouch() : guard(time, personality);
      const push = f.state === 'blockstun' ? -0.15 : 0;
      return {
        pose: pose(base, {
          armA: 1.25,
          foreA: 2.4,
          armB: 1.05,
          foreB: 2.5,
          spine: base.spine - 0.1 + push,
          head: 0.1,
        }),
        rate: 0.5,
      };
    }
    case 'air':
      return { pose: airTuck(f.vy > 0), rate: 0.25 };
    case 'land':
      return { pose: pose(guard(time, personality), { hipsY: -0.18, spine: 0.2 }), rate: 0.5 };
    case 'attack':
      // Resposta rápida: o golpe precisa "estalar" na tela, não chegar devagar.
      return { pose: attackPose(f, def, time, personality), rate: 0.9 };
    case 'hitstun':
      return { pose: hitReaction(f, time, personality, reaction), rate: 0.85 };
    case 'launched':
      return {
        pose: pose(neutralPose(), {
          hipsRot: Math.min(1.3, 0.3 + f.stateTick * 0.05),
          armA: 2.4,
          foreA: 0.3,
          armB: 2.0,
          foreB: 0.5,
          legA: 0.6,
          shinA: -0.4,
          legB: 0.2,
          head: 0.3,
        }),
        rate: 0.3,
      };
    case 'ko':
      if (f.y > 0) return targetPose({ ...f, state: 'launched' }, def, time, personality);
      return { pose: lying(), rate: 0.3 };
    case 'knockdown':
      return { pose: lying(), rate: 0.3 };
    case 'getup': {
      const k = Math.min(1, f.stateTick / GETUP_TICKS);
      const p =
        k < 0.5
          ? mixPose(lying(), crouch(), k * 2)
          : mixPose(crouch(), guard(time, personality), (k - 0.5) * 2);
      return { pose: p, rate: 0.5 };
    }
    case 'thrown':
      return {
        pose: pose(neutralPose(), {
          hipsY: 0.3,
          hipsRot: -f.stateTick * 0.22,
          armA: 2.0,
          armB: 1.6,
          legA: 0.5,
        }),
        rate: 0.5,
      };
    case 'dizzy': {
      const sway = Math.sin(time * 3);
      return {
        pose: pose(neutralPose(), {
          hipsY: -0.05,
          spine: sway * 0.2,
          head: Math.cos(time * 3) * 0.3,
          armA: 0.1 + sway * 0.15,
          foreA: 0.3,
          armB: -0.1 - sway * 0.15,
          foreB: 0.4,
          legA: 0.1,
          legB: -0.1,
          shinA: -0.2,
          shinB: -0.2,
        }),
        rate: 0.2,
      };
    }
    case 'victory':
      return { pose: victory(time, personality), rate: 0.2 };
    case 'toonality':
      return {
        pose: pose(neutralPose(), {
          armA: 2.8,
          armB: 2.8,
          foreA: 0.1,
          foreB: 0.1,
          spread: 0.7,
          spine: -0.3,
          head: -0.3,
        }),
        rate: 0.2,
      };
  }
}
