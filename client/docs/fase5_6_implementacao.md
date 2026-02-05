# Plano de Implementação Detalhado
## Fase 5 e 6 - Agentes Coordenadores, Resposta Final e Fluxo Contínuo

---

## 📋 Informações do Documento

- **Fases Cobertas:** 5 e 6
- **Objetivos:** 11, 12, 13 e 14
- **Dependências:** Fases 1, 2, 3 e 4 (já implementadas)
- **Arquivos de Referência:**
  - `server/docs/md/diferenças_coor.md` - Contratos dos agentes coordenadores
  - `server/docs/md/diferenças_API.md` - Critérios de uso das APIs
  - `client/docs/visao_geral.md` - Visão geral do sistema

---

## 📌 Fase 5: Agentes Coordenadores

---

### Objetivo 11: Construir os Três Agentes Coordenadores

Os coordenadores são agentes especialistas que recebem o DOC do Orquestrador e executam tarefas complexas em suas áreas de domínio.

---

#### 11.1 Estrutura Base dos Coordenadores

**Diretório:** `server/src/services/agents/coordinators/`

**Arquivos a criar:**

| Arquivo | Descrição |
|---------|-----------|
| `coordinators/index.js` | API pública e exportação dos coordenadores |
| `coordinators/base-coordinator.js` | Classe abstrata base para todos os coordenadores |
| `coordinators/analysis/index.js` | Agente de Análise |
| `coordinators/analysis/analysis-agent.js` | Lógica principal do Agente de Análise |
| `coordinators/investments/index.js` | Agente de Investimentos |
| `coordinators/investments/investments-agent.js` | Lógica principal do Agente de Investimentos |
| `coordinators/planning/index.js` | Agente de Planejamento |
| `coordinators/planning/planning-agent.js` | Lógica principal do Agente de Planejamento |

**Tarefas:**

1. **Criar a classe base `BaseCoordinator`** que implementa o pipeline padrão de 6 passos:
   - Recepção
   - Metacognição
   - Planejamento Interno
   - Execução
   - Validação
   - Entrega Estruturada

2. **Implementar interface comum** com métodos:
   ```javascript
   class BaseCoordinator {
     async process(memory, query, doc, taskInfo) {}
     async healthCheck() {}
     getCapabilities() {}
     getContract() {}
   }
   ```

---

#### 11.2 Agente de Análise (O Observador de Comportamento)

**Diretório:** `server/src/services/agents/coordinators/analysis/`

**Arquivos a criar:**

| Arquivo | Descrição |
|---------|-----------|
| `analysis-agent.js` | Lógica principal do agente |
| `analyzers/spending-analyzer.js` | Análise de gastos por categoria |
| `analyzers/pattern-detector.js` | Detecção de padrões (assinaturas, duplicidades) |
| `analyzers/cashflow-analyzer.js` | Análise de fluxo de caixa |
| `analyzers/deviation-alerter.js` | Alertas de desvio da média histórica |
| `prompts/analysis-system.txt` | Prompt de sistema do agente |
| `prompts/analysis-metacognition.txt` | Prompt de metacognição |

**Tarefas:**

1. **Implementar o Agente de Análise** que:
   - Recebe: memória + query + DOC + taskInfo
   - Usa o Finance Bridge para consultar dados históricos
   - Realiza diagnóstico de gastos por categoria
   - Identifica padrões de consumo e assinaturas esquecidas
   - Analisa o fluxo de caixa (Receitas vs Despesas)
   - Emite alertas quando gastos fogem da média

2. **Implementar os analisadores especializados:**

   **SpendingAnalyzer:**
   - Buscar transações por período
   - Calcular totais por categoria
   - Calcular percentuais de participação
   - Comparar com períodos anteriores
   - Formatar relatório de gastos

   **PatternDetector:**
   - Identificar cobranças recorrentes (assinaturas)
   - Detectar cobranças duplicadas
   - Identificar tendências de aumento/redução
   - Detectar gastos sazonais

   **CashflowAnalyzer:**
   - Calcular total de receitas
   - Calcular total de despesas
   - Calcular saldo (receitas - despesas)
   - Identificar meses positivos/negativos
   - Projetar tendência

   **DeviationAlerter:**
   - Calcular média histórica por categoria
   - Comparar mês atual com a média
   - Gerar alertas para desvios > 20%
   - Priorizar alertas por impacto financeiro

