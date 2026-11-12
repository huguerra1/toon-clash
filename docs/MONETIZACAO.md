# Plano de monetização do Toon Clash

Objetivo: começar a ganhar dinheiro com o jogo **sem custo de infraestrutura**. Este documento
parte da proposta do Gemini, aponta o que corrigir e organiza o trabalho entre o que o Claude
faz sozinho (código, documentação, empacotamento) e o que só o dono pode fazer (contas,
contratos, pagamentos, dados pessoais e envio aos portais).

> Valores, regras e planos grátis dos serviços citados mudam com frequência. Os pontos marcados
> com **(confirmar)** vieram de fontes de terceiros ou podem estar desatualizados: confira na
> página oficial antes de decidir. Nada aqui é conselho jurídico ou tributário.

## Resumo

1. **Já feito (sem conta nem custo):** aviso do README, auditoria de licenças, módulo de anúncios
   com pausa de loop e som, botão "Apoie" configurável, pacote `.zip` para o Itch.io, fontes
   embutidas no build e servidor pronto para hospedagem grátis (PRs #48 a #52 e o deste plano).
2. **Próximo passo do dono (rápido, R$ 0):** criar a página de apoio (Ko-fi ou LivePix) e a
   página no Itch.io; colocar o link em `VITE_SUPPORT_URL`.
3. **Aposta principal:** portais de jogos web. Começar pelo **CrazyGames** (sem exclusividade)
   ou tentar primeiro o **Poki** (maior alcance, mas pede exclusividade na web). Os dois não
   combinam ao mesmo tempo.
4. **Antes de mandar a qualquer portal:** revisar os personagens mais próximos de desenhos
   conhecidos (ver [Riscos](#riscos)) e testar no celular de verdade.
5. **Por último:** vender a engine como template — conflita com a licença MIT e rende pouco;
   vender conhecimento (curso, guia, suporte) faz mais sentido.

## Onde o jogo está hoje

| Item           | Situação                                                                      |
| -------------- | ----------------------------------------------------------------------------- |
| Hospedagem     | GitHub Pages (grátis), publicado a partir da `main`                           |
| Online         | Servidor de salas no Render (plano grátis, dorme sem uso); P2P por WebRTC     |
| Tamanho        | ~5 MB no total; JS ~234 kB com gzip; `.zip` do Itch ~1,6 MB                   |
| Plataformas    | Desktop (teclado/controle) e celular (toque); FPS no celular ainda não medido |
| Licença        | Código MIT; assets próprios (veja `public/assets/CREDITS.md`)                 |
| Dados pessoais | O jogo não coleta nada: só preferências no `localStorage` do navegador        |

## O que já foi adiantado

| PR  | O que faz                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------- |
| #48 | `src/ads/`: interface `AdProvider`, `NoAdsProvider` (padrão) e controlador que pausa loop e som no anúncio |
| #49 | Botão "Apoie o desenvolvedor" na tela inicial, ligado por `VITE_SUPPORT_URL`; some em build de portal      |
| #50 | `npm run package:itch`: build + `.zip` validado para o Itch.io em `release/`                               |
| #51 | Servidor: `/healthz`, `ALLOWED_ORIGINS`, `SIGTERM`, `Dockerfile`, guia de hospedagens grátis               |
| #52 | Fontes embutidas (sem Google Fonts): requisito comum de portal e funciona offline                          |
| —   | Este plano, aviso do README sem "sem fins comerciais" e auditoria de licenças em `CREDITS.md`              |

Como ligar cada coisa:

- **Botão Apoie no site:** no GitHub, **Settings → Secrets and variables → Actions → Variables**,
  crie `VITE_SUPPORT_URL` com o link (e, se quiser, `VITE_SUPPORT_LABEL`). O próximo deploy da
  `main` mostra o botão.
- **Itch.io:** `npm run package:itch` gera `release/toon-clash-itch-<versão>.zip`. Para o online
  funcionar lá, rode com `VITE_NET_URL=wss://…` (o endereço do servidor).
- **Anúncios de portal:** quando um portal aceitar o jogo, o Claude cria o provedor dele em
  `src/ads/ads.ts` e o build do portal usa `VITE_ADS=<portal>`.

## Análise da proposta do Gemini

### 1. Tirar "Projeto de fã, sem fins comerciais" do README

**Certo, e já feito**, com dois ajustes:

- O aviso antigo citava a Cartoon Network e a Warner Bros. Discovery. Citar empresas num produto
  comercial cria associação com elas; o aviso novo diz só que o jogo é independente e sem ligação
  com qualquer estúdio, emissora ou franquia.
- Mudar o texto não basta. "Personagens originais" precisa ser verdade **também no visual e na
  história**: alguns ainda estão perto demais de desenhos conhecidos (ver [Riscos](#riscos)).

### 2. Parcerias com portais (Poki, CrazyGames, Kongregate)

**É o caminho com mais potencial**, mas a proposta está desatualizada e otimista:

- **"Patrocínio" é coisa da era Flash.** Hoje o modelo é divisão da receita de anúncios exibidos
  pela SDK do portal. O Poki às vezes paga adiantado ou por licença, mas por negociação caso a
  caso, não como regra.
- **Kongregate** deixou de ser opção para jogo web novo na prática **(confirmar)**. Troque por
  **GameDistribution** ou **Playgama**, que distribuem para centenas de sites sem exclusividade
  (paga menos por jogador).
- **Poki:** seleção por equipe humana, padrão de **exclusividade na web** (pode exigir tirar o
  jogo de outros portais e talvez do Itch); paga 50/50 no tráfego que o Poki traz e mais no
  tráfego que você leva **(confirmar)**. Pede carregamento rápido (fala-se em menos de ~8 MB no
  download inicial — estamos bem abaixo), celular funcionando e SDK deles para os anúncios.
- **CrazyGames:** começa por um "Basic Launch" (sem receita) e só no "Full Launch" entra a SDK e
  os anúncios; limite de 50 MB no download inicial (20 MB no celular sem SDK), só anúncios pela
  SDK deles **(confirmar)**; não exige exclusividade, segundo guias de terceiros **(confirmar)**.
- **Regras que valem para quase todos:** nada de links para fora do jogo (o botão Apoie já some
  em build de portal), nada de marca de outros sites, anúncio só em pausa natural (entre lutas —
  já é assim no módulo), evento de "gameplay start/stop" (já existe), jogo funcionando no
  celular e dentro de um `iframe`.
- **O online nos portais:** o servidor grátis dorme e a primeira conexão pode levar ~1 minuto.
  Num portal, essa primeira impressão é ruim. Sugestão: **build de portal sem o modo Online** no
  começo (ou com o servidor pago pelo portal / só depois de ter receita).
- **Expectativa de receita:** anúncio web paga pouco por jogador, ainda menos em tráfego do
  Brasil. Só rende de verdade com dezenas de milhares de partidas por mês. O que mais aumenta a
  receita nos portais é **anúncio premiado** (o jogador escolhe ver em troca de algo), não o
  intervalo forçado.

**Melhoria:** usar o anúncio premiado em coisas que não quebram a luta: continuar no Arcade,
cores alternativas dos lutadores, liberar o Warlord Zhaar sem zerar o Arcade. O
`rewardedBreak()` já está pronto no módulo; com `NoAdsProvider` a recompensa vem de graça.

### 3. Itch.io "pague o quanto quiser" + botão de apoio

**Bom e de custo zero, mas rende pouco** — vale como vitrine e para quem quer apoiar.

- Em jogo **jogado no navegador**, o "pague o quanto quiser" não aparece como cobrança: o jogador
  só joga. A pessoa só paga se for baixar. Opções: deixar a versão de navegador grátis com doação
  sugerida, e oferecer o `.zip` para baixar e jogar offline como "pague o quanto quiser".
- O Itch fica com uma parte configurável (padrão 10%, pode baixar). Para receber, é preciso
  PayPal ou Stripe e preencher o formulário de impostos dos EUA (W-8BEN para quem mora fora).
- **Ko-fi / Buy Me a Coffee** para o público de fora; **LivePix** (Pix) para o público
  brasileiro, que é a maior parte das partidas. Dá para ter os dois e trocar o link quando quiser,
  sem mexer no código.
- **GitHub Sponsors** é outra opção sem custo e combina com o repositório público.
- **Não colocar anúncio no GitHub Pages:** os termos do GitHub Pages não permitem usá-lo como
  site comercial, e redes como o AdSense pedem domínio próprio. Link de doação no site é ok.

### 4. Vender a engine como template (Gumroad / CodeCanyon)

**É o item mais fraco da proposta.**

- **Conflito com a licença:** o código é MIT e está público. Qualquer pessoa pode baixar, usar e
  até revender de graça; quem compraria? Mudar a licença só vale para versões futuras (o que já
  foi publicado continua MIT).
- **CodeCanyon/Envato** costuma recusar item que está disponível de graça em outro lugar e tem
  regras para código gerado por IA **(confirmar)**.
- **Assets e personagens:** um template "com os lutadores" levaria os personagens junto. Se a
  ideia é proteger os personagens como marca do jogo, eles não podem ir no template.
- **O que vende melhor sem conflito:** conhecimento e tempo. Um guia ou curso ("como fiz um jogo
  de luta com rollback no navegador"), um starter kit limpo e documentado **sem os personagens**,
  ou suporte/consultoria. O Itch.io também vende ferramentas e assets, sem custo fixo.
- **Prioridade:** baixa. Só depois de o jogo ter público — é ele que vende o template.

### 5. Servidor online grátis (Render, Koyeb, Fly.io)

**Viável, com ressalvas**, e o repositório já está pronto (PR #51):

- **Render:** já configurado (`render.yaml`). Dorme após 15 min sem tráfego; acorda em até ~1 min.
- **Koyeb:** plano grátis dorme após 1 h sem tráfego e não dá para desligar isso; a empresa foi
  comprada pela Mistral em 2026 e o plano grátis pode ter mudado **(confirmar)**.
- **Fly.io:** contas novas não têm mais plano grátis, precisa de cartão **(confirmar)**. Fica fora
  da regra de custo zero.
- **O que derruba sala de verdade** não é dormir no meio da luta (o cliente manda `ping` e o tráfego
  mantém o servidor acordado), e sim **reinício ou nova publicação** da hospedagem, porque as
  salas ficam na memória. Com o P2P por WebRTC, a luta continua mesmo se o servidor cair depois
  do aperto de mão, mas o `relay` e a revanche dependem dele.
- **Alternativa que não dorme:** Cloudflare Workers com Durable Objects tem plano grátis com
  WebSocket e acorda em milissegundos **(confirmar limites)**. Exige reescrever o `server.mjs`
  (~150 linhas) para o formato da Cloudflare — o Claude faz; a conta é do dono.
- **Segurança:** com o servidor público, use `ALLOWED_ORIGINS` para só o site e o Itch abrirem
  salas.

### O que faltou na proposta

- **Riscos de propriedade intelectual** antes de lucrar (ver abaixo).
- **Requisitos técnicos dos portais** (fontes externas, links, celular, `iframe`, tamanho).
- **Anúncio premiado** como principal fonte de receita em portal.
- **Tráfego próprio:** no Poki, o tráfego que você leva paga mais. Devlogs curtos (YouTube
  Shorts, TikTok) com Toonalities e combos são o marketing de custo zero.
- **Impostos e dados pessoais:** receber de fora exige declarar no Brasil (carnê-leão ou MEI,
  conforme o caso) — vale conversar com um contador. Nenhum dado pessoal ou bancário vai para o
  repositório.
- **Steam** (taxa de US$ 100 por jogo) fica fora do custo zero; reavaliar se o jogo pegar tração.

## Riscos

| Risco                                     | Por quê                                                                                                                                                                                                                   | O que fazer                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personagem parecido com desenho conhecido | Com dinheiro envolvido, a chance de reclamação aumenta, e os portais têm revisão humana. O Kai Volt "achava um bracelete cósmico dentro de um meteorito e trocava de forma": a premissa de um desenho famoso quase igual. | **Texto feito:** o Kai agora "levou um raio e virou bateria viva" (Rajada Volt, Toonality Curto-Circuito), e o final do Arcade e a bio do Zhaar não falam mais em bracelete/relógio. **Falta:** o visual ainda tem um aparelho brilhando no pulso; tirar ou trocar e revisar os 11 lutadores lado a lado com as referências. |
| Exclusividade do Poki                     | Pode impedir CrazyGames, GameDistribution e talvez Itch.                                                                                                                                                                  | Decidir antes de mandar: Poki primeiro (esperar resposta) ou CrazyGames + distribuidores.                                                                                                                                                                                                                                    |
| Servidor grátis dorme ou some             | Primeira conexão lenta; plano grátis pode acabar.                                                                                                                                                                         | Build de portal sem online no começo; Cloudflare como plano B.                                                                                                                                                                                                                                                               |
| Licença MIT                               | Qualquer um pode copiar e publicar o jogo (inclusive em portais).                                                                                                                                                         | Aceitar (valor de portfólio) ou mudar a licença das versões futuras; o nome "Toon Clash" não é coberto pela MIT.                                                                                                                                                                                                             |
| Receita baixa                             | Anúncio web paga pouco por jogador.                                                                                                                                                                                       | Tratar como renda extra; medir antes de investir mais tempo.                                                                                                                                                                                                                                                                 |
| Celular                                   | Portais têm muito tráfego no celular; o FPS em aparelho real ainda não foi medido.                                                                                                                                        | Testar em 2 ou 3 celulares antes de enviar (backlog item 3).                                                                                                                                                                                                                                                                 |

## Licenças dos assets (auditoria)

Detalhe em [`public/assets/CREDITS.md`](../public/assets/CREDITS.md). Resumo: **tudo é próprio
ou tem licença que permite uso comercial.**

- Modelos `.glb` dos lutadores: próprios, gerados por `tools/blender/build_fighters.py`.
- Sons, músicas e locutor: sintetizados no navegador (sem arquivo de áudio de terceiros); a voz do
  locutor é a do sistema do jogador, não é distribuída com o jogo.
- Fontes Bangers e Nunito: SIL Open Font License 1.1 (uso comercial permitido), embutidas no build.
- Bibliotecas que vão no jogo: three.js (MIT); no servidor: ws (MIT).
- Imagens do README (`docs/img/`): capturas do próprio jogo.

Pendência do dono: decidir a licença dos personagens e modelos (hoje "todos os direitos
reservados" por omissão; o código que monta os personagens em `src/characters/` é MIT).

## Quem faz o quê

| Tarefa                                                                              | Claude |     Você     |
| ----------------------------------------------------------------------------------- | :----: | :----------: |
| Código: módulo de anúncios, botão Apoie, pacote do Itch, servidor, fontes           |   ✅   |              |
| Integrar a SDK de um portal (depois de aceito; a SDK vem da página do portal)       |   ✅   |              |
| Build de portal sem online, anúncio premiado (continuar, cores, Zhaar)              |   ✅   |              |
| Reescrever história/textos dos personagens parecidos; propor visual novo            |   ✅   | ✅ (aprovar) |
| Servidor em Cloudflare Durable Objects (se quiser trocar)                           |   ✅   |              |
| Textos de página (Itch, portais, Ko-fi), capturas e GIFs para divulgação            |   ✅   |              |
| Criar contas (Itch, Ko-fi/LivePix, portais, Render/Cloudflare)                      |        |      ✅      |
| Aceitar termos, contratos e exclusividade                                           |        |      ✅      |
| Dados pessoais, CPF, conta bancária, PayPal/Stripe, formulário de impostos (W-8BEN) |        |      ✅      |
| Enviar o jogo aos portais e responder a eles                                        |        |      ✅      |
| Variáveis do repositório (`VITE_SUPPORT_URL`, `VITE_NET_URL`)                       |        |      ✅      |
| Decidir licença dos personagens e se troca a MIT                                    |        |      ✅      |
| Aprovar o PR `dev → main` (publica no site)                                         |        |      ✅      |
| Impostos e contador                                                                 |        |      ✅      |

## Ordem de prioridade

1. **Agora (R$ 0, uma tarde):** página de apoio + Itch.io + link no site.
2. **Antes dos portais (Claude):** revisar personagens parecidos, build de portal sem online,
   medir FPS no celular.
3. **Portais:** enviar ao Poki **ou** ao CrazyGames (decisão sua); quando aceito, o Claude integra
   a SDK. Depois, GameDistribution se não houver exclusividade.
4. **Anúncio premiado** nas recompensas (continuar, cores, Zhaar).
5. **Servidor:** manter o Render; trocar para Cloudflare se o online ganhar uso.
6. **Template/curso:** só com o jogo tendo público.

## O que você precisa fazer, em ordem

1. Revisar e aprovar o PR `dev → main` para o site receber o botão Apoie e as fontes embutidas.
2. Criar a página de apoio: **LivePix** (Pix, público brasileiro) e/ou **Ko-fi**. Use um nome
   público (pode ser o do jogo), sem expor dados pessoais na página.
3. No GitHub: **Settings → Secrets and variables → Actions → Variables** → `VITE_SUPPORT_URL` com
   o link da página (opcional: `VITE_SUPPORT_LABEL`, ex.: "Apoie com Pix").
4. Criar a conta no **Itch.io**, a página do jogo (tipo HTML), subir o `.zip` de
   `npm run package:itch` e configurar pagamento (PayPal/Stripe) e o formulário de impostos.
5. No **Render**, preencher `ALLOWED_ORIGINS` com
   `https://huguerra1.github.io,https://*.itch.zone`.
6. Decidir: **Poki (exclusivo) ou CrazyGames (sem exclusividade)?** E se troca a licença das
   versões futuras ou mantém MIT.
7. Pedir ao Claude a revisão dos personagens parecidos e o build de portal sem online; aprovar.
8. Cadastrar-se no portal escolhido e enviar o jogo; quando aceito, passar ao Claude o nome do
   portal e o link da documentação da SDK (nada de chave no repositório).
9. Conversar com um contador sobre como declarar a receita do exterior.

## Fontes consultadas

- [CrazyGames — requisitos](https://docs.crazygames.com/requirements/intro/) e
  [requisitos técnicos](https://docs.crazygames.com/requirements/technical/)
- [Poki for Developers](https://developers.poki.com/) e [SDK do Poki](https://sdk.poki.com/)
- [Guia de terceiros sobre o Poki (2026)](https://app.cinevva.com/guides/publish-game-poki)
- [Koyeb — scale to zero](https://www.koyeb.com/docs/run-and-scale/scale-to-zero)
- [Itch.io — jogos HTML5](https://itch.io/docs/creators/html5)
- [Termos do GitHub Pages](https://docs.github.com/pages/getting-started-with-github-pages/about-github-pages#usage-limits)
