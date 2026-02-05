/**
 * Flow Controller - Controlador de Fluxo de Execução
 * Fase 6 - Fluxo de Execução Contínua
 * 
 * Responsável por:
 * - Orquestrar execução completa de agentes
 * - Gerenciar chamadas a ferramentas externas
 * - Coordenar salvamento/restauração de estado
 * - Integrar com StateManager e EventHandler
 * - Implementar timeout de 80 segundos
 */

const logger = require('../../../utils/logger');
const { StateManager, STATE_STATUS } = require('./state-manager');
const { EventHandler, EVENT_TYPES } = require('./event-handler');

/**
 * Status do fluxo de execução
 */
const FLOW_STATUS = {
  IDLE: 'idle',
  INITIALIZING: 'initializing',
  RUNNING: 'running',
  WAITING: 'waiting',
  RESUMING: 'resuming',
  COMPLETING: 'completing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  TIMEOUT: 'timeout'
};

/**
 * Timeout padrão para ferramentas (em ms)
 */
const DEFAULT_TOOL_TIMEOUT = parseInt(process.env.TOOL_TIMEOUT) || 80000;

/**
 * Timeout padrão para coordenadores (em ms)
 */
const DEFAULT_COORDINATOR_TIMEOUT = parseInt(process.env.COORDINATOR_TIMEOUT) || 60000;

class FlowController {
  
  constructor(options = {}) {
    // Gerenciadores de estado e eventos
    this.stateManager = options.stateManager || StateManager.getInstance();
    this.eventHandler = options.eventHandler || EventHandler.getInstance();
    
    // Configurações
    this.toolTimeout = options.toolTimeout || DEFAULT_TOOL_TIMEOUT;
    this.coordinatorTimeout = options.coordinatorTimeout || DEFAULT_COORDINATOR_TIMEOUT;
    
    // Estado do controlador
    this.status = FLOW_STATUS.IDLE;
    this.currentExecution = null;
    
    // Registro de execuções
    this.executions = new Map();
    
    // Estatísticas
    this.stats = {
      totalExecutions: 0,
      completedExecutions: 0,
      failedExecutions: 0,
      timeouts: 0,
      averageDuration: 0
    };
  }

  /**
   * Executa um agente com suporte a ferramentas externas
   * 
   * @param {Object} agent - Instância do agente a executar
   * @param {Object} input - Input para o agente (memory, query, etc)
   * @param {Object} options - Opções de execução
   * @returns {Promise<Object>} Resultado da execução
   */
  async executeAgent(agent, input, options = {}) {
    const executionId = this.generateExecutionId();
    const startTime = Date.now();
    
    // Registrar execução
    const execution = {
      id: executionId,
      agent: agent.agentType || agent.constructor.name,
      status: FLOW_STATUS.INITIALIZING,
      startTime,
      input,
      options,
      steps: [],
      results: []
    };
    
    this.executions.set(executionId, execution);
    this.currentExecution = execution;
    this.stats.totalExecutions++;

    logger.info('Iniciando execução de agente', {
      executionId,
      agent: execution.agent
    });

    try {
      // Configurar timeout geral
      const timeout = options.timeout || this.coordinatorTimeout;
      
      // Executar com timeout
      const result = await this.executeWithTimeout(
        () => this.runAgentWithToolSupport(agent, input, execution),
        timeout,
        executionId
      );

      // Atualizar execução
      execution.status = FLOW_STATUS.COMPLETED;
      execution.endTime = Date.now();
      execution.duration = execution.endTime - startTime;
      execution.result = result;

      // Atualizar estatísticas
      this.stats.completedExecutions++;
      this.updateAverageDuration(execution.duration);

      logger.info('Execução concluída', {
        executionId,
        duration: execution.duration
      });

      return {
        success: true,
        executionId,
        result,
        metadata: {
          duration: execution.duration,
          steps: execution.steps.length
        }
      };

    } catch (error) {
      execution.status = error.message.includes('Timeout') 
        ? FLOW_STATUS.TIMEOUT 
        : FLOW_STATUS.FAILED;
      execution.endTime = Date.now();
      execution.duration = execution.endTime - startTime;
      execution.error = error.message;

      if (execution.status === FLOW_STATUS.TIMEOUT) {
        this.stats.timeouts++;
      }
      this.stats.failedExecutions++;

      logger.error('Execução falhou', {
        executionId,
        error: error.message,
        status: execution.status
      });

      return {
        success: false,
        executionId,
        error: error.message,
        timeout: execution.status === FLOW_STATUS.TIMEOUT,
        metadata: {
          duration: execution.duration,
          steps: execution.steps.length
        }
      };
    }
  }

