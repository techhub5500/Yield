# Sistema de Multi-Agente
## Arquitetura Aprimorada v2.0 - Completa

---

## PONTO  IMPORTANTE:
Os agentes precisam ser capazes de interagir com sistemas externos sem encerrar o fluxo de execução.
Por exemplo:
Quando o agente júnior precisa utilizar o Financial Bridge, ele deve executar uma ação que ative o Financial Bridge e já envie a solicitação necessária.
Em seguida, o agente júnior deve aguardar a resposta, mantendo seu estado e contexto.
Após alguns segundos, quando o Financial Bridge retornar os dados, o agente júnior deve retomar o fluxo normalmente, dando continuidade à tarefa.

O objetivo é que o sistema funcione de forma contínua. Sempre que for necessário utilizar um sistema ou ferramenta externa, o agente deve ser capaz de ativá-la, aguardar o retorno preservando sua memória e, quando a resposta chegar, continuar o fluxo para executar a próxima tarefa, sem perda de contexto."

## 🧠 1. Sistema de Memória Contextual

### 1.1 Identificação e Carregamento

**🔧 LÓGICA PURA:**
- Verificar se o chat possui ID existente no banco
- Se existir → carregar memória armazenada
- Se não existir → inicializar contexto vazio

### 1.2 Estrutura Simples de Memória

**Memória Recente:**
- **🔧 LÓGICA:** Manter últimos 2 ciclos completos em array
- **🔧 LÓGICA:** Acesso direto sem processamento

**Memória Antiga:**
- **🔧 LÓGICA:** Identificar ciclos anteriores aos 2 mais recentes
- **🤖 IA (GPT-5-nano):** 
  - Recebe: ciclo completo (input do usuário + resposta da IA)
  - Tarefa: Resumir preservando valores numéricos, datas, decisões importantes e contexto essencial
  - Retorna: Resumo estruturado do ciclo
  - **Justificativa do modelo:** Tarefa simples e repetitiva, alto volume, baixo custo de erro

**⚠️ IMPORTANTE:** A memória é atualizada a cada ciclo COMPLETO (usuário enviou + IA respondeu), não a cada mensagem individual.

### 1.3 Gestão de Volume

**Controle de Tamanho:**

**🔧 LÓGICA PURA:**
- Contar palavras da memória total
- Verificar se atingiu 90% do limite (2.250 de 2.500 palavras)
- Se atingiu → acionar compressão

**🤖 IA (GPT-5.2 - Reasoning: High, Verbosity: Low):**
- Recebe: Todos os resumos antigos + instrução de compressão
- Tarefa: Comprimir resumos mantendo informações críticas:
  - Metas financeiras do usuário
  - Limites e alertas configurados
  - Preferências declaradas
  - Decisões importantes tomadas
- Meta: Reduzir para aproximadamente 1.000 palavras (40% do limite)
- Retorna: Memória comprimida
- **Justificativa do modelo:** Decisão crítica (o que preservar/descartar), alto custo de erro (perder contexto importante), exige avaliação de trade-offs

**🔧 LÓGICA:** Substituir resumos antigos pela versão comprimida

---

## 🔀 2. Sistema de Roteamento Inteligente (Smart Router)

### 2.1 Agente Junior (First Responder)

**Entrada:**
- Memória completa
- Query atual do usuário

**🤖 IA (GPT-5-ini - Reasoning: Medium, Verbosity: Low):**

**Recebe:**
- Memória completa
- Query do usuário
- Descrição simplificada das ferramentas disponíveis:
  - FinanceBridge (buscar e inserir dados financeiros)
  - Serper (pesquisar na internet)
  - Orquestrador (tarefas complexas ou multi-tarefa)

**Tarefa: Analisar e classificar a query**

**Justificativa do modelo:** Exige raciocínio (analisar contexto, detectar ambiguidade), mas é local e bem definido. Não é decisão estratégica global.

**Retorna JSON:**
```json
{
  "decision": "bridge_query | bridge_insert | serper | escalate",
  "reasoning": "Explicação da decisão",
  "missing_info": ["campo1", "campo2"], // se aplicável
  "needs_followup": true/false,
  "followup_question": "Pergunta ao usuário" // se needs_followup = true
}
```

**Tipos de Decisão:**

1. **bridge_query**: Consultas diretas aos dados financeiros
   - Exemplo: "Quanto gastei ontem?"
   
2. **bridge_insert**: Lançamento de transações
   - Exemplo: "Gastei R$50 no almoço"
   - **⚠️ VALIDAÇÃO DE COMPLETUDE:**
     - **🤖 IA verifica:** Se a query tem todas as informações necessárias (valor, categoria/descrição)
     - Se incompleto → needs_followup = true
     - Exemplo: "Gastei 200" → falta categoria → retorna "Você gastou R$ 200,00 em quê?"