3. **Integrar APIs:**
   - Finance Bridge (consultas ao banco de dados)
   - Serper (pesquisas gerais quando necessário)

4. **Criar prompt de sistema** definindo:
   - Papel do agente como analista comportamental
   - Ferramentas disponíveis
   - Formato de saída esperado
   - Exemplos de análises

---

#### 11.3 Agente de Investimentos (O Estrategista de Ativos)

**Diretório:** `server/src/services/agents/coordinators/investments/`

**Arquivos a criar:**

| Arquivo | Descrição |
|---------|-----------|
| `investments-agent.js` | Lógica principal do agente |
| `portfolio/portfolio-analyzer.js` | Análise de carteira do usuário |
| `market/market-client.js` | Cliente para API Brapi |
| `market/quote-fetcher.js` | Busca de cotações |
| `market/indicators-fetcher.js` | Busca de indicadores (Selic, IPCA, etc) |
| `recommendations/aporte-recommender.js` | Recomendações de aporte |
| `calculations/investment-calculator.js` | Cálculos de investimento |
| `prompts/investments-system.txt` | Prompt de sistema do agente |
| `prompts/investments-metacognition.txt` | Prompt de metacognição |

**Tarefas:**

1. **Implementar o Agente de Investimentos** que:
   - Recebe: memória + query + DOC + taskInfo
   - Analisa a carteira de investimentos do usuário
   - Consulta cotações e indicadores via Brapi
   - Faz recomendações de aporte baseadas no perfil
   - Realiza cálculos de projeção (juros compostos, etc)

2. **Implementar o cliente Brapi:**

   **MarketClient:**
   - Conexão com API Brapi
   - Retry automático em caso de erro
   - Tratamento de rate limiting
   - Cache de cotações (5 minutos)
   - Health check da API

   **QuoteFetcher:**
   - Buscar cotação de ações (PETR4, VALE3, etc)
   - Buscar cotação de FIIs
   - Buscar cotação de criptomoedas
   - Buscar cotação de moedas (USD, EUR)
   - Formatar resposta padronizada

   **IndicatorsFetcher:**
   - Buscar taxa Selic
   - Buscar IPCA
   - Buscar CDI
   - Buscar IGP-M
   - Formatar indicadores para uso

3. **Implementar análise de carteira:**

   **PortfolioAnalyzer:**
   - Carregar posições do usuário
   - Calcular rentabilidade por ativo
   - Calcular rentabilidade total
   - Avaliar diversificação
   - Calcular exposição por setor
   - Gerar score de risco

4. **Implementar recomendações:**

   **AporteRecommender:**
   - Analisar perfil de risco do usuário
   - Avaliar disponibilidade de caixa
   - Sugerir alocação por classe de ativo
   - Recomendar ativos específicos
   - Justificar recomendações

5. **Implementar cálculos financeiros:**

   **InvestmentCalculator:**
   - Juros compostos
   - Valor presente líquido (VPL)
   - Taxa interna de retorno (TIR)
   - Projeção de rendimentos
   - Comparação entre ativos

6. **Integrar APIs:**
   - Brapi (dados de mercado) - **OBRIGATÓRIO**
   - Tavily (pesquisas profundas sobre mercado)
   - Serper (notícias gerais)
   - Finance Bridge (dados do usuário)

7. **Criar prompt de sistema** definindo:
   - Papel do agente como estrategista de ativos
   - Quando usar cada API (Brapi para dados, Tavily para análise)
   - Formato de saída de recomendações
   - Disclaimer sobre investimentos

---

#### 11.4 Agente de Planejamento (O Arquiteto de Futuro)

**Diretório:** `server/src/services/agents/coordinators/planning/`

**Arquivos a criar:**