  /**
   * Executa agente com suporte a ferramentas externas
   */
  async runAgentWithToolSupport(agent, input, execution) {
    execution.status = FLOW_STATUS.RUNNING;

    // Verificar se o agente tem método process
    if (typeof agent.process !== 'function') {
      throw new Error('Agente não possui método process');
    }

    // Criar wrapper para interceptar chamadas de ferramentas
    const toolWrapper = this.createToolWrapper(execution);

    // Injetar wrapper no contexto
    const enhancedInput = {
      ...input,
      toolWrapper,
      flowController: this,
      executionId: execution.id
    };

    // Executar o agente
    const result = await agent.process(
      enhancedInput.memory,
      enhancedInput.query,
      enhancedInput.doc,
      enhancedInput.taskInfo
    );

    return result;
  }

  /**
   * Cria wrapper para interceptar chamadas de ferramentas
   */
  createToolWrapper(execution) {
    return {
      /**
       * Chama ferramenta externa com suporte a estado
       */
      callTool: async (tool, request) => {
        return this.callExternalTool(tool, request, execution);
      },

      /**
       * Chama Finance Bridge
       */
      callFinanceBridge: async (request) => {
        const FinanceBridge = require('../../finance-bridge');
        return this.callExternalTool(
          { name: 'finance_bridge', execute: (req) => FinanceBridge.execute(req) },
          request,
          execution
        );
      },

      /**
       * Chama API de pesquisa
       */
      callSearch: async (query) => {
        const Search = require('../../search');
        return this.callExternalTool(
          { name: 'search', execute: (q) => Search.search(q) },
          query,
          execution
        );
      }
    };
  }

