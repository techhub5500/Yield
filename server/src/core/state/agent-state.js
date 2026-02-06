/**
 * @module core/state/agent-state
 * @description Estado de agentes durante execução.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 * 
 * Conforme ponto importante da constituição:
 * "Os agentes precisam ser capazes de interagir com sistemas externos
 *  sem encerrar o fluxo de execução."
 * 
 * Este módulo persiste o estado do agente durante chamadas externas,
 * permitindo que o agente retome a execução com contexto completo
 * após a resposta do sistema externo.
 * 
 * Estados possíveis:
 * - idle: Agente sem tarefa ativa
 * - executing: Agente processando tarefa
 * - waiting_external: Agente aguardando resposta de sistema externo
 * - completed: Agente finalizou tarefa
 * - error: Agente encontrou erro
 */

const logger = require('../../utils/logger');

/**
 * @class AgentState
 * Representa o estado de um agente durante a execução.
 */
class AgentState {
  /**
   * @param {string} agentId - Identificador do agente (junior, analysis, etc.)
   * @param {string} chatId - Identificador do chat
   */
  constructor(agentId, chatId) {
    this.agentId = agentId;
    this.chatId = chatId;
    this.status = 'idle';
    this.currentTask = null;
    this.context = {};
    this.pendingExternalCalls = [];
    this.results = [];
    this.timestamp = Date.now();
    this.updatedAt = Date.now();
  }

  /**
   * Marca o agente como em execução.
   * @param {Object} task - Descrição da tarefa atual
   */
  startExecution(task) {
    this.status = 'executing';
    this.currentTask = task;
    this.updatedAt = Date.now();
  }

  /**
   * Marca o agente como aguardando sistema externo.
   * @param {string} externalSystem - Nome do sistema (finance_bridge, serper, etc.)
   * @param {Object} params - Parâmetros da chamada
   */
  markWaitingExternal(externalSystem, params) {
    this.status = 'waiting_external';
    this.pendingExternalCalls.push({
      system: externalSystem,
      params,
      timestamp: Date.now(),
    });
    this.updatedAt = Date.now();
  }

  /**
   * Retoma execução após retorno de sistema externo.
   * @param {Object} result - Resultado do sistema externo
   */
  resumeExecution(result) {
    this.status = 'executing';
    const pendingCall = this.pendingExternalCalls.pop();
    if (pendingCall) {
      this.results.push({
        system: pendingCall.system,
        result,
        resolvedAt: Date.now(),
      });
    }
    this.context.lastExternalResult = result;
    this.updatedAt = Date.now();
  }

  /**
   * Marca o agente como concluído.
   * @param {Object} finalResult - Resultado final da tarefa
   */
  markCompleted(finalResult) {
    this.status = 'completed';
    this.context.finalResult = finalResult;
    this.updatedAt = Date.now();
  }

  /**
   * Marca o agente como em erro.
   * @param {string} errorMessage - Mensagem de erro
   */
  markError(errorMessage) {
    this.status = 'error';
    this.context.lastError = errorMessage;
    this.updatedAt = Date.now();
  }

  /**
   * Serializa o estado para persistência.
   * @returns {Object} Estado serializado
   */
  toJSON() {
    return {
      agentId: this.agentId,
      chatId: this.chatId,
      status: this.status,
      currentTask: this.currentTask,
      context: this.context,
      pendingExternalCalls: this.pendingExternalCalls,
      results: this.results,
      timestamp: this.timestamp,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Restaura estado a partir de dados serializados.
   * @param {Object} data - Dados serializados
   * @returns {AgentState}
   */
  static fromJSON(data) {
    const state = new AgentState(data.agentId, data.chatId);
    state.status = data.status || 'idle';
    state.currentTask = data.currentTask || null;
    state.context = data.context || {};
    state.pendingExternalCalls = data.pendingExternalCalls || [];
    state.results = data.results || [];
    state.timestamp = data.timestamp || Date.now();
    state.updatedAt = data.updatedAt || Date.now();
    return state;
  }
}

module.exports = AgentState;