| Arquivo | Descrição |
|---------|-----------|
| `planning-agent.js` | Lógica principal do agente |
| `budget/budget-creator.js` | Criação de orçamentos |
| `budget/budget-tracker.js` | Acompanhamento de orçamentos |
| `goals/goal-manager.js` | Gestão de metas financeiras |
| `goals/progress-tracker.js` | Acompanhamento de progresso |
| `scenarios/scenario-simulator.js` | Simulação de cenários |
| `plans/action-planner.js` | Criação de planos de ação |
| `prompts/planning-system.txt` | Prompt de sistema do agente |
| `prompts/planning-metacognition.txt` | Prompt de metacognição |

**Tarefas:**

1. **Implementar o Agente de Planejamento** que:
   - Recebe: memória + query + DOC + taskInfo
   - Cria orçamentos personalizados por categoria
   - Gerencia metas financeiras do usuário
   - Elabora planos de ação detalhados
   - Simula cenários financeiros

2. **Implementar criação de orçamentos:**

   **BudgetCreator:**
   - Analisar gastos históricos (usa dados do Agente de Análise se disponível)
   - Sugerir limites por categoria
   - Distribuir renda entre categorias
   - Ajustar por prioridades do usuário
   - Gerar orçamento estruturado

   **BudgetTracker:**
   - Comparar gastos reais vs orçamento
   - Calcular percentual de consumo
   - Gerar alertas de estouro
   - Sugerir realocações

3. **Implementar gestão de metas:**

   **GoalManager:**
   - Criar nova meta (valor alvo, prazo)
   - Editar metas existentes
   - Listar metas do usuário
   - Priorizar metas
   - Calcular valor necessário por mês

   **ProgressTracker:**
   - Calcular progresso atual
   - Estimar data de conclusão
   - Sugerir ajustes de aporte
   - Gerar relatório de progresso

4. **Implementar simulação de cenários:**

   **ScenarioSimulator:**
   - Simular aumento/redução de gastos
   - Simular aumento/redução de renda
   - Simular aportes diferentes
   - Calcular impacto em metas
   - Comparar cenários

5. **Implementar planos de ação:**

   **ActionPlanner:**
   - Criar passo a passo para sair de dívidas
   - Criar plano para atingir meta
   - Definir marcos (milestones)
   - Gerar cronograma
   - Sugerir ações imediatas

6. **Integrar APIs:**
   - Finance Bridge (dados do usuário)
   - Serper (pesquisas gerais)

7. **Criar prompt de sistema** definindo:
   - Papel do agente como planejador financeiro
   - Ferramentas disponíveis
   - Formato de saída de planos e orçamentos
   - Exemplos de planos de ação

---

### Objetivo 12: Implementar o Protocolo de Execução dos Coordenadores

Todo coordenador deve seguir um processo padronizado de trabalho para garantir qualidade e consistência.

---

#### 12.1 Pipeline de 6 Passos

**Arquivo:** `server/src/services/agents/coordinators/base-coordinator.js`

**Tarefas:**

1. **Implementar o método `process()` na classe base** que executa os 6 passos:

```javascript
async process(memory, query, doc, taskInfo) {
  // 1. RECEPÇÃO
  const context = await this.receive(memory, query, doc, taskInfo);
  
  // 2. METACOGNIÇÃO
  const reflection = await this.reflect(context);
  
  // 3. PLANEJAMENTO INTERNO
  const plan = await this.planExecution(reflection);
  
  // 4. EXECUÇÃO
  const result = await this.execute(plan);
  
  // 5. VALIDAÇÃO
  const validated = await this.validate(result);
  
  // 6. ENTREGA ESTRUTURADA
  return await this.deliver(validated);
}
```

2. **Implementar cada etapa:**

   **Recepção (`receive`):**
   - Extrair informações relevantes do DOC
   - Identificar a tarefa específica para este agente
   - Extrair contexto da memória filtrada
   - Preparar o ambiente de execução

   **Metacognição (`reflect`):**
   - Executar prompt de metacognição
   - Responder as 4 perguntas obrigatórias
   - Definir claramente a missão
   - Inventariar recursos disponíveis

   **Planejamento Interno (`planExecution`):**
   - Definir sequência de ferramentas
   - Identificar dados necessários
   - Estimar tempo de execução
   - Preparar fallbacks

   **Execução (`execute`):**
   - Executar ferramentas na ordem planejada
   - Coletar resultados intermediários
   - Tratar erros de forma resiliente
   - Manter log de execução

   **Validação (`validate`):**
   - Verificar se a tarefa foi completada
   - Validar formato do resultado
   - Verificar consistência dos dados
   - Aplicar critérios de qualidade

   **Entrega Estruturada (`deliver`):**
   - Formatar resultado no padrão esperado
   - Adicionar metadados (tempo, confiança)
   - Preparar para o Agente de Resposta
   - Retornar resultado final

