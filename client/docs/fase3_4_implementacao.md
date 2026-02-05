# Plano de Implementação Detalhado - Fases 3 e 4
**Sistema Multi-Agente de Finanças Pessoais**

---

## 📋 Informações do Documento

- **Data de Criação:** 04 de fevereiro de 2026
- **Fases Cobertas:** Fase 3 (Agente Júnior) e Fase 4 (Camada de Orquestração)
- **Pré-requisitos:** Fase 1 ✅ e Fase 2 ✅ já implementadas
- **Executor:** GitHub Copilot (Claude Opus 4.5)

---

## 📦 Dependências das Fases Anteriores

### Da Fase 1 (Finance Bridge):
- `server/src/services/finance-bridge/index.js` - Processamento de requisições JSON
- `server/src/services/finance-bridge/ai/nano-bridge.js` - Integração GPT-5 Nano
- `server/src/models/TransactionRepository.js` - Operações CRUD de transações
- `server/src/utils/logger.js` - Sistema de logs
- `server/src/utils/error-handler.js` - Tratamento de erros

### Da Fase 2 (Sistema de Memória):
- `server/src/services/memory/index.js` - API principal de memória
- `server/src/services/memory/memory-manager.js` - Gerenciador de memória
- `server/src/models/Memory.js` - Schema de memória
- `server/src/models/MemoryRepository.js` - Operações de memória

---

# 📌 FASE 3: Agente Júnior (First Responder)

A Fase 3 implementa o **Agente Júnior**, que é a porta de entrada do sistema. Ele recebe todas as mensagens do usuário e decide se resolve sozinho ou escala para o Orquestrador.

---

## 🎯 Objetivo 6: Construir o Agente Júnior

### 6.1 Visão Geral

O Agente Júnior é o primeiro ponto de contato com o usuário. Ele:
- Recebe a memória completa do chat + mensagem atual
- Classifica a complexidade da solicitação
- Resolve tarefas simples diretamente
- Escala tarefas complexas para o Orquestrador

### 6.2 Estrutura de Arquivos a Criar

```
server/src/services/
└── agents/
    └── junior/
        ├── index.js                    # API pública do Agente Júnior
        ├── junior-agent.js             # Lógica principal do agente
        ├── classifier.js               # Classificador de complexidade
        ├── resolver.js                 # Resolutor de tarefas simples
        └── prompts/
            └── junior-system.txt       # Prompt de sistema do Júnior
```

### 6.3 Tarefas Detalhadas

#### Tarefa 6.1: Criar a Estrutura Base do Agente Júnior

**Arquivo:** `server/src/services/agents/junior/index.js`

**Responsabilidades:**
- Exportar a API pública do agente
- Métodos: `processMessage(memory, userMessage)`, `getAgentInfo()`, `healthCheck()`

**Código Esperado:**
```javascript
// Exporta funções públicas
const { JuniorAgent } = require('./junior-agent');

const juniorAgent = new JuniorAgent();

module.exports = {
  processMessage: (memory, userMessage) => juniorAgent.process(memory, userMessage),
  getAgentInfo: () => juniorAgent.getInfo(),
  healthCheck: () => juniorAgent.healthCheck()
};
```

---

#### Tarefa 6.2: Implementar a Lógica Principal do Agente Júnior

**Arquivo:** `server/src/services/agents/junior/junior-agent.js`

**Classe JuniorAgent:**

```javascript
class JuniorAgent {
  constructor() {
    this.classifier = new Classifier();
    this.resolver = new Resolver();
    this.financeBridge = require('../../finance-bridge');
    this.memoryService = require('../../memory');
  }

  async process(memory, userMessage) {
    // 1. Classificar a complexidade
    const classification = await this.classifier.classify(memory, userMessage);
    
    // 2. Verificar se precisa de informações adicionais
    if (classification.needsMoreInfo) {
      return this.requestMoreInfo(classification.missingFields, memory);
    }
    
    // 3. Se for complexo, escalar para Orquestrador
    if (classification.complexity === 'complex') {
      return this.escalateToOrchestrator(memory, userMessage, classification);
    }
    
    // 4. Resolver localmente
    return this.resolver.resolve(classification, memory, userMessage);
  }
}
```

**Inputs:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| memory | Object | Memória completa do chat (recent + old + critical_data) |
| userMessage | String | Mensagem atual do usuário |

**Outputs:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| response | String | Resposta para o usuário |
| action | String | Ação tomada (resolved, escalated, needs_info) |
| data | Object | Dados adicionais (resultado da query, etc.) |

---

#### Tarefa 6.3: Implementar o Classificador de Complexidade

**Arquivo:** `server/src/services/agents/junior/classifier.js`

**Lógica de Classificação:**

| Classificação | Critérios | Exemplos | Ação |
|---------------|-----------|----------|------|
| **trivial** | Consulta direta, 1 filtro | "Quanto gastei ontem?" | Junior → Bridge → Resposta |
| **simple** | Lançamento com dados completos | "Gastei R$50 no almoço no restaurante" | Junior → Bridge.insert |
| **intermediate** | Análise básica ou comparação | "Como estão meus gastos este mês?" | Junior → Bridge + Cálculo |
| **complex** | Múltiplas tarefas, análise profunda | "Analise meus investimentos e sugira ajustes" | Escalar → Orquestrador |

**Detecção de Informações Faltantes:**

O classificador deve verificar se um lançamento está completo:

```javascript
const requiredFields = {
  expense: ['amount', 'category'], // valor e onde gastou
  income: ['amount', 'source']     // valor e origem
};

// Exemplo de detecção
function detectMissingInfo(userMessage, type) {
  const extracted = extractInfo(userMessage);
  const required = requiredFields[type];
  const missing = [];
  
  if (!extracted.amount) missing.push('amount');
  if (!extracted.category && type === 'expense') missing.push('category');
  if (!extracted.source && type === 'income') missing.push('source');
  
  return {
    needsMoreInfo: missing.length > 0,
    missingFields: missing,
    extracted: extracted
  };
}
```

**Perguntas de Follow-up:**

| Campo Faltante | Pergunta Gerada |
|----------------|-----------------|
| amount | "Qual foi o valor?" |
| category | "Você gastou em que esse R$ {valor}?" |
| source | "Qual a origem dessa receita de R$ {valor}?" |
| date | "Quando foi essa transação?" |