3. **serper**: Busca externa na internet
   - Exemplo: "Qual a taxa Selic atual?"

4. **escalate**: Escalar para o Orquestrador
   - Exemplo: "Analise meus investimentos e sugira ajustes no orçamento"

**🔧 LÓGICA PURA (após decisão da IA):**
```javascript
if (decision === "bridge_query") {
  // Enviar para Finance Bridge (query)
}
else if (decision === "bridge_insert") {
  // Enviar para Finance Bridge (insert)
}
else if (decision === "serper") {
  // Chamar API Serper
}
else if (decision === "escalate") {
  // Enviar para Orquestrador
}
```

### 2.2 Sistema de Follow-up Contextual

**🤖 IA (Junior):**
Quando detecta informação faltante:
- Analisa memória recente para inferir contexto
- Exemplo: Se 2 mensagens atrás o usuário falou "fui no Carrefour", pode sugerir categoria "Supermercado"
- Faz pergunta contextualizada ao usuário

**🔧 LÓGICA:**
- Adiciona o follow-up à memória com marcador especial de "continuação de contexto"
- Quando receber resposta, concatena com mensagem anterior antes de processar

### 2.3 Regras de Envio de Memória

**🔧 LÓGICA PURA (Roteamento de dados):**

**Para Junior (Execução Direta):**
- Bridge/Serper: Enviar memória COMPLETA
- Lançamento (insert): Memória NÃO enviada

**Para Orquestrador (Escalada):**
- Enviar memória COMPLETA
- Enviar query atual

---

## 🏛️ 3. Camada de Orquestração (Orchestration Layer)

### 3.1 Agente Orquestrador (Strategic Brain)

**🤖 IA (GPT-5.2 - Reasoning: High, Verbosity: Low):**

**Recebe:**
- Memória completa
- Query do usuário
- **Contratos dos Agentes Coordenadores** (documento descrevendo função de cada um)
  {em "server\docs\md\diferenças_coor.md" tem um docuemnto md que diz sobre as diferenças de cada agente coordenador, é imporesindivel analisar eles para fazer os contratos deles}

**Justificativa do modelo:** Coordenação de múltiplos agentes, planejamento em múltiplas etapas, decisão estratégica global, alto custo de erro

**Contratos dos Agentes:**
```
Agente de Análise:
- Especialista em análise de padrões financeiros
- Ferramentas: Finance Bridge, Serper, Tavily, Módulo Matemático
- Entregas: Relatórios analíticos, identificação de tendências, comparações

Agente de Investimentos:
- Especialista em análise de investimentos e mercado
- Ferramentas: Brapi, Finance Bridge, Serper, Tavily, Módulo Matemático
- Entregas: Análise de ativos, sugestões de alocação, avaliação de risco

Agente de Planejamento:
- Especialista em planejamento financeiro e orçamento
- Ferramentas: Finance Bridge, Serper, Módulo Matemático
- Entregas: Planos de ação, orçamentos, roadmaps financeiros
```

**Processo de Raciocínio (Chain of Thought):**

**ETAPA 1 - DECOMPOSIÇÃO:**
- **🤖 IA analisa:** Quais áreas estão envolvidas na solicitação?
  - Precisa de análise de padrões? → Agente de Análise
  - Envolve investimentos ou mercado? → Agente de Investimentos
  - Requer planejamento de metas/orçamento? → Agente de Planejamento

**ETAPA 2 - DEPENDÊNCIAS:**
- **🤖 IA identifica:** Existe ordem de execução necessária?
  - Alguma tarefa precisa ser feita antes de outra?
  - Há dados que um agente produz e outro consome?
  - Exemplo: Análise deve vir antes do Planejamento?

**ETAPA 3 - MEMORIZAÇÃO:**
- **🤖 IA seleciona:** O que da memória é essencial para cada agente?
  - Filtra informações relevantes por agente
  - Marca como "contexto de memória"

**ETAPA 4 - PRIORIZAÇÃO:**
- **🤖 IA define:** Estratégia de execução
  - Ordem lógica das tarefas
  - Quais podem ser executadas em paralelo
  - Prioridades (1, 2, 3...)

**Saída: DOC (Documento de Direção)**

**🤖 IA gera estrutura:**
```json
{
  "request_id": "uuid",
  "original_query": "query do usuário",
  "reasoning": "Raciocínio completo do orquestrador",
  
  "execution_plan": {
    "agents": [
      {
        "agent": "analysis",
        "priority": 1,
        "task_description": "Analisar padrão de gastos dos últimos 3 meses",
        "expected_output": "Relatório com categorias e tendências",
        "memory_context": "Memória filtrada relevante",
        "dependencies": []
      },
      {
        "agent": "planning",
        "priority": 2,
        "task_description": "Sugerir ajustes no orçamento com base na análise",
        "expected_output": "Plano de ação estruturado",
        "memory_context": "Memória filtrada relevante",
        "dependencies": ["analysis"]
      }
    ]
  }
}
```

