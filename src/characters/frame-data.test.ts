import { describe, expect, it } from 'vitest';
import { buildFrameData } from './frame-data';
import { CHARACTERS } from './roster';

describe('tabela de frame data', () => {
  const tables = buildFrameData();

  it('inclui todo o roster, inclusive o chefe, todas as formas e todos os golpes', () => {
    expect([...new Set(tables.map((table) => table.id))]).toEqual(Object.keys(CHARACTERS));
    for (const def of Object.values(CHARACTERS)) {
      const entries = tables.filter((table) => table.id === def.id);
      expect(entries.map((table) => table.form)).toEqual(
        def.forms?.map((form) => form.name) ?? [undefined],
      );
      for (const entry of entries) {
        expect(entry.moves.map((move) => move.id)).toEqual(Object.keys(def.moves));
      }
    }
  });

  it('soma startup, active e recovery para todos os golpes', () => {
    for (const table of tables) {
      for (const move of table.moves) {
        expect(move.total).toBe(move.startup + move.active + move.recovery);
      }
    }
  });

  it('calcula as vantagens nominais do Jab e do Direto', () => {
    const kai = tables.find((table) => table.id === 'kai')!;
    expect(kai.moves.find((move) => move.id === 'lp')).toMatchObject({
      startup: 4,
      active: 3,
      recovery: 8,
      total: 15,
      hitAdvantage: 7,
      blockAdvantage: 1,
    });
    expect(kai.moves.find((move) => move.id === 'hp')).toMatchObject({
      hitAdvantage: 5,
      blockAdvantage: -3,
    });
  });

  it('não inventa vantagens para stun ausente, quedas, agarrões e projéteis', () => {
    const kai = tables.find((table) => table.id === 'kai')!;
    for (const id of ['d_hp', 'hk', 'throw', 'comet_shoulder', 'omega_blast', 'shift_form']) {
      expect(kai.moves.find((move) => move.id === id)?.hitAdvantage).toBeUndefined();
    }
    for (const id of ['throw', 'comet_shoulder', 'omega_blast', 'shift_form']) {
      expect(kai.moves.find((move) => move.id === id)?.blockAdvantage).toBeUndefined();
    }
  });

  it('aplica formas, arredondamento e chip como no combate', () => {
    const rock = tables.find((table) => table.form === 'Rochedo')!;
    expect(rock.moves.find((move) => move.id === 'lp')?.damage).toBe(39);
    expect(rock.moves.find((move) => move.id === 'omega_blast')).toMatchObject({
      damage: 91,
      chip: 14,
      hitstun: 20,
    });
    const ferrum = tables.find((table) => table.id === 'ferrum')!;
    expect(ferrum.moves.find((move) => move.id === 'rocket_punch')).toMatchObject({
      damage: 132,
      chip: 20,
    });
    expect(ferrum.moves.find((move) => move.id === 'throw')?.chip).toBe(0);
  });

  it('preserva comandos aéreos e propriedades relevantes', () => {
    const solara = tables.find((table) => table.id === 'solara')!;
    expect(solara.moves.find((move) => move.id === 'air_star_bolt')).toMatchObject({
      input: '(no ar) ↓ → + Soco Baixo',
      properties: ['especial', 'projétil (médio)'],
    });
    expect(solara.moves.find((move) => move.id === 'd_lk')?.input).toBe('↓ + Chute Baixo');
    expect(solara.moves.find((move) => move.id === 'j_hk')?.input).toBe('(no ar) Chute Alto');
  });

  it('é determinística e não modifica os dados de origem', () => {
    const before = JSON.stringify(CHARACTERS);
    const first = buildFrameData();
    first[0]!.moves[0]!.properties.push('teste');
    expect(buildFrameData()).toEqual(tables);
    expect(JSON.stringify(CHARACTERS)).toBe(before);
  });
});