---

#### Tarefa 6.4: Implementar o Resolutor de Tarefas

**Arquivo:** `server/src/services/agents/junior/resolver.js`

**Métodos:**

```javascript
class Resolver {
  // Para consultas triviais (query simples)
  async resolveTrivial(classification, memory) {
    const queryPayload = this.buildQueryPayload(classification);
    const result = await financeBridge.processRequest(queryPayload);
    return this.formatResponse(result, 'query');
  }
  
  // Para lançamentos simples
  async resolveSimple(classification, memory) {
    // Usar fluxo de lançamento (Objetivo 7)
    return this.launchTransaction(classification);
  }
  
  // Para análises intermediárias
  async resolveIntermediate(classification, memory) {
    const queryPayload = this.buildAggregatePayload(classification);
    const result = await financeBridge.processRequest(queryPayload);
    return this.formatAnalysisResponse(result);
  }
}
```

---

#### Tarefa 6.5: Criar o Prompt de Sistema do Júnior

**Arquivo:** `server/src/services/agents/junior/prompts/junior-system.txt`

**Conteúdo do Prompt:**

```markdown
# Agente Júnior - Sistema de Finanças Pessoais

Você é o Agente Júnior, a porta de entrada do sistema de finanças pessoais. Sua função é:

1. CLASSIFICAR a complexidade da solicitação do usuário
2. RESOLVER tarefas simples diretamente
3. ESCALAR tarefas complexas para o Orquestrador

## CLASSIFICAÇÃO DE COMPLEXIDADE:

### TRIVIAL (resolver sozinho via Finance Bridge)
- Consultas diretas: "Quanto gastei ontem?", "Qual foi minha última compra?"
- Apenas 1 filtro ou período simples
- Não requer análise ou comparação

### SIMPLES (resolver via lançamento)
- Registrar despesa/receita com dados completos
- Exemplo: "Gastei R$50 no almoço no restaurante"
- Requer: valor + categoria (+ descrição opcional)

### INTERMEDIÁRIA (resolver com cálculos)
- Análises básicas: "Como estão meus gastos este mês?"
- Comparações simples: "Gastei mais ou menos que no mês passado?"
- Somas, médias, agrupamentos

### COMPLEXA (escalar para Orquestrador)
- Múltiplas tarefas: "Analise meus gastos E sugira um orçamento"
- Análise de investimentos
- Planejamento financeiro
- Metas e projeções
- Qualquer coisa envolvendo múltiplos agentes

## REGRAS IMPORTANTES:

1. Se faltar informação para um lançamento, PERGUNTE antes de inserir
   - Faltou valor: "Qual foi o valor?"
   - Faltou categoria: "Você gastou em que esse R$ X?"
   
2. Mantenha o contexto da conversa usando a memória fornecida

3. Formate valores monetários corretamente: R$ 1.234,56

4. Para datas, interprete corretamente:
   - "ontem" → data de ontem
   - "semana passada" → últimos 7 dias
   - "esse mês" → mês atual
```

---

#### Tarefa 6.6: Garantir Registro de Follow-ups na Memória

**Implementação:**

Quando o Júnior faz uma pergunta de esclarecimento, o ciclo deve ser registrado na memória:

```javascript
// No junior-agent.js
async requestMoreInfo(missingFields, memory) {
  const question = this.buildFollowUpQuestion(missingFields);
  
  // Marcar na memória que estamos em estado de follow-up
  memory.pending_context = {
    type: 'follow_up',
    waiting_for: missingFields,
    original_intent: 'transaction_launch',
    timestamp: new Date()
  };
  
  return {
    response: question,
    action: 'needs_info',
    pendingContext: memory.pending_context
  };
}

// Ao receber a próxima mensagem, verificar se é continuação
async process(memory, userMessage) {
  // Verificar se é resposta a um follow-up anterior
  if (memory.pending_context?.type === 'follow_up') {
    return this.handleFollowUpResponse(memory, userMessage);
  }
  
  // Fluxo normal...
}
```

---

## 🎯 Objetivo 7: Implementar o Fluxo de Lançamentos do Agente Júnior

### 7.1 Visão Geral

O fluxo de lançamentos é otimizado para economizar tokens, enviando apenas os dados necessários para o GPT-5 Nano.

### 7.2 Estrutura de Arquivos a Criar

```
server/src/services/agents/junior/
└── launch/
    ├── index.js                # API do sistema de lançamentos
    ├── transaction-launcher.js # Lógica principal de lançamento
    ├── category-loader.js      # Carregador de categorias
    └── prompts/
        └── launch-system.txt   # Prompt para o GPT-5 Nano
```

### 7.3 Tarefas Detalhadas

#### Tarefa 7.1: Criar o Carregador de Categorias

**Arquivo:** `server/src/services/agents/junior/launch/category-loader.js`

**Responsabilidades:**
- Identificar se é despesa ou receita
- Carregar APENAS o JSON correspondente (nunca ambos)
- Extrair apenas categorias (sem subcategorias inicialmente)
- Carregar subcategorias específicas sob demanda

```javascript
const path = require('path');
const fs = require('fs').promises;

class CategoryLoader {
  constructor() {
    this.basePath = path.join(__dirname, '../../../../../docs/jsons/lançamentos/despesas e receitas');
    this.cache = {};
  }

  // Carrega apenas o tipo necessário (expense ou income)
  async loadCategories(type) {
    const fileName = type === 'expense' ? 'despesas.json' : 'receitas.json';
    
    if (!this.cache[type]) {
      const filePath = path.join(this.basePath, fileName);
      const content = await fs.readFile(filePath, 'utf-8');
      this.cache[type] = JSON.parse(content);
    }
    
    // Retorna apenas os nomes das categorias (sem subcategorias)
    return this.cache[type].categorias.map(cat => ({
      id: cat.id,
      nome: cat.nome
    }));
  }

  // Carrega subcategorias de uma categoria específica
  async loadSubcategories(type, categoryId) {
    await this.loadCategories(type); // Garantir que está em cache
    
    const category = this.cache[type].categorias.find(c => c.id === categoryId);
    if (!category) return [];
    
    return category.subcategorias;
  }
}
```

