# Sistema Proprietário de Análise de Investimentos
### Documento de Arquitetura e Funcionamento Completo

---

## 1. O que é esse sistema

Uma plataforma de análise de investimentos com interface visual no formato de planilha proprietária — com identidade visual própria, sem depender de Google Sheets, Excel ou qualquer ferramenta externa. O usuário visualiza dados financeiros organizados em células, blocos e seções temáticas, e interage com a plataforma através de um chat com IA para construir análises, modelos e projeções.

A diferença fundamental em relação a uma planilha tradicional: o usuário **não escreve fórmulas**. Ele descreve o que quer em linguagem natural. A IA interpreta o pedido, seleciona os skills que precisa consultar, escreve um script Python sob medida para aquela situação específica, e o resultado aparece diretamente nas células — com total transparência sobre cada decisão tomada.

O usuário pode editar valores de input diretamente na interface. Quando isso acontece, o sistema reexecuta o script já salvo automaticamente, propagando a mudança por todas as células dependentes sem intervenção manual e sem chamar a IA novamente.

---

## 2. Princípios fundamentais

### A IA executa, não sugere
Tudo que envolve cálculo, fórmula, estrutura de modelo ou projeção é executado pela IA. O usuário não copia e cola resultados do chat — o resultado aparece diretamente nas células da planilha.

### A IA gera o script, não escolhe entre scripts prontos
Não existem scripts pré-construídos no sistema. Para cada pedido, a IA escreve um script Python do zero, baseando-se no pedido do usuário, no estado atual da planilha e nos skills que ela mesma selecionou para aquela situação. O script é gerado sob medida e depois salvo pelo sistema para uso nos recálculos automáticos.

### A IA escolhe seus próprios skills autonomamente
Antes de executar qualquer coisa, a IA recebe um índice com todos os skills disponíveis — nome e descrição curta de cada um. Ela decide quais quer ler na íntegra, pode escolher quantos achar necessário, e só então parte para a execução. Nenhum skill é imposto pelo sistema — a IA determina o que precisa saber.

### Transparência total nas células calculadas
Cada célula preenchida pela IA armazena três camadas de informação, acessíveis ao usuário ao clicar:
- **Raciocínio** — a lógica por trás do número, as premissas aplicadas, os alertas relevantes
- **Script executado** — o código Python gerado pela IA para aquele cálculo específico
- **Mapa de células** — como os resultados do script foram distribuídos na planilha

Esse raciocínio existe **apenas em células calculadas**. Células de input não carregam raciocínio — não há decisão da IA sobre elas.

### Recálculo automático sem chamar a IA
Quando o usuário edita um input, o sistema reexecuta o script salvo com os novos valores. A IA não é chamada. O mapa de células salvo é reutilizado para saber onde escrever cada resultado. Tudo propaga automaticamente em cascata, na ordem correta.

---

## 3. Os dois tipos de célula

### Célula de Input
Contém um valor bruto — número, percentual ou texto. Inserida manualmente pelo usuário ou carregada automaticamente pela plataforma a partir dos dados financeiros da empresa selecionada.

- Editável diretamente pelo usuário na interface
- Não tem script vinculado
- Não tem raciocínio da IA
- Quando seu valor muda, o sistema dispara o recálculo em cascata de todas as células calculadas que dependem dela

**Exemplos:** Beta da empresa, taxa livre de risco (SELIC), crescimento estimado, número de ações em circulação, dívida bruta, caixa disponível, receita do último exercício.

### Célula Calculada
Contém um resultado produzido pela IA através de um script Python gerado sob demanda. O valor exibido é o output desse script.

- Bloqueada para edição manual pelo usuário
- Tem um script Python salvo e vinculado a ela
- Tem o mapa de células salvo — sabe de onde vêm seus inputs e para onde vai seu output
- Tem raciocínio, skills consultados e premissas armazenados — acessíveis ao clicar
- É recalculada automaticamente quando qualquer input do qual depende é alterado

**Exemplos:** WACC calculado, Ke (custo do equity), projeção de FCFF por ano, VP dos fluxos, Valor Terminal, Enterprise Value, Preço Justo por ação.

---

## 4. O sistema de skills

### O que é um skill
Um skill é um arquivo `.md` com instruções sobre como pensar e executar um tipo específico de análise financeira. Ele não contém código — contém raciocínio. Como estruturar o modelo, quais premissas considerar, quais armadilhas evitar, como interpretar os resultados, o que alertar o usuário.

