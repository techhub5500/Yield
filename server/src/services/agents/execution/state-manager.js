/**
 * State Manager - Gerenciador de Estado de Espera
 * Fase 6 - Fluxo de Execução Contínua
 * 
 * Responsável por:
 * - Salvar estado do agente antes de chamar ferramenta externa
 * - Preservar memória e contexto durante espera
 * - Restaurar estado após retorno da ferramenta
 * - Gerenciar timeouts de espera
 */

const logger = require('../../../utils/logger');

/**
 * Status possíveis de um estado
 */
const STATE_STATUS = {
  WAITING: 'waiting',       // Aguardando resposta de ferramenta
  TIMEOUT: 'timeout',       // Timeout atingido
  RESUMED: 'resumed',       // Estado restaurado
  COMPLETED: 'completed',   // Processamento concluído
  FAILED: 'failed'          // Falha no processamento
};

/**
 * Timeout padrão para ferramentas externas (em ms)
 */
const DEFAULT_TIMEOUT = parseInt(process.env.TOOL_TIMEOUT) || 80000;

class StateManager {
  
  constructor() {
    // Map de estados: agentId -> state
    this.states = new Map();
    
    // Map de timers: agentId -> timerId
    this.timers = new Map();
    
    // Configuração
    this.defaultTimeout = DEFAULT_TIMEOUT;
    
    // Callbacks de timeout
    this.timeoutCallbacks = new Map();
  }