---

#### Tarefa 7.2: Implementar o Lançador de Transações

**Arquivo:** `server/src/services/agents/junior/launch/transaction-launcher.js`

**Fluxo de Execução:**

```
1. Usuário: "Gastei R$150 no supermercado"
              │
              ▼
2. Júnior identifica: DESPESA
              │
              ▼
3. Carrega despesas.json (apenas categorias)
              │
              ▼
4. GPT-5 Nano recebe: texto + lista de categorias
              │
              ▼
5. GPT-5 Nano escolhe: "Alimentação"
              │
              ▼
6. Sistema carrega subcategorias de "Alimentação"
              │
              ▼
7. GPT-5 Nano recebe: subcategorias de Alimentação
              │
              ▼
8. GPT-5 Nano escolhe: "Supermercado"
              │
              ▼
9. GPT-5 Nano monta JSON completo de lançamento
              │
              ▼
10. Finance Bridge executa insert
              │
              ▼
11. Retorna sucesso ao usuário
```

**Código:**

```javascript
class TransactionLauncher {
  constructor() {
    this.categoryLoader = new CategoryLoader();
    this.nanoBridge = require('../../../finance-bridge/ai/nano-bridge');
    this.financeBridge = require('../../../finance-bridge');
  }

  async launch(userMessage, memory) {
    // Passo 1: Identificar tipo (expense ou income)
    const type = await this.identifyType(userMessage);
    
    // Passo 2: Carregar apenas as categorias do tipo identificado
    const categories = await this.categoryLoader.loadCategories(type);
    
    // Passo 3: GPT-5 Nano escolhe a categoria
    const categoryChoice = await this.nanoBridge.chooseCategory(userMessage, categories);
    
    // Passo 4: Carregar subcategorias da categoria escolhida
    const subcategories = await this.categoryLoader.loadSubcategories(type, categoryChoice.id);
    
    // Passo 5: GPT-5 Nano escolhe subcategoria e monta JSON
    const transactionPayload = await this.nanoBridge.buildTransactionPayload(
      userMessage,
      categoryChoice,
      subcategories
    );
    
    // Passo 6: Executar inserção via Finance Bridge
    const result = await this.financeBridge.processRequest({
      operation: 'insert',
      params: transactionPayload
    });
    
    return result;
  }

  async identifyType(userMessage) {
    // Palavras-chave para identificação rápida
    const expenseKeywords = ['gastei', 'paguei', 'comprei', 'custo', 'despesa'];
    const incomeKeywords = ['recebi', 'ganhei', 'entrou', 'salário', 'receita'];
    
    const message = userMessage.toLowerCase();
    
    if (expenseKeywords.some(kw => message.includes(kw))) return 'expense';
    if (incomeKeywords.some(kw => message.includes(kw))) return 'income';
    
    // Se não conseguir identificar, usar GPT-5 Nano
    return this.nanoBridge.identifyTransactionType(userMessage);
  }
}
```

---

#### Tarefa 7.3: Criar Prompts para o GPT-5 Nano (Lançamentos)

**Arquivo:** `server/src/services/agents/junior/launch/prompts/launch-system.txt`

```markdown
# GPT-5 Nano - Assistente de Lançamentos

Você é um assistente especializado em categorizar transações financeiras.

## TAREFA 1: Escolher Categoria

Dado o texto do usuário e a lista de categorias disponíveis, escolha a categoria mais adequada.

ENTRADA:
- Texto do usuário: "Gastei R$150 no supermercado"
- Categorias: ["Alimentação", "Moradia", "Transporte", ...]

SAÍDA (JSON):
{
  "category_id": "desp_001",
  "category_name": "Alimentação",
  "confidence": 0.95
}

## TAREFA 2: Escolher Subcategoria e Montar JSON

Dado o texto, categoria escolhida e subcategorias, monte o JSON de lançamento.

ENTRADA:
- Texto: "Gastei R$150 no supermercado"
- Categoria: "Alimentação"
- Subcategorias: ["Supermercado", "Restaurante", "Delivery", ...]

SAÍDA (JSON):
{
  "amount": 150.00,
  "date": "2026-02-04",
  "type": "expense",
  "category": "Alimentação",
  "subcategory": "Supermercado",
  "description": "Compra no supermercado"
}

## REGRAS:
1. SEMPRE retorne JSON válido
2. Use a data atual se não especificada
3. Extraia o valor numérico corretamente (R$ 150,00 → 150.00)
4. Escolha a subcategoria mais específica possível
```

---

#### Tarefa 7.4: Atualizar o nano-bridge.js para Suportar Lançamentos

**Adicionar métodos ao arquivo existente:** `server/src/services/finance-bridge/ai/nano-bridge.js`

```javascript
// Novos métodos a adicionar:

async chooseCategory(userMessage, categories) {
  const prompt = `
Texto do usuário: "${userMessage}"

Categorias disponíveis:
${categories.map(c => `- ${c.id}: ${c.nome}`).join('\n')}

Escolha a categoria mais adequada e retorne APENAS o JSON:
{"category_id": "...", "category_name": "...", "confidence": 0.0-1.0}
`;
  
  return this.processRequest(prompt);
}

async buildTransactionPayload(userMessage, category, subcategories) {
  const prompt = `
Texto do usuário: "${userMessage}"
Categoria escolhida: ${category.nome}

Subcategorias disponíveis:
${subcategories.join(', ')}

Monte o JSON de lançamento completo:
{
  "amount": número,
  "date": "YYYY-MM-DD",
  "type": "expense" ou "income",
  "category": "nome da categoria",
  "subcategory": "subcategoria escolhida",
  "description": "descrição breve"
}
`;
  
  return this.processRequest(prompt);
}

async identifyTransactionType(userMessage) {
  const prompt = `
Texto: "${userMessage}"

Isso é uma DESPESA (dinheiro saindo) ou RECEITA (dinheiro entrando)?
Responda APENAS: "expense" ou "income"
`;
  
  const result = await this.processRequest(prompt);
  return result.includes('income') ? 'income' : 'expense';
}
```

---

## 🎯 Objetivo 8: Conectar o Agente Júnior às APIs de Pesquisa

### 8.1 Visão Geral