### 3.2 Sistema de Controle de Dependências

**🔧 LÓGICA PURA:**
- Ler campo "dependencies" de cada agente
- Criar fila de execução respeitando prioridades
- Aguardar conclusão do agente dependente antes de iniciar próximo
- Passar output do agente anterior como input adicional quando há dependência

**Fluxo:**
```javascript
// Lógica de controle
for (agent in execution_plan.agents.sortBy('priority')) {
  if (agent.dependencies.length > 0) {
    // Esperar dependências serem concluídas
    await waitForDependencies(agent.dependencies);
    // Adicionar outputs das dependências ao input do agente
    agent.additional_input = getOutputsFrom(agent.dependencies);
  }
  
  // Executar agente
  result = await executeAgent(agent);
  storeResult(agent.id, result);
}
```

---

## 🛠️ 4. Toolkit dos Agentes (Ferramentas Especializadas)

### 4.1 Finance Bridge (Database Interface)

**Banco de Dados:** MongoDB

O Finance Bridge é um middleware de comunicação estruturada que permite operações financeiras através de protocolo JSON.

#### 4.1.1 Para CONSULTAS (Query)

**🤖 IA (GPT-5-nano):**

**Recebe:**
- Query em linguagem natural do agente
  - Exemplo: "Busque gastos de alimentação entre R$ 120 e R$ 145 nos últimos 6 dias, mas ignore 'Restaurantes', ordene pelos 10 mais recentes"
- Schema completo do Finance Bridge (todos os campos e operações possíveis)

**Tarefa:** Converter para JSON estruturado

**Justificativa do modelo:** Conversão de formato (NL → JSON), tarefa simples e repetitiva, pode ser descrita quase como regras, alto volume, baixo custo

**Retorna:**
```json
{
  "operation": "query",
  "params": {
    "filters": {
      "period": {
        "named_period": "last_6_days"
      },
      "amount": {
        "min": 120.00,
        "max": 145.00
      },
      "categories": ["alimentação"]
    },
    "logic": "NOT",
    "exclude": {
      "tags": ["restaurante"]
    },
    "sort": {
      "field": "date",
      "order": "desc"
    },
    "limit": 10
  },
  "context": {
    "user_timezone": "America/Sao_Paulo",
    "currency": "BRL"
  }
}
```

**🔧 LÓGICA PURA:**
- Validar estrutura do JSON (campos obrigatórios presentes)
- Validar tipos de dados (numbers são numbers, dates são válidas)
- Executar query no MongoDB
- Retornar dados diretamente ao agente solicitante (SEM passar pela IA novamente)

#### 4.1.2 Para LANÇAMENTOS (Insert)

**Fluxo Otimizado de Tokens:**

**PASSO 1 - Identificação de Tipo**
**🤖 IA (GPT-5-nano):**
- Recebe: Query do Junior ("Lançar compra de R$ 150,00 no supermercado")
- Identifica: É receita ou despesa?
- Retorna: "expense" ou "income"
- **Justificativa do modelo:** Classificação binária simples, repetitiva, alto volume

**🔧 LÓGICA:**
- Carregar arquivo JSON correspondente:
  - `server/docs/jsons/lançamentos/despesas.json` OU
  - `server/docs/jsons/lançamentos/receitas.json`
- Extrair apenas lista de CATEGORIAS (sem subcategorias)
- Enviar para IA

**PASSO 2 - Seleção de Categoria**
**🤖 IA (GPT-5-mini - Reasoning: Medium, Verbosity: Low):**
- Recebe: Lista de categorias + query
- Analisa contexto (exemplo: "Uber Eats" é alimentação, não transporte)
- Retorna: Categoria escolhida
- **Justificativa do modelo:** Exige raciocínio contextual (casos ambíguos), mas escopo bem definido, não é decisão global

**🔧 LÓGICA:**
- Buscar subcategorias da categoria escolhida no JSON
- Enviar subcategorias para IA

**PASSO 3 - Montagem Final**
**🤖 IA (GPT-5-nano):**
- Recebe: Subcategorias + query completa
- Seleciona subcategoria apropriada
- Extrai demais informações (valor, data, descrição, etc.)
- Monta JSON de lançamento
- **Justificativa do modelo:** Extração de dados + formatação JSON, tarefa direta, alto volume:

```json
{
  "operation": "insert",
  "params": {
    "amount": 150.00,
    "date": "2026-02-05",
    "category": "Alimentação",
    "subcategory": "Supermercado",
    "description": "Compra no supermercado",
    "payment_method": "credit_card",
    "status": "completed"
  }
}
```

