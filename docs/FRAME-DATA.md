# Frame data — Toon Clash

Gerado dos dados do roster com `npm run frame-data` (Node 22.15 ou superior). Não edite as tabelas manualmente.

Todas as durações estão em frames, a 60 Hz. **Startup** é a preparação; **Active**, a janela ativa; **Recovery**, a recuperação; **Total** = startup + active + recovery. São os valores declarados em `MoveDef`, sem incluir hitstop, voo do projétil ou aterrissagem. As formas alteram dano e movimento, mas não essas durações.

**Dano** é o de um acerto isolado, já arredondado com `damageMul` do personagem e da forma, sem redução de combo. Para projéteis, usa `projectile.damage`, multiplicado no disparo. **Chip** é o dano na defesa: especiais causam 15% (arredondado); normais e agarrões não causam chip. No projétil, o chip parte do dano já arredondado.

**Hitstun/Blockstun** mostram apenas campos explícitos dos dados (hitstun do projétil quando presente). **Vant. hit/block** são referências nominais: `hitstun − recovery` e `blockstun − recovery`, com sinal positivo indicando vantagem. Não são uma simulação de segurança: contato nos primeiros frames ativos ainda deixa frames ativos restantes; distância, cancelamentos, queda e aterrissagem também mudam o resultado.

**—** significa ausente ou não aplicável. Não calculamos vantagem no hit para lançadores, quedas ou agarrões, nem vantagens de projéteis, que dependem do tempo de viagem. Campos ausentes não recebem os padrões do motor (`DEFAULT_HITSTUN = 16`, `DEFAULT_BLOCKSTUN = 10`); na colisão, projéteis usam blockstun 12, definido em `match.ts`, não em `ProjectileDef`.

Os comandos usam a notação da interface, olhando para a direita. Alto/médio seguem `height`: ambos aceitam defesa em pé ou agachada no motor atual; baixo exige agachar e overhead exige ficar em pé. Propriedades incluem especiais, projéteis, agarrões, lançadores, quedas e defesas especiais. Toonality é uma finalização sem fases `MoveDef` e não entra nas tabelas.

## Kai Volt — Forma Kai

Multiplicador de dano: 1. Multiplicador de movimento da forma: 1.

| Golpe                         | Input                     | Startup | Active | Recovery | Total | Dano | Chip | Hitstun | Blockstun | Vant. hit | Vant. block | Propriedades                     |
| ----------------------------- | ------------------------- | ------: | -----: | -------: | ----: | ---: | ---: | ------: | --------: | --------: | ----------: | -------------------------------- |
| Jab (lp)                      | Soco Baixo                |       4 |      3 |        8 |    15 |   30 |    0 |      15 |         9 |        +7 |          +1 | alto; emenda em: lp, hp          |
| Direto (hp)                   | Soco Alto                 |       6 |      3 |       14 |    23 |   55 |    0 |      19 |        11 |        +5 |          -3 | alto                             |
| Chute Frontal (lk)            | Chute Baixo               |       7 |      3 |       12 |    22 |   45 |    0 |      17 |        10 |        +5 |          -2 | médio; emenda em: hk             |
| Chute Giratório (hk)          | Chute Alto                |      10 |      4 |       18 |    32 |   75 |    0 |      22 |        12 |         — |          -6 | médio; derruba                   |
| Soco Agachado (d_lp)          | ↓ + Soco Baixo            |       4 |      3 |        7 |    14 |   22 |    0 |      14 |         8 |        +7 |          +1 | médio; emenda em: d_lp, d_hp     |
| Gancho (d_hp)                 | ↓ + Soco Alto             |       7 |      4 |       24 |    35 |  110 |    0 |       — |        14 |         — |         -10 | médio; lançador                  |
| Rasteira Curta (d_lk)         | ↓ + Chute Baixo           |       5 |      3 |       10 |    18 |   25 |    0 |      14 |         8 |        +4 |          -2 | baixo; emenda em: d_hk           |
| Rasteira (d_hk)               | ↓ + Chute Alto            |       9 |      4 |       22 |    35 |   60 |    0 |       — |        12 |         — |         -10 | baixo; derruba                   |
| Soco Aéreo (j_lp)             | (no ar) Soco Baixo        |       5 |      8 |        6 |    19 |   50 |    0 |      18 |        10 |       +12 |          +4 | médio                            |
| Soco Aéreo Forte (j_hp)       | (no ar) Soco Alto         |       6 |      8 |        6 |    20 |   60 |    0 |      20 |        11 |       +14 |          +5 | médio                            |
| Voadora (j_lk)                | (no ar) Chute Baixo       |       5 |     10 |        6 |    21 |   55 |    0 |      18 |        10 |       +12 |          +4 | médio                            |
| Voadora Forte (j_hk)          | (no ar) Chute Alto        |       7 |     10 |        6 |    23 |   70 |    0 |      21 |        11 |       +15 |          +5 | médio                            |
| Arremesso (throw)             | → + Soco Baixo (de perto) |       4 |      3 |       24 |    31 |  110 |    0 |       — |         — |         — |           — | agarrão (indefensável)           |
| Rajada Ômega (omega_blast)    | ↓ → + Soco Baixo          |      14 |      1 |       20 |    35 |   70 |   11 |      20 |         — |         — |           — | especial; projétil (médio)       |
| Ombro Cometa (comet_shoulder) | ← → + Chute Baixo         |       8 |     14 |       16 |    38 |   90 |   14 |       — |         — |         — |           — | médio; especial; derruba; avanço |
| Mudar Forma (shift_form)      | ↓ ↓ + Soco Alto           |      20 |      1 |       18 |    39 |    0 |    0 |       — |         — |         — |           — | especial; troca de forma         |

## Kai Volt — Forma Rochedo

Multiplicador de dano: 1.3. Multiplicador de movimento da forma: 0.75.