Haverá vários skills, cada um cobrindo uma área ou modelo específico. Exemplos de skills: `dcf_dois_estagios.md`, `wacc_mercado_brasileiro.md`, `analise_de_margens.md`, `multiplos_comparaveis.md`, `monte_carlo_valuation.md`.

### Como a IA seleciona skills

A IA não recebe todos os skills de uma vez. Ela recebe primeiro um **índice** — uma lista com o nome e uma descrição curta de cada skill disponível. Com base no pedido do usuário e no contexto da planilha, a IA decide quais skills quer ler na íntegra. Pode escolher um, vários, ou nenhum.

```
ÍNDICE DE SKILLS DISPONÍVEIS:

- wacc_mercado_brasileiro.md
  Como calcular WACC para empresas brasileiras: CAPM, prêmio de risco local,
  beta alavancado, estrutura de capital, custo da dívida líquido de IR.

- dcf_dois_estagios.md
  Modelo de fluxo de caixa descontado com fase de alta expansão e transição
  gradual para crescimento perpétuo. Terminal value por Gordon e por múltiplo.

- analise_de_margens.md
  Interpretação de margem bruta, operacional e líquida. Tendências, red flags,
  comparação setorial e o que cada margem revela sobre o modelo de negócio.

- multiplos_comparaveis.md
  Peer analysis: quando usar EV/EBITDA, P/L e P/VPA. Ajuste por crescimento,
  normalização de múltiplos e como tratar outliers no grupo comparável.

[... demais skills ...]
```

Após ler os skills escolhidos, a IA tem o contexto necessário para escrever o script Python e registrar o raciocínio correto.

### Quando nenhum skill cobre o pedido
Se o pedido do usuário não for bem coberto por nenhum skill disponível, a IA executa com o melhor julgamento possível e registra explicitamente no raciocínio da célula que nenhum skill foi consultado para aquela análise — e por quê. Isso serve tanto como transparência para o usuário quanto como sinal para o desenvolvedor de que um novo skill pode ser necessário.

---

## 5. O que a IA gera e entrega

Quando a IA executa um pedido, ela entrega **três elementos juntos** em uma única resposta estruturada. O sistema não aceita resposta parcial — os três precisam estar presentes.

### Elemento 1 — O script Python
Gerado do zero para aquele pedido específico, considerando os dados disponíveis na planilha e as instruções dos skills consultados. O script sempre segue o mesmo contrato: recebe um dicionário de inputs e devolve um JSON com os resultados.

### Elemento 2 — O mapa de células
Um JSON separado que diz ao sistema exatamente onde cada campo do retorno do script deve ser escrito na planilha. A IA conhece o retorno do script porque ela mesma o gerou — então é ela quem define o mapa, não o sistema.

```json
{
  "mapa_celulas": {
    "wacc":               "B12",
    "ke":                 "B11",
    "beta_alavancado":    "B10",
    "vp_fluxos":          "C30",
    "vp_valor_terminal":  "C31",
    "enterprise_value":   "C33",
    "equity_value":       "C35",
    "preco_justo":        "C37",
    "projecoes":  {
      "tipo": "array_linhas",
      "inicio": "B20",
      "campos": ["ano", "estagio", "g", "fcff", "vp_fcff"]
    }
  }
}
```

O sistema salva esse mapa vinculado às células. No recálculo automático, o mesmo mapa é reutilizado para saber onde escrever os novos resultados.

### Elemento 3 — O raciocínio
O texto explicativo que ficará armazenado nas células calculadas e acessível ao usuário ao clicar. Inclui: a lógica da análise, os skills consultados, as premissas assumidas pelo que o usuário não especificou, e alertas sobre o resultado (ex: Valor Terminal representa 56% do EV — modelo altamente sensível ao crescimento perpétuo assumido).

---

## 6. O grafo de dependências e recálculo automático

### Por que o grafo existe
O grafo de dependências é o mecanismo que transforma a planilha em um modelo financeiro vivo. Quando o usuário altera um input, o sistema sabe exatamente quais células recalcular, em qual ordem, e com qual script — sem precisar da IA.

### O que a IA registra ao popular a planilha
Além dos três elementos acima, a IA registra as dependências de cada célula calculada:

```
celula_ke          depende de → [celula_beta, celula_selic, celula_premio_risco]
celula_wacc        depende de → [celula_ke, celula_custo_divida, celula_estrutura_capital]
celula_vp_fluxos   depende de → [celula_wacc, celula_fcf_base, celula_g1, celula_g2]
celula_ev          depende de → [celula_vp_fluxos, celula_vp_terminal]
celula_preco_justo depende de → [celula_ev, celula_divida, celula_caixa, celula_acoes]
```

Com esse mapa, o sistema sabe o que recalcular e em que ordem quando qualquer valor muda.

### Ordenação topológica — a ordem correta de execução
Quando múltiplas células precisam ser recalculadas em cascata, a ordem importa. Uma célula calculada só pode ser recalculada depois que todas as suas dependências já foram atualizadas.

O sistema resolve isso com ordenação topológica do grafo antes de executar qualquer recálculo. Se `celula_preco_justo` depende de `celula_ev`, que depende de `celula_vp_fluxos`, que depende de `celula_wacc` — o sistema sempre recalcula nessa sequência, independentemente de como as células aparecem visualmente na interface.

Construir sem esse controle de ordem resulta em bugs silenciosos onde células exibem valores calculados com dependências ainda desatualizadas. Isso precisa estar na arquitetura desde o início.

### Fluxo de recálculo quando o usuário edita um input

```
Usuário altera celula_beta (de 1.43 para 1.60)
        ↓
Sistema consulta o grafo: quem depende de celula_beta?
        ↓
Determina ordem topológica:
celula_ke → celula_wacc → celula_vp_fluxos → celula_ev → celula_preco_justo
        ↓
Reexecuta o script salvo de cada célula calculada, em ordem, com novos inputs
        ↓
Usa o mapa de células salvo para escrever cada resultado no lugar correto
        ↓
Interface reflete todos os novos valores instantaneamente
        ↓
Raciocínio armazenado permanece o mesmo — a lógica não mudou, só os valores
```

Nenhuma chamada à IA nesse fluxo.

---

## 7. O papel da IA no sistema

A IA tem três momentos de atuação. Fora desses momentos, ela não é chamada.

**Momento 1 — Seleção de skills:** recebe o índice, decide quais skills ler, lê os escolhidos na íntegra.

**Momento 2 — Geração e execução:** interpreta o pedido com o contexto dos skills, lê o estado atual da planilha, gera o script Python, entrega o script + mapa de células + raciocínio.

**Momento 3 — Novos pedidos:** quando o usuário pede uma análise nova, refaz a lógica de um bloco, ou pede algo que o modelo atual não cobre.

O recálculo automático por edição de input **não é um momento de atuação da IA**.

---

## 8. Fluxo completo de uma interação

```
1. Usuário digita no chat:
   "Monte um DCF de dois estágios com crescimento de 15% nos primeiros 5 anos
    e transição para 3% até o ano 10. Use os dados já carregados."

2. Sistema envia para a IA:
   → Pedido do usuário
   → Estado atual das células relevantes da planilha
   → Índice de skills disponíveis (nomes + descrições curtas)
   → Instrução de formato de resposta esperado

3. IA seleciona skills:
   → Lê o índice
   → Decide: preciso de dcf_dois_estagios.md e wacc_mercado_brasileiro.md
   → Sistema entrega os dois arquivos completos

4. IA gera e entrega os três elementos:
   → Script Python gerado sob medida para o pedido e os dados disponíveis
   → Mapa de células: onde cada campo do JSON de retorno será escrito
   → Raciocínio: lógica, premissas assumidas, skills consultados, alertas

5. Backend executa o script:
   → Roda o script Python com os inputs extraídos da planilha
   → Script calcula e devolve JSON com todos os resultados

6. Sistema popula a planilha:
   → Usa o mapa de células para escrever cada resultado no lugar correto
   → Salva o script, o mapa e o raciocínio vinculados às células calculadas
   → Registra o grafo de dependências
   → Determina e salva a ordem topológica para futuros recálculos

7. Interface atualiza:
   → Células calculadas exibem os novos valores
   → Células calculadas recebem indicador visual de raciocínio disponível
   → Chat exibe resumo curto com os alertas relevantes

8. Usuário inspeciona uma célula:
   → Clica em "Preço Justo por Ação"
   → Vê: raciocínio completo, skills consultados, script executado,
          inputs usados, output retornado, premissas assumidas, alertas
```