  /**
   * Chama ferramenta externa com gerenciamento de estado
   * 
   * @param {Object} tool - Ferramenta a chamar
   * @param {Object} request - Requisição
   * @param {Object} execution - Contexto de execução
   * @returns {Promise<Object>} Resposta da ferramenta
   */
  async callExternalTool(tool, request, execution) {
    const toolName = tool.name || 'unknown';
    const agentId = `${execution.id}_${toolName}_${Date.now()}`;

    // Registrar step
    const step = {
      tool: toolName,
      request,
      startTime: Date.now(),
      status: 'started'
    };
    execution.steps.push(step);

    logger.debug('Chamando ferramenta externa', {
      executionId: execution.id,
      tool: toolName
    });

    // Salvar estado antes da chamada
    execution.status = FLOW_STATUS.WAITING;
    
    const state = {
      agentType: execution.agent,
      docId: execution.input?.doc?.id,
      query: execution.input?.query,
      executionPlan: execution.steps,
      currentStep: execution.steps.length - 1,
      intermediateResults: execution.results,
      pendingTool: toolName,
      pendingRequest: request,
      memory: execution.input?.memory,
      context: execution.input
    };

    this.stateManager.saveState(agentId, state);

    // Iniciar timeout
    this.stateManager.startTimeout(agentId, this.toolTimeout, () => {
      step.status = 'timeout';
      step.error = 'Timeout atingido';
    });

    try {
      // Executar ferramenta
      const response = await this.executeWithTimeout(
        () => tool.execute(request),
        this.toolTimeout,
        agentId
      );

      // Sucesso - atualizar step
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.status = 'completed';
      step.response = response;

      // Processar resposta via EventHandler
      await this.eventHandler.handleToolResponse(agentId, response);

      // Atualizar execução
      execution.status = FLOW_STATUS.RUNNING;
      execution.results.push({
        tool: toolName,
        response,
        timestamp: Date.now()
      });

      // Limpar estado
      this.stateManager.clearState(agentId, STATE_STATUS.COMPLETED);

      logger.debug('Ferramenta concluída', {
        tool: toolName,
        duration: step.duration
      });

      return response;

    } catch (error) {
      // Falha - atualizar step
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.status = 'failed';
      step.error = error.message;

      // Processar erro via EventHandler
      await this.eventHandler.handleToolError(agentId, error);

      // Limpar estado
      this.stateManager.clearState(agentId, STATE_STATUS.FAILED);

      logger.error('Ferramenta falhou', {
        tool: toolName,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Executa promise com timeout
   * 
   * @param {Function} fn - Função a executar
   * @param {number} timeout - Timeout em ms
   * @param {string} context - Contexto para logs
   * @returns {Promise<any>} Resultado da execução
   */
  async executeWithTimeout(fn, timeout, context = '') {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout após ${timeout}ms${context ? ` [${context}]` : ''}`));
      }, timeout);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Continua execução após retorno de ferramenta
   * 
   * @param {Object} agent - Agente a continuar
   * @param {Object} state - Estado salvo
   * @param {Object} toolResponse - Resposta da ferramenta
   * @returns {Promise<Object>} Resultado da continuação
   */
  async continueExecution(agent, state, toolResponse) {
    logger.debug('Continuando execução', {
      agent: state.agentType,
      currentStep: state.currentStep
    });

    // Restaurar contexto no agente
    if (typeof agent.restoreContext === 'function') {
      agent.restoreContext(state);
    }

    // Integrar resposta
    if (typeof agent.integrateToolResponse === 'function') {
      agent.integrateToolResponse(toolResponse);
    }

    // Continuar do próximo passo
    if (typeof agent.continueFromStep === 'function') {
      return agent.continueFromStep(state.currentStep);
    }

    // Fallback: re-executar process com estado atualizado
    return agent.process(
      state.memory,
      state.query,
      state.context?.doc,
      state.context?.taskInfo
    );
  }

  /**
   * Gera ID único para execução
   */
  generateExecutionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `exec_${timestamp}_${random}`;
  }

  /**
   * Atualiza média de duração
   */
  updateAverageDuration(duration) {
    const total = this.stats.completedExecutions;
    this.stats.averageDuration = (
      (this.stats.averageDuration * (total - 1) + duration) / total
    );
  }

  /**
   * Obtém informações de uma execução
   */
  getExecution(executionId) {
    return this.executions.get(executionId);
  }

  /**
   * Obtém execuções ativas
   */
  getActiveExecutions() {
    const active = [];
    
    for (const [id, execution] of this.executions) {
      if ([FLOW_STATUS.RUNNING, FLOW_STATUS.WAITING, FLOW_STATUS.RESUMING]
          .includes(execution.status)) {
        active.push({ id, ...execution });
      }
    }

    return active;
  }

  /**
   * Cancela uma execução
   */
  cancelExecution(executionId) {
    const execution = this.executions.get(executionId);
    
    if (!execution) {
      return { success: false, error: 'Execução não encontrada' };
    }

    execution.status = FLOW_STATUS.FAILED;
    execution.endTime = Date.now();
    execution.error = 'Cancelado pelo usuário';

    logger.warn('Execução cancelada', { executionId });

    return { success: true };
  }

  /**
   * Obtém estatísticas do controlador
   */
  getStats() {
    return {
      ...this.stats,
      activeExecutions: this.getActiveExecutions().length,
      stateManagerStats: this.stateManager.getStats(),
      eventHandlerStats: this.eventHandler.getStats()
    };
  }

  /**
   * Health check do controlador
   */
  async healthCheck() {
    return {
      status: 'healthy',
      component: 'FlowController',
      currentStatus: this.status,
      stats: this.getStats(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Limpa execuções antigas
   * 
   * @param {number} maxAge - Idade máxima em ms
   */
  cleanupOldExecutions(maxAge = 3600000) { // 1 hora
    const now = Date.now();
    const toDelete = [];

    for (const [id, execution] of this.executions) {
      if (execution.endTime && (now - execution.endTime) > maxAge) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.executions.delete(id);
    }

    logger.debug('Limpeza de execuções', { removed: toDelete.length });
  }

  /**
   * Shutdown do controlador
   */
  async shutdown() {
    // Cancelar execuções ativas
    for (const execution of this.getActiveExecutions()) {
      this.cancelExecution(execution.id);
    }

    // Limpar gerenciadores
    this.stateManager.clearAll();
    this.eventHandler.clearAll();

    // Limpar execuções
    this.executions.clear();

    this.status = FLOW_STATUS.IDLE;
    
    logger.info('FlowController shutdown concluído');
  }
}

// Singleton
let instance = null;

/**
 * Obtém instância singleton do FlowController
 */
function getInstance() {
  if (!instance) {
    instance = new FlowController();
  }
  return instance;
}

module.exports = {
  FlowController,
  FLOW_STATUS,
  DEFAULT_TOOL_TIMEOUT,
  DEFAULT_COORDINATOR_TIMEOUT,
  getInstance,
  
  // Atalhos para uso direto
  executeAgent: (agent, input, options) => 
    getInstance().executeAgent(agent, input, options),
  callExternalTool: (tool, request, execution) =>
    getInstance().callExternalTool(tool, request, execution)
};
