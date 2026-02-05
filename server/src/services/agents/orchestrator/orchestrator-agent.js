/**
 * Agente Orquestrador - Lógica Principal
 * Fase 4 - Camada de Orquestração
 * 
 * O Orquestrador é o "cérebro estratégico" do sistema. Ele:
 * - Recebe tarefas complexas do Agente Júnior
 * - Analisa quais agentes coordenadores são necessários
 * - Define a ordem de execução e dependências
 * - Gera o DOC para instruir os coordenadores
 */

const { TaskDecomposer } = require('./task-decomposer');
const { DependencyResolver } = require('./dependency-resolver');
const { MemoryFilter } = require('./memory-filter');
const { PriorityManager } = require('./priority-manager');
const { DocBuilder } = require('./doc-builder');
const { ExecutionController } = require('./execution-controller');
const logger = require('../../../utils/logger');

/**
 * Contratos dos agentes coordenadores
 * Define as capacidades e limitações de cada agente
 */
const AGENT_CONTRACTS = {
  analysis: {
    name: 'Agente de Análise',
    description: 'Especialista em comportamento financeiro passado e presente',
    capabilities: [
      'diagnóstico de gastos',
      'identificação de padrões',
      'análise de fluxo de caixa',
      'alertas de desvio',
      'detecção de assinaturas esquecidas',
      'comparativo de gastos entre períodos',
      'breakdown por categoria'
    ],
    doesNot: [
      'análise de ativos',
      'sugestão de investimentos',
      'criação de orçamentos futuros'
    ],
    expectedOutputs: [
      'relatório de gastos',
      'lista de padrões identificados',
      'alertas e desvios',
      'comparativo mensal'
    ]
  },
  investments: {
    name: 'Agente de Investimentos',
    description: 'Estrategista de ativos e gestão de portfólio',
    capabilities: [
      'análise de carteira',
      'análise de mercado',
      'recomendação de aporte',
      'cálculos de investimento',
      'consulta Brapi',
      'projeção de rendimentos',
      'avaliação de risco'
    ],
    doesNot: [
      'análise de gastos domésticos',
      'orçamento de lazer',
      'planejamento de metas pessoais'
    ],
    expectedOutputs: [
      'análise de carteira',
      'recomendações de aporte',
      'projeções de rendimento',
      'avaliação de risco'
    ]
  },
  planning: {
    name: 'Agente de Planejamento',
    description: 'Arquiteto de futuro financeiro',
    capabilities: [
      'criação de orçamentos',
      'gestão de metas',
      'planos de ação',
      'simulações de cenários',
      'definição de limites por categoria',
      'acompanhamento de progresso'
    ],
    doesNot: [
      'análise de ações',
      'listar gastos passados',
      'consulta de mercado'
    ],
    expectedOutputs: [
      'orçamento por categoria',
      'plano de metas',
      'simulação de cenários',
      'passos de ação'
    ]
  }
};

class OrchestratorAgent {
  
  constructor() {
    this.decomposer = new TaskDecomposer(AGENT_CONTRACTS);
    this.dependencyResolver = new DependencyResolver();
    this.memoryFilter = new MemoryFilter();
    this.priorityManager = new PriorityManager();
    this.docBuilder = new DocBuilder();
    this.executionController = new ExecutionController();
  }