| Golpe                         | Input                     | Startup | Active | Recovery | Total | Dano | Chip | Hitstun | Blockstun | Vant. hit | Vant. block | Propriedades                     |
| ----------------------------- | ------------------------- | ------: | -----: | -------: | ----: | ---: | ---: | ------: | --------: | --------: | ----------: | -------------------------------- |
| Jab (lp)                      | Soco Baixo                |       4 |      3 |        8 |    15 |   39 |    0 |      15 |         9 |        +7 |          +1 | alto; emenda em: lp, hp          |
| Direto (hp)                   | Soco Alto                 |       6 |      3 |       14 |    23 |   72 |    0 |      19 |        11 |        +5 |          -3 | alto                             |
| Chute Frontal (lk)            | Chute Baixo               |       7 |      3 |       12 |    22 |   59 |    0 |      17 |        10 |        +5 |          -2 | médio; emenda em: hk             |
| Chute Giratório (hk)          | Chute Alto                |      10 |      4 |       18 |    32 |   98 |    0 |      22 |        12 |         — |          -6 | médio; derruba                   |
| Soco Agachado (d_lp)          | ↓ + Soco Baixo            |       4 |      3 |        7 |    14 |   29 |    0 |      14 |         8 |        +7 |          +1 | médio; emenda em: d_lp, d_hp     |
| Gancho (d_hp)                 | ↓ + Soco Alto             |       7 |      4 |       24 |    35 |  143 |    0 |       — |        14 |         — |         -10 | médio; lançador                  |
| Rasteira Curta (d_lk)         | ↓ + Chute Baixo           |       5 |      3 |       10 |    18 |   33 |    0 |      14 |         8 |        +4 |          -2 | baixo; emenda em: d_hk           |
| Rasteira (d_hk)               | ↓ + Chute Alto            |       9 |      4 |       22 |    35 |   78 |    0 |       — |        12 |         — |         -10 | baixo; derruba                   |
| Soco Aéreo (j_lp)             | (no ar) Soco Baixo        |       5 |      8 |        6 |    19 |   65 |    0 |      18 |        10 |       +12 |          +4 | médio                            |
| Soco Aéreo Forte (j_hp)       | (no ar) Soco Alto         |       6 |      8 |        6 |    20 |   78 |    0 |      20 |        11 |       +14 |          +5 | médio                            |
| Voadora (j_lk)                | (no ar) Chute Baixo       |       5 |     10 |        6 |    21 |   72 |    0 |      18 |        10 |       +12 |          +4 | médio                            |
| Voadora Forte (j_hk)          | (no ar) Chute Alto        |       7 |     10 |        6 |    23 |   91 |    0 |      21 |        11 |       +15 |          +5 | médio                            |
| Arremesso (throw)             | → + Soco Baixo (de perto) |       4 |      3 |       24 |    31 |  143 |    0 |       — |         — |         — |           — | agarrão (indefensável)           |
| Rajada Ômega (omega_blast)    | ↓ → + Soco Baixo          |      14 |      1 |       20 |    35 |   91 |   14 |      20 |         — |         — |           — | especial; projétil (médio)       |
| Ombro Cometa (comet_shoulder) | ← → + Chute Baixo         |       8 |     14 |       16 |    38 |  117 |   18 |       — |         — |         — |           — | médio; especial; derruba; avanço |
| Mudar Forma (shift_form)      | ↓ ↓ + Soco Alto           |      20 |      1 |       18 |    39 |    0 |    0 |       — |         — |         — |           — | especial; troca de forma         |

## Kai Volt — Forma Faísca

Multiplicador de dano: 0.85. Multiplicador de movimento da forma: 1.45.

| Golpe                         | Input                     | Startup | Active | Recovery | Total | Dano | Chip | Hitstun | Blockstun | Vant. hit | Vant. block | Propriedades                     |
| ----------------------------- | ------------------------- | ------: | -----: | -------: | ----: | ---: | ---: | ------: | --------: | --------: | ----------: | -------------------------------- |
| Jab (lp)                      | Soco Baixo                |       4 |      3 |        8 |    15 |   26 |    0 |      15 |         9 |        +7 |          +1 | alto; emenda em: lp, hp          |
| Direto (hp)                   | Soco Alto                 |       6 |      3 |       14 |    23 |   47 |    0 |      19 |        11 |        +5 |          -3 | alto                             |
| Chute Frontal (lk)            | Chute Baixo               |       7 |      3 |       12 |    22 |   38 |    0 |      17 |        10 |        +5 |          -2 | médio; emenda em: hk             |
| Chute Giratório (hk)          | Chute Alto                |      10 |      4 |       18 |    32 |   64 |    0 |      22 |        12 |         — |          -6 | médio; derruba                   |
| Soco Agachado (d_lp)          | ↓ + Soco Baixo            |       4 |      3 |        7 |    14 |   19 |    0 |      14 |         8 |        +7 |          +1 | médio; emenda em: d_lp, d_hp     |
| Gancho (d_hp)                 | ↓ + Soco Alto             |       7 |      4 |       24 |    35 |   94 |    0 |       — |        14 |         — |         -10 | médio; lançador                  |
| Rasteira Curta (d_lk)         | ↓ + Chute Baixo           |       5 |      3 |       10 |    18 |   21 |    0 |      14 |         8 |        +4 |          -2 | baixo; emenda em: d_hk           |
| Rasteira (d_hk)               | ↓ + Chute Alto            |       9 |      4 |       22 |    35 |   51 |    0 |       — |        12 |         — |         -10 | baixo; derruba                   |
| Soco Aéreo (j_lp)             | (no ar) Soco Baixo        |       5 |      8 |        6 |    19 |   43 |    0 |      18 |        10 |       +12 |          +4 | médio                            |
| Soco Aéreo Forte (j_hp)       | (no ar) Soco Alto         |       6 |      8 |        6 |    20 |   51 |    0 |      20 |        11 |       +14 |          +5 | médio                            |
| Voadora (j_lk)                | (no ar) Chute Baixo       |       5 |     10 |        6 |    21 |   47 |    0 |      18 |        10 |       +12 |          +4 | médio                            |
| Voadora Forte (j_hk)          | (no ar) Chute Alto        |       7 |     10 |        6 |    23 |   60 |    0 |      21 |        11 |       +15 |          +5 | médio                            |
| Arremesso (throw)             | → + Soco Baixo (de perto) |       4 |      3 |       24 |    31 |   94 |    0 |       — |         — |         — |           — | agarrão (indefensável)           |
| Rajada Ômega (omega_blast)    | ↓ → + Soco Baixo          |      14 |      1 |       20 |    35 |   60 |    9 |      20 |         — |         — |           — | especial; projétil (médio)       |
| Ombro Cometa (comet_shoulder) | ← → + Chute Baixo         |       8 |     14 |       16 |    38 |   77 |   11 |       — |         — |         — |           — | médio; especial; derruba; avanço |
| Mudar Forma (shift_form)      | ↓ ↓ + Soco Alto           |      20 |      1 |       18 |    39 |    0 |    0 |       — |         — |         — |           — | especial; troca de forma         |

