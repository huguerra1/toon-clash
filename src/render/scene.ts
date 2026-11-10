import * as THREE from 'three';
import { getLook, LOOKS } from '../characters/looks';
import { getCharacter } from '../characters/roster';
import { ARENA_HALF_WIDTH, TOONALITY_TICKS } from '../combat/constants';
import { type FighterState, currentMove } from '../combat/fighter';
import type { CharacterId, MoveDef } from '../combat/types';
import type { GameEvent } from '../game/events';
import type { MatchState } from '../game/match';
import { Effects } from './effects';
import { getFighterSource } from './fighter-assets';
import { PostProcessing } from './post';
import {
  type Quality,
  type QualityLevel,
  defaultQualityLevel,
  loadQuality,
  saveQuality,
} from './quality';
import {
  type AccessibilityPrefs,
  flashScale,
  loadAccessibility,
  saveAccessibility,
  shakeScale,
} from '../ui/accessibility';
import type { Personality } from '../characters/look';
import { type Expression, FighterModel, type PropName } from './fighter-model';
import { type HitReaction, targetPose } from './poses';
import { buildStage, type BuiltStage, type StageId } from './stages';
import { disposeObject } from './toon-material';
import { ToonalityPlayer } from './toonality';

/** Distância mínima da câmera até o plano da luta (lutadores próximos). */
const CAMERA_MIN_DISTANCE = 9;
/** Espaço livre além de cada lutador, nas bordas da tela. */
const CAMERA_MARGIN = 1.6;
/** Fração do caminho até o alvo que a câmera anda por quadro (suavização). */
const CAMERA_SMOOTHING = 0.1;
/** Um pouco virado para a câmera, como em jogos de luta 3D. */
const TURN_TO_CAMERA = 0.35;

/** Acessório que aparece durante cada tipo de golpe (MoveDef.visual). */
const VISUAL_PROPS: Record<string, PropName> = {
  sword: 'sword',
  hammer: 'hammer',
  jets: 'jets',
  rhino: 'horn',
  eagle: 'wings',
  shadowHand: 'shadowHand',
  rocket: 'rocket',
  gorilla: 'bigHands',
  claw: 'bigHands',
  bread: 'bread',
  rake: 'rake',
  lid: 'lid',
  stretch: 'stretch',
};
const ALL_PROPS = [...new Set(Object.values(VISUAL_PROPS))];

/**
 * Nome curto da placa de vídeo. O Chrome devolve algo como
 * "ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 (0x00002507) Direct3D11 vs_5_0 ps_5_0, D3D11)".
 */
export function shortGpuName(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const raw = String(
    info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
  );
  return cleanGpuName(raw);
}

/**
 * Renderizadores por software: aparecem quando a aceleração do navegador está desligada, a placa
 * está na lista de bloqueio ou falta driver. Nesses casos o jogo roda a ~10–15 FPS.
 */
export function isSoftwareRenderer(name: string): boolean {
  return /basic render|swiftshader|llvmpipe|softpipe|software|warp/i.test(name);
}

export function cleanGpuName(raw: string): string {
  let name = raw;
  if (raw.startsWith('ANGLE (')) {
    // "ANGLE (fabricante, nome da placa (0x...) Direct3D11 ..., D3D11)": fica o segundo campo.
    name = raw.slice('ANGLE ('.length).split(', ')[1] ?? raw;
    name = name
      .replace(/\s*\(0x[0-9a-f]+\).*$/i, '')
      .replace(/\s+(Direct3D|OpenGL|Metal|Vulkan).*$/i, '');
  }
  return name.replace(/\s+/g, ' ').trim() || 'placa desconhecida';
}

interface Point {
  x: number;
  y: number;
}

/** Golpes de soco/chute que ganham o risco de movimento no impacto. */
const SWOOSH_ANIMS = new Set<string>([
  'jab',
  'cross',
  'frontKick',
  'roundhouse',
  'crouchJab',
  'uppercut',
  'lowKick',
  'sweep',
  'airPunch',
  'airKick',
  'slash',
]);

