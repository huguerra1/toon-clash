# Modelos 3D dos lutadores (Blender → .glb)

O jogo funciona sem nenhum arquivo 3D: cada lutador é montado com primitivas em código. Quando
existe um `.glb` para ele, o jogo usa o modelo do Blender no lugar — com as mesmas animações,
expressões, acessórios e efeitos. Se o modelo estiver incompleto, o jogo avisa no console e
volta para as primitivas.

## 1. Pegar o ponto de partida

Com `npm run dev` rodando, abra o jogo e, no console do navegador (F12), rode:

```js
toon.exportFighters();
```

O navegador baixa um `.glb` por lutador (e um por forma do Kai Volt), já com todas as partes
nomeadas no padrão. Importe no Blender em **File → Import → glTF 2.0**.

## 2. O que precisa ter no modelo

O jogo anima o lutador girando **nós com estes nomes** (o Blender pode acrescentar `.001`, tudo bem):

| Nó               | O que é                                                        | Gira em torno de              |
| ---------------- | -------------------------------------------------------------- | ----------------------------- |
| `hips`           | quadril (a altura dele no Blender é a altura do quadril em pé) | Z (tombar) e sobe/desce       |
| `spine`          | tronco                                                         | Z                             |
| `head`           | cabeça                                                         | Z                             |
| `armA`, `armB`   | ombros (A = lado da câmera)                                    | Z (para a frente) e X (abrir) |
| `foreA`, `foreB` | cotovelos                                                      | Z                             |
| `legA`, `legB`   | quadris das pernas                                             | Z                             |
| `shinA`, `shinB` | joelhos                                                        | Z                             |

Regras que o jogo assume:

- O lutador olha para **+X**, com **+Y para cima**, pés em y = 0, altura total de ~1,8.
- Na pose de descanso, braços e pernas apontam **para baixo** (−Y) e todos os nós têm rotação zero.
- A hierarquia segue o corpo: `hips → spine → head`, `spine → armA → foreA`, `hips → legA → shinA`.
- Pode ser **rígido** (cada peça é filha do nó do osso — mais fácil e combina com o estilo) ou
  com **esqueleto e skinning**, desde que os ossos tenham esses nomes e orientações.

## 3. Partes opcionais

| Nome                                                                                                                                                       | Para que serve                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `eye` com filhos `lid` e `pupil`                                                                                                                           | olhos que piscam e mudam de expressão (o `lid` gira em Z)                                              |
| `brow` (dois)                                                                                                                                              | sobrancelhas que mudam com a expressão                                                                 |
| `mouth`                                                                                                                                                    | onde a boca desenhada é colocada (o jogo cria a boca)                                                  |
| `prop:sword`, `prop:hammer`, `prop:jets`, `prop:bread`, `prop:rake`, `prop:lid`, `prop:wings`, `prop:horn`, `prop:shadowHand`, `prop:rocket`, `prop:stars` | acessórios que só aparecem durante certos golpes                                                       |
| `dangle:<qualquer coisa>`                                                                                                                                  | ponto de articulação de algo que balança (capa, cabelo, cachecol); a peça é filha dele e pende para −Y |

## 4. Materiais

- Use cores sólidas ou uma textura pintada à mão (atlas de 1024×1024). O jogo troca os materiais
  pelo toon shader de 3 tons e desenha o contorno preto sozinho.
- Partes que brilham (olhos de energia, joias, armas de luz): coloque cor em **Emission**.
- Mantenha 3–6 mil triângulos por lutador.

## 5. Colocar no jogo

1. Exporte em **File → Export → glTF 2.0**, formato **glTF Binary (.glb)**, com "+Y Up".
2. Comprima (opcional, recomendado): `npx @gltf-transform/cli optimize entrada.glb saida.glb`.
3. Copie para `public/assets/fighters/` e registre em `public/assets/fighters/manifest.json`:

   ```json
   { "kai": ["kai.glb", "kai-forma1.glb", "kai-forma2.glb"], "nyx": ["nyx.glb"] }
   ```

   A lista de cada lutador é uma entrada por forma (só o Kai Volt tem 3).

4. Registre autor e licença em `public/assets/CREDITS.md`.

## Personagens originais

Os lutadores são criações próprias do Toon Clash. Ao modelar, mantenha as cores, roupas e
acessórios de cada um (`src/characters/<lutador>/look.ts`) e não copie visual de personagens
de outras obras.
