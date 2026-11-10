# Regras do projeto Toon Clash

Instruções para agentes de código (Claude Code e Codex CLI). `CLAUDE.md` aponta para este arquivo.

## O projeto

Jogo de luta 1x1 estilo Mortal Kombat em 2.5D (lutadores 3D num plano 2D), rodando no navegador
com Three.js. O plano completo e as etapas estão em `PLANO.md`.

## Comandos

- `npm run dev` — servidor de desenvolvimento (http://localhost:5173)
- `npm test` — testes (Vitest)
- `npm run lint` — ESLint
- `npm run format:check` — Prettier
- `npm run build` — checagem de tipos + build de produção em `dist/`

Antes de dar uma tarefa como pronta: `npm run lint && npm test && npm run build` precisam passar.

## Arquitetura

- `src/core/` — game loop, input, utilidades genéricas.
- `src/game/` e `src/combat/` — **regras do jogo**. Código puro: não importa `three` nem acessa o DOM.
  O estado avança por `step(estado, inputs) → novo estado`, sem mutar o estado anterior.
- `src/render/` — Three.js. Só **lê** o estado e desenha; nunca muda regra de jogo.
- `src/ui/` — menus, HUD e controles de toque em HTML/CSS.
- `src/characters/<nome>/` — `data.ts` (golpes, puro) e `look.ts` (visual, dados puros).
- `src/ai/` — CPU e boneco de treino. Usa gerador com semente próprio, fora do MatchState.
- `src/audio/` — sons sintetizados; só reage a `GameEvent`.
- `src/net/` — online: `rollback.ts` (não conhece rede) e `client.ts` (WebSocket).
- `server/` — servidor de salas em Node (`npm run server`). Veja `docs/ONLINE.md`.
- `src/app.ts` — fluxo de telas e partida; `src/main.ts` liga tudo.

## Regras

1. **Lógica separada do visual.** Toda regra nova de jogo ganha teste em Vitest ao lado do arquivo
   (`arquivo.test.ts`).
2. **Passo fixo de 60 Hz.** Durações de golpes são contadas em ticks/frames, nunca em milissegundos.
3. **Determinismo.** Nada de `Math.random()`, `Date.now()`, `**`/`Math.pow` ou funções
   trigonométricas dentro da lógica (o online depende de resultados idênticos em qualquer
   navegador); se precisar de aleatoriedade, use um gerador com semente guardado no estado.
4. **Personagens originais.** Pode se inspirar em arquétipos de desenhos (garoto com relógio
   alienígena, adolescente com nanitas etc.), mas **nunca** usar nomes, logos, falas ou visuais de
   personagens existentes (Ben 10, Mutante Rex, Jovens Titãs ou outros).
5. **Assets** em `public/assets/`, modelos em `.glb`. Só usar assets com licença que permita uso
   (próprios, CC0 ou Mixamo) e registrar a origem em `public/assets/CREDITS.md`.
6. Código e comentários em português, nomes de variáveis/funções em inglês.
7. Commits pequenos, mensagem em português no imperativo (ex.: "Adiciona bloqueio ao lutador").

## Regras de autonomia (agentes de IA)

Este repositório faz parte do plano de melhoria contínua do portfólio. O painel geral fica no repositório privado `portfolio-ops`.

1. **Branches:** todo trabalho acontece em `claude/<tema>`, com PRs pequenos e focados. O CI precisa estar verde antes do merge.
2. **Integração:** os PRs dos agentes entram na branch `dev`. A `main` só muda quando o dono revisar e aprovar o PR `dev → main`.
3. **Backlog:** o arquivo `ROADMAP.md` é a fonte da verdade. Atualize o status ao final de cada execução.
4. **Nunca:** apagar o repositório, mudar a visibilidade, commitar segredos (use `.env` + `.env.example`), reescrever o histórico da `main`, fazer force-push em branches que não são suas, ou adicionar serviços e dependências pagas. Esses pontos sempre voltam para o dono.
5. **Pronto:** quando o checklist de "pronto" do `ROADMAP.md` estiver completo, marque o status como **PRONTO PARA REVISÃO** e passe para o próximo repositório da fila no `portfolio-ops`.
6. **Commits:** mensagens em português, no imperativo, curtas e descritivas (nada de "atualização").
