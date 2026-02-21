# Plano de Implementação - Sistema Multi-Agente v2.0

## 📋 Visão Geral do Plano

Este plano implementa rigorosamente a arquitetura definida na constituição do sistema, respeitando a separação fundamental entre **lógica determinística** e **inferência por IA**, com foco em código limpo, organização e manutenibilidade.

---

## 🎯 FASE 1: Fundação e Infraestrutura Core

**Objetivo:** Estabelecer a base sólida do sistema com foco em organização, separação de responsabilidades e padrões de código limpo.

### Objetivo 1.1: Estrutura de Diretórios e Arquitetura Base

**Justificativa:** Código bem organizado facilita manutenção, testes e evolução futura. A estrutura deve refletir a separação lógica/IA definida na constituição.

**Tarefas:**

1. **Criar estrutura de diretórios no servidor**
   ```
   server/
   ├── src/
   │   ├── core/           # Lógica pura (determinística)
   │   ├── agents/         # Agentes com IA
   │   ├── tools/          # Ferramentas e APIs externas
   │   ├── utils/          # Utilidades e helpers
   │   └── config/         # Configurações
   ├── tests/              # Testes unitários e integração
   ├── docs/               # Documentação (já existente)
   └── package.json
   ```

2. **Definir padrões de nomenclatura e convenções**
   - Criar documento `CODING_STANDARDS.md` com:
     - Nomenclatura de arquivos, classes e funções
     - Padrões de comentários e documentação inline
     - Convenções de export/import
     - Estrutura de logs e error handling

3. **Configurar ambiente de desenvolvimento**
   - Setup de linting (ESLint) com regras estritas
   - Prettier para formatação consistente
   - TypeScript para type safety (opcional mas recomendado)
   - Configurar scripts npm: `dev`, `test`, `lint`, `format`

4. **Criar sistema de logging estruturado**
   - Implementar logger centralizado com níveis (debug, info, warn, error)
   - Separar logs de lógica vs logs de IA
   - Incluir metadata: timestamp, componente, tipo (logic/ai)

### Objetivo 1.2: Sistema de Memória Contextual (Lógica Pura)

**Justificativa:** A memória é o coração do sistema. Implementação puramente lógica conforme constituição.

**Tarefas:**

1. **Implementar módulo de persistência (`core/memory/storage.js`)**
   - Conexão com MongoDB
   - CRUD operations: `loadMemory(chatId)`, `saveMemory(chatId, memory)`
   - Validação de estrutura de dados
   - Error handling robusto (retry logic, fallbacks)

2. **Implementar estrutura de memória (`core/memory/structure.js`)**
   ```javascript
   class Memory {
     constructor() {
       this.recent = [];      // Últimos 2 ciclos completos
       this.old = [];         // Resumos de ciclos anteriores
       this.wordCount = 0;    // Contagem de palavras total
     }
     
     addCycle(userInput, aiResponse) { /* lógica pura */ }
     moveToOld() { /* lógica pura */ }
     shouldCompress() { /* lógica pura: wordCount > 2250 */ }
   }
   ```

3. **Implementar contador de palavras (`core/memory/counter.js`)**
   - Função pura: `countWords(text)` retorna número
   - Função: `calculateTotalWords(memory)` soma recent + old
   - Sem dependências externas, apenas string manipulation

4. **Criar sistema de ciclos (`core/memory/cycle.js`)**
   ```javascript
   class Cycle {
     constructor(userInput, aiResponse, timestamp) {
       this.userInput = userInput;
       this.aiResponse = aiResponse;
       this.timestamp = timestamp;
       this.id = generateCycleId(); // UUID
     }
   }
   ```

5. **Implementar testes unitários**
   - Testar adição de ciclos
   - Testar movimentação para memória antiga
   - Testar contagem de palavras
   - Testar detecção de limite (90%)

### Objetivo 1.3: Agentes de IA para Memória (Nano e Full)

**Justificativa:** Implementar os dois pontos de IA na gestão de memória conforme constituição.

**Tarefas:**

1. **Criar módulo de resumo de ciclos (`agents/memory/summarizer.js`)**
   - Modelo: GPT-5-nano (sem reasoning/verbosity parameters)
   - Input: objeto Cycle completo
   - Prompt: "Resuma preservando valores numéricos, datas, decisões importantes"
   - Output: string de resumo
   - Error handling: fallback para preservar ciclo completo se IA falhar

2. **Criar módulo de compressão (`agents/memory/compressor.js`)**
   - Modelo: GPT-5.2 (Reasoning: High, Verbosity: Low)
   - Input: array de resumos antigos
   - Prompt detalhado: preservar metas, limites, preferências, decisões
   - Output: resumo comprimido (~1000 palavras)
   - Validação: garantir que output tem < 1500 palavras