  /**
   * Gera um ID único para o agente
   * 
   * @param {string} agentType - Tipo do agente (analysis, planning, etc)
   * @param {string} docId - ID do DOC sendo processado
   * @returns {string} ID único
   */
  generateAgentId(agentType, docId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${agentType}_${docId || 'local'}_${timestamp}_${random}`;
  }

  /**
   * Salva o estado atual do agente antes de chamar ferramenta externa
   * 
   * @param {string} agentId - ID único do agente
   * @param {Object} state - Estado a salvar
   * @returns {Object} Estado salvo com metadados
   */
  saveState(agentId, state) {
    const savedState = {
      agentId,
      status: STATE_STATUS.WAITING,
      savedAt: Date.now(),
      
      // Contexto do agente
      memory: state.memory || {},
      context: state.context || {},
      
      // Progresso de execução
      executionPlan: state.executionPlan || [],
      currentStep: state.currentStep || 0,
      intermediateResults: state.intermediateResults || [],
      
      // Informações da ferramenta pendente
      pendingTool: state.pendingTool || null,
      pendingRequest: state.pendingRequest || null,
      
      // Metadados adicionais
      metadata: {
        agentType: state.agentType,
        docId: state.docId,
        query: state.query,
        ...state.metadata
      }
    };

    this.states.set(agentId, savedState);
    
    logger.debug('Estado salvo', {
      agentId,
      pendingTool: savedState.pendingTool,
      currentStep: savedState.currentStep
    });

    return savedState;
  }

  /**
   * Recupera o estado de um agente
   * 
   * @param {string} agentId - ID do agente
   * @returns {Object|null} Estado salvo ou null
   */
  getState(agentId) {
    return this.states.get(agentId) || null;
  }

  /**
   * Restaura o estado de um agente
   * 
   * @param {string} agentId - ID do agente
   * @returns {Object} Estado restaurado
   * @throws {Error} Se estado não encontrado
   */
  restoreState(agentId) {
    const state = this.states.get(agentId);
    
    if (!state) {
      throw new Error(`Estado não encontrado para agente: ${agentId}`);
    }

    // Atualizar status
    state.status = STATE_STATUS.RESUMED;
    state.resumedAt = Date.now();
    state.waitDuration = state.resumedAt - state.savedAt;

    // Limpar timer se existir
    this.clearTimer(agentId);

    logger.debug('Estado restaurado', {
      agentId,
      waitDuration: state.waitDuration
    });

    return state;
  }

  /**
   * Atualiza o estado com resultado da ferramenta
   * 
   * @param {string} agentId - ID do agente
   * @param {Object} toolResponse - Resposta da ferramenta
   * @returns {Object} Estado atualizado
   */
  updateWithToolResponse(agentId, toolResponse) {
    const state = this.states.get(agentId);
    
    if (!state) {
      throw new Error(`Estado não encontrado para agente: ${agentId}`);
    }

    // Adicionar resultado às intermediárias
    state.intermediateResults.push({
      tool: state.pendingTool,
      request: state.pendingRequest,
      response: toolResponse,
      receivedAt: Date.now()
    });

    // Avançar para próximo passo
    state.currentStep++;
    
    // Limpar ferramenta pendente
    state.pendingTool = null;
    state.pendingRequest = null;
    
    // Atualizar status
    state.status = STATE_STATUS.RESUMED;
    state.resumedAt = Date.now();

    logger.debug('Estado atualizado com resposta', {
      agentId,
      currentStep: state.currentStep,
      totalResults: state.intermediateResults.length
    });

    return state;
  }

  /**
   * Limpa o estado de um agente
   * 
   * @param {string} agentId - ID do agente
   * @param {string} finalStatus - Status final (completed, failed)
   */
  clearState(agentId, finalStatus = STATE_STATUS.COMPLETED) {
    const state = this.states.get(agentId);
    
    if (state) {
      state.status = finalStatus;
      state.clearedAt = Date.now();
      
      // Calcular duração total
      state.totalDuration = state.clearedAt - state.savedAt;
    }

    // Limpar timer
    this.clearTimer(agentId);
    
    // Remover estado
    this.states.delete(agentId);

    logger.debug('Estado limpo', { agentId, finalStatus });
  }

  /**
   * Inicia timer de timeout para um agente
   * 
   * @param {string} agentId - ID do agente
   * @param {number} timeout - Tempo limite em ms
   * @param {Function} callback - Callback para timeout
   */
  startTimeout(agentId, timeout = this.defaultTimeout, callback = null) {
    // Limpar timer anterior se existir
    this.clearTimer(agentId);

    const timerId = setTimeout(() => {
      this.handleTimeout(agentId);
      
      if (callback) {
        callback(agentId);
      } else if (this.timeoutCallbacks.has(agentId)) {
        this.timeoutCallbacks.get(agentId)(agentId);
      }
    }, timeout);

    this.timers.set(agentId, timerId);

    logger.debug('Timeout iniciado', { agentId, timeout });
  }

  /**
   * Limpa o timer de um agente
   */
  clearTimer(agentId) {
    const timerId = this.timers.get(agentId);
    
    if (timerId) {
      clearTimeout(timerId);
      this.timers.delete(agentId);
    }
  }

  /**
   * Verifica se o estado expirou
   * 
   * @param {string} agentId - ID do agente
   * @param {number} timeout - Tempo limite em ms
   * @returns {boolean} true se expirou
   */
  checkTimeout(agentId, timeout = this.defaultTimeout) {
    const state = this.states.get(agentId);
    
    if (!state) return false;
    
    const elapsed = Date.now() - state.savedAt;
    return elapsed > timeout;
  }

  /**
   * Trata timeout de um agente
   */
  handleTimeout(agentId) {
    const state = this.states.get(agentId);
    
    if (state) {
      state.status = STATE_STATUS.TIMEOUT;
      state.timedOutAt = Date.now();
      state.waitDuration = state.timedOutAt - state.savedAt;

      logger.warn('Timeout atingido', {
        agentId,
        waitDuration: state.waitDuration,
        pendingTool: state.pendingTool
      });
    }

    // Limpar timer
    this.timers.delete(agentId);
  }

  /**
   * Registra callback de timeout para um agente
   * 
   * @param {string} agentId - ID do agente
   * @param {Function} callback - Callback a executar no timeout
   */
  onTimeout(agentId, callback) {
    this.timeoutCallbacks.set(agentId, callback);
  }

  /**
   * Obtém todos os estados em espera
   * 
   * @returns {Array} Lista de estados aguardando
   */
  getWaitingStates() {
    const waiting = [];
    
    for (const [agentId, state] of this.states) {
      if (state.status === STATE_STATUS.WAITING) {
        waiting.push({ agentId, ...state });
      }
    }

    return waiting;
  }

  /**
   * Obtém estatísticas do gerenciador
   */
  getStats() {
    const stats = {
      total: this.states.size,
      waiting: 0,
      resumed: 0,
      timeout: 0,
      activeTimers: this.timers.size
    };

    for (const state of this.states.values()) {
      if (state.status === STATE_STATUS.WAITING) stats.waiting++;
      else if (state.status === STATE_STATUS.RESUMED) stats.resumed++;
      else if (state.status === STATE_STATUS.TIMEOUT) stats.timeout++;
    }

    return stats;
  }

  /**
   * Limpa todos os estados (para reset/shutdown)
   */
  clearAll() {
    // Limpar todos os timers
    for (const timerId of this.timers.values()) {
      clearTimeout(timerId);
    }
    
    this.timers.clear();
    this.states.clear();
    this.timeoutCallbacks.clear();

    logger.info('StateManager limpo');
  }

  /**
   * Serializa estado para persistência (se necessário)
   */
  serializeState(agentId) {
    const state = this.states.get(agentId);
    if (!state) return null;
    
    return JSON.stringify(state);
  }

  /**
   * Restaura estado de serialização
   */
  deserializeState(serialized) {
    try {
      const state = JSON.parse(serialized);
      this.states.set(state.agentId, state);
      return state;
    } catch (error) {
      logger.error('Erro ao deserializar estado', { error: error.message });
      return null;
    }
  }
}

// Singleton
let instance = null;

/**
 * Obtém instância singleton do StateManager
 */
function getInstance() {
  if (!instance) {
    instance = new StateManager();
  }
  return instance;
}

module.exports = {
  StateManager,
  STATE_STATUS,
  DEFAULT_TIMEOUT,
  getInstance,
  
  // Atalhos para uso direto
  saveState: (agentId, state) => getInstance().saveState(agentId, state),
  restoreState: (agentId) => getInstance().restoreState(agentId),
  clearState: (agentId, status) => getInstance().clearState(agentId, status),
  checkTimeout: (agentId, timeout) => getInstance().checkTimeout(agentId, timeout),
  generateAgentId: (type, docId) => getInstance().generateAgentId(type, docId)
};
