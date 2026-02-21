
Quero que você analise detalhadamente o arquivo teste_9.html e gere um documento .md com a documentação completa da página.

# Frontend Documentation Generator

Você vai analisar um arquivo HTML de frontend e gerar uma documentação completa em `.md`. O objetivo é registrar com precisão tudo o que existe hoje na página — sem inventar, sem resumir demais, sem inferir funcionalidades que não estão lá.

Essa documentação será usada posteriormente para guiar a integração com backend, banco de dados e APIs externas.

---

## Fluxo de Execução

1. Leia o arquivo HTML completo — incluindo HTML, CSS e JavaScript
2. Mapeie cada seção, componente, dado fixo e comportamento implementado
3. Gere o arquivo `.md` seguindo rigorosamente a estrutura abaixo
4. Salve o arquivo como `docs_frontend.md`

Execute tudo imediatamente. Não faça perguntas, não aguarde confirmação.

---

## Estrutura Obrigatória do Documento

Use exatamente estes títulos e esta ordem:

---

### 1. Visão Geral da Página
Descreva:
- Qual é a proposta da página e o problema que ela resolve
- Como está organizada visualmente (ex: navbar fixa, conteúdo central, sidebar lateral)
- Qual é o estado atual: apenas frontend, dados mockados, sem backend

---

### 2. Estrutura de Layout
Mapeie a estrutura visual da página:
- Header/navbar (se existir): o que contém, como está posicionado
- Seções principais: liste cada bloco principal da página com seu título e função
- Cards e grids: descreva como os elementos são agrupados visualmente
- Sidebar ou painéis laterais: se existirem, descreva seu conteúdo e comportamento
- Hierarquia visual: o que aparece primeiro, segundo, terceiro para o usuário

---

### 3. Componentes Existentes
Para **cada componente** da página, crie uma entrada com:

```
**Nome:** [nome descritivo do componente]
**O que exibe:** [o que o usuário vê]
**Dados:** [fixos no HTML / fixos no JS / mockados]
**Estrutura HTML:** [descreva brevemente como está montado]
**Estados possíveis:** [se tiver hover, aberto/fechado, visível/oculto, etc.]
```

Não pule componentes. Documente todos, mesmo os menores.

---

### 4. Dados Estáticos Atuais
Liste todos os valores fixos presentes na página. Para cada um informe:

```
**Dado:** [ex: preço da ação, P/L, nome da empresa]
**Valor atual:** [ex: R$ 38,42]
**Onde está:** [ex: hardcoded no HTML / declarado em variável JS]
**Contexto:** [em qual componente ou seção aparece]
```

---

### 5. Comportamentos Implementados
Liste todas as interações que funcionam de verdade na página. Para cada uma:

```
**Interação:** [ex: clicar em "Mostrar gráfico"]
**O que acontece:** [ex: expande uma área com gráfico SVG]
**Como está implementado:** [ex: função JS toggleChart(), manipula classes CSS]
**É real ou apenas visual?:** [real = funciona / visual = aparência sem lógica]
```

Inclua: cliques, hovers, modais, abas, filtros, cálculos, animações, localStorage, etc.

---

### 6. Pontos que Precisam ser Dinamizados
Esta é a seção mais importante para a próxima etapa. Para cada parte estática da página, descreva:

```
**Elemento:** [nome do componente ou dado]
**Situação atual:** [o que está fixo hoje]
**O que precisará vir do backend:** [ex: endpoint que retorna dados do ativo]
**O que precisará vir do banco de dados:** [ex: anotações salvas pelo usuário]
**O que precisará vir de API externa:** [ex: API de dados financeiros para P/L, DY, etc.]
**Observações:** [regras de negócio, validações, casos especiais]
```

---

## Regras de Ouro

- **Não invente.** Documente apenas o que realmente existe no arquivo.
- **Não resuma demais.** Se um componente tem 4 estados, descreva os 4.
- **Não infira.** Se um botão não tem lógica implementada, diga que é apenas visual.
- **Linguagem clara.** Escreva de forma que um desenvolvedor backend consiga entender sem ter visto o HTML.
- **Seja específico.** Em vez de "há um gráfico", escreva "há um gráfico SVG gerado por JavaScript com dados anuais mockados, filtrável por período (1T, 2T, 3T, 4T) e por ano".

---

## Exemplo de Entrada e Saída Esperada

**Entrada:** arquivo `teste_9.html` com dashboard de análise fundamentalista de ações

**Saída esperada:** arquivo `docs_frontend.md` com:
- Visão geral explicando que é um painel de análise de ações brasileiras com dados mockados
- Layout mapeado: navbar fixa + conteúdo central + sidebar deslizante
- Todos os componentes documentados: células de métricas, gráficos SVG, calculadora de valuation, modais informativos, painel de notas
- Dados estáticos listados: ticker, preço, P/L, DY, ROE, etc. com seus valores e onde estão declarados
- Comportamentos reais identificados: toggle de seções, gráficos interativos, calculadora de preço justo, anotações inline
- Mapa completo de dinamização: o que vem de API de dados financeiros, o que vem do banco, o que vem do backend próprio

---

## Sinais de Boa Execução

- O documento cobre 100% dos componentes visíveis na página
- Nenhum dado fixo ficou sem ser listado na seção 4
- A seção 6 tem uma entrada para cada elemento que precisará de integração
- Um desenvolvedor backend consegue ler o `.md` e entender o que precisa construir sem abrir o HTML