3. **Integrar IA com lógica de memória (`core/memory/manager.js`)**
   ```javascript
   class MemoryManager {
     async updateAfterCycle(chatId, userInput, aiResponse) {
       // LÓGICA: adicionar aos recentes
       // LÓGICA: mover mais antigo para old
       // IA (nano): resumir ciclo que saiu
       // LÓGICA: verificar limite
       // SE > 90%: IA (full): comprimir
       // LÓGICA: salvar no banco
     }
   }
   ```

4. **Implementar testes de integração**
   - Simular múltiplos ciclos até atingir limite
   - Verificar chamada correta dos agentes de IA
   - Validar que memória comprimida mantém info crítica (mock de IA)

### Objetivo 1.4: Configuração de Clientes de IA

**Justificativa:** Abstração para trocar providers facilmente, facilitar testes e manter código desacoplado.

**Tarefas:**

1. **Criar interface abstrata de IA (`utils/ai/client.js`)**
   ```javascript
   class AIClient {
     async complete(prompt, options = {}) {
       throw new Error('Must implement');
     }
   }
   ```

2. **Implementar cliente OpenAI (`utils/ai/openai-client.js`)**
   - Suporte para GPT-5.2, GPT-5-mini, GPT-5-nano
   - Parsing de parâmetros: reasoning, verbosity (quando aplicável)
   - Retry logic com exponential backoff
   - Rate limiting awareness

3. **Criar factory de modelos (`utils/ai/model-factory.js`)**
   ```javascript
   const ModelFactory = {
     getNano: () => new OpenAIClient('gpt-5-nano'),
     getMini: (reasoning, verbosity) => new OpenAIClient('gpt-5-mini', {reasoning, verbosity}),
     getFull: (reasoning, verbosity) => new OpenAIClient('gpt-5.2', {reasoning, verbosity})
   };
   ```

4. **Criar mock de IA para testes (`tests/mocks/ai-mock.js`)**
   - Simular respostas de IA com latência configurável
   - Permitir injetar respostas específicas por teste
   - Contar chamadas para validar uso correto de modelos

---

## 🎯 FASE 2: Camadas de Roteamento e Ferramentas

**Objetivo:** Implementar o sistema de roteamento inteligente e as ferramentas especializadas, mantendo separação clara entre decisão (IA) e execução (lógica).

### Objetivo 2.1: Agente Junior (First Responder)

**Justificativa:** Primeiro ponto de contato, decisão local com raciocínio médio conforme constituição.

**Tarefas:**

1. **Implementar estrutura do Junior (`agents/junior/index.js`)**
   - Modelo: GPT-5-mini (Reasoning: Medium, Verbosity: Low)
   - Input: memória completa + query do usuário
   - Output: JSON estruturado com decisão
   - Validação estrita do JSON de saída

2. **Criar prompt system do Junior (`agents/junior/prompt.js`)**
   ```javascript
   const JUNIOR_SYSTEM_PROMPT = `
   Você é o agente de roteamento. Analise a query e classifique em:
   - bridge_query: consultas a dados financeiros
   - bridge_insert: lançamento de transações
   - serper: busca na internet
   - escalate: tarefas complexas/multi-tarefa
   
   Retorne JSON:
   {
     "decision": "...",
     "reasoning": "...",
     "missing_info": [...],
     "needs_followup": true/false,
     "followup_question": "..."
   }
   `;
   ```

3. **Implementar validador de completude (`agents/junior/validators.js`)**
   - Para `bridge_insert`: verificar presença de valor e categoria/descrição
   - Para `bridge_query`: verificar clareza da solicitação
   - Retornar campos faltantes de forma estruturada

4. **Implementar sistema de follow-up (`agents/junior/followup.js`)**
   - Detectar informações faltantes via IA
   - Inferir contexto da memória recente (IA analisa últimos 2 ciclos)
   - Gerar pergunta contextualizada ao usuário
   - Marcar na memória como "continuação de contexto"

5. **Criar roteador lógico (`core/router/dispatcher.js`)**
   ```javascript
   class Dispatcher {
     async route(decision, query, memory) {
       switch(decision) {
         case 'bridge_query': return await this.financeBridge.query(...);
         case 'bridge_insert': return await this.financeBridge.insert(...);
         case 'serper': return await this.serper.search(...);
         case 'escalate': return await this.orchestrator.handle(...);
       }
     }
   }
   ```

### Objetivo 2.2: Finance Bridge - Camada de Query

**Justificativa:** Interface estruturada para o banco de dados, conversão NL→JSON com IA, execução puramente lógica.

**Tarefas:**

1. **Criar schema do Finance Bridge (`tools/finance-bridge/schema.js`)**
   - Definir todos os campos aceitos
   - Definir tipos e validações
   - Documentar períodos inteligentes (current_month, last_quarter, etc.)
   - Exportar como constante para ser enviada à IA

