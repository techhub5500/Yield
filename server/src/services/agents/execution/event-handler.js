/**
 * Event Handler - Gerenciador de Eventos de Reativação
 * Fase 6 - Fluxo de Execução Contínua
 * 
 * Responsável por:
 * - Registrar callbacks para respostas de ferramentas
 * - Processar respostas e reativar agentes
 * - Gerenciar fila de eventos pendentes
 * - Integrar respostas ao fluxo de execução
 */

const logger = require('../../../utils/logger');
const { StateManager, STATE_STATUS } = require('./state-manager');

/**
 * Tipos de eventos
 */
const EVENT_TYPES = {
  TOOL_RESPONSE: 'tool_response',    // Resposta de ferramenta externa
  TOOL_ERROR: 'tool_error',          // Erro de ferramenta externa
  TIMEOUT: 'timeout',                // Timeout de espera
  CANCEL: 'cancel',                  // Cancelamento de operação
  COMPLETE: 'complete'               // Conclusão de processamento
};

/**
 * Prioridades de eventos
 */
const EVENT_PRIORITY = {
  HIGH: 1,     // Erros, timeouts
  NORMAL: 2,   // Respostas normais
  LOW: 3       // Eventos secundários
};

class EventHandler {
  
  constructor(stateManager = null) {
    // Gerenciador de estado (injeção de dependência ou singleton)
    this.stateManager = stateManager || StateManager.getInstance();
    
    // Listeners registrados: agentId -> { callback, options }
    this.listeners = new Map();
    
    // Fila de eventos pendentes
    this.eventQueue = [];
    
    // Flag de processamento
    this.processing = false;
    
    // Handlers globais por tipo de evento
    this.globalHandlers = new Map();
    
    // Estatísticas
    this.stats = {
      eventsProcessed: 0,
      eventsQueued: 0,
      errors: 0,
      timeouts: 0
    };
  }

  /**
   * Registra callback para quando uma ferramenta retornar
   * 
   * @param {string} agentId - ID do agente aguardando
   * @param {Function} callback - Callback a executar (state, response) => Promise
   * @param {Object} options - Opções adicionais
   */
  onToolResponse(agentId, callback, options = {}) {
    this.listeners.set(agentId, {
      callback,
      type: EVENT_TYPES.TOOL_RESPONSE,
      registeredAt: Date.now(),
      options: {
        timeout: options.timeout || 80000,
        retryOnError: options.retryOnError || false,
        maxRetries: options.maxRetries || 1,
        ...options
      }
    });

    logger.debug('Listener registrado', { agentId, type: EVENT_TYPES.TOOL_RESPONSE });
  }

  /**
   * Registra callback para erros de ferramenta
   */
  onToolError(agentId, callback) {
    const existing = this.listeners.get(agentId);
    
    if (existing) {
      existing.errorCallback = callback;
    } else {
      this.listeners.set(agentId, {
        errorCallback: callback,
        type: EVENT_TYPES.TOOL_ERROR,
        registeredAt: Date.now()
      });
    }
  }

  /**
   * Registra handler global para um tipo de evento
   * 
   * @param {string} eventType - Tipo de evento
   * @param {Function} handler - Handler a executar
   */
  registerGlobalHandler(eventType, handler) {
    if (!this.globalHandlers.has(eventType)) {
      this.globalHandlers.set(eventType, []);
    }
    this.globalHandlers.get(eventType).push(handler);
  }

  /**
   * Processa resposta de uma ferramenta externa
   * 
   * @param {string} agentId - ID do agente que estava aguardando
   * @param {Object} response - Resposta da ferramenta
   * @returns {Promise<Object>} Resultado do processamento
   */
  async handleToolResponse(agentId, response) {
    const event = {
      type: EVENT_TYPES.TOOL_RESPONSE,
      agentId,
      response,
      timestamp: Date.now(),
      priority: EVENT_PRIORITY.NORMAL
    };

    return this.processEvent(event);
  }

