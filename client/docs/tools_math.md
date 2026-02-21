Excelente iniciativa. Para construir um sistema escalável, não podemos ter uma tool para cada um dos 40 casos de uso. Isso geraria redundância e dificuldade de manutenção.

A arquitetura correta exige **tools modulares e combináveis** (primitivas financeiras). Por exemplo, a tool de regressão linear (Nível Avançado) calcula o Beta, que serve de input para a tool de WACC (Nível Intermediário), que serve de input para o DCF (Nível Avançado).

Abaixo, apresento a especificação técnica no formato `.md` de um subconjunto representativo e fundamental dessas tools para os três níveis, estabelecendo o padrão exato que sua equipe de engenharia deve seguir para implementar o restante.

---

# Blueprint Arquitetural: Tools Financeiras para IA

Este documento especifica os contratos de interface (Schemas) e regras de negócio para as tools consumidas pela IA na construção da planilha proprietária.

## Princípios Globais do Grafo de Dependências

Todas as tools seguem uma regra estrita de integração com o DAG (Directed Acyclic Graph) do sistema:

1. **Inputs como Referências:** Sempre que um input for uma variável dinâmica, a IA passará o ID da célula (ex: `"ref:C10"`) em vez do valor hardcoded (ex: `15.5`).
2. **Resolução de Dependências:** O backend da tool resolve `"ref:C10"` para o valor numérico antes do cálculo.
3. **Retorno Padronizado:** O output de toda tool retorna um array `dependencies` listando todas as referências utilizadas, alimentando automaticamente o motor de recálculo da planilha.

---

# Nível Básico

Tools focadas em matemática financeira direta e formatação de séries temporais. Nenhuma modelagem encadeada.

## 1. Nome da Tool: `calc_cagr`

### 2. Finalidade

* **Casos (Top 40):** #4.
* **Problema:** Calcula a Taxa de Crescimento Anual Composta de qualquer métrica (Receita, Lucro, etc.) evitando distorções de médias aritméticas em séries temporais.

### 3. Tipo de Tool

* Cálculo matemático simples.

### 4. Inputs esperados (Schema)

```json
{
  "valor_inicial": { "type": ["number", "string"], "required": true, "description": "Valor numérico ou referência de célula (ex: 'ref:B2')" },
  "valor_final": { "type": ["number", "string"], "required": true, "description": "Valor numérico ou referência de célula (ex: 'ref:F2')" },
  "periodos": { "type": ["integer", "string"], "required": true, "description": "Número de anos/períodos entre o valor inicial e final." }
}

```

### 5. Output esperado (Schema)

```json
{
  "value": "number", // Resultado decimal (ex: 0.155 para 15.5%)
  "metadata": {
    "dependencies": ["string"], // Ex: ["B2", "F2"]
    "formula_string": "((valor_final / valor_inicial) ^ (1 / periodos)) - 1"
  }
}

```

### 6. Relação com o Grafo de Dependências

Se `valor_inicial` for `"ref:B2"` e `valor_final` for `"ref:F2"`, a tool mapeia `["B2", "F2"]` no array de dependências. Se o usuário alterar `B2` manualmente, o motor topológico ignora a IA e reexecuta a `formula_string` com o novo valor de `B2`.

### 7. Nível de Ativação

* **Básico.** Carregada sempre que o usuário pede "qual o crescimento histórico", "qual a taxa média", etc.

### 8. Regras de Validação

* `valor_inicial` não pode ser nulo ou zero (Erro: "Divisão por zero ao calcular CAGR").
* Se `valor_inicial` for negativo e `valor_final` positivo, a tool deve retornar um erro estruturado (CAGR clássico falha com inversão de sinal).

### 9. Precisão Numérica

* Floating point calculation. Retornar em decimal bruto (até 6 casas decimais). A interface (frontend) cuida da formatação para porcentagem.

### 10. Observações Arquiteturais

* Altamente reaproveitável. Pode ser chamada internamente pela tool de DCF para calcular taxas de crescimento implícitas.

---

# Nível Intermediário

Tools focadas em agregação, projeção linear e modelos teóricos consolidados.

## 2. Nome da Tool: `calc_wacc`

### 2. Finalidade

* **Casos (Top 40):** #15, #17, #28.
* **Problema:** Calcula o Custo Médio Ponderado de Capital para uso como taxa de desconto em modelos de valuation.

### 3. Tipo de Tool

* Engine de cálculo financeiro composto.

### 4. Inputs esperados (Schema)

```json
{
  "cost_of_equity": { "type": ["number", "string"], "required": true },
  "cost_of_debt": { "type": ["number", "string"], "required": true },
  "tax_rate": { "type": ["number", "string"], "required": true },
  "equity_value": { "type": ["number", "string"], "required": true },
  "debt_value": { "type": ["number", "string"], "required": true }
}

```