2. **Implementar conversor NL→JSON (`tools/finance-bridge/query-builder.js`)**
   - Modelo: GPT-5-nano
   - Input: query em NL + schema completo
   - Prompt: "Converta para JSON seguindo o schema exato"
   - Output: JSON estruturado
   - Validação: verificar se JSON está conforme schema

3. **Implementar validador de query (`tools/finance-bridge/validators.js`)**
   - Validação de tipos (amount é number, date é ISO 8601)
   - Validação de ranges (datas válidas, valores positivos)
   - Sanitização de strings (prevenir injection)
   - Checagem de campos obrigatórios

4. **Implementar executor de query (`tools/finance-bridge/executor.js`)**
   - Converter JSON para query MongoDB
   - Resolver períodos inteligentes (lógica pura: current_month → calcular datas)
   - Aplicar lógica booleana (AND, OR, NOT)
   - Executar query
   - Retornar dados brutos (sem processamento adicional)

5. **Criar testes end-to-end**
   - Query simples: "Gastos do mês"
   - Query complexa: "Alimentação entre R$120-145, últimos 6 dias, exceto restaurantes"
   - Validar conversão NL→JSON→MongoDB→resultado

### Objetivo 2.3: Finance Bridge - Camada de Insert

**Justificativa:** Pipeline otimizado de tokens com 3 agentes de IA conforme constituição.

**Tarefas:**

1. **Implementar classificador de tipo (`tools/finance-bridge/insert/classifier.js`)**
   - Modelo: GPT-5-nano
   - Input: query do usuário
   - Output: "expense" ou "income"
   - Carregamento do JSON apropriado (lógica)

2. **Implementar seletor de categoria (`tools/finance-bridge/insert/category-selector.js`)**
   - Modelo: GPT-5-mini (Reasoning: Medium, Verbosity: Low)
   - Input: lista de categorias (extraída do JSON) + query
   - Análise contextual: "Uber Eats" → Alimentação, não Transporte
   - Output: categoria escolhida
   - Validação: categoria existe no JSON

3. **Implementar montador de lançamento (`tools/finance-bridge/insert/assembler.js`)**
   - Modelo: GPT-5-nano
   - Input: subcategorias da categoria escolhida + query completa
   - Extração: valor, data, descrição, método de pagamento
   - Output: JSON de lançamento completo
   - Validação: campos obrigatórios presentes

4. **Implementar orquestrador de insert (`tools/finance-bridge/insert/index.js`)**
   ```javascript
   async function insert(query) {
     // PASSO 1: Classificar tipo (nano)
     const type = await classifier.classify(query);
     
     // LÓGICA: Carregar JSON apropriado
     const json = loadJSON(type); // despesas.json ou receitas.json
     
     // LÓGICA: Extrair apenas categorias
     const categories = extractCategories(json);
     
     // PASSO 2: Selecionar categoria (mini)
     const category = await categorySelector.select(categories, query);
     
     // LÓGICA: Buscar subcategorias
     const subcategories = extractSubcategories(json, category);
     
     // PASSO 3: Montar lançamento (nano)
     const transaction = await assembler.assemble(subcategories, query);
     
     // LÓGICA: Validar e executar insert no MongoDB
     validate(transaction);
     return await db.insert(transaction);
   }
   ```

5. **Criar testes de pipeline**
   - Lançamento completo: "Gastei R$50 no almoço"
   - Lançamento incompleto: "Gastei 200" → deve acionar followup do Junior
   - Casos ambíguos: "Uber" vs "Uber Eats"

### Objetivo 2.4: APIs Externas (Serper, Brapi, Tavily)

**Justificativa:** Ferramentas de busca externa, execução puramente lógica após decisão de uso.

**Tarefas:**

1. **Implementar cliente Serper (`tools/search/serper.js`)**
   - Configuração de API key via .env
   - Método: `search(query)` retorna resultados brutos
   - Error handling: timeout, rate limit, API down
   - Logging estruturado

2. **Implementar cliente Brapi (`tools/search/brapi.js`)**
   - Endpoints: cotações, fundamentos, histórico
   - Métodos: `getQuote(ticker)`, `getFundamentals(ticker)`
   - Cache de resultados (opcional: 5 minutos)
   - Error handling específico de mercado (ativo não encontrado, mercado fechado)

3. **Implementar cliente Tavily (`tools/search/tavily.js`)**
   - Método: `deepSearch(query, context)`
   - Suporte para contexto de busca
   - Parsing de resultados detalhados
   - Error handling robusto

4. **Criar abstração de busca (`tools/search/index.js`)**
   ```javascript
   class SearchManager {
     async search(query, source = 'serper') {
       switch(source) {
         case 'serper': return await this.serper.search(query);
         case 'brapi': return await this.brapi.search(query);
         case 'tavily': return await this.tavily.deepSearch(query);
       }
     }
   }
   ```

