# Multiplayer online: WebSocket, WebRTC e rollback

Este documento explica como o online do Toon Clash funciona e por que foi feito assim.

## O problema

Em jogo de luta, cada frame (1/60 s) importa. Um soco tem 4 frames de startup — 66 ms. Se o
jogo esperasse o input do outro jogador chegar pela internet antes de desenhar cada frame
("delay-based" puro), qualquer ping acima de ~50 ms deixaria os controles pesados.

## A solução usada: rollback (estilo GGPO)

1. Os dois navegadores rodam **a mesma simulação**. O motor (`src/game/match.ts`) é
   determinístico: mesmo estado + mesmos inputs = mesmo resultado, em qualquer navegador
   (sem `Math.random`, sem `Date.now`, sem funções trigonométricas na lógica).
2. Cada lado manda **só os inputs** (9 bits por frame), não o estado do jogo.
3. O input local é aplicado com **2 frames de atraso** — quase imperceptível e reduz correções.
4. Quando o input do outro jogador ainda não chegou, o jogo **prevê** que ele continua
   apertando o mesmo de antes e segue sem esperar.
5. Quando o input real chega e é diferente da previsão, o jogo **volta** ao último estado certo
   e **resimula** os frames até o atual (`src/net/rollback.ts`). Isso leva menos de 1 ms.
6. Se a previsão passar de 10 frames (~166 ms), o jogo espera ("Aguardando o outro jogador…").
7. A cada 60 frames confirmados, os dois lados trocam uma soma de verificação do estado para
   detectar dessincronização.

Cada pacote repete os últimos 12 inputs, então perder pacotes não trava a luta.

## WebSocket ou WebRTC?

|                       | WebSocket (usado agora)                         | WebRTC DataChannel                                  |
| --------------------- | ----------------------------------------------- | --------------------------------------------------- |
| Transporte            | TCP, sempre pelo servidor                       | UDP direto entre os jogadores (P2P)                 |
| Latência              | ida ao servidor + volta (≈ 2× o ping até ele)   | só o caminho entre os dois (geralmente menor)       |
| Pacote perdido        | TCP reenvia e **segura os seguintes** (engasgo) | modo não confiável: o próximo pacote já resolve     |
| Funciona atrás de NAT | sempre                                          | precisa de STUN e, em ~10–20% das redes, de TURN    |
| Complexidade          | baixa                                           | alta (negociação SDP/ICE, servidor de sinalização)  |
| Servidor necessário   | sim, repassa tudo                               | só para o "aperto de mão" (e TURN quando falha P2P) |

**Conclusão:** WebSocket é o melhor ponto de partida — funciona em qualquer rede e, combinado
com rollback e redundância de inputs, já dá uma experiência boa até ~100 ms de ping. O código
foi separado para trocar o transporte sem mexer no rollback:

- `src/net/rollback.ts` — não sabe nada de rede, só recebe e devolve pacotes de input.
- `src/net/client.ts` — transporte (WebSocket).

**Próximo passo recomendado:** usar o próprio servidor WebSocket como **sinalização** para abrir
um **WebRTC DataChannel** (`ordered: false, maxRetransmits: 0`) entre os jogadores, e cair de
volta para o WebSocket quando o P2P não conectar. Isso tira o servidor do meio do caminho e
elimina os engasgos do TCP.

## Como rodar

```bash
npm run server   # servidor de salas em ws://localhost:8787
npm run dev      # jogo em http://localhost:5173
```

Abra o jogo em duas abas (ou dois computadores na mesma rede, trocando `localhost` pelo IP),
vá em **Online**, crie a sala em uma e entre com o código na outra.

## Publicando o servidor

O GitHub Pages só hospeda arquivos estáticos; o servidor precisa de um serviço que rode Node:
Render, Railway, Fly.io ou uma VPS. Ele só precisa de `npm install` e `npm run server`, e lê a
porta da variável `PORT`. Em produção use `wss://` (HTTPS), porque páginas HTTPS não podem abrir
`ws://`.

Para o jogo publicado já vir com o endereço certo, defina a variável `VITE_NET_URL` no build
(ex.: `VITE_NET_URL=wss://toon-clash-server.onrender.com npm run build`). O jogador também pode
digitar outro endereço na tela Online.
