# Toon Clash

Jogo de luta 1x1 estilo Mortal Kombat, em 2.5D, rodando direto no navegador com
[Three.js](https://threejs.org/). Personagens originais inspirados nos desenhos animados dos anos 2000.

> Status: **etapa M0 (setup)** — arena de teste com dois lutadores provisórios.
> Veja o roadmap completo em [PLANO.md](PLANO.md).

## Como rodar

Precisa do [Node.js](https://nodejs.org/) 20 ou mais novo.

```bash
npm install
npm run dev
```

Abra http://localhost:5173.

| Jogador | Andar |
| ------- | ----- |
| 1       | A / D |
| 2       | ← / → |

## Scripts

| Comando          | O que faz                                          |
| ---------------- | -------------------------------------------------- |
| `npm run dev`    | Servidor de desenvolvimento com recarga automática |
| `npm test`       | Testes da lógica do jogo (Vitest)                  |
| `npm run lint`   | Verifica o código com ESLint                       |
| `npm run format` | Formata o código com Prettier                      |
| `npm run build`  | Gera a versão de produção em `dist/`               |

## Estrutura

```
src/
  core/     game loop (60 Hz fixo) e input
  game/     regras do jogo (sem Three.js, testáveis)
  render/   cena Three.js, câmera e material cartoon
```

Regras de código para humanos e agentes de IA: [AGENTS.md](AGENTS.md).

## Aviso

Projeto de fã, sem fins comerciais e sem ligação com a Cartoon Network ou a Warner Bros. Discovery.
Todos os personagens são criações originais.
