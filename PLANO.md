# Toon Clash — Plano do projeto

> Nome provisório. Jogo de luta 1x1 estilo Mortal Kombat (2.5D: lutadores 3D presos num plano 2D),
> com personagens **originais inspirados** nos desenhos da Cartoon Network dos anos 2000/2010,
> rodando no navegador com Three.js (WebGL).

---

## 1. Decisões importantes

### Personagens: inspirados, não copiados

Ben 10, Mutante Rex e Jovens Titãs são marcas registradas (Cartoon Network / Warner Bros. Discovery).
Usar nomes, visuais ou logos originais pode derrubar o repositório público (DMCA).
**Regra do projeto:** arquétipos e poderes parecidos, mas nome, visual e cores próprios.

| Lutador                   | Arquétipo                    | Ideia de mecânica                                                           |
| ------------------------- | ---------------------------- | --------------------------------------------------------------------------- |
| **Kai Volt**              | Garoto que se transforma     | Bracelete cósmico: troca entre 3 formas no meio da luta (normal/pedra/raio) |
| **Nyx-R**                 | Engenheira com microrrobôs   | O enxame forma armas: lâmina, martelo, botas-foguete                        |
| **Umbra**                 | Ilusionista das sombras      | Magia sombria, teleporte, agarrões à distância                              |
| **Ferrum**                | Piloto de armadura pesada    | Pesado, canhão no braço, superarmadura em alguns golpes                     |
| **Solara**                | Guardiã estelar              | Voa um pouco, estrelas de energia, combos aéreos                            |
| **Feral**                 | Escoteiro que vira bicho     | Se transforma em animais diferentes para cada especial                      |
| **Sir Pipoca**            | Cavaleiro mirim              | Baguete encantada, escudo de tampa, salto heroico                           |
| **Gelatino**              | Criatura elástica            | Braços que esticam, quiques e investidas                                    |
| **Capi Folgado**          | Zelador preguiçoso do parque | Ancinho, fitas cassete, rolamento rasteiro                                  |
| **Lola Volume**           | DJ do fliperama              | Ondas sonoras, scratch em área, investida                                   |
| **Warlord Zhaar** (chefe) | Conquistador espacial        | Chefe do modo arcade                                                        |

Os visuais (cores, roupas, cabelos, acessórios) foram revisados para não repetir combinações
marcantes de personagens existentes.

**Finalizações:** em vez de fatalities sangrentos, "Toonalities" — gags de desenho animado
(o perdedor vira bigorna, sai voando pro céu brilhando, etc.). Combina com o estilo e evita classificação adulta.

### "WebGL" vs "WebXR"

- **WebGL** (padrão do Three.js): renderização 3D no navegador → **é o que vamos usar**.
- **WebGPU**: renderer mais novo do Three.js; dá pra ligar depois sem reescrever o jogo.
- **WebXR** (realidade virtual): fica como extra opcional no fim (modo espectador em VR).

---

## 2. Stack

| Área              | Escolha                                                   | Por quê                                        |
| ----------------- | --------------------------------------------------------- | ---------------------------------------------- |
| Linguagem         | TypeScript                                                | Tipagem ajuda muito em lógica de combate       |
| Build/dev server  | Vite                                                      | Rápido, hot reload, build estático             |
| 3D                | Three.js                                                  | Pedido do projeto                              |
| Visual cartoon    | `MeshToonMaterial` + contorno (outline)                   | Cara de desenho animado                        |
| Modelos/animações | Blender (low-poly) + Mixamo (animações grátis) → glTF/GLB | Formato nativo do Three.js                     |
| Física/colisão    | Própria (caixas AABB de hitbox/hurtbox)                   | Jogos de luta não usam física realista         |
| Áudio             | Web Audio API (ou Howler.js)                              | Simples                                        |
| Controles         | Teclado + Gamepad API                                     | Controle de Xbox/PS funciona no navegador      |
| Testes            | Vitest                                                    | Testar lógica de combate sem abrir o navegador |
| Qualidade         | ESLint + Prettier                                         | Padrão                                         |
| Deploy            | GitHub Pages via GitHub Actions                           | Grátis, link pra mostrar o jogo                |

---

## 3. Arquitetura (resumo)