/** Passo da caminhada por unidade andada (≈ 3 radianos por metro). */
const WALK_PHASE_PER_UNIT = 3;
/** Acima disso entre dois ticks é teletransporte/arremesso: não interpola. */
const MAX_INTERPOLATED_JUMP = 1.5;

/** O estado anterior só serve para interpolar se for exatamente o tick antes deste. */
function canInterpolate(match: MatchState, previous: MatchState | null): previous is MatchState {
  return previous !== null && previous.tick === match.tick - 1 && previous.round === match.round;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Posição de cada lutador entre o tick anterior e o atual. */
export function interpolatedPositions(
  match: MatchState,
  previous: MatchState | null,
  alpha: number,
): [Point, Point] {
  const t = Math.min(1, Math.max(0, alpha));
  return match.fighters.map((f, i) => {
    const p = canInterpolate(match, previous) ? previous.fighters[i]! : null;
    if (!p || Math.abs(f.x - p.x) > MAX_INTERPOLATED_JUMP) return { x: f.x, y: f.y };
    return { x: lerp(p.x, f.x, t), y: lerp(p.y, f.y, t) };
  }) as [Point, Point];
}

/** Projéteis com a posição interpolada (pelo id, entre o tick anterior e o atual). */
function interpolatedProjectiles(match: MatchState, previous: MatchState | null, alpha: number) {
  if (!canInterpolate(match, previous)) return match.projectiles;
  const before = new Map(previous.projectiles.map((p) => [p.id, p.x]));
  const t = Math.min(1, Math.max(0, alpha));
  return match.projectiles.map((p) => {
    const x = before.get(p.id);
    return x === undefined ? p : { ...p, x: lerp(x, p.x, t) };
  });
}

/** Cara do lutador conforme o que ele está fazendo. */
function expressionFor(f: FighterState, special: boolean, personality?: Personality): Expression {
  switch (f.state) {
    case 'attack':
      return special ? 'shout' : 'angry';
    case 'block':
    case 'blockstun':
    case 'air':
      return 'angry';
    case 'hitstun':
    case 'launched':
    case 'thrown':
    case 'knockdown':
    case 'getup':
      return 'pain';
    case 'ko':
      return 'ko';
    case 'dizzy':
      return 'dizzy';
    case 'victory':
    case 'toonality':
      return 'happy';
    default:
      return personality === 'lazy' ? 'sleepy' : 'neutral';
  }
}

/** Squash & stretch: estica ao subir no pulo, achata ao cair e ao levar golpe. */
function stretchFor(f: FighterState, move: MoveDef | null): number {
  switch (f.state) {
    case 'air':
      return f.vy > 0.1 ? 1.14 : f.vy < -0.12 ? 1.06 : 1;
    case 'land':
      return 0.8;
    case 'hitstun':
      return f.stateTick < 5 ? 0.86 : 1;
    case 'attack':
      if (move && f.stateTick >= move.startup && f.stateTick < move.startup + move.active)
        return 1.05;
      return move && f.stateTick < move.startup ? 0.95 : 1;
    default:
      return 1;
  }
}

/** Desenha a partida. Não contém regra de jogo: só lê o MatchState e reage aos eventos. */
export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  /** Grupo que segura a câmera (no modo VR a cabeça do usuário se move dentro dele). */
  readonly cameraRig = new THREE.Group();
  private readonly effects = new Effects();
  /** Brilho pós-processado (bloom); desligado na qualidade 'baixo'. */
  private readonly post: PostProcessing;
  /** Preferência de qualidade escolhida pelo jogador ('alto', 'baixo' ou 'auto'). */
  quality: Quality = loadQuality();
  /** Nível gráfico efetivo atualmente aplicado ('alto' ou 'baixo'). */
  effectiveQuality: QualityLevel = defaultQualityLevel();
  /** Tremor de tela e flashes escolhidos no menu Opções. */
  accessibility: AccessibilityPrefs = loadAccessibility();
  private stage: BuiltStage | null = null;
  private models: [FighterModel[], FighterModel[]] = [[], []];
  private toonality: ToonalityPlayer | null = null;
  private readonly fxKeys: [string, string] = ['', ''];
  private time = 0;
  /** Fase do ciclo de passos de cada lutador (avança com a distância andada). */
  private readonly walkPhase: [number, number] = [0, 0];
  private cachedGpu: string | null = null;
  /** Último golpe recebido por cada lutador (para a reação de quem apanha). */
  private readonly reactions: [HitReaction, HitReaction] = [
    { heavy: false, high: true },
    { heavy: false, high: true },
  ];
  private lastDefender: 0 | 1 | null = null;
  /** Zoom de impacto da câmera (1 logo após um golpe forte, 0 em repouso). */
  private cameraPunch = 0;
  private loadedStage: StageId | null = null;
  private loadedCharacters = '';

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.cameraRig.add(this.camera);
    this.scene.add(this.cameraRig);
    this.camera.position.set(0, 2.2, CAMERA_MIN_DISTANCE);
    this.scene.add(this.effects.group);
    this.addLights();
    this.post = new PostProcessing(this.renderer, this.scene, this.camera);
    this.setQuality(this.quality === 'auto' ? this.effectiveQuality : this.quality);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Monta cenário e lutadores. Não refaz nada se já estiver com a mesma combinação. */
  load(characters: [CharacterId, CharacterId], stageId: StageId): void {
    if (stageId !== this.loadedStage) {
      this.loadedStage = stageId;
      if (this.stage) {
        disposeObject(this.stage.group);
        this.stage.background.dispose();
      }
      this.stage = buildStage(stageId);
      this.scene.add(this.stage.group);
      this.scene.background = this.stage.background;
      this.scene.fog = this.stage.fog;
    }
    const key = characters.join(',');
    if (key === this.loadedCharacters) return;
    this.loadedCharacters = key;
    this.reset();
    for (const m of this.models.flat()) m.dispose();
    this.models = [this.createModels(characters[0]), this.createModels(characters[1])];
  }

  /** Força recriar os lutadores no próximo load() (ex.: modelos 3D acabaram de carregar). */
  invalidateCharacters(): void {
    this.loadedCharacters = '';
  }

  /** Limpa efeitos e Toonality (novo round ou nova partida). */
  reset(): void {
    this.effects.clear();
    this.toonality?.dispose();
    this.toonality = null;
    for (const m of this.models.flat()) {
      m.root.visible = true;
      m.root.position.set(0, 0, 0);
      m.root.rotation.set(0, 0, 0);
      m.body.scale.setScalar(m.look.scale);
    }
  }

  private createModels(id: CharacterId): FighterModel[] {
    return LOOKS[id].map((_, form) => {
      const model = new FighterModel(getLook(id, form), getFighterSource(id, form));
      model.flashScale = flashScale(this.accessibility.flashes);
      this.scene.add(model.root);
      return model;
    });
  }

  /** Efeitos visuais disparados pelos eventos de um tick. */
  handleEvents(events: readonly GameEvent[], match: MatchState): void {
    const glow = (i: 0 | 1) => getLook(match.fighters[i].character, match.fighters[i].form).glow;
    for (const e of events) {
      switch (e.type) {
        case 'hit': {
          const defender = (1 - e.attacker) as 0 | 1;
          this.activeModel(match, defender)?.hitFlash();
          const target = match.fighters[defender];
          const height = getCharacter(target.character).height;
          this.reactions[defender] = { heavy: e.heavy, high: e.y - target.y > height * 0.6 };
          this.lastDefender = defender;
          if (e.heavy) this.cameraPunch = 1;
          this.effects.burst(
            e.x,
            e.y,
            e.heavy ? 0xffe14d : 0xffffff,
            e.heavy ? 18 : 10,
            e.heavy ? 0.11 : 0.07,
          );
          this.effects.ringPulse(e.x, e.y, e.heavy ? 0xff8a3d : 0xffffff, e.heavy ? 1.3 : 0.8);
          if (e.heavy || e.combo >= 3 || Math.random() < 0.35) this.effects.word(e.x, e.y, e.heavy);
          this.effects.shake = Math.min(1, this.effects.shake + (e.heavy ? 0.5 : 0.18));
          break;
        }
        case 'block':
          this.effects.ringPulse(e.x, e.y, 0x6ad1ff, 0.9);
          this.effects.burst(e.x, e.y, 0x6ad1ff, 6, 0.05, 'cube');
          break;
        case 'armor':
          this.effects.ringPulse(e.x, e.y, 0xffa040, 1.2);
          this.activeModel(match, e.player)?.hitFlash();
          break;
        case 'clash':
          this.effects.burst(e.x, e.y, 0xffffff, 24, 0.12);
          this.effects.word(e.x, e.y, true, 'ZAP!');
          this.effects.shake = Math.min(1, this.effects.shake + 0.3);
          break;
        case 'land':
          this.effects.dust(match.fighters[e.player].x, 4);
          break;
        case 'knockdown':
          this.effects.dust(e.x, 12);
          this.effects.shake = Math.min(1, this.effects.shake + 0.3);
          break;
        case 'transform': {
          const f = match.fighters[e.player];
          this.effects.burst(f.x, 1.2, glow(e.player), 30, 0.12);
          this.effects.ringPulse(f.x, 1.2, glow(e.player), 2);
          this.activeModel(match, e.player)?.hitFlash();
          break;
        }
        case 'teleport':
          this.effects.burst(e.fromX, 1.1, 0x9a3dff, 16, 0.08, 'cube');
          this.effects.burst(e.toX, 1.1, 0x9a3dff, 16, 0.08, 'cube');
          break;
        case 'special': {
          const f = match.fighters[e.player];
          this.effects.ringPulse(f.x, 1.1, glow(e.player), 1.4);
          break;
        }
        case 'throw':
          this.effects.shake = Math.min(1, this.effects.shake + 0.3);
          break;
        case 'ko':
          this.effects.shake = 1;
          break;
        case 'announce':
          if (e.kind === 'round') this.reset();
          break;
        default:
          break;
      }
    }
  }

  /**
   * Desenha um quadro. A lógica roda a 60 Hz e a tela pode ser mais rápida (120/144 Hz): com o
   * estado anterior e `alpha` (0..1, fração entre os dois ticks) as posições são interpoladas,
   * para o movimento ficar liso em qualquer monitor.
   */
  render(match: MatchState, dt: number, previous: MatchState | null = null, alpha = 1): void {
    this.time += dt;
    const presenting = this.renderer.xr.isPresenting;
    const positions = interpolatedPositions(match, previous, alpha);

    match.fighters.forEach((f, i) => {
      const index = i as 0 | 1;
      const def = getCharacter(f.character);
      const models = this.models[index];
      const model = this.activeModel(match, index);
      for (const m of models) m.root.visible = m === model;
      if (!model) return;

      const victim = match.toonality !== null && match.toonality.player !== index;
      const { x, y } = positions[index];
      // Passos acompanham a distância andada (sem o pé "patinar" no chão).
      const moved = model.root.position.x - x;
      this.walkPhase[index] += Math.abs(moved) * WALK_PHASE_PER_UNIT;
      // Na pausa do impacto (hitstop) quem apanhou treme no lugar.
      const shaking = match.hitstop > 0 && this.lastDefender === index;
      const jitter = shaking
        ? (Math.random() - 0.5) * 0.08 * shakeScale(this.accessibility.screenShake)
        : 0;
      model.root.position.set(x + jitter, y, 0);
      this.turnToward(model, f.facing === 1 ? -TURN_TO_CAMERA : Math.PI + TURN_TO_CAMERA, dt);
      const state = victim && f.state === 'toonality' ? { ...f, state: 'dizzy' as const } : f;
      const { pose, rate } = targetPose(
        state,
        def,
        this.time + index * 0.7,
        model.look.personality,
        this.walkPhase[index],
        this.reactions[index],
      );
      model.applyPose(pose, rate, dt);

      const move = currentMove(f, def);
      model.setExpression(expressionFor(state, move?.special === true, model.look.personality));
      model.setStretch(stretchFor(state, move), dt);
      const visualProp = move?.visual ? VISUAL_PROPS[move.visual] : undefined;
      for (const prop of ALL_PROPS) model.setProp(prop, prop === visualProp);
      model.setProp('stars', f.state === 'dizzy' && !match.toonality);

      if (move?.anim === 'teleport') {
        const t = f.stateTick;
        const k = t < move.startup ? 1 - t / move.startup : Math.min(1, (t - move.startup) / 8);
        model.body.scale.setScalar(model.look.scale * Math.max(0.02, k));
      }
      this.moveEffects(match, index);
      model.update(dt);
    });

    this.updateToonality(match);
    this.effects.syncProjectiles(
      interpolatedProjectiles(match, previous, alpha),
      (owner) => getLook(match.fighters[owner].character, match.fighters[owner].form).glow,
    );
    this.effects.update(dt);
    this.stage?.update(this.time);
    if (!presenting) this.followFighters(positions, dt);
    this.post.render();
  }

  /** Gira o lutador até o lado certo em ~0,1 s (antes virava 180° de uma vez). */
  private turnToward(model: FighterModel, target: number, dt: number): void {
    const current = model.root.rotation.y;
    // Menor caminho entre os dois ângulos.
    const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    const k = 1 - Math.exp(-dt * 30);
    model.root.rotation.set(0, Math.abs(diff) < 0.001 ? target : current + diff * k, 0);
  }

  /** Aplica o nível efetivo ('alto': brilho e sombras suaves; 'baixo': mais leve para celular). */
  setQuality(level: QualityLevel): void {
    // Sem placa de vídeo (renderização por software) só o 'baixo' é jogável.
    if (this.softwareRendering) level = 'baixo';
    this.effectiveQuality = level;
    const high = level === 'alto';
    this.post.enabled = high;
    // No 'baixo' a sombra sai de vez: ela desenha a cena inteira mais uma vez a cada quadro.
    if (this.renderer.shadowMap.enabled !== high) {
      this.renderer.shadowMap.enabled = high;
      this.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.needsUpdate = true;
        }
      });
    }
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 2 : 1));
    this.resize();
  }

  /** O navegador está desenhando sem a placa de vídeo (aceleração desligada ou sem driver). */
  get softwareRendering(): boolean {
    return isSoftwareRenderer(this.gpuName);
  }

  /** Placa de vídeo que o navegador está usando (ex.: "NVIDIA GeForce RTX 3050"). */
  get gpuName(): string {
    if (this.cachedGpu === null) this.cachedGpu = shortGpuName(this.renderer.getContext());
    return this.cachedGpu;
  }

  /** Salva a preferência do jogador ('alto', 'baixo' ou 'auto') e aplica o nível efetivo. */
  setQualityPreference(quality: Quality, effective: QualityLevel = defaultQualityLevel()): void {
    this.quality = quality;
    saveQuality(quality);
    this.setQuality(quality === 'auto' ? effective : quality);
  }

  /** Salva e aplica na hora as preferências de tremor e flashes (sem recarregar). */
  setAccessibility(prefs: AccessibilityPrefs): void {
    this.accessibility = { ...prefs };
    saveAccessibility(this.accessibility);
    const scale = flashScale(this.accessibility.flashes);
    for (const m of this.models.flat()) m.flashScale = scale;
  }

  private activeModel(match: MatchState, i: 0 | 1): FighterModel | undefined {
    const models = this.models[i];
    return models[match.fighters[i].form] ?? models[0];
  }

  /** Efeitos ligados a golpes específicos (explosão, onda de choque, rastro de investida). */
  private moveEffects(match: MatchState, i: 0 | 1): void {
    const f = match.fighters[i];
    const move = currentMove(f);
    if (f.state !== 'attack' || !move) return;
    const glow = getLook(f.character, f.form).glow;
    const key = `${match.tick - f.stateTick}:${f.moveId}`;
    if (f.stateTick >= move.startup && this.fxKeys[i] !== key) {
      this.fxKeys[i] = key;
      // Risco de movimento onde o soco/chute chega, no primeiro quadro ativo.
      if (move.hitbox && SWOOSH_ANIMS.has(move.anim)) {
        const hb = move.hitbox;
        const pos = interpolatedPositions(match, null, 1)[i];
        this.effects.swoosh(
          pos.x + f.facing * (hb.x + hb.w * 0.6),
          pos.y + hb.y + hb.h / 2,
          f.facing,
          move.damage >= 70,
        );
      }
      if (move.anim === 'burst') {
        this.effects.ringPulse(f.x, 1, glow, 3);
        this.effects.burst(f.x, 1, glow, 30, 0.14);
      }
      if (move.anim === 'stomp') {
        for (let k = 0; k < 3; k++)
          this.effects.ringPulse(f.x + f.facing * k * 0.8, 0.05, glow, 1.5 + k, true);
        this.effects.dust(f.x + f.facing, 14);
        this.effects.shake = Math.min(1, this.effects.shake + 0.5);
      }
      if (move.anim === 'slam') this.effects.dust(f.x + f.facing * 1.2, 10);
    }
    const dashing = move.dash && f.stateTick >= move.dash.from && f.stateTick < move.dash.to;
    const rising = move.rise && f.stateTick >= move.startup && f.y > 0;
    if ((dashing || rising) && Math.random() < 0.7) {
      this.effects.burst(f.x - f.facing * 0.3, 0.8 + Math.random() * 0.6, glow, 1, 0.02, 'cube');
    }
  }

  private updateToonality(match: MatchState): void {
    if (!match.toonality) {
      if (this.toonality) {
        this.toonality.dispose();
        this.toonality = null;
      }
      return;
    }
    const winner = match.toonality.player;
    const victimIndex = (1 - winner) as 0 | 1;
    const victim = this.activeModel(match, victimIndex);
    if (!victim) return;
    if (!this.toonality) {
      const glow = getLook(match.fighters[winner].character, match.fighters[winner].form).glow;
      this.toonality = new ToonalityPlayer(
        match.toonality.kind,
        victim,
        this.effects,
        this.scene,
        glow,
      );
    }
    const tick = match.phase === 'toonality' ? match.phaseTick : TOONALITY_TICKS + match.phaseTick;
    const direction = Math.sign(match.fighters[victimIndex].x - match.fighters[winner].x) || 1;
    this.toonality.update(tick, match.fighters[victimIndex].x, direction);
  }

  /**
   * A câmera acompanha o centro da luta e se afasta quando os lutadores se separam,
   * para os dois caberem na tela em qualquer proporção de janela.
   */
  private followFighters(positions: readonly [Point, Point], dt: number): void {
    const [a, b] = positions;
    const center = (a.x + b.x) / 2;
    const halfSpan = Math.abs(b.x - a.x) / 2 + CAMERA_MARGIN;
    const tanHalfFovX =
      Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
    const targetZ = Math.max(CAMERA_MIN_DISTANCE, halfSpan / tanHalfFovX);
    const height = Math.min(Math.max(a.y, b.y), 4) * 0.35;

    // Suavização pelo tempo real: a câmera anda igual em monitor de 60, 120 ou 144 Hz.
    const k = 1 - Math.pow(1 - CAMERA_SMOOTHING, dt * 60);
    const cam = this.camera.position;
    cam.x += (center - cam.x) * k;
    cam.z += (targetZ - cam.z) * k;
    cam.y += (2.1 + height - cam.y) * k;
    const shake =
      this.effects.shake * this.effects.shake * 0.25 * shakeScale(this.accessibility.screenShake);
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    this.camera.lookAt(cam.x + sx, 1.2 + height + sy, 0);
    // Leve zoom no golpe forte, que volta rápido.
    const fov = 40 - this.cameraPunch * 2.5 * shakeScale(this.accessibility.screenShake);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.cameraPunch = Math.max(0, this.cameraPunch - dt * 6);
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a3a66, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(4, 9, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 1024);
    sun.shadow.camera.left = -ARENA_HALF_WIDTH - 3;
    sun.shadow.camera.right = ARENA_HALF_WIDTH + 3;
    sun.shadow.camera.top = 6;
    sun.shadow.camera.bottom = -3;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    // Luz de contorno vinda de trás para destacar os lutadores do fundo.
    const rim = new THREE.DirectionalLight(0xb48cff, 0.8);
    rim.position.set(-3, 4, -6);
    this.scene.add(rim);
  }

  resize(): void {
    const parent = this.renderer.domElement.parentElement!;
    const { clientWidth: width, clientHeight: height } = parent;
    this.renderer.setSize(width, height);
    this.post?.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