  /**
   * Processa uma tarefa complexa
   * 
   * @param {Object} memory - Memória completa do chat
   * @param {string} query - Query original do usuário
   * @param {Object} context - Contexto adicional
   * @returns {Object} Resultado do processamento
   */
  async process(memory, query, context = {}) {
    const startTime = Date.now();
    
    try {
      logger.info('Orquestrador iniciando processamento', {
        user_id: context.user_id,
        query_length: query.length
      });

      // ETAPA 1: DECOMPOSIÇÃO
      // Identificar quais agentes são necessários
      logger.debug('Etapa 1: Decomposição de tarefas');
      const decomposition = await this.decomposer.decompose(query, memory);
      
      if (decomposition.tasks.length === 0) {
        logger.warn('Nenhum agente identificado para a tarefa', { query });
        return {
          action: 'no_agents_needed',
          response: 'Não foi possível identificar uma tarefa específica para os agentes coordenadores.',
          suggestion: 'Por favor, reformule sua solicitação com mais detalhes.'
        };
      }

      // ETAPA 2: DEPENDÊNCIAS
      // Verificar ordem de execução
      logger.debug('Etapa 2: Resolução de dependências');
      const dependencies = await this.dependencyResolver.resolve(decomposition.tasks);

      // ETAPA 3: MEMORIZAÇÃO
      // Extrair memória relevante para contextualização
      logger.debug('Etapa 3: Filtragem de memória');
      const filteredMemory = await this.memoryFilter.filter(memory, decomposition.tasks);

      // ETAPA 4: PRIORIZAÇÃO
      // Definir ordem e paralelismo
      logger.debug('Etapa 4: Priorização e plano de execução');
      const executionPlan = await this.priorityManager.plan(decomposition.tasks, dependencies);

      // Construir DOC
      logger.debug('Construindo DOC');
      const doc = await this.docBuilder.build({
        query,
        memory: filteredMemory,
        decomposition,
        dependencies,
        executionPlan,
        context
      });

      const duration = Date.now() - startTime;

      logger.info('Orquestrador finalizou processamento', {
        duration_ms: duration,
        agents_count: decomposition.tasks.length,
        phases_count: executionPlan.phases.length,
        has_dependencies: dependencies.length > 0
      });

      return {
        action: 'doc_generated',
        doc: doc,
        summary: {
          agents: decomposition.tasks.map(t => t.agent),
          phases: executionPlan.phases.length,
          hasDependencies: dependencies.length > 0,
          estimatedComplexity: this.estimateComplexity(decomposition.tasks)
        }
      };

    } catch (error) {
      logger.error('Erro no Orquestrador', {
        error: error.message,
        user_id: context.user_id
      });

      return {
        action: 'error',
        response: 'Ocorreu um erro ao processar sua solicitação complexa. Por favor, tente novamente.',
        error: error.message
      };
    }
  }

  /**
   * Gera apenas o DOC sem executar
   * 
   * @param {Object} memory - Memória completa do chat
   * @param {string} query - Query original do usuário
   * @returns {Object} DOC gerado
   */
  async generateDocOnly(memory, query) {
    const decomposition = await this.decomposer.decompose(query, memory);
    const dependencies = await this.dependencyResolver.resolve(decomposition.tasks);
    const filteredMemory = await this.memoryFilter.filter(memory, decomposition.tasks);
    const executionPlan = await this.priorityManager.plan(decomposition.tasks, dependencies);

    return this.docBuilder.build({
      query,
      memory: filteredMemory,
      decomposition,
      dependencies,
      executionPlan,
      context: {}
    });
  }

  /**
   * Estima a complexidade baseada nos agentes necessários
   */
  estimateComplexity(tasks) {
    if (tasks.length >= 3) return 'alta';
    if (tasks.length === 2) return 'média';
    return 'baixa';
  }

  /**
   * Retorna os contratos dos agentes coordenadores
   */
  getAgentContracts() {
    return AGENT_CONTRACTS;
  }

  /**
   * Retorna informações sobre o Orquestrador
   */
  getInfo() {
    return {
      name: 'Agente Orquestrador',
      version: '1.0.0',
      phase: 4,
      description: 'Cérebro estratégico que coordena tarefas complexas entre agentes especialistas',
      capabilities: [
        'Decomposição de tarefas complexas',
        'Identificação de agentes necessários',
        'Resolução de dependências',
        'Filtragem de memória relevante',
        'Priorização de execução',
        'Geração de DOC (Documento de Direção)'
      ],
      supportedAgents: Object.keys(AGENT_CONTRACTS)
    };
  }

  /**
   * Verifica a saúde do Orquestrador
   */
  async healthCheck() {
    try {
      // Verificar componentes
      const components = {
        decomposer: !!this.decomposer,
        dependencyResolver: !!this.dependencyResolver,
        memoryFilter: !!this.memoryFilter,
        priorityManager: !!this.priorityManager,
        docBuilder: !!this.docBuilder,
        executionController: !!this.executionController
      };

      const allHealthy = Object.values(components).every(v => v === true);

      return {
        healthy: allHealthy,
        components,
        agentContracts: Object.keys(AGENT_CONTRACTS),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = { OrchestratorAgent, AGENT_CONTRACTS };