O Agente Júnior pode usar a API Serper para buscas gerais na internet quando a informação não está no banco de dados.

### 8.2 Estrutura de Arquivos a Criar

```
server/src/services/
└── search/
    ├── index.js                # API unificada de busca
    ├── serper-client.js        # Cliente da API Serper
    └── prompts/
        └── search-optimizer.txt # Prompt para otimizar buscas
```

### 8.3 Tarefas Detalhadas

#### Tarefa 8.1: Criar o Cliente da API Serper

**Arquivo:** `server/src/services/search/serper-client.js`

```javascript
const axios = require('axios');
const logger = require('../../utils/logger');

class SerperClient {
  constructor() {
    this.apiKey = process.env.SERPER_API_KEY;
    this.baseUrl = 'https://google.serper.dev/search';
    this.timeout = 10000; // 10 segundos
  }

  async search(query, options = {}) {
    try {
      logger.info('Serper search', { query });
      
      const response = await axios.post(this.baseUrl, {
        q: query,
        gl: options.country || 'br',
        hl: options.language || 'pt-br',
        num: options.numResults || 5
      }, {
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });
      
      return this.formatResults(response.data);
    } catch (error) {
      logger.error('Serper search failed', { error: error.message });
      throw error;
    }
  }

  formatResults(data) {
    const results = [];
    
    // Resultado direto (answer box)
    if (data.answerBox) {
      results.push({
        type: 'answer',
        content: data.answerBox.answer || data.answerBox.snippet
      });
    }
    
    // Resultados orgânicos
    if (data.organic) {
      data.organic.forEach(item => {
        results.push({
          type: 'organic',
          title: item.title,
          snippet: item.snippet,
          link: item.link
        });
      });
    }
    
    return results;
  }

  async healthCheck() {
    return !!this.apiKey;
  }
}

module.exports = { SerperClient };
```

---

#### Tarefa 8.2: Criar o Otimizador de Buscas

**Arquivo:** `server/src/services/search/prompts/search-optimizer.txt`

```markdown
# Otimizador de Buscas - Agente Júnior

Você deve transformar perguntas do usuário em termos de busca otimizados para o Google.

## REGRAS:

1. Use termos CURTOS e DIRETOS
2. Inclua datas específicas quando relevante
3. Use aspas para termos exatos
4. Evite palavras desnecessárias

## EXEMPLOS:

❌ RUIM: "qual é a taxa selic atual do brasil neste momento"
✅ BOM: "taxa selic fevereiro 2026"

❌ RUIM: "quanto está o dólar hoje em dia no brasil"
✅ BOM: "cotação dólar hoje"

❌ RUIM: "qual o melhor investimento para fazer com pouco dinheiro"
✅ BOM: "melhores investimentos 2026 baixo valor"

## FORMATO DE SAÍDA:

Retorne APENAS os termos de busca, sem explicação.
```

---

#### Tarefa 8.3: Integrar Busca ao Agente Júnior

**Atualizar:** `server/src/services/agents/junior/junior-agent.js`

```javascript
// Adicionar ao construtor
this.searchService = require('../../search');

// Adicionar método
async handleExternalSearch(userMessage, memory) {
  // Otimizar a query para busca
  const optimizedQuery = await this.nanoBridge.optimizeSearchQuery(userMessage);
  
  // Executar busca
  const results = await this.searchService.search(optimizedQuery);
  
  // Formatar resposta com os resultados
  return this.formatSearchResponse(results, userMessage);
}

// Adicionar na classificação
// Se a query precisa de informação externa que não está no banco
if (classification.needsExternalInfo) {
  return this.handleExternalSearch(userMessage, memory);
}
```

**Critérios para Busca Externa:**

| Indicador | Exemplo | Ação |
|-----------|---------|------|
| Pergunta sobre mercado | "Qual a taxa Selic atual?" | Serper → Resposta |
| Informação factual | "Quanto custa X hoje?" | Serper → Resposta |
| Dados não-pessoais | "Qual o limite do PIX?" | Serper → Resposta |

---

# 📌 FASE 4: Camada de Orquestração

A Fase 4 implementa o **Agente Orquestrador** e a estrutura do **DOC (Documento de Direção)** que coordena os agentes especialistas.

---

## 🎯 Objetivo 9: Construir o Agente Orquestrador

### 9.1 Visão Geral

O Orquestrador é o "cérebro estratégico" que:
- Recebe tarefas complexas do Agente Júnior
- Analisa quais agentes coordenadores são necessários
- Define a ordem de execução e dependências
- Gera o DOC para instruir os coordenadores

### 9.2 Estrutura de Arquivos a Criar

```
server/src/services/
└── agents/
    └── orchestrator/
        ├── index.js                    # API pública
        ├── orchestrator-agent.js       # Lógica principal
        ├── task-decomposer.js          # Decomposição de tarefas
        ├── dependency-resolver.js      # Resolução de dependências
        ├── memory-filter.js            # Filtro de memória relevante
        ├── priority-manager.js         # Gerenciador de prioridades
        ├── doc-builder.js              # Construtor do DOC
        └── prompts/
            └── orchestrator-system.txt # Prompt de sistema
```

### 9.3 Tarefas Detalhadas

#### Tarefa 9.1: Criar a Estrutura Base do Orquestrador

**Arquivo:** `server/src/services/agents/orchestrator/index.js`

```javascript
const { OrchestratorAgent } = require('./orchestrator-agent');

const orchestrator = new OrchestratorAgent();

module.exports = {
  processComplexTask: (memory, query, agentContracts) => 
    orchestrator.process(memory, query, agentContracts),
  getAgentInfo: () => orchestrator.getInfo(),
  healthCheck: () => orchestrator.healthCheck()
};
```

---

#### Tarefa 9.2: Implementar a Lógica Principal do Orquestrador

**Arquivo:** `server/src/services/agents/orchestrator/orchestrator-agent.js`

**Inputs do Orquestrador:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| memory | Object | Memória completa do chat |
| query | String | Query original do usuário |
| agentContracts | Object | Contratos dos agentes coordenadores |

**Fluxo de Processamento (Chain of Thought):**

