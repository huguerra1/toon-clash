# ROADMAP — Toon Clash

**Status:** EM ANDAMENTO · Prioridade 1 no portfólio (carro-chefe)

O plano de jogo detalhado está em `PLANO.md`. Este arquivo acompanha o checklist de portfólio e o backlog de melhorias.

## Checklist de "pronto"

- [x] CI no GitHub Actions (lint + format + testes + build) verde
- [x] Deploy público (GitHub Pages + servidor de salas no Render)
- [x] Licença (MIT para o código; assets conforme `public/assets/CREDITS.md`)
- [ ] README com GIF/prints da luta, do menu e do online
- [ ] Link do jogo no "About" do repositório, com descrição e tópicos (depende do `gh`)
- [ ] Releases versionadas (tags `v0.x` com changelog)
- [x] Dependabot ativo (npm + GitHub Actions; PRs semanais na `dev`)
- [ ] Backlog restante registrado como issues

## Backlog

1. GIF de gameplay e prints no README
2. Testes do netcode: reconexão (perda em rajada, fora de ordem, duplicados, latência assimétrica, checksum divergente e limite de predição: feito)
3. Performance no celular: medir FPS em aparelho médio, LOD/sombras adaptativas, limitar o bloom
4. Acessibilidade: remapeamento das teclas de luta e redução de tremor de tela e flashes (feito; falta o tutorial mostrar as teclas atuais)
5. Release `v1.0` com changelog gerado a partir dos PRs
6. Telemetria local opcional (FPS e ping) no modo Treino
7. Balanceamento: tabela de frame data por personagem gerada a partir de `data.ts` (feito; `npm run frame-data`, documentação em `docs/FRAME-DATA.md`)

## Log

- 2026-11-10 — Tabela de frame data gerada para todo o roster e formas, com dano, chip, vantagens nominais e testes; dados de balanceamento preservados.
- 2026-11-10 — Fase 1: licença MIT, regras de autonomia no AGENTS.md, roadmap.
- 2026-11-10 — 6 novos testes de rollback (rajada de perda, fora de ordem/duplicados, latência assimétrica, checksum divergente, limite de predição).
- 2026-11-10 — Opções de acessibilidade: tremor de tela (normal/reduzido/desligado, respeita prefers-reduced-motion) e flashes reduzidos.
- 2026-11-10 — Remapeamento das teclas de luta por jogador (Controles → Remapear teclas), salvo no navegador.
