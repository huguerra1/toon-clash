import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { format } from 'prettier';

// Node 22 remove tipos, mas exige extensões; o código do Vite usa imports sem extensão.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { buildFrameData } = await import('../src/characters/frame-data');

function cell(value: string | number | undefined): string {
  return value === undefined
    ? '—'
    : String(value)
        .replace(/\|/g, '\\|')
        .replace(/[\r\n]+/g, ' ');
}

function advantage(value: number | undefined): string {
  return value === undefined ? '—' : value > 0 ? `+${value}` : String(value);
}

const lines = [
  '# Frame data — Toon Clash',
  '',
  'Gerado dos dados do roster com `npm run frame-data` (Node 22.15 ou superior). Não edite as tabelas manualmente.',
  '',
  'Todas as durações estão em frames, a 60 Hz. **Startup** é a preparação; **Active**, a janela ativa; **Recovery**, a recuperação; **Total** = startup + active + recovery. São os valores declarados em `MoveDef`, sem incluir hitstop, voo do projétil ou aterrissagem. As formas alteram dano e movimento, mas não essas durações.',
  '',
  '**Dano** é o de um acerto isolado, já arredondado com `damageMul` do personagem e da forma, sem redução de combo. Para projéteis, usa `projectile.damage`, multiplicado no disparo. **Chip** é o dano na defesa: especiais causam 15% (arredondado); normais e agarrões não causam chip. No projétil, o chip parte do dano já arredondado.',
  '',
  '**Hitstun/Blockstun** mostram apenas campos explícitos dos dados (hitstun do projétil quando presente). **Vant. hit/block** são referências nominais: `hitstun − recovery` e `blockstun − recovery`, com sinal positivo indicando vantagem. Não são uma simulação de segurança: contato nos primeiros frames ativos ainda deixa frames ativos restantes; distância, cancelamentos, queda e aterrissagem também mudam o resultado.',
  '',
  '**—** significa ausente ou não aplicável. Não calculamos vantagem no hit para lançadores, quedas ou agarrões, nem vantagens de projéteis, que dependem do tempo de viagem. Campos ausentes não recebem os padrões do motor (`DEFAULT_HITSTUN = 16`, `DEFAULT_BLOCKSTUN = 10`); na colisão, projéteis usam blockstun 12, definido em `match.ts`, não em `ProjectileDef`.',
  '',
  'Os comandos usam a notação da interface, olhando para a direita. Alto/médio seguem `height`: ambos aceitam defesa em pé ou agachada no motor atual; baixo exige agachar e overhead exige ficar em pé. Propriedades incluem especiais, projéteis, agarrões, lançadores, quedas e defesas especiais. Toonality é uma finalização sem fases `MoveDef` e não entra nas tabelas.',
  '',
];

for (const table of buildFrameData()) {
  lines.push(
    `## ${table.name}${table.form ? ` — Forma ${table.form}` : ''}`,
    '',
    `Multiplicador de dano: ${table.damageMul}. Multiplicador de movimento da forma: ${table.speedMul}.`,
    '',
    '| Golpe | Input | Startup | Active | Recovery | Total | Dano | Chip | Hitstun | Blockstun | Vant. hit | Vant. block | Propriedades |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  );
  for (const move of table.moves) {
    lines.push(
      `| ${[
        `${move.name} (${move.id})`,
        move.input,
        move.startup,
        move.active,
        move.recovery,
        move.total,
        move.damage,
        move.chip,
        move.hitstun,
        move.blockstun,
        advantage(move.hitAdvantage),
        advantage(move.blockAdvantage),
        move.properties.join('; ') || '—',
      ]
        .map(cell)
        .join(' | ')} |`,
    );
  }
  lines.push('');
}

const output = new URL('../docs/FRAME-DATA.md', import.meta.url);
await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
await writeFile(output, await format(lines.join('\n'), { parser: 'markdown' }), 'utf8');