```javascript
class OrchestratorAgent {
  constructor() {
    this.decomposer = new TaskDecomposer();
    this.dependencyResolver = new DependencyResolver();
    this.memoryFilter = new MemoryFilter();
    this.priorityManager = new PriorityManager();
    this.docBuilder = new DocBuilder();
  }

  async process(memory, query, agentContracts) {
    // ETAPA 1: DECOMPOSIÇÃO
    // Identificar quais agentes são necessários
    const decomposition = await this.decomposer.decompose(query, agentContracts);
    
    // ETAPA 2: DEPENDÊNCIAS
    // Verificar ordem de execução
    const dependencies = await this.dependencyResolver.resolve(decomposition);
    
    // ETAPA 3: MEMORIZAÇÃO
    // Extrair memória relevante para contextualização
    const filteredMemory = await this.memoryFilter.filter(memory, decomposition);
    
    // ETAPA 4: PRIORIZAÇÃO
    // Definir ordem e paralelismo
    const executionPlan = await this.priorityManager.plan(decomposition, dependencies);
    
    // Construir DOC
    const doc = await this.docBuilder.build({
      query,
      memory: filteredMemory,
      decomposition,
      dependencies,
      executionPlan
    });
    
    return doc;
  }
}
```

---

#### Tarefa 9.3: Implementar o Decompositor de Tarefas

**Arquivo:** `server/src/services/agents/orchestrator/task-decomposer.js`

**Contratos dos Agentes (referência: `server/docs/md/diferenças_coor.md`):**

```javascript
class TaskDecomposer {
  constructor() {
    // Carregar contratos dos agentes
    this.agentCapabilities = {
      analysis: {
        name: 'Agente de Análise',
        capabilities: [
          'diagnóstico de gastos',
          'identificação de padrões',
          'análise de fluxo de caixa',
          'alertas de desvio',
          'detecção de assinaturas esquecidas'
        ],
        doesNot: ['análise de ativos', 'sugestão de investimentos']
      },
      investments: {
        name: 'Agente de Investimentos',
        capabilities: [
          'análise de carteira',
          'análise de mercado',
          'recomendação de aporte',
          'cálculos de investimento',
          'consulta Brapi'
        ],
        doesNot: ['análise de gastos domésticos', 'orçamento de lazer']
      },
      planning: {
        name: 'Agente de Planejamento',
        capabilities: [
          'criação de orçamentos',
          'gestão de metas',
          'planos de ação',
          'simulações de cenários'
        ],
        doesNot: ['análise de ações', 'listar gastos passados']
      }
    };
  }

  async decompose(query, agentContracts) {
    const tasks = [];
    
    // Analisar query para identificar necessidades
    const needs = await this.analyzeNeeds(query);
    
    // Mapear necessidades para agentes
    for (const need of needs) {
      const agent = this.findBestAgent(need);
      if (agent) {
        tasks.push({
          agent: agent,
          task: need.description,
          expectedOutput: need.outputType
        });
      }
    }
    
    return tasks;
  }

  async analyzeNeeds(query) {
    // Palavras-chave para identificar necessidades
    const patterns = {
      analysis: ['gastos', 'gastei', 'padrão', 'fluxo', 'comportamento', 'analise meus'],
      investments: ['investimento', 'carteira', 'ações', 'fundos', 'rendimento', 'aporte'],
      planning: ['orçamento', 'meta', 'plano', 'objetivo', 'economizar', 'planejamento']
    };
    
    const needs = [];
    const queryLower = query.toLowerCase();
    
    for (const [agent, keywords] of Object.entries(patterns)) {
      if (keywords.some(kw => queryLower.includes(kw))) {
        needs.push({
          agent,
          description: this.extractTaskDescription(query, agent),
          outputType: this.getExpectedOutput(agent)
        });
      }
    }
    
    return needs;
  }
}
```

---

#### Tarefa 9.4: Implementar o Resolutor de Dependências

**Arquivo:** `server/src/services/agents/orchestrator/dependency-resolver.js`

```javascript
class DependencyResolver {
  // Regras de dependência entre agentes
  constructor() {
    this.dependencyRules = [
      {
        dependent: 'planning',
        dependsOn: 'analysis',
        condition: 'when_needs_current_spending_data',
        description: 'Planejamento precisa de análise antes para ter dados de gastos'
      },
      {
        dependent: 'investments',
        dependsOn: 'analysis',
        condition: 'when_needs_cash_flow',
        description: 'Investimentos pode precisar de fluxo de caixa do analista'
      }
    ];
  }

  async resolve(decomposition) {
    const dependencies = [];
    const agents = decomposition.map(d => d.agent);
    
    for (const task of decomposition) {
      const taskDeps = this.findDependencies(task.agent, agents);
      if (taskDeps.length > 0) {
        dependencies.push({
          agent: task.agent,
          dependsOn: taskDeps,
          mustWaitFor: taskDeps
        });
      }
    }
    
    return dependencies;
  }

  findDependencies(agent, availableAgents) {
    const deps = [];
    
    for (const rule of this.dependencyRules) {
      if (rule.dependent === agent && availableAgents.includes(rule.dependsOn)) {
        deps.push(rule.dependsOn);
      }
    }
    
    return deps;
  }
}
```

---

#### Tarefa 9.5: Implementar o Filtro de Memória

**Arquivo:** `server/src/services/agents/orchestrator/memory-filter.js`

```javascript
class MemoryFilter {
  async filter(memory, decomposition) {
    const relevantMemory = {
      context: [],
      critical_data: {}
    };
    
    // Sempre incluir dados críticos
    relevantMemory.critical_data = memory.critical_data || {};
    
    // Filtrar ciclos relevantes baseado nas tarefas
    const relevantTopics = this.extractTopics(decomposition);
    
    // Dos ciclos recentes, manter apenas o relevante
    if (memory.recent_memory) {
      for (const cycle of memory.recent_memory) {
        if (this.isRelevant(cycle, relevantTopics)) {
          relevantMemory.context.push({
            user: cycle.user_message,
            ai: this.summarizeIfNeeded(cycle.ai_response)
          });
        }
      }
    }
    
    // Da memória antiga, extrair apenas informações úteis
    if (memory.old_memory) {
      for (const cycle of memory.old_memory) {
        if (this.isRelevant(cycle, relevantTopics)) {
          relevantMemory.context.push({
            summary: cycle.summary,
            preserved_data: cycle.preserved_data
          });
        }
      }
    }
    
    return relevantMemory;
  }

  extractTopics(decomposition) {
    const topics = [];
    for (const task of decomposition) {
      topics.push(...this.getAgentTopics(task.agent));
    }
    return [...new Set(topics)];
  }

  getAgentTopics(agent) {
    const topicMap = {
      analysis: ['gasto', 'despesa', 'receita', 'categoria', 'padrão'],
      investments: ['investimento', 'carteira', 'ação', 'fundo', 'rendimento'],
      planning: ['meta', 'objetivo', 'orçamento', 'plano', 'economia']
    };
    return topicMap[agent] || [];
  }
}
```