**🔧 LÓGICA:**
- Validar JSON (campos obrigatórios: amount, date, category)
- Validar tipos e ranges (amount > 0, data não é futura em despesas normais)
- Executar insert no MongoDB
- Retornar sucesso/erro ao Junior

**Estrutura dos Arquivos:**
- Localização: `server/docs/jsons/lançamentos/`
- Arquivos: 
  - `despesas.json` - Categorias e subcategorias de despesas
  - `receitas.json` - Categorias e subcategorias de receitas

#### 4.1.3 Estrutura Base de Requisição (Todas Operações)

```json
{
  "operation": "query | insert | update | delete | aggregate | compare",
  "params": {
    "filters": {
      "period": {
        "start": "YYYY-MM-DD",
        "end": "YYYY-MM-DD",
        "named_period": "current_month | last_quarter | last_6_days | etc"
      },
      "amount": {
        "min": number,
        "max": number
      },
      "categories": ["string"],
      "subcategories": ["string"],
      "status": "string",
      "payment_method": "string",
      "tags": ["string"]
    },
    "logic": "AND | OR | NOT",
    "exclude": {
      "tags": ["string"],
      "categories": ["string"]
    },
    "sort": {
      "field": "date | amount | category",
      "order": "asc | desc"
    },
    "limit": number
  },
  "context": {
    "user_timezone": "string",
    "currency": "BRL"
  }
}
```

#### 4.1.4 Períodos Inteligentes (Named Periods)

**🔧 LÓGICA resolve macros:**
- `current_month` → Do dia 01 até hoje
- `last_month` → Mês anterior completo
- `last_quarter` → Últimos 3 meses fechados
- `last_6_days` → Últimos 6 dias a partir de hoje
- `fiscal_year` → Ano fiscal vigente
- `since_last_payday` → Desde último recebimento de salário (detectado por category="Salário")

#### 4.1.5 Lógica Booleana

**🔧 LÓGICA executa:**
- **AND:** Todos os critérios devem ser satisfeitos
- **OR:** Pelo menos um critério deve ser satisfeito
- **NOT:** Exclui resultados específicos (usa campo "exclude")

#### 4.1.6 Validação e Segurança

**🔧 LÓGICA PURA:**
- Validação de tipos (amount é number, date é válida ISO 8601)
- Sanitização de strings (bloquear injeção de código)
- Checagem de ranges (datas futuras, valores negativos em campos não permitidos)
- Verificação de campos obrigatórios por operação

### 4.2 Sistema de Pesquisa Externa (Search Layer)

#### 4.2.1 API Serper (Pesquisas Gerais)

**Acesso:** Junior + Coordenadores

**🤖 IA (Prompt Sistema para Junior):**
```
Você tem acesso à ferramenta Serper para buscar informações na web.

REGRAS DE USO:
- Faça buscas objetivas com termos específicos
- Prefira consultas curtas e diretas
- Exemplos:
  ✅ "taxa selic fevereiro 2026"
  ✅ "inflação brasil 2026"
  ❌ "qual é a taxa selic atual do brasil este ano"
  ❌ "me diga sobre a inflação no brasil"
```

**🤖 IA (Prompt Sistema para Coordenadores):**
```
Você tem acesso a três ferramentas de pesquisa:

SERPER - Use para:
- Informações gerais e notícias
- Contexto público amplo
- Validação rápida de informações

BRAPI - Use para:
- Cotações de ações e fundos
- Indicadores financeiros de empresas
- Fundamentos de ativos brasileiros

TAVILY - Use para:
- Análises aprofundadas
- Contexto histórico detalhado
- Relatórios e estudos

há um arquivo em "server\docs\md\diferenças_API.md" é impresividel ler esse arquivo md para entender cada api, o que cada faz e quanod usar.
ESTRATÉGIA:
Escolha a ferramenta mais apropriada para sua tarefa específica.
```

**🔧 LÓGICA:**
- Receber decisão da IA sobre qual API usar
- Executar chamada HTTP à API escolhida
- Retornar resultado bruto à IA

#### 4.2.2 API Brapi (Dados de Mercado)

**Acesso:** Apenas Coordenadores (Análise, Investimentos)

**Uso:**
- Cotações em tempo real
- Indicadores fundamentalistas
- Dados históricos de ativos

**🔧 LÓGICA:**
- Formatar requisição conforme documentação Brapi
- Executar chamada
- Retornar dados estruturados

#### 4.2.3 API Tavily (Pesquisa Contextual)

**Acesso:** Apenas Coordenadores

**Uso:**
- Análises aprofundadas
- Contexto histórico
- Relatórios e estudos detalhados

**🔧 LÓGICA:**
- Formatar requisição Tavily
- Executar chamada
- Retornar conteúdo contextual