5. **Implementar testes de integração**
   - Mock de APIs para testes isolados
   - Testes de error handling (timeout, erro 500, rate limit)
   - Validar estrutura de resposta de cada API

---

## 🎯 FASE 3: Orquestração e Coordenadores

**Objetivo:** Implementar a camada de orquestração estratégica e os agentes coordenadores especializados, respeitando a hierarquia de decisão definida na constituição.

### Objetivo 3.1: Agente Orquestrador (Strategic Brain)

**Justificativa:** Decisão estratégica global, coordenação de múltiplos agentes. Modelo Full com Reasoning High conforme constituição.

**Tarefas:**

1. **Ler e processar contratos dos coordenadores**
   - Ler `server/docs/md/diferenças_coor.md`
   - Extrair descrição de cada coordenador (Análise, Investimentos, Planejamento)
   - Estruturar contratos em formato consumível pela IA
   - Criar arquivo `agents/orchestrator/contracts.js` com contratos processados

2. **Implementar estrutura do Orquestrador (`agents/orchestrator/index.js`)**
   - Modelo: GPT-5.2 (Reasoning: High, Verbosity: Low)
   - Input: memória completa + query + contratos dos coordenadores
   - Chain of Thought forçado (4 etapas: decomposição, dependências, memorização, priorização)
   - Output: DOC (Documento de Direção) estruturado

3. **Criar prompt system do Orquestrador (`agents/orchestrator/prompt.js`)**
   ```javascript
   const ORCHESTRATOR_PROMPT = `
   Você é o Orquestrador Estratégico. Recebe tarefas complexas e coordena agentes especializados.
   
   CONTRATOS DOS AGENTES:
   ${contracts}
   
   PROCESSO OBRIGATÓRIO (Chain of Thought):
   
   ETAPA 1 - DECOMPOSIÇÃO:
   Quais áreas estão envolvidas?
   - Precisa de análise de padrões? → Agente de Análise
   - Envolve investimentos/mercado? → Agente de Investimentos
   - Requer planejamento/orçamento? → Agente de Planejamento
   
   ETAPA 2 - DEPENDÊNCIAS:
   Existe ordem de execução? Alguma tarefa precisa de output de outra?
   
   ETAPA 3 - MEMORIZAÇÃO:
   O que da memória é essencial para cada agente? Filtre informações relevantes.
   
   ETAPA 4 - PRIORIZAÇÃO:
   Defina ordem lógica (prioridade: 1, 2, 3...)
   
   Retorne JSON (DOC):
   {
     "request_id": "uuid",
     "original_query": "...",
     "reasoning": "Raciocínio completo seguindo as 4 etapas",
     "execution_plan": {
       "agents": [
         {
           "agent": "analysis|investments|planning",
           "priority": number,
           "task_description": "...",
           "expected_output": "...",
           "memory_context": "...",
           "dependencies": []
         }
       ]
     }
   }
   `;
   ```

4. **Implementar validador de DOC (`agents/orchestrator/validators.js`)**
   - Verificar estrutura do JSON
   - Validar que prioridades são únicas e sequenciais
   - Verificar que dependências referenciam agentes existentes
   - Garantir que reasoning contém as 4 etapas

5. **Criar testes de decomposição**
   - Query simples (1 agente): "Analise meus gastos do mês"
   - Query complexa (2 agentes com dependência): "Analise investimentos e sugira ajustes no orçamento"
   - Query muito complexa (3 agentes): "Análise completa + recomendações de investimento + plano de ação"

### Objetivo 3.2: Sistema de Controle de Dependências

**Justificativa:** Execução lógica e determinística conforme ordem definida pelo Orquestrador.

**Tarefas:**

1. **Implementar gerenciador de execução (`core/orchestrator/execution-manager.js`)**
   ```javascript
   class ExecutionManager {
     constructor() {
       this.results = new Map(); // Armazena outputs por agent.id
     }
     
     async execute(doc) {
       const sorted = this.sortByPriority(doc.execution_plan.agents);
       
       for (const agent of sorted) {
         await this.waitForDependencies(agent.dependencies);
         const input = this.prepareInput(agent);
         const result = await this.executeAgent(agent, input);
         this.results.set(agent.agent, result);
       }
       
       return this.results;
     }
   }
   ```

2. **Implementar fila de execução (`core/orchestrator/queue.js`)**
   - Ordenar agentes por prioridade
   - Criar sistema de espera para dependências
   - Timeout configurável por agente (ex: 60s)
   - Log de progresso da execução

3. **Implementar preparador de input (`core/orchestrator/input-builder.js`)**
   ```javascript
   function prepareInput(agent, results) {
     return {
       memory_context: agent.memory_context,
       task_description: agent.task_description,
       expected_output: agent.expected_output,
       dependency_outputs: agent.dependencies.map(dep => results.get(dep))
     };
   }
   ```

