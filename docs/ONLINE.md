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

|                       | WebSocket (reserva)                             | WebRTC DataChannel (preferido)                      |
| --------------------- | ----------------------------------------------- | --------------------------------------------------- |
| Transporte            | TCP, sempre pelo servidor                       | UDP direto entre os jogadores (P2P)                 |
| Latência              | ida ao servidor + volta (≈ 2× o ping até ele)   | só o caminho entre os dois (geralmente menor)       |
| Pacote perdido        | TCP reenvia e **segura os seguintes** (engasgo) | modo não confiável: o próximo pacote já resolve     |
| Funciona atrás de NAT | sempre                                          | precisa de STUN e, em ~10–20% das redes, de TURN    |
| Complexidade          | baixa                                           | alta (negociação SDP/ICE, servidor de sinalização)  |
| Servidor necessário   | sim, repassa tudo                               | só para o "aperto de mão" (e TURN quando falha P2P) |

**Como fica:** os dois. A sala e a escolha de lutadores sempre passam pelo WebSocket. Assim que o
segundo jogador entra, o anfitrião tenta abrir um **WebRTC DataChannel** (`ordered: false,
maxRetransmits: 0`) usando o próprio servidor como **sinalização** (oferta, resposta e candidatos
ICE vão como mensagens `rtc` pelo `relay`; o servidor não precisou mudar).

- Se o canal abrir, os **inputs** e as **somas de verificação** vão direto entre os jogadores. O
  selo da luta mostra `ping … · direto`.
- Mensagens que não podem se perder (`hello`, `start`, `rematch`) continuam pelo WebSocket.
- Se o P2P não conectar (rede que exige TURN, navegador sem WebRTC), tudo segue pelo WebSocket,
  como antes. Só há STUN público configurado, não TURN.
- O `ping` mostrado é até o servidor, não entre os jogadores.

O código continua separado para o transporte não mexer no rollback:

- `src/net/rollback.ts` — não sabe nada de rede, só recebe e devolve pacotes de input.
- `src/net/client.ts` — transporte (WebSocket + WebRTC).

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

### No Render (grátis, já configurado)

O `render.yaml` na raiz descreve o serviço (`toon-clash-server`, plano grátis, região Virginia).

1. Entre em [render.com](https://render.com) com a conta do GitHub.
2. **New → Blueprint**, escolha o repositório `toon-clash` e confirme.
3. Quando o deploy terminar, copie o endereço do serviço (`https://toon-clash-server-xxxx.onrender.com`).
   Abrir esse endereço no navegador deve mostrar `Toon Clash server ok`.
4. Crie a variável `VITE_NET_URL` (abaixo) com o mesmo endereço trocando `https://` por `wss://`.

O plano grátis dorme depois de 15 minutos sem uso. A primeira conexão depois disso leva até
~1 minuto (a tela Online avisa "Acordando o servidor…"); as seguintes são imediatas. O Render só
publica o servidor de novo quando `server/` ou o `package.json` mudam.

Para o jogo publicado já vir com o endereço certo, defina a variável `VITE_NET_URL` no build
(ex.: `VITE_NET_URL=wss://toon-clash-server.onrender.com npm run build`). O jogador também pode
digitar outro endereço na tela Online.

No GitHub Pages, o CI lê essa variável das configurações do repositório: **Settings → Secrets and
variables → Actions → Variables → New repository variable**, nome `VITE_NET_URL`, valor
`wss://…`. O próximo push na `main` publica o jogo já apontando para o servidor. Sem a variável,
o jogo tenta o mesmo host na porta 8787.