### 5. Output esperado (Schema)

```json
{
  "value": "number",
  "metadata": {
    "dependencies": ["string"],
    "weights": {
      "equity_weight": "number",
      "debt_weight": "number"
    },
    "formula_string": "(cost_of_equity * equity_weight) + (cost_of_debt * debt_weight * (1 - tax_rate))"
  }
}

```

### 6. Relação com o Grafo de Dependências

Esta tool recebe múltiplos inputs que geralmente são dependências de outras células (ex: `cost_of_equity` pode vir da tool `calc_capm`). O grafo registra todas essas conexões. A alteração da alíquota de imposto (`tax_rate`) na planilha disparará o recálculo do WACC instantaneamente.

### 7. Nível de Ativação

* **Intermediário.** Ativada quando detectado contexto de Valuation, DCF, Custo de Capital ou Análise de Viabilidade.

### 8. Regras de Validação

* `equity_value` e `debt_value` devem ser `>= 0`. Se ambos forem zero, Erro: "Estrutura de capital inválida".
* `tax_rate` deve estar no intervalo `[0, 1]`.

### 9. Precisão Numérica

* Output em decimal até 8 casas para evitar erros de arredondamento quando repassado ao DCF.

### 10. Observações Arquiteturais

* O cálculo do Ke (Cost of Equity) e Kd (Cost of Debt) NÃO deve ser feito dentro desta tool. Eles devem ter suas próprias tools (ex: `calc_capm`). Isso garante modularidade (Princípio da Responsabilidade Única).

---

# Nível Avançado

Tools que exigem iterações, estatística, ou resolução de matrizes.

## 3. Nome da Tool: `calc_dcf_engine`

### 2. Finalidade

* **Casos (Top 40):** #17, #28, #30 (indiretamente).
* **Problema:** Desconta uma matriz de fluxos de caixa futuros a valor presente e soma com o valor terminal para encontrar o Enterprise Value.

### 3. Tipo de Tool

* Motor de agregação de matrizes (Time-value-of-money engine).

### 4. Inputs esperados (Schema)

```json
{
  "free_cash_flows": { 
    "type": "array", 
    "items": { "type": ["number", "string"] }, 
    "required": true,
    "description": "Array ordenado dos fluxos de caixa projetados, ou referências de células."
  },
  "discount_rate": { "type": ["number", "string"], "required": true },
  "terminal_value": { "type": ["number", "string"], "required": true }
}

```

### 5. Output esperado (Schema)

```json
{
  "enterprise_value": "number",
  "present_value_of_fcfs": "array",
  "present_value_of_tv": "number",
  "metadata": {
    "dependencies": ["string"], // Inclui a array inteira de FCFs, a taxa e o TV
    "assumptions_logged": "Desconto feito assumindo fluxos no final do período (End of Period)."
  }
}

```

### 6. Relação com o Grafo de Dependências

A array de `free_cash_flows` mapeia para N células diferentes (ex: `["ref:D10", "ref:E10", "ref:F10"]`). O motor de recálculo precisa assinar eventos de atualização em **qualquer uma** dessas células. Se o fluxo do ano 3 mudar, a tool deve reprocessar o array.

### 7. Nível de Ativação

* **Avançado.** Carregada estritamente em pedidos de precificação justa, DCF completo ou análise de M&A.

### 8. Regras de Validação

* `free_cash_flows` não pode ser vazio.
* `discount_rate` deve ser `> 0` para evitar inconsistências matemáticas no fator de desconto `(1+r)^n`.

### 9. Precisão Numérica

* Inputs geralmente em "Milhões" ou "Bilhares". A tool deve processar os números na escala bruta enviada e retornar na mesma escala.

### 10. Observações Arquiteturais

* **Separação de Preocupações:** Note que a tool de DCF não calcula o Valor Terminal. O Valor Terminal deve ser calculado por outra tool (`calc_terminal_value_gordon` ou `calc_terminal_value_multiple`) e injetado aqui. Isso permite que o usuário troque a metodologia do Valor Terminal na interface sem quebrar o motor do DCF.

---

### Próximo Passo Sugerido

Este é o padrão ouro para a construção das tools da sua plataforma. Com essa estrutura, a IA não precisa "pensar" na matemática, apenas orquestrar quais ferramentas chamar e conectar as células (`ref:ID`) corretamente.

Gostaria que eu gerasse os schemas para o **Motor de Projeção Linear (DRE/EBITDA)** ou para o **Motor de Regressão Estatística (Cálculo de Beta)** usando esse mesmo nível de rigor arquitetural?