## Nyx-R

Multiplicador de dano: 1. Multiplicador de movimento da forma: 1.

| Golpe                            | Input                     | Startup | Active | Recovery | Total | Dano | Chip | Hitstun | Blockstun | Vant. hit | Vant. block | Propriedades                                                         |
| -------------------------------- | ------------------------- | ------: | -----: | -------: | ----: | ---: | ---: | ------: | --------: | --------: | ----------: | -------------------------------------------------------------------- |
| Jab (lp)                         | Soco Baixo                |       4 |      3 |        8 |    15 |   30 |    0 |      15 |         9 |        +7 |          +1 | alto; emenda em: lp, hp                                              |
| Direto (hp)                      | Soco Alto                 |       6 |      3 |       14 |    23 |   55 |    0 |      19 |        11 |        +5 |          -3 | alto                                                                 |
| Chute Frontal (lk)               | Chute Baixo               |       7 |      3 |       12 |    22 |   45 |    0 |      17 |        10 |        +5 |          -2 | médio; emenda em: hk                                                 |
| Chute Giratório (hk)             | Chute Alto                |      10 |      4 |       18 |    32 |   75 |    0 |      22 |        12 |         — |          -6 | médio; derruba                                                       |
| Soco Agachado (d_lp)             | ↓ + Soco Baixo            |       4 |      3 |        7 |    14 |   22 |    0 |      14 |         8 |        +7 |          +1 | médio; emenda em: d_lp, d_hp                                         |
| Gancho (d_hp)                    | ↓ + Soco Alto             |       7 |      4 |       24 |    35 |  110 |    0 |       — |        14 |         — |         -10 | médio; lançador                                                      |
| Rasteira Curta (d_lk)            | ↓ + Chute Baixo           |       5 |      3 |       10 |    18 |   25 |    0 |      14 |         8 |        +4 |          -2 | baixo; emenda em: d_hk                                               |
| Rasteira (d_hk)                  | ↓ + Chute Alto            |       9 |      4 |       22 |    35 |   60 |    0 |       — |        12 |         — |         -10 | baixo; derruba                                                       |
| Soco Aéreo (j_lp)                | (no ar) Soco Baixo        |       5 |      8 |        6 |    19 |   50 |    0 |      18 |        10 |       +12 |          +4 | médio                                                                |
| Soco Aéreo Forte (j_hp)          | (no ar) Soco Alto         |       6 |      8 |        6 |    20 |   60 |    0 |      20 |        11 |       +14 |          +5 | médio                                                                |
| Voadora (j_lk)                   | (no ar) Chute Baixo       |       5 |     10 |        6 |    21 |   55 |    0 |      18 |        10 |       +12 |          +4 | médio                                                                |
| Voadora Forte (j_hk)             | (no ar) Chute Alto        |       7 |     10 |        6 |    23 |   70 |    0 |      21 |        11 |       +15 |          +5 | médio                                                                |
| Arremesso (throw)                | → + Soco Baixo (de perto) |       4 |      3 |       24 |    31 |  110 |    0 |       — |         — |         — |           — | agarrão (indefensável)                                               |
| Lâmina do Enxame (nano_blade)    | ← → + Soco Alto           |      12 |      5 |       20 |    37 |   85 |   13 |      22 |        14 |        +2 |          -6 | médio; especial                                                      |
| Martelo Esmagador (smash_hammer) | ↓ → + Chute Alto          |      18 |      4 |       22 |    44 |  105 |   16 |       — |        16 |         — |          -6 | overhead (defesa em pé); especial; lançador                          |
| Botas-Foguete (rocket_boots)     | ↓ ← + Chute Baixo         |       6 |     10 |       18 |    34 |   80 |   12 |       — |        12 |         — |          -6 | médio; especial; lançador; salto ascendente; invencível por 8 frames |

## Umbra

Multiplicador de dano: 0.95. Multiplicador de movimento da forma: 1.

| Golpe                         | Input                     | Startup | Active | Recovery | Total | Dano | Chip | Hitstun | Blockstun | Vant. hit | Vant. block | Propriedades                                  |
| ----------------------------- | ------------------------- | ------: | -----: | -------: | ----: | ---: | ---: | ------: | --------: | --------: | ----------: | --------------------------------------------- |
| Jab (lp)                      | Soco Baixo                |       4 |      3 |        8 |    15 |   29 |    0 |      15 |         9 |        +7 |          +1 | alto; emenda em: lp, hp                       |
| Direto (hp)                   | Soco Alto                 |       6 |      3 |       14 |    23 |   52 |    0 |      19 |        11 |        +5 |          -3 | alto                                          |
| Chute Frontal (lk)            | Chute Baixo               |       7 |      3 |       12 |    22 |   43 |    0 |      17 |        10 |        +5 |          -2 | médio; emenda em: hk                          |
| Chute Giratório (hk)          | Chute Alto                |      10 |      4 |       18 |    32 |   71 |    0 |      22 |        12 |         — |          -6 | médio; derruba                                |
| Soco Agachado (d_lp)          | ↓ + Soco Baixo            |       4 |      3 |        7 |    14 |   21 |    0 |      14 |         8 |        +7 |          +1 | médio; emenda em: d_lp, d_hp                  |
| Gancho (d_hp)                 | ↓ + Soco Alto             |       7 |      4 |       24 |    35 |  105 |    0 |       — |        14 |         — |         -10 | médio; lançador                               |
| Rasteira Curta (d_lk)         | ↓ + Chute Baixo           |       5 |      3 |       10 |    18 |   24 |    0 |      14 |         8 |        +4 |          -2 | baixo; emenda em: d_hk                        |
| Rasteira (d_hk)               | ↓ + Chute Alto            |       9 |      4 |       22 |    35 |   57 |    0 |       — |        12 |         — |         -10 | baixo; derruba                                |
| Soco Aéreo (j_lp)             | (no ar) Soco Baixo        |       5 |      8 |        6 |    19 |   48 |    0 |      18 |        10 |       +12 |          +4 | médio                                         |
| Soco Aéreo Forte (j_hp)       | (no ar) Soco Alto         |       6 |      8 |        6 |    20 |   57 |    0 |      20 |        11 |       +14 |          +5 | médio                                         |
| Voadora (j_lk)                | (no ar) Chute Baixo       |       5 |     10 |        6 |    21 |   52 |    0 |      18 |        10 |       +12 |          +4 | médio                                         |
| Voadora Forte (j_hk)          | (no ar) Chute Alto        |       7 |     10 |        6 |    23 |   67 |    0 |      21 |        11 |       +15 |          +5 | médio                                         |
| Arremesso (throw)             | → + Soco Baixo (de perto) |       4 |      3 |       24 |    31 |  105 |    0 |       — |         — |         — |           — | agarrão (indefensável)                        |
| Orbe Sombrio (shadow_orb)     | ↓ → + Soco Baixo          |      16 |      1 |       22 |    39 |   57 |    9 |      24 |         — |         — |           — | especial; projétil (médio)                    |
| Passo Sombrio (shadow_step)   | ↓ ← + Chute Baixo         |      14 |      1 |       12 |    27 |    0 |    0 |       — |         — |         — |           — | especial; teleporte; invencível por 15 frames |
| Mão das Sombras (shadow_hand) | ← → + Soco Alto           |      14 |      4 |       26 |    44 |   90 |    0 |       — |         — |         — |           — | especial; agarrão (indefensável)              |

