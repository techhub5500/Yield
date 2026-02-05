/**
 * Execution - API Pública do Sistema de Execução Contínua
 * Fase 6 - Fluxo de Execução Contínua
 * 
 * Este módulo exporta os componentes de execução contínua:
 * - FlowController: Controlador principal de execução
 * - StateManager: Gerenciador de estado de espera
 * - EventHandler: Gerenciador de eventos de reativação
 * 
 * O sistema de execução permite que agentes:
 * 1. Chamem ferramentas externas sem "morrer"
 * 2. Preservem estado durante espera
 * 3. Sejam reativados automaticamente quando ferramentas retornam
 * 4. Tratem timeouts de forma adequada
 */

const { FlowController, FLOW_STATUS, getInstance: getFlowController } = require('./flow-controller');
const { StateManager, STATE_STATUS, getInstance: getStateManager } = require('./state-manager');
const { EventHandler, EVENT_TYPES, EVENT_PRIORITY, getInstance: getEventHandler } = require('./event-handler');
const logger = require('../../../utils/logger');

/**
 * Configurações padrão
 */
const DEFAULT_CONFIG = {
  toolTimeout: parseInt(process.env.TOOL_TIMEOUT) || 80000,
  coordinatorTimeout: parseInt(process.env.COORDINATOR_TIMEOUT) || 60000,
  cleanupInterval: 3600000 // 1 hora
};

/**
 * Flag de inicialização
 */
let initialized = false;

/**
 * Timer de limpeza
 */
let cleanupTimer = null;

/**
 * Inicializa o sistema de execução
 * 
 * @param {Object} config - Configurações opcionais
 * @returns {Object} Instâncias dos componentes
 */
async function initialize(config = {}) {
  if (initialized) {
    return getInstances();
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  logger.info('Inicializando sistema de execução', finalConfig);

  // Obter instâncias singleton
  const stateManager = getStateManager();
  const eventHandler = getEventHandler();
  const flowController = getFlowController();

  // Configurar handlers globais
  setupGlobalHandlers(eventHandler);

  // Iniciar limpeza periódica
  if (finalConfig.cleanupInterval > 0) {
    cleanupTimer = setInterval(() => {
      flowController.cleanupOldExecutions(finalConfig.cleanupInterval);
    }, finalConfig.cleanupInterval);
  }

  initialized = true;

  logger.info('Sistema de execução inicializado');

  return { stateManager, eventHandler, flowController };
}

/**
 * Configura handlers globais de eventos
 */
function setupGlobalHandlers(eventHandler) {
  // Log de todas as respostas de ferramentas
  eventHandler.registerGlobalHandler(EVENT_TYPES.TOOL_RESPONSE, (event, result) => {
    logger.debug('Tool response processado', {
      agentId: event.agentId,
      success: result.success
    });
  });

  // Log de todos os erros
  eventHandler.registerGlobalHandler(EVENT_TYPES.TOOL_ERROR, (event, result) => {
    logger.warn('Tool error processado', {
      agentId: event.agentId,
      error: event.error?.message
    });
  });

  // Log de timeouts
  eventHandler.registerGlobalHandler(EVENT_TYPES.TIMEOUT, (event, result) => {
    logger.warn('Timeout processado', {
      agentId: event.agentId,
      waitDuration: result.waitDuration
    });
  });
}

/**
 * Obtém instâncias dos componentes
 */
function getInstances() {
  return {
    stateManager: getStateManager(),
    eventHandler: getEventHandler(),
    flowController: getFlowController()
  };
}

/**
 * Executa um agente com suporte completo a fluxo contínuo
 * 
 * @param {Object} agent - Agente a executar
 * @param {Object} input - Input para o agente
 * @param {Object} options - Opções de execução
 * @returns {Promise<Object>} Resultado da execução
 */
async function executeAgent(agent, input, options = {}) {
  if (!initialized) {
    await initialize();
  }

  const flowController = getFlowController();
  return flowController.executeAgent(agent, input, options);
}

/**
 * Chama ferramenta externa com suporte a estado
 * 
 * @param {Object} tool - Ferramenta a chamar
 * @param {Object} request - Requisição
 * @param {Object} context - Contexto opcional
 * @returns {Promise<Object>} Resposta da ferramenta
 */
async function callTool(tool, request, context = {}) {
  if (!initialized) {
    await initialize();
  }

  const flowController = getFlowController();
  
  // Criar execução temporária se não houver contexto
  const execution = context.execution || {
    id: flowController.generateExecutionId(),
    agent: context.agentType || 'direct_call',
    status: 'running',
    startTime: Date.now(),
    steps: [],
    results: []
  };

  return flowController.callExternalTool(tool, request, execution);
}

/**
 * Obtém estatísticas do sistema
 */
function getStats() {
  if (!initialized) {
    return { initialized: false };
  }

  const flowController = getFlowController();
  return {
    initialized: true,
    ...flowController.getStats()
  };
}

/**
 * Health check do sistema
 */
async function healthCheck() {
  if (!initialized) {
    return {
      status: 'not_initialized',
      component: 'execution',
      timestamp: new Date().toISOString()
    };
  }

  const flowController = getFlowController();
  return flowController.healthCheck();
}

/**
 * Shutdown do sistema
 */
async function shutdown() {
  if (!initialized) return;

  logger.info('Encerrando sistema de execução');

  // Limpar timer de limpeza
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }

  // Shutdown do FlowController
  const flowController = getFlowController();
  await flowController.shutdown();

  initialized = false;

  logger.info('Sistema de execução encerrado');
}

/**
 * Utilitário: Cria promise com timeout
 */
function withTimeout(promise, timeout, message = 'Timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`${message} após ${timeout}ms`)), timeout)
    )
  ]);
}

/**
 * Utilitário: Retry com backoff exponencial
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    factor = 2
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(factor, attempt), maxDelay);
        logger.debug('Retry agendado', { attempt: attempt + 1, delay });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

module.exports = {
  // Classes
  FlowController,
  StateManager,
  EventHandler,

  // Constantes
  FLOW_STATUS,
  STATE_STATUS,
  EVENT_TYPES,
  EVENT_PRIORITY,
  DEFAULT_CONFIG,

  // Funções principais
  initialize,
  getInstances,
  executeAgent,
  callTool,

  // Utilitários
  getStats,
  healthCheck,
  shutdown,
  withTimeout,
  withRetry,

  // Getters de instância
  getFlowController,
  getStateManager,
  getEventHandler
};