### 4.3 Módulo Matemático (Precision Engine)

**Quando usar:**
- Cálculos complexos
- Juros compostos
- Projeções financeiras
- Análises de risco (VaR, Sharpe Ratio, etc.)

**🤖 IA (Prompt Sistema):**
```
Você tem acesso a um módulo de cálculo de alta precisão.

REGRAS ABSOLUTAS:
1. Sempre use formatação numérica com separadores de milhar
2. Arredonde resultados monetários para 2 casas decimais
3. Para cálculos complexos, decomponha em etapas numeradas
4. Valide inputs antes de calcular

FORMATO DE SAÍDA:
- Valores monetários: R$ 1.234,56
- Percentuais: 12,34%
- Números grandes: 1.234.567

Para cálculos complexos, mostre:
PASSO 1: [descrição]
Cálculo: [fórmula]
Resultado parcial: [valor]

PASSO 2: [descrição]
...
```

**🔧 LÓGICA:**
- Executar operações matemáticas com biblioteca de precisão (ex: Decimal.js)
- Aplicar formatação conforme instruções
- Retornar resultado à IA

---

## 🎯 5. Protocolo de Execução dos Coordenadores

### 5.1 Pipeline de Processamento

**🔧 LÓGICA (Sequência de execução):**
```javascript
1. Receber do Orquestrador:
   - Memória filtrada
   - Task do DOC
   - Outputs de agentes dependentes (se houver)

2. Enviar para IA do Coordenador

3. IA executa (ver seção 5.2)

4. Receber output estruturado da IA

5. Armazenar resultado com ID do agente

6. Notificar sistema de dependências (conclusão)
```

### 5.2 Metacognição Guiada do Coordenador

**🤖 IA (Cada Coordenador - GPT-5.2 - Reasoning: High, Verbosity: Low):**

**Recebe:**
- Memória contextual (filtrada pelo Orquestrador)
- Task específica do DOC
- Outputs de agentes anteriores (se houver dependências)
- Acesso às ferramentas disponíveis

**Justificativa do modelo:** Decisões não triviais, planejamento de uso de ferramentas, avaliação de qualidade, lida com ambiguidade, alto custo de erro

**Processo de Raciocínio Interno (Chain of Thought Obrigatório):**

```
ETAPA 1 - CLAREZA DE MISSÃO:
Perguntas obrigatórias:
- "Qual é EXATAMENTE minha entrega esperada?"
- "O que o Orquestrador quer que EU faça?"
- "Qual o formato de saída esperado?"

ETAPA 2 - INVENTÁRIO DE RECURSOS:
- "Quais ferramentas estão disponíveis para mim?"
- "Qual ferramenta é mais adequada para ESTA tarefa específica?"
- "Preciso usar mais de uma ferramenta?"

ETAPA 3 - PLANEJAMENTO:
- "Qual a sequência lógica de uso das ferramentas?"
- "Há interdependência entre as ferramentas que vou usar?"
- "Quais dados preciso extrair de cada ferramenta?"

ETAPA 4 - EXECUÇÃO:
- Usar ferramentas na ordem planejada
- Validar output de cada ferramenta antes de prosseguir

ETAPA 5 - VALIDAÇÃO:
- "Respondi completamente o que foi solicitado?"
- "A qualidade da entrega está adequada?"
- "Há algo faltando?"

ETAPA 6 - FORMATAÇÃO:
- Estruturar resultado no formato esperado
- Incluir dados relevantes
- Preparar para envio ao Agente de Resposta
```

**Saída Estruturada:**
```json
{
  "agent": "analysis | investments | planning",
  "task_completed": true/false,
  "reasoning": "Raciocínio completo do agente",
  "tools_used": ["finance_bridge", "tavily"],
  "result": {
    // Conteúdo específico da entrega
  },
  "metadata": {
    "execution_time": "timestamp",
    "confidence": "high | medium | low"
  }
}
```

---

## 📤 6. Camada de Resposta Final (Response Layer)

### 6.1 Agente de Resposta (Final Synthesizer)

**🤖 IA (GPT-5.2 - Reasoning: High, Verbosity: High):**

**Recebe:**
- Memória completa (mesma enviada aos coordenadores)
- Query original do usuário
- DOC completo do Orquestrador
- Outputs de TODOS os coordenadores que trabalharam:
  ```json
  {
    "analysis_output": { ... },
    "investments_output": { ... },
    "planning_output": { ... }
  }
  ```

**Justificativa do modelo:** 
- **Reasoning High:** Decisão complexa (como integrar múltiplos outputs), avaliação de trade-offs (priorização de informações), lida com ambiguidade (tom e formato adequados)
- **Verbosity High:** A resposta será lida por HUMANOS, precisa explicar decisões, exige clareza e transparência