## Ferrum

Multiplicador de dano: 1.15. Multiplicador de movimento da forma: 1.

| Golpe                               | Input                     | Startup | Active | Recovery | Total | Dano | Chip | Hitstun | Blockstun | Vant. hit | Vant. block | Propriedades                                                         |
| ----------------------------------- | ------------------------- | ------: | -----: | -------: | ----: | ---: | ---: | ------: | --------: | --------: | ----------: | -------------------------------------------------------------------- |
| Jab (lp)                            | Soco Baixo                |       4 |      3 |        8 |    15 |   35 |    0 |      15 |         9 |        +7 |          +1 | alto; emenda em: lp, hp                                              |
| Direto (hp)                         | Soco Alto                 |       6 |      3 |       14 |    23 |   63 |    0 |      19 |        11 |        +5 |          -3 | alto                                                                 |
| Chute Frontal (lk)                  | Chute Baixo               |       7 |      3 |       12 |    22 |   52 |    0 |      17 |        10 |        +5 |          -2 | médio; emenda em: hk                                                 |
| Chute Giratório (hk)                | Chute Alto                |      10 |      4 |       18 |    32 |   86 |    0 |      22 |        12 |         — |          -6 | médio; derruba                                                       |
| Soco Agachado (d_lp)                | ↓ + Soco Baixo            |       4 |      3 |        7 |    14 |   25 |    0 |      14 |         8 |        +7 |          +1 | médio; emenda em: d_lp, d_hp                                         |
| Gancho (d_hp)                       | ↓ + Soco Alto             |       7 |      4 |       24 |    35 |  126 |    0 |       — |        14 |         — |         -10 | médio; lançador                                                      |
| Rasteira Curta (d_lk)               | ↓ + Chute Baixo           |       5 |      3 |       10 |    18 |   29 |    0 |      14 |         8 |        +4 |          -2 | baixo; emenda em: d_hk                                               |
| Rasteira (d_hk)                     | ↓ + Chute Alto            |       9 |      4 |       22 |    35 |   69 |    0 |       — |        12 |         — |         -10 | baixo; derruba                                                       |
| Soco Aéreo (j_lp)                   | (no ar) Soco Baixo        |       5 |      8 |        6 |    19 |   57 |    0 |      18 |        10 |       +12 |          +4 | médio                                                                |
| Soco Aéreo Forte (j_hp)             | (no ar) Soco Alto         |       6 |      8 |        6 |    20 |   69 |    0 |      20 |        11 |       +14 |          +5 | médio                                                                |
| Voadora (j_lk)                      | (no ar) Chute Baixo       |       5 |     10 |        6 |    21 |   63 |    0 |      18 |        10 |       +12 |          +4 | médio                                                                |
| Voadora Forte (j_hk)                | (no ar) Chute Alto        |       7 |     10 |        6 |    23 |   81 |    0 |      21 |        11 |       +15 |          +5 | médio                                                                |
| Arremesso (throw)                   | → + Soco Baixo (de perto) |       4 |      3 |       24 |    31 |  126 |    0 |       — |         — |         — |           — | agarrão (indefensável)                                               |
| Canhão de Plasma (sonic_cannon)     | ↓ → + Soco Alto           |      18 |      1 |       26 |    45 |  103 |   15 |      22 |         — |         — |           — | especial; projétil (médio); derruba                                  |
| Investida Blindada (armored_charge) | ← → + Chute Alto          |      12 |     14 |       20 |    46 |  115 |   17 |       — |         — |         — |           — | médio; especial; derruba; avanço; armadura (absorve 1 golpe)         |
| Soco Foguete (rocket_punch)         | ↓ ← + Soco Alto           |       8 |      8 |       24 |    40 |  132 |   20 |       — |        14 |         — |         -10 | médio; especial; lançador; salto ascendente; invencível por 6 frames |

## Solara

Multiplicador de dano: 0.95. Multiplicador de movimento da forma: 1.