---

#### Tarefa 9.6: Implementar o Gerenciador de Prioridades

**Arquivo:** `server/src/services/agents/orchestrator/priority-manager.js`

```javascript
class PriorityManager {
  async plan(decomposition, dependencies) {
    const executionPlan = {
      phases: [],
      canRunInParallel: []
    };
    
    // Construir grafo de dependências
    const graph = this.buildDependencyGraph(decomposition, dependencies);
    
    // Ordenação topológica para definir fases
    const phases = this.topologicalSort(graph);
    
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      executionPlan.phases.push({
        phaseNumber: i + 1,
        agents: phase,
        canParallelize: phase.length > 1
      });
    }
    
    return executionPlan;
  }

  buildDependencyGraph(decomposition, dependencies) {
    const graph = {};
    
    // Inicializar nós
    for (const task of decomposition) {
      graph[task.agent] = {
        task: task,
        dependsOn: []
      };
    }
    
    // Adicionar arestas de dependência
    for (const dep of dependencies) {
      if (graph[dep.agent]) {
        graph[dep.agent].dependsOn = dep.dependsOn;
      }
    }
    
    return graph;
  }

  topologicalSort(graph) {
    const phases = [];
    const visited = new Set();
    const remaining = new Set(Object.keys(graph));
    
    while (remaining.size > 0) {
      const phase = [];
      
      for (const agent of remaining) {
        const deps = graph[agent].dependsOn;
        // Se todas as dependências já foram visitadas
        if (deps.every(d => visited.has(d))) {
          phase.push(agent);
        }
      }
      
      // Mover para visitados
      for (const agent of phase) {
        visited.add(agent);
        remaining.delete(agent);
      }
      
      phases.push(phase);
    }
    
    return phases;
  }
}
```

---

#### Tarefa 9.7: Criar o Prompt de Sistema do Orquestrador

**Arquivo:** `server/src/services/agents/orchestrator/prompts/orchestrator-system.txt`

```markdown
# Agente Orquestrador - Cérebro Estratégico

Você é o Orquestrador do sistema de finanças pessoais. Sua função é analisar solicitações complexas e coordenar os agentes especialistas.

## AGENTES DISPONÍVEIS:

### 1. Agente de Análise
**Foco:** Comportamento financeiro passado e presente
- Diagnóstico de gastos
- Identificação de padrões
- Análise de fluxo de caixa
- Alertas de desvio

### 2. Agente de Investimentos
**Foco:** Multiplicação de capital e gestão de portfólio
- Análise de carteira
- Consulta de mercado (Brapi)
- Recomendação de aportes
- Cálculos de investimento

### 3. Agente de Planejamento
**Foco:** Metas, orçamentos e futuro financeiro
- Criação de orçamentos
- Gestão de metas
- Planos de ação
- Simulações de cenários

## PROCESSO DE ANÁLISE:

### ETAPA 1 - DECOMPOSIÇÃO
Pergunte-se: Quais agentes são necessários?
- A tarefa envolve análise de gastos? → Agente de Análise
- A tarefa envolve investimentos? → Agente de Investimentos
- A tarefa envolve planejamento/metas? → Agente de Planejamento

### ETAPA 2 - DEPENDÊNCIAS
Pergunte-se: Há ordem obrigatória?
- O planejamento precisa de dados de análise antes?
- Investimentos precisa saber o fluxo de caixa?

### ETAPA 3 - MEMORIZAÇÃO
Pergunte-se: O que na memória é relevante?
- Metas declaradas pelo usuário
- Limites configurados
- Decisões anteriores

### ETAPA 4 - PRIORIZAÇÃO
Pergunte-se: Qual a ordem lógica?
- Quais tarefas podem rodar em paralelo?
- Quais precisam esperar outras terminarem?

## FORMATO DE SAÍDA:

Retorne um JSON estruturado (DOC) conforme especificação.
```

---

## 🎯 Objetivo 10: Criar a Estrutura do DOC (Documento de Direção)

### 10.1 Visão Geral

O DOC é o documento JSON que o Orquestrador gera para instruir os coordenadores. Contém toda a informação necessária para execução.

### 10.2 Tarefas Detalhadas

#### Tarefa 10.1: Implementar o Construtor do DOC

**Arquivo:** `server/src/services/agents/orchestrator/doc-builder.js`

**Estrutura do DOC:**

```javascript
class DocBuilder {
  async build({ query, memory, decomposition, dependencies, executionPlan }) {
    const doc = {
      // IDENTIFICAÇÃO
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      
      // QUERY ORIGINAL
      original_query: query,
      
      // MEMÓRIA FILTRADA
      memory: memory,
      
      // ANÁLISE DO ORQUESTRADOR
      orchestrator_analysis: {
        intent: this.describeIntent(query),
        chain_of_thought: this.buildChainOfThought(decomposition, dependencies, executionPlan)
      },
      
      // DISTRIBUIÇÃO DE TAREFAS
      task_distribution: this.buildTaskDistribution(decomposition, dependencies, executionPlan),
      
      // CONTROLE DE EXECUÇÃO
      execution_control: {
        phases: executionPlan.phases,
        total_agents: decomposition.length,
        has_dependencies: dependencies.length > 0
      }
    };
    
    return doc;
  }

  generateId() {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  describeIntent(query) {
    // Gerar descrição da intenção identificada
    return `Usuário solicita: ${query}`;
  }

  buildChainOfThought(decomposition, dependencies, executionPlan) {
    return {
      step1_decomposition: `Identificados ${decomposition.length} agentes necessários: ${decomposition.map(d => d.agent).join(', ')}`,
      step2_dependencies: dependencies.length > 0 
        ? `Dependências encontradas: ${JSON.stringify(dependencies)}`
        : 'Sem dependências entre agentes',
      step3_memory: 'Memória filtrada para contexto relevante',
      step4_priority: `Plano de execução: ${executionPlan.phases.length} fases`
    };
  }

  buildTaskDistribution(decomposition, dependencies, executionPlan) {
    const distribution = [];
    
    for (const task of decomposition) {
      const phase = this.findPhase(task.agent, executionPlan);
      const taskDeps = dependencies.find(d => d.agent === task.agent);
      
      distribution.push({
        agent: task.agent,
        task_description: task.task,
        expected_output: task.expectedOutput,
        priority: phase,
        depends_on: taskDeps?.dependsOn || [],
        status: 'pending'
      });
    }
    
    return distribution;
  }

  findPhase(agent, executionPlan) {
    for (let i = 0; i < executionPlan.phases.length; i++) {
      if (executionPlan.phases[i].agents.includes(agent)) {
        return i + 1;
      }
    }
    return 1;
  }
}
```