**Processo de Síntese:**

```
ANÁLISE INTERNA:
1. "O que o usuário realmente quer saber?"
2. "Quais outputs são mais relevantes para a pergunta?"
3. "Como integrar múltiplos outputs de forma coerente?"
4. "Qual o melhor formato de resposta?"
   - Prosa conversacional?
   - Lista estruturada?
   - Relatório formal?
   - Resposta curta e direta?
5. "Qual tom é apropriado?"
   - Encorajador
   - Técnico
   - Alerta
   - Neutro

REGRAS DE FORMATAÇÃO:
- Evite listas/bullets em respostas conversacionais
- Use listas APENAS quando:
  a) Usuário pediu explicitamente
  b) Informação é essencialmente tabular
  c) Comparação lado-a-lado é necessária
  
- Para relatórios/análises: use prosa estruturada em parágrafos
- Para respostas rápidas: seja direto e conciso
- NUNCA use mais de 2 níveis de cabeçalhos

INTEGRAÇÃO DE MÚLTIPLOS OUTPUTS:
- Priorize informações que respondem diretamente à query
- Conecte outputs relacionados de forma natural
- Evite repetição de informações
- Mantenha fluxo narrativo lógico
```

**Saída Final:**
Resposta em linguagem natural otimizada para o usuário, sem estrutura JSON visível.

---

## 🧬 GUIA DE ESCOLHA DE MODELOS GPT-5.2

### Família GPT-5.2: Full, Mini e Nano

A escolha do modelo é uma **decisão arquitetural crítica**. Cada modelo da família GPT-5.2 tem um papel específico no sistema.

**Regra Central:** Modelos grandes pensam, modelos pequenos executam.

---

### GPT-5.2 - O Cérebro Estratégico

**Papel:** Raciocínio, decisão e coordenação

**Quando usar:**
- ✅ Decisões complexas e não triviais
- ✅ Planejamento em múltiplas etapas
- ✅ Avaliação de trade-offs
- ✅ Lidar com ambiguidade
- ✅ Coordenação de múltiplos agentes
- ✅ Análise de falhas e exceções
- ✅ Alto custo de erro
- ✅ Casos de borda e exceções

**Quando NÃO usar:**
- ❌ Tarefas simples e repetitivas
- ❌ Classificação básica
- ❌ Extração de dados estruturados
- ❌ Processamento em massa
- ❌ Pré ou pós-processamento

**No nosso sistema:**
- Agente Orquestrador
- Coordenadores (Análise, Investimentos, Planejamento)
- Agente de Resposta
- Compressão de Memória (decisão do que preservar)

---

### GPT-5-mini - O Executor Inteligente

**Papel:** Execução de tarefas bem definidas com qualidade

**Quando usar:**
- ✅ Exige raciocínio, mas é local
- ✅ Escopo bem definido
- ✅ Não envolve decisões estratégicas globais
- ✅ Pode ser descrito com regras claras
- ✅ Precisa de boa qualidade com custo controlado
- ✅ Análise contextual necessária

**Quando NÃO usar:**
- ❌ Planejamento global
- ❌ Coordenação entre agentes
- ❌ Decisão final em cenários críticos
- ❌ Tarefas extremamente simples (use nano)
- ❌ Alto volume onde custo é fator principal

**No nosso sistema:**
- Agente Junior (roteamento e classificação)
- Seleção de Categoria no Finance Bridge (análise contextual)

---

### GPT-5-nano - A Infraestrutura

**Papel:** Execução direta, alta velocidade, baixo custo

**Características:**
- ⚠️ **NÃO suporta** parâmetros de Reasoning Level ou Verbosity
- Opera apenas em modo de execução direta

**Quando usar:**
- ✅ Tarefas simples e repetitivas
- ✅ Pode ser descrito quase como if/else
- ✅ Alta velocidade necessária
- ✅ Baixíssimo custo necessário
- ✅ Escala para milhares/milhões de chamadas
- ✅ Classificação binária
- ✅ Extração de campos
- ✅ Conversão de formato (NL → JSON)
- ✅ Validação de estrutura

**Quando NÃO usar:**
- ❌ Planejamento
- ❌ Análise complexa
- ❌ Decisão ambígua
- ❌ Coordenação de agentes
- ❌ Avaliação de qualidade
- ❌ Código complexo
- ❌ Tarefas onde erro é caro

**No nosso sistema:**
- Resumo de Memória (conversão de ciclo → resumo)
- Finance Bridge Query (NL → JSON)
- Finance Bridge Insert - Passos 1 e 3 (classificação + extração)

---

### Parâmetros: Reasoning Level e Verbosity

**Disponível apenas em:** GPT-5.2 e Mini

#### Reasoning Level (Quanto o modelo "pensa")