4. **Criar sistema de notificação de conclusão**
   - Event emitter para sinalizar conclusão de agente
   - Listeners para agentes dependentes
   - Timeout handling: se agente não responder em X segundos, falha

5. **Implementar testes de execução**
   - Execução linear (sem dependências): A → B → C
   - Execução com dependência simples: A → B (B depende de A)
   - Execução com dependências complexas: A → B, A → C, B+C → D

### Objetivo 3.3: Agentes Coordenadores (Análise, Investimentos, Planejamento)

**Justificativa:** Agentes especializados com metacognição, decisões não triviais. Modelo Full com Reasoning High conforme constituição.

**Tarefas:**

1. **Criar estrutura base do coordenador (`agents/coordinators/base.js`)**
   ```javascript
   class BaseCoordinator {
     constructor(name, availableTools) {
       this.name = name;
       this.tools = availableTools;
       this.model = ModelFactory.getFull('high', 'low');
     }
     
     async execute(input) {
       // Chain of Thought obrigatório (6 etapas)
       const prompt = this.buildPrompt(input);
       const response = await this.model.complete(prompt);
       return this.parseResponse(response);
     }
   }
   ```

2. **Implementar prompt com Chain of Thought (`agents/coordinators/prompt-template.js`)**
   ```javascript
   const COT_TEMPLATE = `
   Você é o Agente ${name}. Siga o processo obrigatório:
   
   ETAPA 1 - CLAREZA DE MISSÃO:
   - Qual é EXATAMENTE minha entrega esperada?
   - O que o Orquestrador quer que EU faça?
   - Qual o formato de saída esperado?
   
   ETAPA 2 - INVENTÁRIO DE RECURSOS:
   - Ferramentas disponíveis: ${tools}
   - Qual ferramenta é mais adequada para esta tarefa?
   - Preciso usar mais de uma?
   
   ETAPA 3 - PLANEJAMENTO:
   - Qual a sequência lógica de uso das ferramentas?
   - Há interdependência entre ferramentas?
   
   ETAPA 4 - EXECUÇÃO:
   [Use ferramentas aqui]
   
   ETAPA 5 - VALIDAÇÃO:
   - Respondi completamente?
   - A qualidade está adequada?
   
   ETAPA 6 - FORMATAÇÃO:
   Retorne JSON:
   {
     "agent": "${name}",
     "task_completed": true/false,
     "reasoning": "Raciocínio completo das 6 etapas",
     "tools_used": [...],
     "result": { ... },
     "metadata": { "confidence": "high|medium|low" }
   }
   `;
   ```

3. **Implementar Agente de Análise (`agents/coordinators/analysis.js`)**
   - Especialista em análise de padrões financeiros
   - Ferramentas: Finance Bridge, Serper, Tavily, Módulo Matemático
   - Tipos de análise: tendências, categorização, comparações
   - Validar que sempre usa Finance Bridge para dados históricos

4. **Implementar Agente de Investimentos (`agents/coordinators/investments.js`)**
   - Especialista em análise de mercado e ativos
   - Ferramentas: Brapi, Finance Bridge, Serper, Tavily, Módulo Matemático
   - Tipos de análise: cotações, fundamentos, alocação, risco
   - Validar que sempre usa Brapi para dados de mercado

5. **Implementar Agente de Planejamento (`agents/coordinators/planning.js`)**
   - Especialista em planejamento financeiro e orçamento
   - Ferramentas: Finance Bridge, Serper, Módulo Matemático
   - Entregas: planos de ação, orçamentos, roadmaps
   - Validar que sempre estrutura outputs como planos acionáveis

### Objetivo 3.4: Módulo Matemático (Precision Engine)

**Justificativa:** Cálculos financeiros exigem precisão, bibliotecas especializadas são necessárias.

**Tarefas:**

1. **Criar interface do módulo matemático (`tools/math/index.js`)**
   - Usar biblioteca Decimal.js para precisão
   - Métodos: juros compostos, VaR, Sharpe Ratio, TIR, VPL
   - Formatação automática: R$ 1.234,56 para valores, 12,34% para percentuais

2. **Implementar funções financeiras (`tools/math/financial.js`)**
   ```javascript
   const Math = {
     compoundInterest: (principal, rate, time) => { ... },
     netPresentValue: (rate, cashFlows) => { ... },
     internalRateOfReturn: (cashFlows) => { ... },
     sharpeRatio: (returns, riskFreeRate) => { ... },
     valueAtRisk: (returns, confidence) => { ... }
   };
   ```

3. **Implementar formatadores (`tools/math/formatters.js`)**
   - `formatCurrency(value)` → "R$ 1.234,56"
   - `formatPercentage(value)` → "12,34%"
   - `formatNumber(value)` → "1.234.567"
   - Suporte para separadores de milhar e casas decimais