---

#### 12.2 Prompt de Metacognição Guiada

**Arquivo:** `server/src/services/agents/coordinators/prompts/metacognition.txt`

**Tarefas:**

1. **Criar o prompt com as 4 perguntas obrigatórias:**

```
# METACOGNIÇÃO GUIADA

Antes de executar a tarefa, responda internamente:

## 1. CLAREZA DE MISSÃO
- Qual é EXATAMENTE minha entrega esperada?
- O que o Orquestrador quer que EU faça?
- Qual é o formato de saída esperado?

## 2. INVENTÁRIO DE RECURSOS
- Quais ferramentas tenho disponíveis?
- Quais dados eu preciso buscar?
- O que já foi fornecido na memória/contexto?

## 3. PLANEJAMENTO DE EXECUÇÃO
- Em que ordem devo usar as ferramentas?
- Quais são as dependências entre as etapas?
- Quanto tempo cada etapa deve levar?

## 4. CRITÉRIO DE QUALIDADE
- Como sei que terminei bem?
- O que caracteriza uma resposta completa?
- Quais são os mínimos aceitáveis?
```

2. **Implementar parsing das respostas** para guiar a execução

---

#### 12.3 Módulo Matemático (Precision Engine)

**Arquivo:** `server/src/services/agents/coordinators/math/math-module.js`

**Tarefas:**

1. **Criar o módulo matemático** que é ativado automaticamente quando necessário:

```javascript
class MathModule {
  // Detecção automática de necessidade
  shouldActivate(task) {}
  
  // Cálculos financeiros
  calculateCompoundInterest(principal, rate, time) {}
  calculateNPV(cashflows, rate) {}
  calculateIRR(cashflows) {}
  
  // Análises de risco
  calculateVaR(returns, confidence) {}
  calculateSharpeRatio(returns, riskFreeRate) {}
  
  // Formatação
  formatCurrency(value) {}
  formatPercentage(value) {}
}
```

2. **Definir gatilhos de ativação:**
   - Cálculos com mais de 2 operações encadeadas
   - Fórmulas financeiras (juros, VPL, TIR)
   - Projeções financeiras
   - Análises de risco

3. **Implementar regras de precisão:**
   - Sempre usar formatação numérica adequada
   - Arredondar monetários para 2 casas decimais
   - Validar inputs antes de calcular
   - Decompor cálculos complexos em etapas

---

#### 12.4 Integração dos Coordenadores ao Sistema

**Arquivos a modificar:**

| Arquivo | Modificação |
|---------|-------------|
| `services/agents/orchestrator/execution-controller.js` | Integrar coordenadores reais |
| `services/agents/index.js` | Exportar coordenadores |

**Tarefas:**

1. **Modificar o ExecutionController** para usar os coordenadores reais em vez de simulação

2. **Criar mapa de coordenadores:**
   ```javascript
   const coordinators = {
     analysis: require('./coordinators/analysis'),
     investments: require('./coordinators/investments'),
     planning: require('./coordinators/planning')
   };
   ```

3. **Implementar chamada real dos coordenadores** dentro do loop de execução do DOC

---

## 📌 Fase 6: Resposta Final e Fluxo Contínuo

---

### Objetivo 13: Construir o Agente de Resposta Final

O Agente de Resposta é quem monta a resposta definitiva que o usuário vai receber.

---

#### 13.1 Estrutura do Agente de Resposta

**Diretório:** `server/src/services/agents/response/`

**Arquivos a criar:**

| Arquivo | Descrição |
|---------|-----------|
| `response/index.js` | API pública do agente |
| `response/response-agent.js` | Lógica principal do agente |
| `response/synthesizer.js` | Sintetizador de resultados |
| `response/formatter.js` | Formatador de resposta final |
| `response/prompts/response-system.txt` | Prompt de sistema |