**High:**
- Uso: Decisões não triviais, planejamento, ambiguidade, alto custo de erro
- Exemplos no sistema: Orquestrador, Coordenadores, Compressão de Memória

**Medium:**
- Uso: Raciocínio local, escopo definido, análise contextual
- Exemplos no sistema: Junior, Seleção de Categoria

**Low:**
- Uso: Tarefas diretas, repetitivas, baixo custo de erro
- ⚠️ Se a tarefa é tão simples, considere usar Nano

#### Verbosity (Quanto o modelo "fala")

**High:**
- Uso: Resposta será lida por HUMANOS
- Necessário explicar decisões
- Transparência e clareza essenciais
- Exemplos no sistema: Agente de Resposta

**Low:**
- Uso: Resposta consumida por outro agente/sistema
- Output estruturado (JSON)
- Latência e custo são críticos
- Exemplos no sistema: Orquestrador, Coordenadores, Junior, Compressão de Memória

---

### Combinações Corretas

#### 🎯 Reasoning High + Verbosity Low
**"Pensar muito, falar pouco"**

Uso ideal em:
- Orquestração
- Decisão interna
- Planejamento automático
- Avaliação de respostas
- Sistemas autônomos

**No nosso sistema:**
- Orquestrador
- Coordenadores
- Compressão de Memória

#### 🎯 Reasoning High + Verbosity High
**"Pensar muito, explicar muito"**

Uso ideal em:
- Análise para humanos
- Explicação de decisões
- Transparência
- Relatórios

**No nosso sistema:**
- Agente de Resposta

#### 🎯 Reasoning Medium + Verbosity Low
**"Raciocínio local, output direto"**

Uso ideal em:
- Execução inteligente
- Análise contextual localizada
- Comunicação entre agentes

**No nosso sistema:**
- Junior
- Seleção de Categoria (Finance Bridge)

#### ⚠️ Reasoning Low + Verbosity High
**"Pensar pouco, falar muito" - QUASE SEMPRE É ERRO**

Só faz sentido em:
- Interfaces de UX muito específicas
- Conteúdo genérico deliberado
- ❌ Não usado no nosso sistema

---

### Tabela de Decisão Rápida

| Agente/Função | Modelo | Reasoning | Verbosity | Por quê? |
|---------------|--------|-----------|-----------|----------|
| **Orquestrador** | Full | High | Low | Coordenação, decisão estratégica, alto custo de erro |
| **Coordenadores** | Full | High | Low | Decisões não triviais, planejamento de ferramentas |
| **Agente de Resposta** | Full | High | High | Síntese complexa + resposta para HUMANO |
| **Junior** | Mini | Medium | Low | Raciocínio local, bem definido, análise contextual |
| **Compressão Memória** | Full | High | Low | Decisão crítica (o que preservar), alto custo de erro |
| **Resumo Memória** | Nano | - | - | Conversão simples, repetitiva, alto volume |
| **Finance Bridge Query** | Nano | - | - | NL → JSON, tarefa direta, alto volume |
| **FB Insert - Tipo** | Nano | - | - | Classificação binária simples |
| **FB Insert - Categoria** | Mini | Medium | Low | Análise contextual (ambiguidade) |
| **FB Insert - Montagem** | Nano | - | - | Extração + formatação, tarefa direta |

---

### Princípios de Otimização

**Qualidade em Primeiro Lugar:**
- Use Full quando o erro é caro
- Use Mini quando há ambiguidade contextual
- Use Nano apenas quando a tarefa é trivial

**Custo Controlado:**
- Nano para alto volume e tarefas repetitivas
- Mini para execução qualificada sem decisão global
- Full apenas para decisões estratégicas

**Arquitetura Recomendada:**
```
GPT-5.2  → Decide o QUE fazer e QUEM faz
GPT-5-mini  → Executa COM inteligência local
GPT-5-nano  → Prepara, valida, formata, escala
```

Esta separação:
- ✅ Reduz custos totais
- ✅ Aumenta previsibilidade
- ✅ Facilita debugging
- ✅ Permite escalar com segurança
- ✅ Mantém qualidade alta

---

## 🎯 RESUMO: IA vs LÓGICA

### ✅ USE LÓGICA PURA PARA:

1. **Roteamento de Execução:**
   - `if (decision === "serper") callSerper()`
   - `if (priority === 1) executeFirst()`

2. **Manipulação de Dados:**
   - Carregar/salvar memória do banco
   - Contar palavras/tokens
   - Separar arrays (últimos 2 ciclos)
   - Concatenar strings

3. **Validação de Estrutura:**
   - Verificar se JSON tem campos obrigatórios
   - Validar tipos (number, string, date)
   - Checar ranges (amount > 0)

4. **Controle de Fluxo:**
   - Fila de execução de agentes
   - Aguardar dependências
   - Passar outputs entre agentes