| Golpe                                | Input                     | Startup | Active | Recovery | Total | Dano | Chip | Hitstun | Blockstun | Vant. hit | Vant. block | Propriedades                                |
| ------------------------------------ | ------------------------- | ------: | -----: | -------: | ----: | ---: | ---: | ------: | --------: | --------: | ----------: | ------------------------------------------- |
| Jab (lp)                             | Soco Baixo                |       4 |      3 |        8 |    15 |   29 |    0 |      15 |         9 |        +7 |          +1 | alto; emenda em: lp, hp                     |
| Direto (hp)                          | Soco Alto                 |       6 |      3 |       14 |    23 |   52 |    0 |      19 |        11 |        +5 |          -3 | alto                                        |
| Chute Frontal (lk)                   | Chute Baixo               |       7 |      3 |       12 |    22 |   43 |    0 |      17 |        10 |        +5 |          -2 | médio; emenda em: hk                        |
| Chute Giratório (hk)                 | Chute Alto                |      10 |      4 |       18 |    32 |   71 |    0 |      22 |        12 |         — |          -6 | médio; derruba                              |
| Soco Agachado (d_lp)                 | ↓ + Soco Baixo            |       4 |      3 |        7 |    14 |   21 |    0 |      14 |         8 |        +7 |          +1 | médio; emenda em: d_lp, d_hp                |
| Gancho (d_hp)                        | ↓ + Soco Alto             |       7 |      4 |       24 |    35 |  105 |    0 |       — |        14 |         — |         -10 | médio; lançador                             |
| Rasteira Curta (d_lk)                | ↓ + Chute Baixo           |       5 |      3 |       10 |    18 |   24 |    0 |      14 |         8 |        +4 |          -2 | baixo; emenda em: d_hk                      |
| Rasteira (d_hk)                      | ↓ + Chute Alto            |       9 |      4 |       22 |    35 |   57 |    0 |       — |        12 |         — |         -10 | baixo; derruba                              |
| Soco Aéreo (j_lp)                    | (no ar) Soco Baixo        |       5 |      8 |        6 |    19 |   48 |    0 |      18 |        10 |       +12 |          +4 | médio                                       |
| Soco Aéreo Forte (j_hp)              | (no ar) Soco Alto         |       6 |      8 |        6 |    20 |   57 |    0 |      20 |        11 |       +14 |          +5 | médio                                       |
| Voadora (j_lk)                       | (no ar) Chute Baixo       |       5 |     10 |        6 |    21 |   52 |    0 |      18 |        10 |       +12 |          +4 | médio                                       |
| Voadora Forte (j_hk)                 | (no ar) Chute Alto        |       7 |     10 |        6 |    23 |   67 |    0 |      21 |        11 |       +15 |          +5 | médio                                       |
| Arremesso (throw)                    | → + Soco Baixo (de perto) |       4 |      3 |       24 |    31 |  105 |    0 |       — |         — |         — |           — | agarrão (indefensável)                      |
| Estrela Cadente (star_bolt)          | ↓ → + Soco Baixo          |      10 |      1 |       16 |    27 |   52 |    8 |      18 |         — |         — |           — | especial; projétil (médio)                  |
| Estrela Cadente (ar) (air_star_bolt) | (no ar) ↓ → + Soco Baixo  |       8 |      1 |       14 |    23 |   52 |    8 |      18 |         — |         — |           — | especial; projétil (médio)                  |
| Voo Estelar (star_flight)            | ↓ ← + Soco Alto           |       6 |     12 |       16 |    34 |   81 |   12 |       — |        12 |         — |          -4 | médio; especial; lançador; salto ascendente |
| Explosão Solar (solar_burst)         | ↓ ↓ + Chute Baixo         |      16 |      5 |       24 |    45 |   76 |   11 |       — |        14 |         — |         -10 | médio; especial; derruba                    |

## Feral

Multiplicador de dano: 1. Multiplicador de movimento da forma: 1.

| Golpe                               | Input                     | Startup | Active | Recovery | Total | Dano | Chip | Hitstun | Blockstun | Vant. hit | Vant. block | Propriedades                                                 |
| ----------------------------------- | ------------------------- | ------: | -----: | -------: | ----: | ---: | ---: | ------: | --------: | --------: | ----------: | ------------------------------------------------------------ |
| Jab (lp)                            | Soco Baixo                |       4 |      3 |        8 |    15 |   30 |    0 |      15 |         9 |        +7 |          +1 | alto; emenda em: lp, hp                                      |
| Direto (hp)                         | Soco Alto                 |       6 |      3 |       14 |    23 |   55 |    0 |      19 |        11 |        +5 |          -3 | alto                                                         |
| Chute Frontal (lk)                  | Chute Baixo               |       7 |      3 |       12 |    22 |   45 |    0 |      17 |        10 |        +5 |          -2 | médio; emenda em: hk                                         |
| Chute Giratório (hk)                | Chute Alto                |      10 |      4 |       18 |    32 |   75 |    0 |      22 |        12 |         — |          -6 | médio; derruba                                               |
| Soco Agachado (d_lp)                | ↓ + Soco Baixo            |       4 |      3 |        7 |    14 |   22 |    0 |      14 |         8 |        +7 |          +1 | médio; emenda em: d_lp, d_hp                                 |
| Gancho (d_hp)                       | ↓ + Soco Alto             |       7 |      4 |       24 |    35 |  110 |    0 |       — |        14 |         — |         -10 | médio; lançador                                              |
| Rasteira Curta (d_lk)               | ↓ + Chute Baixo           |       5 |      3 |       10 |    18 |   25 |    0 |      14 |         8 |        +4 |          -2 | baixo; emenda em: d_hk                                       |
| Rasteira (d_hk)                     | ↓ + Chute Alto            |       9 |      4 |       22 |    35 |   60 |    0 |       — |        12 |         — |         -10 | baixo; derruba                                               |
| Soco Aéreo (j_lp)                   | (no ar) Soco Baixo        |       5 |      8 |        6 |    19 |   50 |    0 |      18 |        10 |       +12 |          +4 | médio                                                        |
| Soco Aéreo Forte (j_hp)             | (no ar) Soco Alto         |       6 |      8 |        6 |    20 |   60 |    0 |      20 |        11 |       +14 |          +5 | médio                                                        |
| Voadora (j_lk)                      | (no ar) Chute Baixo       |       5 |     10 |        6 |    21 |   55 |    0 |      18 |        10 |       +12 |          +4 | médio                                                        |
| Voadora Forte (j_hk)                | (no ar) Chute Alto        |       7 |     10 |        6 |    23 |   70 |    0 |      21 |        11 |       +15 |          +5 | médio                                                        |
| Arremesso (throw)                   | → + Soco Baixo (de perto) |       4 |      3 |       24 |    31 |  110 |    0 |       — |         — |         — |           — | agarrão (indefensável)                                       |
| Carga do Rinoceronte (rhino_charge) | ← → + Soco Alto           |      10 |     16 |       20 |    46 |   95 |   14 |       — |         — |         — |           — | médio; especial; derruba; avanço                             |
| Mergulho da Águia (eagle_dive)      | ↓ ← + Chute Baixo         |       8 |     30 |       16 |    54 |   80 |   12 |       — |        12 |         — |          -4 | overhead (defesa em pé); especial; derruba; salto ascendente |
| Pancada do Gorila (gorilla_slam)    | ↓ ↓ + Soco Alto           |      18 |      5 |       24 |    47 |  100 |   15 |       — |        14 |         — |         -10 | baixo; especial; derruba                                     |