**Tarefas:**

1. **Implementar o Agente de Resposta** que:
   - Recebe: memória, query original, DOC, resultados dos coordenadores
   - Analisa todos os outputs
   - Decide a melhor forma de responder
   - Gera resposta final formatada

2. **Criar o Synthesizer:**

   **Synthesizer:**
   ```javascript
   class Synthesizer {
     // Combinar resultados de múltiplos agentes
     combineResults(coordinatorOutputs) {}
     
     // Identificar informações principais
     extractKeyInsights(results) {}
     
     // Priorizar informações por relevância
     prioritizeContent(insights, query) {}
     
     // Resolver conflitos entre agentes
     resolveConflicts(results) {}
     
     // Gerar estrutura da resposta
     generateResponseStructure(insights) {}
   }
   ```

3. **Criar o Formatter:**

   **Formatter:**
   ```javascript
   class Formatter {
     // Formatar valores monetários (R$ 1.234,56)
     formatCurrency(value) {}
     
     // Formatar percentuais (12,34%)
     formatPercentage(value) {}
     
     // Formatar datas (04/02/2026)
     formatDate(date) {}
     
     // Aplicar estilo Markdown
     applyMarkdown(content) {}
     
     // Gerar resposta acionável
     makeActionable(content) {}
     
     // Limitar tamanho da resposta
     truncateIfNeeded(response, maxLength) {}
   }
   ```

4. **Implementar lógica de síntese:**
   - Se apenas 1 coordenador trabalhou: resposta direta
   - Se múltiplos coordenadores: combinar insights
   - Se há conflito: priorizar mais recente/relevante
   - Se resultado parcial: informar o que foi possível

5. **Criar prompt de sistema** definindo:
   - Papel como sintetizador final
   - Regras de formatação
   - Exemplos de boas respostas
   - Como tornar respostas acionáveis

---

#### 13.2 Formatação de Resposta

**Tarefas:**

1. **Implementar regras de formatação:**
   - Números monetários: `R$ 1.234,56` (separador de milhar, 2 decimais)
   - Percentuais: `12,34%`
   - Datas: `04/02/2026`
   - Listas: bullets com emojis relevantes

2. **Implementar resposta acionável:**
   - O usuário deve saber O QUE fazer
   - Incluir próximos passos claros
   - Destacar pontos de atenção
   - Oferecer opções quando aplicável

3. **Exemplo de resposta formatada:**
   ```
   📊 **Análise dos seus gastos de janeiro/2026**
   
   Você gastou **R$ 4.523,45** este mês, um aumento de **12,3%** 
   em relação ao mês anterior.
   
   📍 **Principais categorias:**
   • Alimentação: R$ 1.234,56 (27%)
   • Transporte: R$ 892,10 (20%)
   • Lazer: R$ 678,90 (15%)
   
   ⚠️ **Atenção:** Seu gasto com delivery aumentou 45% este mês.
   
   ✅ **Sugestão:** Considere um limite de R$ 300/mês para delivery 
   para economizar aproximadamente R$ 150,00.
   ```

---

### Objetivo 14: Implementar o Fluxo de Execução Contínua

Este é o ponto mais **CRÍTICO** do sistema. Os agentes precisam conseguir usar ferramentas externas sem "morrer" no meio do processo.

---

#### 14.1 Estado de Espera (Waiting State)

**Arquivo:** `server/src/services/agents/execution/state-manager.js`

**Tarefas:**

1. **Implementar o gerenciador de estado:**

   **StateManager:**
   ```javascript
   class StateManager {
     constructor() {
       this.states = new Map(); // agentId -> state
     }
     
     // Salvar estado antes de chamar ferramenta externa
     saveState(agentId, state) {
       this.states.set(agentId, {
         ...state,
         savedAt: Date.now(),
         status: 'waiting'
       });
     }
     
     // Recuperar estado após retorno da ferramenta
     restoreState(agentId) {
       const state = this.states.get(agentId);
       if (!state) throw new Error('Estado não encontrado');
       return state;
     }
     
     // Limpar estado após conclusão
     clearState(agentId) {
       this.states.delete(agentId);
     }
     
     // Verificar timeout
     checkTimeout(agentId, timeout = 80000) {
       const state = this.states.get(agentId);
       if (!state) return false;
       return (Date.now() - state.savedAt) > timeout;
     }
   }
   ```

