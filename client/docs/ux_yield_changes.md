# Yield — O que foi melhorado e por quê

> Explicação simples de cada mudança feita na tela de Análise Fundamentalista.

---

## 1. Painel de saúde rápida do ativo

**Problema que existia:** Ao abrir a tela, o usuário via o nome e o preço do ativo e depois precisava rolar por quatro blocos inteiros de números para entender — na prática — se a empresa estava boa ou ruim nos indicadores mais importantes.

**O que foi feito:** Logo abaixo do cabeçalho principal, adicionamos uma faixa com cinco "etiquetas" coloridas — uma para Valuation, uma para Rentabilidade, uma para Resultado, uma para Endividamento e uma para o Dividendo. Cada etiqueta mostra um ponto colorido (verde = bom, amarelo = atenção) e uma frase curtíssima. Isso permite que qualquer pessoa veja o panorama geral em menos de três segundos, antes de mergulhar nos detalhes.

---

## 2. Cabeçalhos das seções melhorados

**Problema que existia:** Cada bloco de indicadores (Valuation, Rentabilidade, Resultado, Endividamento) tinha apenas o nome como título. Não havia como saber, sem abrir o bloco, qual era a conclusão rápida daquele grupo.

**O que foi feito:** Cada cabeçalho de seção ganhou dois elementos novos:
- Uma linha de descrição pequena explicando o que aquele grupo mede (ex: "Múltiplos de preço vs. fundamentos").
- Um indicador de saúde com ponto colorido e resumo do estado atual (ex: "Desconto vs. setor" para Valuation, ou "ROE 28,4% · ROIC 18,7%" para Rentabilidade).

Agora o usuário sabe o que vai encontrar em cada bloco antes de abrir.

---

## 3. Métricas mais importantes em destaque visual

**Problema que existia:** Todos os 16 indicadores tinham exatamente a mesma aparência. P/L, DY, ROE, Margem EBITDA, Lucro Líquido e Alavancagem — indicadores que resumem a saúde de um investimento — ficavam perdidos no meio dos outros.

**O que foi feito:** As seis métricas mais importantes de cada seção receberam um destaque visual sutil: uma linha dourada fina na borda esquerda da célula e um número ligeiramente maior. São elas: P/L e Dividend Yield (Valuation), ROE e Margem EBITDA (Rentabilidade), Lucro Líquido (Resultado) e Alavancagem DL/EBITDA (Endividamento). O restante das métricas continua visível, mas em segundo plano visual.

---

## 4. Etiquetas de tendência nos indicadores-chave

**Problema que existia:** O usuário via o valor atual de um indicador (ex: ROE 28,4%) mas precisava lembrar ou procurar o valor do ano anterior para entender se era uma evolução boa ou ruim.

**O que foi feito:** Abaixo de cada métrica em destaque, adicionamos uma pequena etiqueta colorida de tendência:
- Verde com seta para cima = melhorando ou acima do setor (ex: "▲ +16,6pp vs. setor" para Margem EBITDA)
- Vermelho com seta para baixo = piorando (ex: "▼ −2,8pp vs. 2023" para ROE, "▼ 3º ano consecutivo" para Lucro Líquido)
- Dourado neutro = estável ou com movimento pequeno (ex: "▲ +0,13x vs. 2023" para Alavancagem)

Com isso, o contexto de qualidade começa a aparecer sem que o usuário precise abrir o gráfico histórico.

---

## 5. Hierarquia visual das métricas melhorada

**Problema que existia:** Os rótulos dos indicadores (como "P/L", "ROE", "Margem EBITDA") eram exibidos em uma cor quase invisível, muito próxima ao fundo da tela. O valor numérico não se destacava o suficiente dos textos auxiliares.

**O que foi feito:** Os rótulos ficaram um pouco mais claros para melhorar a leitura. Os valores numéricos principais ficaram ligeiramente maiores e com espaçamento melhor, criando uma ordem visual clara: nome do indicador → valor → contexto (setor, ano anterior, tendência).