## Sir Pipoca

Multiplicador de dano: 1. Multiplicador de movimento da forma: 1.

| Golpe                          | Input                     | Startup | Active | Recovery | Total | Dano | Chip | Hitstun | Blockstun | Vant. hit | Vant. block | Propriedades                                                         |
| ------------------------------ | ------------------------- | ------: | -----: | -------: | ----: | ---: | ---: | ------: | --------: | --------: | ----------: | -------------------------------------------------------------------- |
| Jab (lp)                       | Soco Baixo                |       4 |      3 |        8 |    15 |   30 |    0 |      15 |         9 |        +7 |          +1 | alto; emenda em: lp, hp                                              |
| Direto (hp)                    | Soco Alto                 |       6 |      3 |       14 |    23 |   55 |    0 |      19 |        11 |        +5 |          -3 | alto                                                                 |
| Chute Frontal (lk)             | Chute Baixo               |       7 |      3 |       12 |    22 |   45 |    0 |      17 |        10 |        +5 |          -2 | médio; emenda em: hk                                                 |
| Chute Giratório (hk)           | Chute Alto                |      10 |      4 |       18 |    32 |   75 |    0 |      22 |        12 |         — |          -6 | médio; derruba                                                       |
| Soco Agachado (d_lp)           | ↓ + Soco Baixo            |       4 |      3 |        7 |    14 |   22 |    0 |      14 |         8 |        +7 |          +1 | médio; emenda em: d_lp, d_hp                                         |
| Gancho (d_hp)                  | ↓ + Soco Alto             |       7 |      4 |       24 |    35 |  110 |    0 |       — |        14 |         — |         -10 | médio; lançador                                                      |
| Rasteira Curta (d_lk)          | ↓ + Chute Baixo           |       5 |      3 |       10 |    18 |   25 |    0 |      14 |         8 |        +4 |          -2 | baixo; emenda em: d_hk                                               |
| Rasteira (d_hk)                | ↓ + Chute Alto            |       9 |      4 |       22 |    35 |   60 |    0 |       — |        12 |         — |         -10 | baixo; derruba                                                       |
| Soco Aéreo (j_lp)              | (no ar) Soco Baixo        |       5 |      8 |        6 |    19 |   50 |    0 |      18 |        10 |       +12 |          +4 | médio                                                                |
| Soco Aéreo Forte (j_hp)        | (no ar) Soco Alto         |       6 |      8 |        6 |    20 |   60 |    0 |      20 |        11 |       +14 |          +5 | médio                                                                |
| Voadora (j_lk)                 | (no ar) Chute Baixo       |       5 |     10 |        6 |    21 |   55 |    0 |      18 |        10 |       +12 |          +4 | médio                                                                |
| Voadora Forte (j_hk)           | (no ar) Chute Alto        |       7 |     10 |        6 |    23 |   70 |    0 |      21 |        11 |       +15 |          +5 | médio                                                                |
| Arremesso (throw)              | → + Soco Baixo (de perto) |       4 |      3 |       24 |    31 |  110 |    0 |       — |         — |         — |           — | agarrão (indefensável)                                               |
| Corte Crocante (crunchy_slash) | ← → + Soco Alto           |      11 |      5 |       20 |    36 |   85 |   13 |      22 |        14 |        +2 |          -6 | médio; especial                                                      |
| Escudo de Tampa (lid_bash)     | ← → + Chute Baixo         |      10 |     12 |       18 |    40 |   80 |   12 |       — |         — |         — |           — | médio; especial; derruba; avanço; armadura (absorve 1 golpe)         |
| Salto Heroico (heroic_leap)    | ↓ ← + Soco Alto           |       6 |     12 |       16 |    34 |   90 |   14 |       — |        12 |         — |          -4 | médio; especial; lançador; salto ascendente; invencível por 7 frames |

## Gelatino

Multiplicador de dano: 0.95. Multiplicador de movimento da forma: 1.

| Golpe                            | Input                     | Startup | Active | Recovery | Total | Dano | Chip | Hitstun | Blockstun | Vant. hit | Vant. block | Propriedades                                                         |
| -------------------------------- | ------------------------- | ------: | -----: | -------: | ----: | ---: | ---: | ------: | --------: | --------: | ----------: | -------------------------------------------------------------------- |
| Jab (lp)                         | Soco Baixo                |       4 |      3 |        8 |    15 |   29 |    0 |      15 |         9 |        +7 |          +1 | alto; emenda em: lp, hp                                              |
| Direto (hp)                      | Soco Alto                 |       6 |      3 |       14 |    23 |   52 |    0 |      19 |        11 |        +5 |          -3 | alto                                                                 |
| Chute Frontal (lk)               | Chute Baixo               |       7 |      3 |       12 |    22 |   43 |    0 |      17 |        10 |        +5 |          -2 | médio; emenda em: hk                                                 |
| Chute Giratório (hk)             | Chute Alto                |      10 |      4 |       18 |    32 |   71 |    0 |      22 |        12 |         — |          -6 | médio; derruba                                                       |
| Soco Agachado (d_lp)             | ↓ + Soco Baixo            |       4 |      3 |        7 |    14 |   21 |    0 |      14 |         8 |        +7 |          +1 | médio; emenda em: d_lp, d_hp                                         |
| Gancho (d_hp)                    | ↓ + Soco Alto             |       7 |      4 |       24 |    35 |  105 |    0 |       — |        14 |         — |         -10 | médio; lançador                                                      |
| Rasteira Curta (d_lk)            | ↓ + Chute Baixo           |       5 |      3 |       10 |    18 |   24 |    0 |      14 |         8 |        +4 |          -2 | baixo; emenda em: d_hk                                               |
| Rasteira (d_hk)                  | ↓ + Chute Alto            |       9 |      4 |       22 |    35 |   57 |    0 |       — |        12 |         — |         -10 | baixo; derruba                                                       |
| Soco Aéreo (j_lp)                | (no ar) Soco Baixo        |       5 |      8 |        6 |    19 |   48 |    0 |      18 |        10 |       +12 |          +4 | médio                                                                |
| Soco Aéreo Forte (j_hp)          | (no ar) Soco Alto         |       6 |      8 |        6 |    20 |   57 |    0 |      20 |        11 |       +14 |          +5 | médio                                                                |
| Voadora (j_lk)                   | (no ar) Chute Baixo       |       5 |     10 |        6 |    21 |   52 |    0 |      18 |        10 |       +12 |          +4 | médio                                                                |
| Voadora Forte (j_hk)             | (no ar) Chute Alto        |       7 |     10 |        6 |    23 |   67 |    0 |      21 |        11 |       +15 |          +5 | médio                                                                |
| Arremesso (throw)                | → + Soco Baixo (de perto) |       4 |      3 |       24 |    31 |  105 |    0 |       — |         — |         — |           — | agarrão (indefensável)                                               |
| Soco Elástico (elastic_punch)    | ↓ → + Soco Baixo          |      12 |      5 |       22 |    39 |   67 |   10 |      20 |        12 |        -2 |         -10 | médio; especial                                                      |
| Quique Gelatinoso (jelly_bounce) | ↓ ↓ + Chute Baixo         |       5 |     14 |       24 |    43 |   71 |   11 |       — |        12 |         — |         -12 | médio; especial; lançador; salto ascendente; invencível por 6 frames |
| Mola Esmagadora (spring_slam)    | ← → + Chute Alto          |       9 |     14 |       20 |    43 |   86 |   13 |       — |         — |         — |           — | médio; especial; derruba; avanço                                     |