---

#### Tarefa 10.2: Criar o Sistema de Controle de Dependências

**Arquivo:** `server/src/services/agents/orchestrator/execution-controller.js`

```javascript
class ExecutionController {
  constructor() {
    this.runningTasks = new Map();
    this.completedTasks = new Map();
    this.pendingTasks = new Map();
  }

  async execute(doc, coordinatorAgents) {
    // Inicializar tarefas pendentes
    for (const task of doc.task_distribution) {
      this.pendingTasks.set(task.agent, task);
    }
    
    // Executar por fases
    for (const phase of doc.execution_control.phases) {
      await this.executePhase(phase, doc, coordinatorAgents);
    }
    
    // Coletar resultados
    return this.collectResults();
  }

  async executePhase(phase, doc, coordinatorAgents) {
    const tasksToRun = phase.agents.map(agent => {
      const task = this.pendingTasks.get(agent);
      return this.runTask(task, doc, coordinatorAgents[agent]);
    });
    
    // Executar em paralelo se permitido
    if (phase.canParallelize) {
      await Promise.all(tasksToRun);
    } else {
      for (const taskPromise of tasksToRun) {
        await taskPromise;
      }
    }
  }

  async runTask(task, doc, agent) {
    // Verificar dependências
    if (!this.dependenciesMet(task)) {
      throw new Error(`Dependências não satisfeitas para ${task.agent}`);
    }
    
    // Marcar como em execução
    this.runningTasks.set(task.agent, task);
    this.pendingTasks.delete(task.agent);
    
    try {
      // Coletar outputs de dependências
      const dependencyOutputs = this.getDependencyOutputs(task.depends_on);
      
      // Executar agente
      const result = await agent.execute({
        memory: doc.memory,
        query: doc.original_query,
        task: task.task_description,
        dependencyOutputs
      });
      
      // Marcar como completo
      this.completedTasks.set(task.agent, {
        ...task,
        status: 'completed',
        result
      });
      this.runningTasks.delete(task.agent);
      
      return result;
    } catch (error) {
      this.completedTasks.set(task.agent, {
        ...task,
        status: 'failed',
        error: error.message
      });
      this.runningTasks.delete(task.agent);
      throw error;
    }
  }

  dependenciesMet(task) {
    for (const dep of task.depends_on) {
      const completedTask = this.completedTasks.get(dep);
      if (!completedTask || completedTask.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  getDependencyOutputs(dependencies) {
    const outputs = {};
    for (const dep of dependencies) {
      const task = this.completedTasks.get(dep);
      if (task) {
        outputs[dep] = task.result;
      }
    }
    return outputs;
  }

  collectResults() {
    const results = {};
    for (const [agent, task] of this.completedTasks) {
      results[agent] = task;
    }
    return results;
  }
}

module.exports = { ExecutionController };
```

---

#### Tarefa 10.3: Exemplo de DOC Gerado

**Exemplo para query:** "Analise meus gastos dos últimos 3 meses e sugira ajustes no orçamento para economizar mais"

```json
{
  "id": "doc_1707091200000_abc123xyz",
  "timestamp": "2026-02-04T12:00:00.000Z",
  
  "original_query": "Analise meus gastos dos últimos 3 meses e sugira ajustes no orçamento para economizar mais",
  
  "memory": {
    "context": [
      {
        "user": "Quero economizar para uma viagem",
        "ai": "Entendido, você quer economizar para uma viagem."
      }
    ],
    "critical_data": {
      "financial_goals": ["Viagem - economizar R$ 5.000 até dezembro"],
      "preferences": ["Prefere cortar gastos de lazer a alimentação"]
    }
  },
  
  "orchestrator_analysis": {
    "intent": "Usuário deseja análise de gastos históricos + sugestão de ajustes no orçamento",
    "chain_of_thought": {
      "step1_decomposition": "Identificados 2 agentes necessários: analysis, planning",
      "step2_dependencies": "Planejamento depende de Análise (precisa dos dados de gastos)",
      "step3_memory": "Memória filtrada: meta de viagem e preferência de corte",
      "step4_priority": "Plano de execução: 2 fases sequenciais"
    }
  },
  
  "task_distribution": [
    {
      "agent": "analysis",
      "task_description": "Analisar padrão de gastos dos últimos 3 meses, identificando categorias principais e tendências",
      "expected_output": "Relatório com breakdown por categoria, comparativo mensal, padrões identificados",
      "priority": 1,
      "depends_on": [],
      "status": "pending"
    },
    {
      "agent": "planning",
      "task_description": "Com base na análise, sugerir ajustes no orçamento para aumentar economia mensal",
      "expected_output": "Plano de ajustes com valores específicos por categoria, projeção de economia",
      "priority": 2,
      "depends_on": ["analysis"],
      "status": "pending"
    }
  ],
  
  "execution_control": {
    "phases": [
      { "phaseNumber": 1, "agents": ["analysis"], "canParallelize": false },
      { "phaseNumber": 2, "agents": ["planning"], "canParallelize": false }
    ],
    "total_agents": 2,
    "has_dependencies": true
  }
}
```

---