4. **Criar prompt de uso para coordenadores**
   ```
   MÓDULO MATEMÁTICO - REGRAS:
   1. Sempre use formatação numérica com separadores
   2. Arredonde monetários para 2 casas decimais
   3. Decomponha cálculos complexos em etapas
   4. Valide inputs antes de calcular
   
   FORMATO DE SAÍDA:
   PASSO 1: [descrição]
   Cálculo: [fórmula]
   Resultado parcial: R$ X.XXX,XX
   ```

5. **Implementar testes de precisão**
   - Validar cálculos contra valores conhecidos
   - Testar edge cases (valores muito grandes, muito pequenos)
   - Verificar formatação correta

---

## 🎯 FASE 4: Resposta Final e Integração Completa

**Objetivo:** Implementar o agente de resposta, integrar todas as camadas e criar sistema de persistência e estado para interações com sistemas externos.

### Objetivo 4.1: Agente de Resposta (Final Synthesizer)

**Justificativa:** Síntese complexa de múltiplos outputs, resposta para humanos. Modelo Full com Reasoning High e Verbosity High conforme constituição.

**Tarefas:**

1. **Implementar estrutura do Agente de Resposta (`agents/response/index.js`)**
   - Modelo: GPT-5.2 (Reasoning: High, Verbosity: High)
   - Input: memória + query original + DOC + outputs de todos coordenadores
   - Output: resposta em linguagem natural otimizada para humanos

2. **Criar prompt de síntese (`agents/response/prompt.js`)**
   ```javascript
   const RESPONSE_PROMPT = `
   Você é o Agente de Resposta. Sintetize outputs de múltiplos agentes em resposta clara para humanos.
   
   ANÁLISE INTERNA OBRIGATÓRIA:
   1. O que o usuário realmente quer saber?
   2. Quais outputs são mais relevantes?
   3. Como integrar múltiplos outputs coerentemente?
   4. Qual o melhor formato?
      - Prosa conversacional
      - Lista estruturada
      - Relatório formal
      - Resposta curta e direta
   5. Qual tom é apropriado? (encorajador, técnico, alerta, neutro)
   
   REGRAS DE FORMATAÇÃO:
   - Evite listas/bullets em conversas casuais
   - Use listas APENAS quando:
     a) Usuário pediu explicitamente
     b) Informação é essencialmente tabular
     c) Comparação lado-a-lado é necessária
   - Para relatórios: use prosa estruturada em parágrafos
   - Para respostas rápidas: seja direto e conciso
   - NUNCA use mais de 2 níveis de cabeçalhos
   
   INTEGRAÇÃO:
   - Priorize informações que respondem diretamente à query
   - Conecte outputs relacionados naturalmente
   - Evite repetição
   - Mantenha fluxo narrativo lógico
   `;
   ```

3. **Implementar seletor de formato (`agents/response/format-selector.js`)**
   - IA analisa query e outputs
   - Decide formato apropriado:
     - Conversational (padrão para queries simples)
     - Structured (para análises pedidas explicitamente)
     - Report (para solicitações formais)
     - Quick (para perguntas diretas)

4. **Implementar integrador de outputs (`agents/response/integrator.js`)**
   - Recebe outputs de múltiplos coordenadores
   - Identifica informações complementares vs redundantes
   - Cria narrativa coerente conectando outputs
   - Prioriza informações mais relevantes à query original

5. **Criar testes de síntese**
   - Output único (apenas Análise): verificar resposta direta
   - Outputs múltiplos sem dependência: verificar integração lado-a-lado
   - Outputs com dependência: verificar fluxo narrativo lógico
   - Diferentes tons: verificar adaptação adequada

### Objetivo 4.2: Sistema de Estado e Persistência para Interações Externas

**Justificativa:** Conforme ponto importante da constituição, agentes devem poder interagir com sistemas externos sem perder contexto, mantendo estado durante espera de resposta.

**Tarefas:**

1. **Criar sistema de estado de agentes (`core/state/agent-state.js`)**
   ```javascript
   class AgentState {
     constructor(agentId, chatId) {
       this.agentId = agentId;
       this.chatId = chatId;
       this.status = 'idle'; // idle, executing, waiting_external, completed
       this.currentTask = null;
       this.context = {};
       this.pendingExternalCalls = [];
       this.timestamp = Date.now();
     }
     
     saveState() { /* persiste no banco */ }
     static loadState(agentId, chatId) { /* carrega do banco */ }
   }
   ```

