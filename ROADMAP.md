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
- [ ] Dependabot ativo (npm + GitHub Actions)
- [ ] Backlog restante registrado como issues

## Backlog

1. GIF de gameplay e prints no README
2. Testes do netcode: rollback com perda/atraso de pacotes, checksum divergente e reconexão
3. Performance no celular: medir FPS em aparelho médio, LOD/sombras adaptativas, limitar o bloom
4. Acessibilidade: remapeamento de teclas e opção de reduzir tremor de tela/flashes
5. Release `v1.0` com changelog gerado a partir dos PRs
6. Telemetria local opcional (FPS e ping) no modo Treino
7. Balanceamento: tabela de frame data por personagem gerada a partir de `data.ts`

## Log

- 2026-11-10 — Fase 1: licença MIT, regras de autonomia no AGENTS.md, roadmap.