---

## 9. O que o usuário pode e não pode fazer

**O usuário pode:**
- Editar qualquer célula de input diretamente
- Pedir à IA que construa qualquer análise em linguagem natural
- Pedir que a IA refaça um bloco com nova lógica ou premissas diferentes
- Inspecionar o raciocínio, o script e o mapa de qualquer célula calculada
- Alterar inputs e ver os resultados propagarem automaticamente

**O usuário não pode:**
- Editar células calculadas diretamente
- Criar fórmulas manualmente na interface
- Alterar a estrutura de um modelo sem passar pelo chat
- Acessar ou modificar os scripts salvos diretamente

---

## 10. Top 40 — O que analistas fazem e como o sistema acomoda

### Nível Básico — Consulta, organização e indicadores diretos

Pedidos simples onde a IA pode gerar scripts curtos ou operar apenas com raciocínio e formatação. Skills de contexto financeiro geral são suficientes.

| # | O que o analista faz | Skill relevante | Complexidade do script gerado |
|---|----------------------|-----------------|-------------------------------|
| 1 | Tabela comparativa de indicadores entre empresas (P/L, EV/EBITDA, P/VPA, DY) | indicadores_valuation.md | Baixa — organização e formatação |
| 2 | Variação percentual de receita, lucro ou EBITDA entre períodos | interpretacao_crescimento.md | Baixa — aritmética simples |
| 3 | Tendência de margem bruta, operacional e líquida ao longo dos anos | analise_de_margens.md | Baixa — série histórica |
| 4 | CAGR de receita, lucro ou qualquer métrica em N anos | interpretacao_crescimento.md | Baixa — fórmula direta |
| 5 | Ajuste de valores por inflação (IPCA) ou conversão de moeda | contexto_macro_brasil.md | Baixa — indexação |
| 6 | Histórico de dividendos e payout ratio | politica_de_dividendos.md | Baixa — organização de dados |
| 7 | Yield on cost (dividendo sobre preço de compra histórico) | politica_de_dividendos.md | Baixa — cálculo direto |
| 8 | Quadro de endividamento: dívida bruta, líquida, Dívida/EBITDA, cobertura de juros | analise_de_alavancagem.md | Baixa — cálculos diretos |
| 9 | Retorno total de uma ação em um período (preço + dividendos) | indicadores_valuation.md | Baixa — cálculo direto |
| 10 | Comparação de indicadores da empresa com média do setor | multiplos_comparaveis.md | Baixa — tabela comparativa |
| 11 | Consistência entre DRE, Balanço e Fluxo de Caixa | demonstracoes_financeiras.md | Baixa — leitura cruzada |
| 12 | ROE, ROA e ROIC | retornos_sobre_capital.md | Baixa — fórmulas diretas |

---

### Nível Intermediário — Projeções, modelos e análises estruturadas

Pedidos que exigem scripts com múltiplas etapas, premissas e projeções encadeadas. A IA precisará de skills mais específicos e gerará scripts de média complexidade.

| # | O que o analista faz | Skills relevantes | Complexidade do script gerado |
|---|----------------------|-------------------|-------------------------------|
| 13 | Projeção de DRE simplificada para 3 a 5 anos | projecao_dre.md | Média — projeção encadeada |
| 14 | Projeção de EBITDA com sensibilidade a volume e preço | projecao_ebitda.md | Média — análise de sensibilidade |
| 15 | WACC (custo médio ponderado de capital) | wacc_mercado_brasileiro.md | Média — CAPM + estrutura de capital |
| 16 | Peer analysis com múltiplos comparáveis e ajuste de crescimento | multiplos_comparaveis.md | Média — normalização e tabela |
| 17 | DCF simplificado de um estágio | dcf_simples.md | Média — projeção + desconto |
| 18 | Preço Justo pelo modelo de Gordon (DDM) | politica_de_dividendos.md | Média — Gordon Growth Model |
| 19 | Análise DuPont de três ou cinco fatores | retornos_sobre_capital.md | Média — decomposição de ROE |
| 20 | FCFE e FCFF projetados | fcf_livre.md | Média — bridge do resultado ao caixa |
| 21 | Análise de cenários (base, otimista, pessimista) | modelagem_de_cenarios.md | Média — variação paramétrica |
| 22 | Break-even operacional e financeiro | estrutura_de_custos.md | Média — custos fixos vs variáveis |
| 23 | Ciclo de conversão de caixa (PMR, PMP, PME) | capital_de_giro.md | Média — ciclo operacional |
| 24 | Alavancagem operacional e financeira (DOL e DFL) | analise_de_alavancagem.md | Média — elasticidade de resultado |
| 25 | Necessidade de capital de giro (NCG) projetada | capital_de_giro.md | Média — projeção de NCG |
| 26 | Ponte de EBITDA para Fluxo de Caixa Livre | fcf_livre.md | Média — bridge multi-etapas |
| 27 | Enterprise Value e suas variações | enterprise_value.md | Média — componentes do EV |