---

## 6. Barra de progresso e contador de palavras na análise

**Problema que existia:** O painel de escrita de análise tinha um comportamento oculto: a cada 5 linhas escritas, aparecia uma sugestão da IA. Mas o usuário não sabia disso. Era como se a IA aparecesse do nada.

**O que foi feito:** Adicionamos uma barra de progresso fina no rodapé da área de escrita. Ela começa vazia e vai enchendo conforme o usuário digita linhas. Quando chega a 100%, o insight da IA aparece e a barra reinicia. Também aparece um contador de palavras no canto. Agora o usuário entende a mecânica e sente que está "trabalhando em direção a algo" enquanto escreve.

---

## 7. Espaçamento e ritmo visual geral

**Problema que existia:** Os elementos da tela estavam muito próximos uns dos outros, com pouco "ar" entre eles. Em telas de análise profissional (como Bloomberg ou Morningstar), o espaçamento generoso é o que permite a leitura rápida sem cansaço visual.

**O que foi feito:** Aumentamos levemente o espaço interno das células de métricas, o padding lateral do conteúdo principal e a separação entre os blocos de seção. O resultado é uma tela que respira melhor sem perder densidade de informação.

---

## 8. Botão da barra lateral com mais presença

**Problema que existia:** O pequeno botão `‹` que abre a barra lateral de anotações ficava quase invisível na borda direita da tela. Muitos usuários podem não perceber que existe um painel de análise acessível por ali.

**O que foi feito:** O botão ficou ligeiramente maior, ganhou borda dourada sutil e cor dourada (ao invés de cinza). No hover (quando o cursor passa por cima), o fundo dourado fica mais evidente. Mantemos a discrição, mas agora ele "convida" mais.

---

## 9. Barra de rolagem mais refinada

**Problema que existia:** A barra de scroll lateral era de apenas 3px de largura, quase invisível mesmo para quem queria usá-la.

**O que foi feito:** A barra agora tem 4px, com cor dourada translúcida que escurece levemente ao passar o cursor. Pequeno detalhe, mas que reforça o padrão premium da interface.

---

## 10. Linha dourada sutil na navegação

**Problema que existia:** A barra de navegação superior era separada do conteúdo apenas por uma linha branca fina e neutra, sem identidade.

**O que foi feito:** Adicionamos um degradê dourado invisível na base da barra de navegação — uma linha que vai de transparente ao centro (onde aparece a cor dourada tênue) e volta a desaparecer. É uma microinteração de identidade que reforça o tom premium sem chamar atenção para si mesma.

---

## 11. Gráficos históricos com mais altura

**Problema que existia:** Os gráficos de histórico de cada métrica tinham apenas 120px de altura, o que tornava difícil identificar tendências com clareza.

**O que foi feito:** A altura dos gráficos foi aumentada para 148px. Não parece muito, mas a diferença na leitura visual das curvas e pontos de dados é significativa — especialmente em períodos longos (7+ anos).

---

## 12. Estado vazio das anotações mais útil

**Problema que existia:** Quando nenhuma anotação havia sido feita, aparecia a mensagem "Clique no ícone ✎ ao lado de qualquer métrica para anotar." A instrução era correta, mas não dizia o que fazer antes (passar o cursor sobre a métrica, porque o ícone só aparece no hover).

**O que foi feito:** O texto foi atualizado para "Passe o cursor sobre qualquer métrica e clique no ✎ para adicionar uma nota." — descrevendo o passo completo da ação.

---

## Resumo em uma frase

Antes, a tela mostrava muitos números com igual peso visual, sem guiar o olhar nem indicar o que era urgente. Agora, ela comunica contexto, direciona a atenção para o que importa e orienta o fluxo de análise — do panorama geral para o detalhe, de forma natural.