2. **Definir estrutura do estado:**
   ```javascript
   {
     agentId: 'analysis_1234567890',
     memory: { /* memória completa */ },
     context: { /* contexto atual */ },
     executionPlan: [ /* etapas planejadas */ ],
     currentStep: 2,
     intermediateResults: [ /* resultados parciais */ ],
     pendingTool: 'finance_bridge',
     pendingRequest: { /* requisição enviada */ },
     savedAt: 1707091200000,
     status: 'waiting'
   }
   ```

---

#### 14.2 Mecanismo de Reativação por Evento

**Arquivo:** `server/src/services/agents/execution/event-handler.js`

**Tarefas:**

1. **Implementar o handler de eventos:**

   **EventHandler:**
   ```javascript
   class EventHandler {
     constructor(stateManager) {
       this.stateManager = stateManager;
       this.listeners = new Map();
     }
     
     // Registrar callback para quando ferramenta retornar
     onToolResponse(agentId, callback) {
       this.listeners.set(agentId, callback);
     }
     
     // Processar resposta da ferramenta
     async handleToolResponse(agentId, response) {
       // 1. Recuperar estado
       const state = this.stateManager.restoreState(agentId);
       
       // 2. Verificar se não expirou
       if (this.stateManager.checkTimeout(agentId)) {
         throw new Error('Timeout: ferramenta demorou demais');
       }
       
       // 3. Integrar resposta ao estado
       state.intermediateResults.push(response);
       state.currentStep++;
       state.status = 'running';
       
       // 4. Chamar callback de reativação
       const callback = this.listeners.get(agentId);
       if (callback) {
         await callback(state, response);
       }
       
       // 5. Limpar listener
       this.listeners.delete(agentId);
     }
   }
   ```

2. **Integrar com chamadas de ferramentas:**
   - Antes de chamar ferramenta: `saveState()`
   - Após retorno: `handleToolResponse()`
   - Se timeout: tratar erro adequadamente

---

#### 14.3 Configuração de Timeout

**Tarefas:**

1. **Implementar timeout de 80 segundos:**

   ```javascript
   const TOOL_TIMEOUT = 80000; // 80 segundos
   
   async callExternalTool(tool, request, agentId) {
     // Salvar estado antes da chamada
     this.stateManager.saveState(agentId, this.getCurrentState());
     
     try {
       // Chamar com timeout
       const response = await Promise.race([
         tool.execute(request),
         this.createTimeoutPromise(TOOL_TIMEOUT)
       ]);
       
       // Processar resposta
       await this.eventHandler.handleToolResponse(agentId, response);
       
     } catch (error) {
       if (error.message === 'TIMEOUT') {
         // Tratamento de timeout
         this.handleTimeout(agentId);
       } else {
         // Tratamento de erro
         this.handleError(agentId, error);
       }
     }
   }
   ```

2. **Implementar tratamento de timeout:**
   - Logar o timeout com detalhes
   - Tentar recuperar com dados parciais
   - Informar ao usuário se necessário
   - Limpar estado do agente

---

#### 14.4 Integração Transparente ao Fluxo

**Arquivo:** `server/src/services/agents/execution/flow-controller.js`

**Tarefas:**

1. **Implementar o controlador de fluxo:**

   **FlowController:**
   ```javascript
   class FlowController {
     constructor() {
       this.stateManager = new StateManager();
       this.eventHandler = new EventHandler(this.stateManager);
     }
     
     // Executar agente com suporte a ferramentas externas
     async executeAgent(agent, input) {
       const agentId = this.generateAgentId(agent);
       
       // Configurar callback de reativação
       this.eventHandler.onToolResponse(agentId, 
         (state, response) => this.continueExecution(agent, state, response)
       );
       
       // Iniciar execução
       return await agent.process(input);
     }
     
     // Continuar execução após retorno de ferramenta
     async continueExecution(agent, state, toolResponse) {
       // Restaurar contexto
       agent.restoreContext(state);
       
       // Integrar resposta da ferramenta
       agent.integrateToolResponse(toolResponse);
       
       // Continuar do passo seguinte
       return await agent.continueFromStep(state.currentStep);
     }
   }
   ```

