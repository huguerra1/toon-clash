# Créditos dos assets

Registre aqui a origem e a licença de cada arquivo em `public/assets/` e de tudo de terceiros que
vai junto com o jogo. Antes de adicionar qualquer asset, confira se a licença permite **uso
comercial** (o jogo pode ser publicado em portais com anúncio e no Itch.io).

Última auditoria: 2026-11-12 — nada de terceiros com restrição comercial.

## Arquivos em `public/assets/`

| Arquivo                                     | Autor                                                   | Licença                                                              |
| ------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| `fighters/*.glb` e `fighters/manifest.json` | Próprio — gerados por `tools/blender/build_fighters.py` | Todos os direitos reservados ao autor do projeto (licença a definir) |

## Embutido no build ou carregado pelo jogo

| Item                            | Origem                                   | Licença                                      | Uso comercial |
| ------------------------------- | ---------------------------------------- | -------------------------------------------- | ------------- |
| three.js                        | npm `three`                              | MIT                                          | Sim           |
| Fonte Bangers (latin, 400)      | npm `@fontsource/bangers` (Google Fonts) | SIL Open Font License 1.1                    | Sim           |
| Fonte Nunito (latin, 600 e 800) | npm `@fontsource/nunito` (Google Fonts)  | SIL Open Font License 1.1                    | Sim           |
| Efeitos, músicas e jingles      | Sintetizados em código (`src/audio/`)    | Mesma do código (MIT)                        | Sim           |
| Voz do locutor                  | `speechSynthesis` do navegador           | Voz do sistema do jogador; não é distribuída | —             |
| Ícone 👊 da aba                 | Emoji desenhado pela fonte do sistema    | Não é distribuído como imagem                | —             |
| Rostos, texturas e cenários     | Gerados em código (`src/render/`)        | Mesma do código (MIT)                        | Sim           |

## Servidor e serviços

| Item                     | Licença / termos                                  |
| ------------------------ | ------------------------------------------------- |
| ws (servidor de salas)   | MIT                                               |
| STUN `stun.l.google.com` | Serviço público do Google, usado só para o WebRTC |

## Documentação

As imagens de `docs/img/` são capturas do próprio jogo.

## Observação

O código que monta os personagens (`src/characters/`, `src/render/`) é MIT, como o resto do
código. A licença dos modelos `.glb` (e do nome "Toon Clash" e dos personagens como marca) é uma
decisão do dono; veja `docs/MONETIZACAO.md`.