2. **Implementar gerenciador de chamadas externas (`core/state/external-call-manager.js`)**
   ```javascript
   class ExternalCallManager {
     async executeWithState(agentId, chatId, externalFn, params) {
       // 1. Salvar estado atual do agente
       const state = AgentState.load(agentId, chatId);
       state.status = 'waiting_external';
       state.pendingExternalCalls.push({fn: externalFn.name, params, timestamp: Date.now()});
       await state.saveState();
       
       // 2. Executar chamada externa (Finance Bridge, APIs, etc)
       try {
         const result = await externalFn(params);
         
         // 3. Recarregar estado e adicionar resultado
         const updatedState = AgentState.load(agentId, chatId);
         updatedState.status = 'executing';
         updatedState.context.lastExternalResult = result;
         updatedState.pendingExternalCalls.pop();
         await updatedState.saveState();
         
         return result;
       } catch (error) {
         // 4. Em caso de erro, salvar erro no estado
         const errorState = AgentState.load(agentId, chatId);
         errorState.status = 'error';
         errorState.context.lastError = error.message;
         await errorState.saveState();
         throw error;
       }
     }
   }
   ```

3. **Implementar recuperação de contexto (`core/state/context-recovery.js`)**
   - Ao retomar execução após chamada externa:
     - Recarregar estado completo do agente
     - Restaurar memória contextual
     - Adicionar resultado da chamada externa ao contexto
     - Continuar execução do ponto exato onde parou

4. **Integrar com Finance Bridge**
   - Modificar `tools/finance-bridge/query-builder.js` e `insert/index.js`
   - Envolver chamadas ao banco com `ExternalCallManager`
   - Exemplo:
     ```javascript
     async function queryWithState(agentId, chatId, queryNL) {
       const manager = new ExternalCallManager();
       
       // Converte NL→JSON (IA, sem estado necessário)
       const queryJSON = await nlToJson(queryNL);
       
       // Executa query no MongoDB com estado
       return await manager.executeWithState(
         agentId, 
         chatId, 
         executeMongoQuery, 
         queryJSON
       );
     }
     ```

5. **Criar testes de continuidade**
   - Simular agente executando tarefa
   - Interromper para chamada externa (Finance Bridge)
   - Simular delay de 5 segundos
   - Verificar que agente retoma com contexto completo
   - Validar que próxima tarefa é executada corretamente

### Objetivo 4.3: API HTTP e Interface Cliente

**Justificativa:** Expor sistema via HTTP para integração com frontend, manter separação de responsabilidades.

**Tarefas:**

1. **Criar servidor HTTP (`server/src/api/server.js`)**
   - Framework: Express.js
   - CORS configurado para frontend
   - Middleware de logging
   - Error handling global
   - Health check endpoint: `GET /health`

2. **Implementar endpoint de mensagem (`server/src/api/routes/message.js`)**
   ```javascript
   POST /api/message
   Body: {
     chatId: string,
     message: string,
     userId: string (opcional)
   }
   
   Response: {
     response: string,
     chatId: string,
     timestamp: number
   }
   ```

3. **Criar fluxo completo de processamento**
   ```javascript
   app.post('/api/message', async (req, res) => {
     const {chatId, message} = req.body;
     
     // 1. Carregar memória (lógica)
     const memory = await MemoryManager.load(chatId);
     
     // 2. Junior classifica (IA)
     const decision = await Junior.classify(message, memory);
     
     // 3. Dispatcher roteia (lógica)
     let result;
     if (decision.needs_followup) {
       result = {response: decision.followup_question};
     } else {
       result = await Dispatcher.route(decision, message, memory);
     }
     
     // 4. Se escalou, executar orquestração
     if (decision.decision === 'escalate') {
       const doc = await Orchestrator.plan(message, memory);
       const outputs = await ExecutionManager.execute(doc);
       result = await ResponseAgent.synthesize(message, memory, doc, outputs);
     }
     
     // 5. Atualizar memória (lógica + IA nano para resumo)
     await MemoryManager.updateAfterCycle(chatId, message, result.response);
     
     // 6. Retornar resposta
     res.json(result);
   });
   ```

4. **Implementar endpoint de histórico**
   ```javascript
   GET /api/chat/:chatId/history
   Response: {
     recent: [...],  // Últimos 2 ciclos completos
     summary: string // Resumo da memória antiga
   }
   ```

5. **Criar testes de integração E2E**
   - Teste 1: Mensagem simples (Junior → Bridge → Resposta)
   - Teste 2: Mensagem com follow-up (Junior detecta info faltante)
   - Teste 3: Mensagem complexa (Junior → Orquestrador → Coordenadores → Resposta)
   - Teste 4: Múltiplas mensagens no mesmo chat (validar memória)

### Objetivo 4.4: Documentação e Guias de Manutenção

**Justificativa:** Código limpo inclui documentação clara. Facilita onboarding e manutenção futura.

**Tarefas:**

1. **Criar guia de arquitetura (`server/docs/md/ARCHITECTURE.md`)**
   - Diagrama de fluxo completo
   - Explicação de cada camada
   - Separação IA vs Lógica com exemplos
   - Escolha de modelos (Full, Mini, Nano) com justificativas