2. **Modificar os agentes para suportar continuação:**
   - Método `saveContext()` para salvar estado
   - Método `restoreContext()` para restaurar
   - Método `integrateToolResponse()` para integrar resposta
   - Método `continueFromStep()` para continuar execução

---

#### 14.5 Teste do Fluxo Completo

**Arquivo:** `server/tests/flow/complete-flow.test.js`

**Tarefas:**

1. **Criar teste do fluxo completo:**

   ```
   Cenário: Usuário envia mensagem complexa
   
   1. Usuário → "Analise meus gastos e sugira um orçamento"
   
   2. Agente Júnior:
      - Classifica como COMPLEX
      - Escala para Orquestrador
   
   3. Orquestrador:
      - Decompõe: analysis + planning
      - Define dependência: planning depende de analysis
      - Gera DOC
   
   4. Execução Fase 1 (Análise):
      - Agente de Análise inicia
      - Chama Finance Bridge (espera 2s)
      - ESTADO: waiting
      - Finance Bridge retorna dados
      - ESTADO: running
      - Processa dados
      - Retorna resultado
   
   5. Execução Fase 2 (Planejamento):
      - Recebe resultado da análise
      - Cria orçamento baseado nos dados
      - Retorna resultado
   
   6. Agente de Resposta:
      - Recebe resultados dos dois agentes
      - Sintetiza resposta
      - Formata para usuário
   
   7. Resposta → Usuário
   ```

2. **Verificar pontos críticos:**
   - Estado preservado durante waiting
   - Reativação funcionando corretamente
   - Timeout tratado adequadamente
   - Resposta final coerente

---

## 📦 Resumo de Arquivos a Criar

### Fase 5 - Agentes Coordenadores

```
server/src/services/agents/
└── coordinators/
    ├── index.js
    ├── base-coordinator.js
    ├── prompts/
    │   └── metacognition.txt
    ├── math/
    │   └── math-module.js
    ├── analysis/
    │   ├── index.js
    │   ├── analysis-agent.js
    │   ├── analyzers/
    │   │   ├── spending-analyzer.js
    │   │   ├── pattern-detector.js
    │   │   ├── cashflow-analyzer.js
    │   │   └── deviation-alerter.js
    │   └── prompts/
    │       ├── analysis-system.txt
    │       └── analysis-metacognition.txt
    ├── investments/
    │   ├── index.js
    │   ├── investments-agent.js
    │   ├── portfolio/
    │   │   └── portfolio-analyzer.js
    │   ├── market/
    │   │   ├── market-client.js
    │   │   ├── quote-fetcher.js
    │   │   └── indicators-fetcher.js
    │   ├── recommendations/
    │   │   └── aporte-recommender.js
    │   ├── calculations/
    │   │   └── investment-calculator.js
    │   └── prompts/
    │       ├── investments-system.txt
    │       └── investments-metacognition.txt
    └── planning/
        ├── index.js
        ├── planning-agent.js
        ├── budget/
        │   ├── budget-creator.js
        │   └── budget-tracker.js
        ├── goals/
        │   ├── goal-manager.js
        │   └── progress-tracker.js
        ├── scenarios/
        │   └── scenario-simulator.js
        ├── plans/
        │   └── action-planner.js
        └── prompts/
            ├── planning-system.txt
            └── planning-metacognition.txt
```

### Fase 6 - Resposta Final e Fluxo Contínuo

```
server/src/services/agents/
├── response/
│   ├── index.js
│   ├── response-agent.js
│   ├── synthesizer.js
│   ├── formatter.js
│   └── prompts/
│       └── response-system.txt
└── execution/
    ├── index.js
    ├── state-manager.js
    ├── event-handler.js
    └── flow-controller.js

server/tests/
└── flow/
    └── complete-flow.test.js
```

---

## 📋 Checklist de Implementação