## Capi Folgado

Multiplicador de dano: 1.05. Multiplicador de movimento da forma: 1.

| Golpe                         | Input                     | Startup | Active | Recovery | Total | Dano | Chip | Hitstun | Blockstun | Vant. hit | Vant. block | Propriedades                                               |
| ----------------------------- | ------------------------- | ------: | -----: | -------: | ----: | ---: | ---: | ------: | --------: | --------: | ----------: | ---------------------------------------------------------- |
| Jab (lp)                      | Soco Baixo                |       4 |      3 |        8 |    15 |   32 |    0 |      15 |         9 |        +7 |          +1 | alto; emenda em: lp, hp                                    |
| Direto (hp)                   | Soco Alto                 |       6 |      3 |       14 |    23 |   58 |    0 |      19 |        11 |        +5 |          -3 | alto                                                       |
| Chute Frontal (lk)            | Chute Baixo               |       7 |      3 |       12 |    22 |   47 |    0 |      17 |        10 |        +5 |          -2 | médio; emenda em: hk                                       |
| Chute Giratório (hk)          | Chute Alto                |      10 |      4 |       18 |    32 |   79 |    0 |      22 |        12 |         — |          -6 | médio; derruba                                             |
| Soco Agachado (d_lp)          | ↓ + Soco Baixo            |       4 |      3 |        7 |    14 |   23 |    0 |      14 |         8 |        +7 |          +1 | médio; emenda em: d_lp, d_hp                               |
| Gancho (d_hp)                 | ↓ + Soco Alto             |       7 |      4 |       24 |    35 |  116 |    0 |       — |        14 |         — |         -10 | médio; lançador                                            |
| Rasteira Curta (d_lk)         | ↓ + Chute Baixo           |       5 |      3 |       10 |    18 |   26 |    0 |      14 |         8 |        +4 |          -2 | baixo; emenda em: d_hk                                     |
| Rasteira (d_hk)               | ↓ + Chute Alto            |       9 |      4 |       22 |    35 |   63 |    0 |       — |        12 |         — |         -10 | baixo; derruba                                             |
| Soco Aéreo (j_lp)             | (no ar) Soco Baixo        |       5 |      8 |        6 |    19 |   53 |    0 |      18 |        10 |       +12 |          +4 | médio                                                      |
| Soco Aéreo Forte (j_hp)       | (no ar) Soco Alto         |       6 |      8 |        6 |    20 |   63 |    0 |      20 |        11 |       +14 |          +5 | médio                                                      |
| Voadora (j_lk)                | (no ar) Chute Baixo       |       5 |     10 |        6 |    21 |   58 |    0 |      18 |        10 |       +12 |          +4 | médio                                                      |
| Voadora Forte (j_hk)          | (no ar) Chute Alto        |       7 |     10 |        6 |    23 |   74 |    0 |      21 |        11 |       +15 |          +5 | médio                                                      |
| Arremesso (throw)             | → + Soco Baixo (de perto) |       4 |      3 |       24 |    31 |  116 |    0 |       — |         — |         — |           — | agarrão (indefensável)                                     |
| Ancinho Giratório (rake_spin) | ← → + Soco Alto           |      13 |      6 |       20 |    39 |   95 |   14 |      22 |        14 |        +2 |          -6 | médio; especial                                            |
| Fita Cassete (cassette)       | ↓ → + Soco Baixo          |      14 |      1 |       20 |    35 |   68 |   10 |      20 |         — |         — |           — | especial; projétil (médio)                                 |
| Cochilo Turbo (turbo_nap)     | ↓ ← + Chute Baixo         |       8 |     16 |       18 |    42 |   79 |   12 |       — |        12 |         — |          -6 | baixo; especial; derruba; avanço; invencível por 10 frames |

## Lola Volume

Multiplicador de dano: 0.95. Multiplicador de movimento da forma: 1.