---

### Nível Avançado — Modelagem complexa, estatística e estruturas sofisticadas

Pedidos que exigem scripts com bibliotecas científicas, simulações ou estruturas financeiras sofisticadas. A IA consultará múltiplos skills e gerará scripts de alta complexidade.

| # | O que o analista faz | Skills relevantes | Complexidade do script gerado |
|---|----------------------|-------------------|-------------------------------|
| 28 | DCF de dois estágios com terminal value por múltiplo e perpetuidade | dcf_dois_estagios.md + wacc_mercado_brasileiro.md | Alta — dois métodos de TV, reconciliação |
| 29 | Modelo LBO simplificado | lbo.md | Alta — estrutura de dívida + retorno ao equity |
| 30 | TIR e VPL com fluxos irregulares | tir_vpl_avancado.md | Alta — múltiplas inversões de sinal |
| 31 | Regressão linear entre variáveis financeiras ou macro | estatistica_financeira.md | Alta — regressão com R² e p-valor |
| 32 | Beta por regressão e beta desalavancado/realavancado | beta_e_risco.md + wacc_mercado_brasileiro.md | Alta — regressão + ajuste de estrutura de capital |
| 33 | Monte Carlo para distribuição de valor | monte_carlo_valuation.md | Alta — simulação com N iterações |
| 34 | Soma das partes (SOTP) para conglomerados | sotp.md | Alta — valuation por segmento + holding discount |
| 35 | Valor em Risco (VaR) de uma carteira | risco_de_carteira.md | Alta — VaR histórico ou paramétrico |
| 36 | Otimização de carteira pela fronteira eficiente (Markowitz) | risco_de_carteira.md + estatistica_financeira.md | Alta — otimização com covariância |
| 37 | Sharpe Ratio, Sortino Ratio e métricas de risco-retorno | risco_de_carteira.md | Alta — métricas ajustadas ao risco |
| 38 | Análise de crédito com score e probabilidade de default | analise_de_credito.md | Alta — Altman Z-Score e indicadores de cobertura |
| 39 | Precificação de opções (Black-Scholes) | derivativos_basico.md | Alta — modelo estocástico |
| 40 | Alocação de capital com ROIIC e EVA | retornos_sobre_capital.md + estrutura_de_custos.md | Alta — valor econômico vs. lucro contábil |

---

## 11. Próximos documentos a construir

Com essa arquitetura definida, a sequência natural de construção é:

**Skills individuais** — começar pelos skills que cobrem os itens 1 a 15, que representam a grande maioria dos casos de uso reais. Cada skill deve conter: como pensar o modelo, premissas padrão para o mercado brasileiro, armadilhas comuns, o que alertar o usuário e como interpretar os resultados.

**Índice de skills** — o arquivo de índice que a IA recebe primeiro, com nome e descrição curta de cada skill. A qualidade desse índice determina se a IA vai selecionar os skills certos.

**Schema de resposta da IA** — o formato exato que a IA deve seguir ao entregar script + mapa de células + raciocínio. Precisa ser rígido o suficiente para o sistema processar de forma confiável, mas flexível para acomodar diferentes tipos de análise.

**Mapeamento de células por modelo** — definir quais células existem em cada modelo (DCF, DRE projetada, múltiplos, etc.), quais são inputs e quais são calculadas, e como o grafo de dependências se estrutura em cada caso.

**Regras de apresentação visual** — hierarquia de seções na interface, diferenciação visual entre células de input e calculadas, indicador de raciocínio disponível, e como arrays de projeção (como anos do DCF) se expandem na planilha.