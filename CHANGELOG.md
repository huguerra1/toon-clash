# Changelog

Todas as mudanças relevantes do Toon Clash. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.0.0] — 2026-11-10

Primeira versão estável. [Jogue no navegador](https://huguerra1.github.io/toon-clash/).

### Jogo

- Jogo de luta 2.5D em Three.js com **11 personagens originais**, modelos 3D, cenários animados e retratos.
- Modos: Tutorial (11 lições guiadas), Arcade (6 lutas + chefe), Versus local, Contra a CPU (4 níveis), Treino e Online.
- Motor de combate 100% determinístico, com controles de toque para celular.

### Online

- Multiplayer online com **rollback netcode** via WebRTC, servidor de sinalização no Render e modo espectador em VR.
- Testes do rollback para perda de pacotes em rajada, pacotes duplicados e divergência de estado (#6).

### Acessibilidade e opções

- Opções para reduzir tremor de tela e flashes (#7).
- Remapeamento das teclas de luta de cada jogador, também mostrado no tutorial (#9, #12).
- Contador de desempenho opcional com FPS, pior quadro e ping (#11, #22).
- Qualidade gráfica automática: reduz abaixo de 50 FPS e volta a subir acima de 58 FPS (#21).

### Balanceamento

- Tabela de frame data de todo o roster em [`docs/FRAME-DATA.md`](docs/FRAME-DATA.md), gerada por `npm run frame-data` (#8).
- Passo Sombrio invencível só até reaparecer; Quique Gelatinoso e Mergulho da Águia puníveis na defesa (#28).

### Projeto

- CI com lint, Prettier, 219 testes e build; deploy automático no GitHub Pages.
- README com GIF, prints, selos e guia de acessibilidade (#10, #13).
- Dependabot para npm e GitHub Actions (#5).

[1.0.0]: https://github.com/huguerra1/toon-clash/releases/tag/v1.0.0