| Golpe                    | Input                     | Startup | Active | Recovery | Total | Dano | Chip | Hitstun | Blockstun | Vant. hit | Vant. block | Propriedades                     |
| ------------------------ | ------------------------- | ------: | -----: | -------: | ----: | ---: | ---: | ------: | --------: | --------: | ----------: | -------------------------------- |
| Jab (lp)                 | Soco Baixo                |       4 |      3 |        8 |    15 |   29 |    0 |      15 |         9 |        +7 |          +1 | alto; emenda em: lp, hp          |
| Direto (hp)              | Soco Alto                 |       6 |      3 |       14 |    23 |   52 |    0 |      19 |        11 |        +5 |          -3 | alto                             |
| Chute Frontal (lk)       | Chute Baixo               |       7 |      3 |       12 |    22 |   43 |    0 |      17 |        10 |        +5 |          -2 | médio; emenda em: hk             |
| Chute Giratório (hk)     | Chute Alto                |      10 |      4 |       18 |    32 |   71 |    0 |      22 |        12 |         — |          -6 | médio; derruba                   |
| Soco Agachado (d_lp)     | ↓ + Soco Baixo            |       4 |      3 |        7 |    14 |   21 |    0 |      14 |         8 |        +7 |          +1 | médio; emenda em: d_lp, d_hp     |
| Gancho (d_hp)            | ↓ + Soco Alto             |       7 |      4 |       24 |    35 |  105 |    0 |       — |        14 |         — |         -10 | médio; lançador                  |
| Rasteira Curta (d_lk)    | ↓ + Chute Baixo           |       5 |      3 |       10 |    18 |   24 |    0 |      14 |         8 |        +4 |          -2 | baixo; emenda em: d_hk           |
| Rasteira (d_hk)          | ↓ + Chute Alto            |       9 |      4 |       22 |    35 |   57 |    0 |       — |        12 |         — |         -10 | baixo; derruba                   |
| Soco Aéreo (j_lp)        | (no ar) Soco Baixo        |       5 |      8 |        6 |    19 |   48 |    0 |      18 |        10 |       +12 |          +4 | médio                            |
| Soco Aéreo Forte (j_hp)  | (no ar) Soco Alto         |       6 |      8 |        6 |    20 |   57 |    0 |      20 |        11 |       +14 |          +5 | médio                            |
| Voadora (j_lk)           | (no ar) Chute Baixo       |       5 |     10 |        6 |    21 |   52 |    0 |      18 |        10 |       +12 |          +4 | médio                            |
| Voadora Forte (j_hk)     | (no ar) Chute Alto        |       7 |     10 |        6 |    23 |   67 |    0 |      21 |        11 |       +15 |          +5 | médio                            |
| Arremesso (throw)        | → + Soco Baixo (de perto) |       4 |      3 |       24 |    31 |  105 |    0 |       — |         — |         — |           — | agarrão (indefensável)           |
| Grave Pesado (bass_drop) | ↓ → + Soco Alto           |      15 |      1 |       22 |    38 |   71 |   11 |      24 |         — |         — |           — | especial; projétil (médio)       |
| Scratch (scratch)        | ↓ ↓ + Chute Baixo         |      14 |      5 |       22 |    41 |   71 |   11 |       — |        14 |         — |          -8 | médio; especial; derruba         |
| Roda Punk (mosh_pit)     | ← → + Chute Baixo         |       9 |     14 |       18 |    41 |   81 |   12 |       — |         — |         — |           — | médio; especial; derruba; avanço |

## Warlord Zhaar

Multiplicador de dano: 1. Multiplicador de movimento da forma: 1.

| Golpe                            | Input                     | Startup | Active | Recovery | Total | Dano | Chip | Hitstun | Blockstun | Vant. hit | Vant. block | Propriedades                     |
| -------------------------------- | ------------------------- | ------: | -----: | -------: | ----: | ---: | ---: | ------: | --------: | --------: | ----------: | -------------------------------- |
| Jab (lp)                         | Soco Baixo                |       4 |      3 |        8 |    15 |   30 |    0 |      15 |         9 |        +7 |          +1 | alto; emenda em: lp, hp          |
| Direto (hp)                      | Soco Alto                 |       6 |      3 |       14 |    23 |   55 |    0 |      19 |        11 |        +5 |          -3 | alto                             |
| Chute Frontal (lk)               | Chute Baixo               |       7 |      3 |       12 |    22 |   45 |    0 |      17 |        10 |        +5 |          -2 | médio; emenda em: hk             |
| Chute Giratório (hk)             | Chute Alto                |      10 |      4 |       18 |    32 |   75 |    0 |      22 |        12 |         — |          -6 | médio; derruba                   |
| Soco Agachado (d_lp)             | ↓ + Soco Baixo            |       4 |      3 |        7 |    14 |   22 |    0 |      14 |         8 |        +7 |          +1 | médio; emenda em: d_lp, d_hp     |
| Gancho (d_hp)                    | ↓ + Soco Alto             |       7 |      4 |       24 |    35 |  110 |    0 |       — |        14 |         — |         -10 | médio; lançador                  |
| Rasteira Curta (d_lk)            | ↓ + Chute Baixo           |       5 |      3 |       10 |    18 |   25 |    0 |      14 |         8 |        +4 |          -2 | baixo; emenda em: d_hk           |
| Rasteira (d_hk)                  | ↓ + Chute Alto            |       9 |      4 |       22 |    35 |   60 |    0 |       — |        12 |         — |         -10 | baixo; derruba                   |
| Soco Aéreo (j_lp)                | (no ar) Soco Baixo        |       5 |      8 |        6 |    19 |   50 |    0 |      18 |        10 |       +12 |          +4 | médio                            |
| Soco Aéreo Forte (j_hp)          | (no ar) Soco Alto         |       6 |      8 |        6 |    20 |   60 |    0 |      20 |        11 |       +14 |          +5 | médio                            |
| Voadora (j_lk)                   | (no ar) Chute Baixo       |       5 |     10 |        6 |    21 |   55 |    0 |      18 |        10 |       +12 |          +4 | médio                            |
| Voadora Forte (j_hk)             | (no ar) Chute Alto        |       7 |     10 |        6 |    23 |   70 |    0 |      21 |        11 |       +15 |          +5 | médio                            |
| Arremesso (throw)                | → + Soco Baixo (de perto) |       4 |      3 |       24 |    31 |  110 |    0 |       — |         — |         — |           — | agarrão (indefensável)           |
| Raio Conquistador (conquest_ray) | ↓ → + Soco Alto           |      16 |      1 |       22 |    39 |   95 |   14 |      22 |         — |         — |           — | especial; projétil (médio)       |
| Pisão Sísmico (seismic_stomp)    | ↓ ↓ + Chute Alto          |      20 |      5 |       26 |    51 |   90 |   14 |       — |        14 |         — |         -12 | baixo; especial; derruba         |
| Garra Tirana (tyrant_claw)       | ← → + Soco Baixo          |      12 |      4 |       26 |    42 |  120 |    0 |       — |         — |         — |           — | especial; agarrão (indefensável) |