```
src/
  main.ts              # bootstrap
  core/
    loop.ts            # game loop com passo fixo de 60 Hz (lógica) + render livre
    input.ts           # teclado/gamepad → buffer de inputs por frame
    state-machine.ts   # máquina de estados genérica
  combat/
    fighter.ts         # estado do lutador (vida, posição, estado atual, frame)
    moves.ts           # definição de golpes: startup / active / recovery, dano, hitbox
    hitbox.ts          # colisão AABB hitbox x hurtbox
    motion-input.ts    # detecção de comandos especiais (↓↘→ + Soco)
    round.ts           # rounds, tempo, vitória
  characters/
    kai-volt/          # dados de golpes + modelo + animações de cada lutador
  render/
    scene.ts, camera.ts, toon-material.ts, effects.ts (faíscas, tremor de tela)
  ui/
    menu, seleção de personagem, HUD (barras de vida), tela de versus
  ai/
    cpu.ts             # IA do oponente
```

Princípio-chave: **lógica separada do visual**. O combate roda em "frames" determinísticos
(60 por segundo) e o Three.js só desenha o estado. Isso permite testar tudo com Vitest
e, no futuro, ter multiplayer online.

---

## 4. Etapas (milestones)

| #   | Etapa                  | Pronto quando…                                                                                                |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| M0  | **Setup**              | Repo no GitHub, Vite + TS + Three.js rodando, lint, CI e deploy no GitHub Pages                               |
| M1  | **Greybox**            | Dois cubos/cápsulas numa arena: andar, pular, agachar, soco, chute, barra de vida, round com tempo            |
| M2  | **Sistema de combate** | Frame data, bloqueio, combos, buffer de input, golpes especiais (↓↘→), knockback, juggle                      |
| M3  | **Visual**             | Primeiro personagem modelado com toon shader, animações, câmera estilo MK, faíscas de impacto, tremor de tela |
| M4  | **Fluxo do jogo**      | Menu → seleção de personagem → tela de versus → "ROUND 1, FIGHT!" → vitória → Toonality                       |
| M5  | **CPU + modo arcade**  | IA com níveis de dificuldade, sequência de lutas até o chefe                                                  |
| M6  | **Roster + polimento** | 6 lutadores + chefe, sons, músicas, controle, responsivo                                                      |
| M7  | **Extras (opcional)**  | Multiplayer online (WebRTC + rollback), modo VR com WebXR, renderer WebGPU                                    |

Regra: só passa para a próxima etapa quando a atual estiver jogável e commitada.

---

## 5. Como dividimos o trabalho: Claude + Codex

- **Claude (aqui):** arquiteto e desenvolvedor principal — planeja cada etapa, escreve o núcleo
  (loop, combate, máquina de estados), integra tudo e faz commits.
- **Codex CLI:** segundo par de mãos e revisor.
  - `codex review` → revisão de código antes de cada merge.
  - `codex exec "..."` → tarefas isoladas e bem definidas (ex.: "crie a tela de seleção de personagem
    seguindo src/ui/README.md"), de preferência num branch/worktree separado.
- **Arquivos de instrução compartilhados:** `CLAUDE.md` (lido pelo Claude) e `AGENTS.md`
  (lido pelo Codex) com as mesmas regras do projeto, para os dois seguirem o mesmo padrão.

Fluxo por etapa: branch `feat/mX-...` → Claude implementa → testes passam → `codex review` →
merge na `main` → deploy automático.

---

## 6. Prompt para iniciar (cole numa conversa comigo)

```
Vamos começar o projeto Toon Clash seguindo o PLANO.md.

Etapa M0 (setup):
1. Crie o projeto em <PASTA> com Vite + TypeScript + Three.js, ESLint, Prettier e Vitest.
2. Inicialize o git, crie .gitignore, README.md, CLAUDE.md e AGENTS.md
   (com as regras: lógica separada do render, loop de 60 Hz fixo, personagens originais,
   commits pequenos em português).
3. Configure GitHub Actions para rodar lint + testes e publicar no GitHub Pages.
4. Crie uma cena de teste: arena simples, câmera lateral, dois cubos coloridos, luz e toon shader.
5. Rode o projeto e me mostre funcionando no navegador.
6. Ao final, rode `codex review` nas mudanças e corrija o que fizer sentido.

Depois me diga o que falta para eu criar o repositório no GitHub e fazer o primeiro push.
```

Prompts das próximas etapas seguem o mesmo formato: "Vamos para a etapa MX do PLANO.md" +
o critério de pronto da tabela acima.