2. **Criar guia de contribuição (`server/CONTRIBUTING.md`)**
   - Como adicionar novo agente coordenador
   - Como adicionar nova ferramenta (API externa)
   - Como modificar prompts de IA
   - Padrões de código e testes obrigatórios
   - Processo de code review

3. **Documentar cada módulo com JSDoc**
   - Todos os arquivos devem ter header comment explicando propósito
   - Funções públicas devem ter JSDoc completo
   - Exemplo:
     ```javascript
     /**
      * Classifica query do usuário e decide roteamento
      * @param {string} query - Query em linguagem natural
      * @param {Memory} memory - Memória contextual do chat
      * @returns {Promise<Decision>} Decisão estruturada com routing info
      * @throws {ValidationError} Se query é vazia ou inválida
      */
     async function classify(query, memory) { ... }
     ```

4. **Criar guia de troubleshooting (`server/docs/md/TROUBLESHOOTING.md`)**
   - Problemas comuns e soluções
   - Como debugar fluxo de agentes
   - Como validar chamadas de IA
   - Como interpretar logs
   - Checklist de validação após deploy

5. **Criar documento de decisões arquiteturais (ADR)**
   - Formato: `server/docs/adr/001-separacao-ia-logica.md`
   - Documentar decisões importantes:
     - Por que GPT-5.2 para orquestração?
     - Por que pipeline de 3 etapas no Finance Bridge insert?
     - Por que sistema de estado para chamadas externas?
   - Cada ADR deve ter: Contexto, Decisão, Consequências, Alternativas consideradas

---

## 📊 Resumo de Entregas por Fase

### FASE 1: Fundação e Infraestrutura Core
- ✅ Estrutura de diretórios organizada
- ✅ Sistema de memória contextual (lógica + IA)
- ✅ Clientes de IA abstraídos e testáveis
- ✅ Padrões de código e logging definidos

### FASE 2: Camadas de Roteamento e Ferramentas
- ✅ Agente Junior com sistema de follow-up
- ✅ Finance Bridge (query + insert) completo
- ✅ APIs externas (Serper, Brapi, Tavily)
- ✅ Módulo matemático de precisão

### FASE 3: Orquestração e Coordenadores
- ✅ Agente Orquestrador com Chain of Thought
- ✅ Sistema de controle de dependências
- ✅ 3 Agentes Coordenadores especializados
- ✅ Módulo matemático integrado

### FASE 4: Resposta Final e Integração Completa
- ✅ Agente de Resposta com síntese inteligente
- ✅ Sistema de estado para chamadas externas
- ✅ API HTTP completa com testes E2E
- ✅ Documentação técnica abrangente

---

## 🎯 Princípios de Implementação (Reforço)

### 1. Separação IA vs Lógica
- **NUNCA** misturar tomada de decisão (IA) com execução (lógica)
- Toda chamada de IA deve ser isolada em função específica
- Lógica deve ser determinística e testável sem mocks de IA

### 2. Código Limpo e Organizado
- Funções pequenas com responsabilidade única
- Nomes descritivos e auto-explicativos
- Evitar side effects não documentados
- Logging estruturado em todos os pontos críticos

### 3. Testabilidade
- Toda função pura deve ter teste unitário
- Toda integração de IA deve ter teste com mock
- Testes E2E para fluxos críticos
- Coverage mínimo de 80% em lógica pura

### 4. Manutenibilidade
- Documentação inline para contexto complexo
- README.md em cada diretório principal
- Versionamento de prompts de IA
- ADRs para decisões arquiteturais importantes

### 5. Resiliência
- Error handling em todas camadas
- Retry logic em chamadas externas
- Timeouts configuráveis
- Fallbacks onde possível (ex: memória completa se resumo falhar)

---

## 📝 Notas Finais

Este plano de implementação foi construído **exclusivamente** com base na constituição fornecida, respeitando rigorosamente:

- ✅ Separação entre IA e Lógica
- ✅ Escolha de modelos (Full, Mini, Nano) conforme especificado
- ✅ Parâmetros de Reasoning e Verbosity conforme indicado
- ✅ Fluxos de dados e responsabilidades de cada agente
- ✅ Estrutura de memória e gestão de ciclos
- ✅ Pipeline do Finance Bridge com 3 etapas
- ✅ Sistema de orquestração com Chain of Thought obrigatório
- ✅ Sistema de estado para interações com sistemas externos

**Nenhuma funcionalidade extra foi proposta.**  
**Nenhuma otimização prematura foi incluída.**  
**O objetivo é implementar corretamente o que foi definido.**

---

**Documento gerado em:** 05/02/2026  
**Versão:** 1.0  
**Status:** Pronto para implementação