  /**
   * Processa erro de uma ferramenta externa
   * 
   * @param {string} agentId - ID do agente
   * @param {Error} error - Erro ocorrido
   * @returns {Promise<Object>} Resultado do tratamento
   */
  async handleToolError(agentId, error) {
    const event = {
      type: EVENT_TYPES.TOOL_ERROR,
      agentId,
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      timestamp: Date.now(),
      priority: EVENT_PRIORITY.HIGH
    };

    this.stats.errors++;
    return this.processEvent(event);
  }

  /**
   * Processa timeout de um agente
   * 
   * @param {string} agentId - ID do agente
   * @returns {Promise<Object>} Resultado do tratamento
   */
  async handleTimeout(agentId) {
    const event = {
      type: EVENT_TYPES.TIMEOUT,
      agentId,
      timestamp: Date.now(),
      priority: EVENT_PRIORITY.HIGH
    };

    this.stats.timeouts++;
    return this.processEvent(event);
  }

  /**
   * Processa um evento
   * 
   * @param {Object} event - Evento a processar
   * @returns {Promise<Object>} Resultado do processamento
   */
  async processEvent(event) {
    logger.debug('Processando evento', {
      type: event.type,
      agentId: event.agentId
    });

    try {
      // 1. Verificar timeout
      if (this.stateManager.checkTimeout(event.agentId)) {
        throw new Error('Timeout: ferramenta demorou demais');
      }

      // 2. Recuperar estado
      let state;
      try {
        state = this.stateManager.restoreState(event.agentId);
      } catch (stateError) {
        logger.warn('Estado não encontrado, pode ter expirado', {
          agentId: event.agentId
        });
        return {
          success: false,
          error: 'Estado expirado ou não encontrado'
        };
      }

      // 3. Processar baseado no tipo de evento
      let result;
      
      switch (event.type) {
        case EVENT_TYPES.TOOL_RESPONSE:
          result = await this.processToolResponse(state, event);
          break;
          
        case EVENT_TYPES.TOOL_ERROR:
          result = await this.processToolError(state, event);
          break;
          
        case EVENT_TYPES.TIMEOUT:
          result = await this.processTimeoutEvent(state, event);
          break;
          
        default:
          result = { success: false, error: 'Tipo de evento desconhecido' };
      }

      // 4. Executar handlers globais
      await this.executeGlobalHandlers(event.type, event, result);

      // 5. Atualizar estatísticas
      this.stats.eventsProcessed++;

      return result;

    } catch (error) {
      logger.error('Erro ao processar evento', {
        type: event.type,
        agentId: event.agentId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Processa resposta de ferramenta
   */
  async processToolResponse(state, event) {
    // Atualizar estado com resposta
    const updatedState = this.stateManager.updateWithToolResponse(
      event.agentId,
      event.response
    );

    // Obter callback registrado
    const listener = this.listeners.get(event.agentId);
    
    if (listener?.callback) {
      try {
        // Chamar callback de reativação
        const callbackResult = await listener.callback(updatedState, event.response);
        
        // Limpar listener após uso
        this.listeners.delete(event.agentId);

        return {
          success: true,
          state: updatedState,
          callbackResult,
          duration: Date.now() - state.savedAt
        };

      } catch (callbackError) {
        logger.error('Erro no callback de reativação', {
          agentId: event.agentId,
          error: callbackError.message
        });

        return {
          success: false,
          error: callbackError.message,
          state: updatedState
        };
      }
    }

    // Sem callback registrado, apenas atualizar estado
    return {
      success: true,
      state: updatedState,
      noCallback: true
    };
  }

  /**
   * Processa erro de ferramenta
   */
  async processToolError(state, event) {
    const listener = this.listeners.get(event.agentId);
    
    // Verificar se deve tentar retry
    if (listener?.options?.retryOnError && 
        (state.retryCount || 0) < listener.options.maxRetries) {
      
      // Incrementar contador de retry
      state.retryCount = (state.retryCount || 0) + 1;
      
      logger.debug('Tentando retry', {
        agentId: event.agentId,
        attempt: state.retryCount
      });

      return {
        success: false,
        retry: true,
        retryCount: state.retryCount,
        maxRetries: listener.options.maxRetries
      };
    }

    // Executar callback de erro se existir
    if (listener?.errorCallback) {
      try {
        await listener.errorCallback(state, event.error);
      } catch (callbackError) {
        logger.error('Erro no callback de erro', {
          error: callbackError.message
        });
      }
    }

    // Limpar estado com falha
    this.stateManager.clearState(event.agentId, STATE_STATUS.FAILED);
    this.listeners.delete(event.agentId);

    return {
      success: false,
      error: event.error,
      handled: true
    };
  }

  /**
   * Processa evento de timeout
   */
  async processTimeoutEvent(state, event) {
    // Marcar estado como timeout
    this.stateManager.clearState(event.agentId, STATE_STATUS.TIMEOUT);

    // Notificar listener
    const listener = this.listeners.get(event.agentId);
    
    if (listener?.errorCallback) {
      try {
        await listener.errorCallback(state, { 
          message: 'Timeout atingido',
          code: 'TIMEOUT'
        });
      } catch (error) {
        logger.error('Erro no callback de timeout', { error: error.message });
      }
    }

    // Limpar listener
    this.listeners.delete(event.agentId);

    return {
      success: false,
      timeout: true,
      waitDuration: Date.now() - state.savedAt
    };
  }

  /**
   * Executa handlers globais
   */
  async executeGlobalHandlers(eventType, event, result) {
    const handlers = this.globalHandlers.get(eventType) || [];
    
    for (const handler of handlers) {
      try {
        await handler(event, result);
      } catch (error) {
        logger.error('Erro em handler global', {
          eventType,
          error: error.message
        });
      }
    }
  }

  /**
   * Adiciona evento à fila para processamento posterior
   * 
   * @param {Object} event - Evento a enfileirar
   */
  enqueueEvent(event) {
    // Inserir na posição correta baseado na prioridade
    const insertIndex = this.eventQueue.findIndex(
      e => e.priority > event.priority
    );
    
    if (insertIndex === -1) {
      this.eventQueue.push(event);
    } else {
      this.eventQueue.splice(insertIndex, 0, event);
    }

    this.stats.eventsQueued++;

    logger.debug('Evento enfileirado', {
      type: event.type,
      queueLength: this.eventQueue.length
    });
  }

  /**
   * Processa próximo evento da fila
   */
  async processNextEvent() {
    if (this.eventQueue.length === 0) return null;
    
    const event = this.eventQueue.shift();
    return this.processEvent(event);
  }

  /**
   * Processa todos os eventos pendentes
   */
  async processAllPendingEvents() {
    const results = [];
    
    while (this.eventQueue.length > 0) {
      const result = await this.processNextEvent();
      results.push(result);
    }

    return results;
  }

  /**
   * Remove listener de um agente
   */
  removeListener(agentId) {
    this.listeners.delete(agentId);
  }

  /**
   * Verifica se há listener registrado
   */
  hasListener(agentId) {
    return this.listeners.has(agentId);
  }

  /**
   * Obtém número de listeners ativos
   */
  getActiveListenersCount() {
    return this.listeners.size;
  }

  /**
   * Obtém estatísticas
   */
  getStats() {
    return {
      ...this.stats,
      activeListeners: this.listeners.size,
      pendingEvents: this.eventQueue.length
    };
  }

  /**
   * Limpa todos os listeners e eventos
   */
  clearAll() {
    this.listeners.clear();
    this.eventQueue = [];
    this.globalHandlers.clear();
    
    logger.info('EventHandler limpo');
  }
}

// Singleton
let instance = null;

/**
 * Obtém instância singleton do EventHandler
 */
function getInstance() {
  if (!instance) {
    instance = new EventHandler();
  }
  return instance;
}

module.exports = {
  EventHandler,
  EVENT_TYPES,
  EVENT_PRIORITY,
  getInstance,
  
  // Atalhos para uso direto
  onToolResponse: (agentId, callback, options) => 
    getInstance().onToolResponse(agentId, callback, options),
  handleToolResponse: (agentId, response) => 
    getInstance().handleToolResponse(agentId, response),
  handleToolError: (agentId, error) => 
    getInstance().handleToolError(agentId, error)
};