5. **Chamadas de API:**
   - Executar HTTP request
   - Retornar resposta bruta

6. **Operações Matemáticas:**
   - Cálculos com bibliotecas de precisão
   - Formatação numérica

### 🤖 USE IA PARA:

1. **Qualquer Decisão Baseada em Contexto:**
   - Classificar intenção do usuário
   - Escolher ferramenta apropriada
   - Identificar informações faltantes

2. **Processamento de Linguagem Natural:**
   - Resumir memória
   - Converter query em JSON
   - Fazer follow-up contextual
   - Selecionar categorias

3. **Raciocínio Estratégico:**
   - Decompor tarefas complexas
   - Identificar dependências
   - Priorizar execução
   - Planejar uso de ferramentas

4. **Análise Semântica:**
   - Entender ambiguidade
   - Inferir contexto de mensagens anteriores
   - Distinguir casos sutis ("Uber" vs "Uber Eats")

5. **Síntese e Formatação:**
   - Integrar múltiplos outputs
   - Escolher tom de resposta
   - Decidir formato (lista vs prosa)
   - Adaptar complexidade ao contexto

### ⚠️ REGRA DE OURO:

**"Se você precisaria de `if/else` com múltiplas condições textuais para escolher comportamento → É decisão de IA"**

**"Se é só executar ação conhecida após decisão tomada → Pode ser lógica"**

---

## 📊 FLUXO COMPLETO DO SISTEMA

```
USUÁRIO ENVIA MENSAGEM
         ↓
   [LÓGICA] Carrega memória do chat
         ↓
   [IA - JUNIOR (Mini)] Classifica query
         ↓
   [LÓGICA] Roteia baseado em decision
         ↓
    ┌─────────────┬─────────────┬──────────────┐
    ↓             ↓             ↓              ↓
[Bridge]      [Serper]    [ORQUESTRADOR]   [Follow-up]
(Nano)        (API)       (Full)           (Mini)
    ↓             ↓             ↓              ↓
 Retorna      Retorna    [IA] Cria DOC    [IA] Pergunta
    ↓             ↓             ↓              ↓
    └─────────────┴─────────────┘         Aguarda usuário
         ↓                                     ↓
   Resposta Direta                    Volta ao Junior
         ↓                                     
    ┌────┴────┐                               
    ↓         ↓                                
[Análise] [Investimentos] [Planejamento]      
(Full)    (Full)          (Full)
    ↓         ↓         ↓                      
[IA] Metacognição + Ferramentas               
    ↓         ↓         ↓                      
    └────┬────┴────┬────┘                      
         ↓         
   [IA - RESPOSTA (Full)] Sintetiza tudo
         ↓
   [LÓGICA] Salva na memória
         ↓
   RESPOSTA AO USUÁRIO
```

**Legenda de Modelos:**
- **(Full)** = GPT-5.2 - Decisões estratégicas e raciocínio complexo
- **(Mini)** = GPT-5-mini - Execução inteligente com raciocínio local
- **(Nano)** = GPT-5-nano - Infraestrutura, conversão e alto volume

---

## 🔄 CICLO DE ATUALIZAÇÃO DE MEMÓRIA

```
USUÁRIO ENVIA → IA RESPONDE
         ↓
   [CICLO COMPLETO]
         ↓
   [LÓGICA] Adiciona aos 2 ciclos recentes
         ↓
   [LÓGICA] Move ciclo mais antigo dos "recentes" para "antigos"
         ↓
   [IA - GPT-5-nano] Resume o ciclo que saiu dos recentes
   (Tarefa: conversão simples, repetitiva)
         ↓
   [LÓGICA] Adiciona resumo aos "antigos"
         ↓
   [LÓGICA] Verifica contagem de palavras
         ↓
   SE > 90% do limite:
      [IA - GPT-5.2 (High/Low)] Comprime resumos antigos
      (Tarefa: decisão crítica do que preservar)
      [LÓGICA] Substitui versão antiga pela comprimida
         ↓
   [LÓGICA] Salva memória atualizada no banco
```

---

## 🛡️ PRINCÍPIOS DE DESIGN

1. **IA Decide, Lógica Executa**
   - IA nunca executa ações diretamente
   - Lógica nunca toma decisões contextuais

2. **Validação em Camadas**
   - IA valida semântica
   - Lógica valida estrutura e tipos

3. **Separação de Responsabilidades**
   - Cada agente tem função clara
   - Sem sobreposição de tarefas

4. **Rastreabilidade**
   - Todo raciocínio de IA é registrado
   - Outputs incluem metadata

5. **Resiliência**
   - Falhas de IA não quebram sistema
   - Fallbacks em validações de lógica

---


**FIM DA DOCUMENTAÇÃO**