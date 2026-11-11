# ROADMAP — Toon Clash

**Status:** PRONTO PARA REVISÃO · Prioridade 1 no portfólio (carro-chefe). Falta só a release, que depende do merge `dev → main`.

O plano de jogo detalhado está em `PLANO.md`. Este arquivo acompanha o checklist de portfólio e o backlog de melhorias.

## Checklist de "pronto"

- [x] CI no GitHub Actions (lint + format + testes + build) verde
- [x] Deploy público (GitHub Pages + servidor de salas no Render)
- [x] Licença (MIT para o código; assets conforme `public/assets/CREDITS.md`)
- [x] README com GIF e prints da luta, da tela inicial e da escolha de lutadores
- [x] Link do jogo no "About" do repositório, com descrição e tópicos
- [ ] Releases versionadas (tags `v0.x` com changelog)
- [x] Dependabot ativo (npm + GitHub Actions; PRs semanais na `dev`)
- [x] Backlog restante registrado como issues (#14 a #19)

## Backlog

1. ~~GIF de gameplay e prints no README~~ (feito; falta um print do modo Online)
2. Testes do netcode: reconexão (perda em rajada, fora de ordem, duplicados, latência assimétrica, checksum divergente e limite de predição: feito)
3. Performance no celular: medir FPS num aparelho real (qualidade adaptativa automática de bloom, sombras e pixel ratio: feito)
4. ~~Acessibilidade: remapeamento das teclas de luta e redução de tremor de tela e flashes~~ (feito; o tutorial mostra as teclas atuais)
5. ~~Release `v1.0` com changelog gerado a partir dos PRs~~ ✅ (CHANGELOG.md)
6. ~~Telemetria local opcional (FPS e ping)~~ (feito: Opções → Mostrar desempenho, em qualquer modo; ping no Online)
7. Balanceamento: tabela de frame data por personagem gerada a partir de `data.ts` (feito; `npm run frame-data`, documentação em `docs/FRAME-DATA.md`)

## Log

- 2026-11-11 — Refatoração visual dos lutadores (estilo desenho de TV): rosto desenhado com 7 estilos, sombra chapada em 2 tons, traço de nanquim no cenário, formas novas no Blender (silhuetas por personagem, luvas, tênis grandes), guarda com linha de ação e opção de animação "desenho". Antes/depois em `docs/ESTILO-VISUAL.md`. Traço de nanquim feito pelo Gemini; revisão cruzada pelo Gemini.
- 2026-11-10 — Movimento liso (#31): lutadores, projéteis e câmera interpolados entre ticks, câmera pelo tempo real, passos pela distância e virada suave.
- 2026-11-10 — Golpes com impacto (#32): preparação, estalo e pausa no impacto, giro de tronco e avanço do quadril, reações diferentes a golpe alto/corpo/forte, tremor no hitstop, zoom no golpe forte e risco de movimento.
- 2026-11-10 — Dificuldade recalibrada para iniciantes com teste de vitórias por nível; Fácil por padrão, Arcade sobe só um degrau no fim e reduz o nível ao continuar, chefe com 1200 de vida e dano normal, comandos e buffer mais tolerantes.
- 2026-11-10 — Tabela de frame data gerada para todo o roster e formas, com dano, chip, vantagens nominais e testes; dados de balanceamento preservados.
- 2026-11-10 — Fase 1: licença MIT, regras de autonomia no AGENTS.md, roadmap.
- 2026-11-10 — 6 novos testes de rollback (rajada de perda, fora de ordem/duplicados, latência assimétrica, checksum divergente, limite de predição).
- 2026-11-10 — Opções de acessibilidade: tremor de tela (normal/reduzido/desligado, respeita prefers-reduced-motion) e flashes reduzidos.
- 2026-11-10 — Remapeamento das teclas de luta por jogador (Controles → Remapear teclas), salvo no navegador.
- 2026-11-10 — Contador de desempenho opcional (FPS, pior quadro, quadros lentos e ping no Online).
- 2026-11-10 — Tutorial mostra as teclas remapeadas; tela de remapear usa os mesmos nomes de botão do jogo.
- 2026-11-10 — GIF de luta e prints (título, seleção, luta) no README, capturados com Chrome headless.
- 2026-11-10 — Backlog restante virou issues (#14–#19). Status: pronto para revisão.
- 2026-11-10 — Qualidade gráfica adaptativa ('auto' por padrão): desce para 'baixo' abaixo de 50 FPS por 3 s e sobe para 'alto' acima de 58 FPS por 10 s.
- 2026-11-10 — Balanceamento (#16): Passo Sombrio invencível só até reaparecer (15 frames, antes 26); Quique Gelatinoso com recuperação 24 (-12 na defesa, antes -2); Mergulho da Águia com recuperação 16 (-4 na defesa, antes +2).
- 2026-11-10 — Release v1.0.0: CHANGELOG.md, versão 1.0.0 no package.json, tag e release no GitHub.
