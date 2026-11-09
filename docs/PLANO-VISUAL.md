# Plano: visual mais detalhado dos lutadores

## Onde estamos

Hoje cada lutador é montado em código com ~25 primitivas (cápsulas, esferas, caixas), animado
por poses procedurais e desenhado com toon shader de 3 tons + contorno "inverted hull".
Funciona e é leve, mas tem limites claros:

- Corpo "de bonecos de encaixe": juntas aparecem, mãos são bolas, sem dedos.
- Rosto parado: olhos fixos, sem boca, sem sobrancelhas — zero expressão.
- Silhuetas parecidas: todo mundo tem a mesma proporção, só muda cor e acessório.
- Animação rígida: sem squash & stretch, sem movimento secundário (cabelo, capa, rabo).
- Cabelo e roupa feitos de cones e caixas.

## Regra que continua valendo

Todos os personagens continuam **originais**. Pode-se buscar o _clima_ de desenhos de TV,
mas sem copiar nome, silhueta, roupa marcante ou poderes de personagens existentes. Antes de
modelar, cada lutador ganha uma folha de conceito própria (frente, perfil, 3 expressões, paleta).

## Fase A — polir o que é procedural (rápido, sem assets externos)

Tudo dentro de `src/render/`, sem mudar a lógica do jogo.

| Item                       | O que muda                                                                                                                                           | Esforço |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **Rosto expressivo**       | Olhos com pálpebra que pisca, pupila que segue o oponente, sobrancelhas e boca (texturas de canvas trocadas por estado: bravo, dor, tonto, vitória). | médio   |
| **Mãos de luva**           | Mão em formato de luva de desenho (palma + polegar) e punho fechado ao golpear.                                                                      | baixo   |
| **Silhuetas únicas**       | Proporções por personagem no `look.ts`: cabeça, ombros, pernas, barriga (ex.: Ferrum largo e baixo, Solara alta e fina, Gelatino gordinho).          | médio   |
| **Squash & stretch**       | Esticar no início do pulo, achatar ao aterrissar, "esmagar" ao apanhar forte, alongar no golpe ativo.                                                | baixo   |
| **Movimento secundário**   | Cabelo, capa, cachecol e orelhas com mola simples (atrasam e balançam).                                                                              | médio   |
| **Smear frames**           | Rastro deformado do membro no frame mais rápido do golpe, como em animação 2D.                                                                       | médio   |
| **Roupas com detalhe**     | Golas, bolsos, costuras, logotipos próprios, faixas na calça — via texturas de canvas.                                                               | médio   |
| **Pós-processamento**      | Bloom só nos brilhos (especiais, olhos), contorno por detecção de borda (mais fino e uniforme que o atual) e leve granulado de TV.                   | médio   |
| **Poses de personalidade** | Guarda, vitória e intro diferentes por lutador (Capi bocejando, Lola dançando, Zhaar de braços cruzados).                                            | médio   |

Resultado esperado: personagens bem mais vivos, sem aumentar o tamanho do download.

## Fase B — modelos 3D de verdade (Blender → GLB)

Para chegar num nível de jogo comercial, os lutadores passam a ser modelados no Blender.

1. **Piloto com 1 personagem** (sugestão: Kai Volt) para validar o pipeline inteiro.
2. Modelo low/mid-poly (3–6 mil triângulos), com esqueleto padrão humanoide.
3. Texturas pintadas à mão em atlas único (1024×1024), com o mesmo toon shader de 3 tons.
4. Animações: base do Mixamo (andar, pular, apanhar, cair) + golpes animados à mão no Blender.
5. Exportar `.glb` com Draco/Meshopt e texturas KTX2; carregar com `GLTFLoader`.
6. O código de animação troca as poses procedurais por clipes (`AnimationMixer`), com o
   frame data do jogo continuando a ser a referência — a animação acompanha o golpe, nunca o contrário.
7. Assets em `public/assets/<lutador>/` e origem registrada em `public/assets/CREDITS.md`.

Orçamento por lutador: até ~1,5 MB comprimido. Com 11 lutadores, carregar sob demanda na seleção.

## Fase C — resto do elenco e cenários

- Aplicar o pipeline da Fase B nos outros 10 lutadores, em ordem de popularidade.
- Cenários com mais profundidade: camadas de fundo animadas, plateia simples, objetos que
  quebram na Toonality.
- Telas de seleção com retrato desenhado (render do modelo com pose de destaque).

## Ordem sugerida

1. Fase A completa (dá para fazer já, com testes visuais no navegador a cada item).
2. Piloto da Fase B com Kai Volt; decidir se vale o esforço vendo o resultado lado a lado.
3. Fase C conforme a Fase B se pagar.

## Ferramentas

- Blender (gratuito) para modelagem e animação.
- Mixamo (gratuito, conta Adobe) para animações base — licença permite uso em jogos.
- glTF-Transform (`npx @gltf-transform/cli`) para comprimir os `.glb`.
- Opcional: Codex/Claude geram os scripts Python do Blender para automatizar export e rig.