## 📊 Resumo de Arquivos a Criar

### Fase 3 - Agente Júnior

| Arquivo | Descrição |
|---------|-----------|
| `server/src/services/agents/junior/index.js` | API pública do Júnior |
| `server/src/services/agents/junior/junior-agent.js` | Lógica principal |
| `server/src/services/agents/junior/classifier.js` | Classificador de complexidade |
| `server/src/services/agents/junior/resolver.js` | Resolutor de tarefas |
| `server/src/services/agents/junior/prompts/junior-system.txt` | Prompt de sistema |
| `server/src/services/agents/junior/launch/index.js` | API de lançamentos |
| `server/src/services/agents/junior/launch/transaction-launcher.js` | Lógica de lançamento |
| `server/src/services/agents/junior/launch/category-loader.js` | Carregador de categorias |
| `server/src/services/agents/junior/launch/prompts/launch-system.txt` | Prompt de lançamentos |
| `server/src/services/search/index.js` | API de busca |
| `server/src/services/search/serper-client.js` | Cliente Serper |
| `server/src/services/search/prompts/search-optimizer.txt` | Otimizador de buscas |

**Total Fase 3:** 12 arquivos

### Fase 4 - Orquestrador

| Arquivo | Descrição |
|---------|-----------|
| `server/src/services/agents/orchestrator/index.js` | API pública |
| `server/src/services/agents/orchestrator/orchestrator-agent.js` | Lógica principal |
| `server/src/services/agents/orchestrator/task-decomposer.js` | Decomposição de tarefas |
| `server/src/services/agents/orchestrator/dependency-resolver.js` | Resolução de dependências |
| `server/src/services/agents/orchestrator/memory-filter.js` | Filtro de memória |
| `server/src/services/agents/orchestrator/priority-manager.js` | Gerenciador de prioridades |
| `server/src/services/agents/orchestrator/doc-builder.js` | Construtor do DOC |
| `server/src/services/agents/orchestrator/execution-controller.js` | Controlador de execução |
| `server/src/services/agents/orchestrator/prompts/orchestrator-system.txt` | Prompt de sistema |

**Total Fase 4:** 9 arquivos

**Total Geral:** 21 arquivos

---

## ⚙️ Configurações Necessárias

### Variáveis de Ambiente (adicionar ao .env)

```env
# API Serper (Pesquisa)
SERPER_API_KEY=sua_chave_aqui

# Timeouts
SEARCH_TIMEOUT=10000
AGENT_TIMEOUT=80000
```

### Dependências (package.json)

As dependências `axios` e `dotenv` já estão instaladas da Fase 1.

---

## 🧪 Testes Recomendados

### Teste 1: Classificação do Júnior
```
1. Enviar "Quanto gastei ontem?" → Deve classificar como TRIVIAL
2. Enviar "Gastei R$50 no almoço" → Deve classificar como SIMPLES
3. Enviar "Como estão meus gastos?" → Deve classificar como INTERMEDIÁRIA
4. Enviar "Analise meus investimentos e sugira ajustes" → Deve classificar como COMPLEXA
```

### Teste 2: Detecção de Informações Faltantes
```
1. Enviar "Gastei 200" → Deve perguntar "Você gastou em que esse R$ 200,00?"
2. Responder "no supermercado" → Deve completar e inserir
```

### Teste 3: Fluxo de Lançamento
```
1. Enviar "Gastei R$150 no supermercado"
2. Verificar: carregou apenas despesas.json
3. Verificar: categoria escolhida = Alimentação
4. Verificar: subcategoria = Supermercado
5. Verificar: transação inserida no banco
```

### Teste 4: Orquestrador
```
1. Enviar "Analise meus gastos e sugira um orçamento"
2. Verificar DOC gerado com 2 agentes
3. Verificar dependência: planning depende de analysis
4. Verificar execução em 2 fases
```

---

## 📋 Checklist de Implementação

### Objetivo 6 - Agente Júnior
- [ ] Estrutura base criada (index.js, junior-agent.js)
- [ ] Classificador implementado com 4 níveis
- [ ] Resolutor implementado para cada nível
- [ ] Detecção de informações faltantes funcionando
- [ ] Follow-ups registrados na memória
- [ ] Prompt de sistema criado

### Objetivo 7 - Fluxo de Lançamentos
- [ ] CategoryLoader carregando apenas o tipo correto
- [ ] TransactionLauncher com fluxo de 2 passos (categoria → subcategoria)
- [ ] nano-bridge atualizado com novos métodos
- [ ] Economia de tokens verificada

### Objetivo 8 - APIs de Pesquisa
- [ ] SerperClient implementado
- [ ] Otimizador de queries funcionando
- [ ] Integração com Júnior completa

### Objetivo 9 - Orquestrador
- [ ] TaskDecomposer identificando agentes necessários
- [ ] DependencyResolver encontrando dependências
- [ ] MemoryFilter filtrando memória relevante
- [ ] PriorityManager definindo ordem de execução

### Objetivo 10 - Estrutura do DOC
- [ ] DocBuilder gerando DOC completo
- [ ] ExecutionController controlando dependências
- [ ] Sistema liberando agentes apenas quando dependências satisfeitas

---

## 📅 Ordem de Implementação Sugerida

1. **Dia 1:** Objetivo 6 (Tarefas 6.1 a 6.4) - Estrutura base do Júnior
2. **Dia 1:** Objetivo 6 (Tarefas 6.5 e 6.6) - Prompts e follow-ups
3. **Dia 2:** Objetivo 7 (Todas as tarefas) - Fluxo de lançamentos
4. **Dia 2:** Objetivo 8 (Todas as tarefas) - APIs de pesquisa
5. **Dia 3:** Objetivo 9 (Tarefas 9.1 a 9.4) - Estrutura do Orquestrador
6. **Dia 3:** Objetivo 9 (Tarefas 9.5 a 9.7) - Filtros e prompts
7. **Dia 4:** Objetivo 10 (Todas as tarefas) - DOC e controle de execução
8. **Dia 4:** Testes de integração completos

---

**Data de Criação:** 04 de fevereiro de 2026  
**Autor:** GitHub Copilot (Claude Opus 4.5)  
**Status:** 📝 PRONTO PARA IMPLEMENTAÇÃO