### Objetivo 11 - Agentes Coordenadores
- [ ] Classe base `BaseCoordinator` com pipeline de 6 passos
- [ ] Agente de Análise com analisadores especializados
- [ ] Agente de Investimentos com integração Brapi
- [ ] Agente de Planejamento com criador de orçamentos
- [ ] Integração com APIs (Brapi, Tavily, Serper)
- [ ] Prompts de sistema para cada agente

### Objetivo 12 - Protocolo de Execução
- [ ] Pipeline de 6 passos implementado
- [ ] Prompt de metacognição guiada
- [ ] Módulo matemático para cálculos complexos
- [ ] Integração dos coordenadores ao ExecutionController

### Objetivo 13 - Agente de Resposta
- [ ] Synthesizer combinando resultados
- [ ] Formatter com regras de formatação
- [ ] Resposta acionável implementada
- [ ] Prompt de sistema do agente

### Objetivo 14 - Fluxo de Execução Contínua
- [ ] StateManager salvando/restaurando estado
- [ ] EventHandler gerenciando reativação
- [ ] Timeout de 80 segundos configurado
- [ ] FlowController integrando tudo
- [ ] Teste do fluxo completo

---

## 🔧 Configurações Necessárias

### Variáveis de Ambiente

```dotenv
# APIs de Mercado
BRAPI_API_KEY=your_brapi_api_key_here

# API Tavily (Pesquisa Contextual)
TAVILY_API_KEY=your_tavily_api_key_here

# Timeouts
TOOL_TIMEOUT=80000
COORDINATOR_TIMEOUT=60000
```

### Dependências

```json
{
  "dependencies": {
    "axios": "^1.6.0"
  }
}
```

---

## ⚠️ Pontos de Atenção

1. **Objetivo 14 é CRÍTICO:** O fluxo de execução contínua é o coração do sistema. Sem ele funcionando corretamente, os agentes não conseguem usar ferramentas externas de forma eficiente.

2. **Qualidade antes de velocidade:** É aceitável que o sistema demore mais para responder se isso garantir respostas de qualidade.

3. **Latência como necessidade:** A latência não é um erro, é o tempo necessário para o sistema pensar e buscar informações corretas.

4. **Ordem de implementação sugerida:**
   - Primeiro: BaseCoordinator (fundação)
   - Segundo: Agente de Análise (mais simples)
   - Terceiro: Agente de Planejamento (usa dados da análise)
   - Quarto: Agente de Investimentos (requer Brapi)
   - Quinto: Agente de Resposta
   - Sexto: Fluxo de Execução Contínua

5. **Testes incrementais:** Testar cada componente individualmente antes de integrar.

---

## 📊 Estimativas

| Componente | Linhas Estimadas | Complexidade |
|------------|------------------|--------------|
| Base Coordinator | ~200 | Média |
| Agente de Análise | ~600 | Média |
| Agente de Investimentos | ~800 | Alta |
| Agente de Planejamento | ~700 | Média |
| Agente de Resposta | ~350 | Média |
| Fluxo de Execução | ~500 | Alta |
| Prompts | ~400 | Baixa |
| Testes | ~300 | Média |
| **TOTAL** | **~3.850** | - |

---

## 📅 Ordem de Execução

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FASE 5 - COORDENADORES                        │
├─────────────────────────────────────────────────────────────────────┤
│  1. BaseCoordinator (fundação)                                       │
│  2. Agente de Análise + Analisadores                                │
│  3. Agente de Planejamento + Orçamentos + Metas                     │
│  4. Agente de Investimentos + Brapi + Cálculos                      │
│  5. Módulo Matemático                                                │
│  6. Integração ao ExecutionController                               │
├─────────────────────────────────────────────────────────────────────┤
│                     FASE 6 - RESPOSTA E FLUXO                        │
├─────────────────────────────────────────────────────────────────────┤
│  7. Agente de Resposta (Synthesizer + Formatter)                    │
│  8. StateManager + EventHandler                                      │
│  9. FlowController                                                   │
│ 10. Testes de Fluxo Completo                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

**Documento criado em:** 04 de fevereiro de 2026  
**Para implementação por:** GitHub Copilot (Claude Opus 4.5)  
**Status:** Pronto para implementação
