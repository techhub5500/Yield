/**
 * @module core/state/external-call-manager
 * @description Gerenciador de chamadas externas com preservação de estado.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 * 
 * Conforme constituição:
 * "Quando o agente precisa utilizar um sistema externo, ele deve executar a ação,
 *  aguardar o retorno preservando sua memória, e quando a resposta chegar,
 *  continuar o fluxo para executar a próxima tarefa, sem perda de contexto."
 * 
 * Responsabilidades:
 * - Salvar estado do agente antes de chamada externa
 * - Executar chamada externa (Finance Bridge, APIs, etc.)
 * - Restaurar estado e adicionar resultado após retorno
 * - Tratar erros mantendo estado consistente
 */

const AgentState = require('./agent-state');
const logger = require('../../utils/logger');

/**
 * @class ExternalCallManager
 * Gerencia chamadas a sistemas externos preservando estado do agente.
 */
class ExternalCallManager {
  constructor() {
    /**
     * Cache em memória de estados ativos.
     * Chave: `${agentId}:${chatId}`
     * @type {Map<string, AgentState>}
     */
    this.activeStates = new Map();
  }

  /**
   * Gera chave única para o par agente+chat.
   * @private
   * @param {string} agentId
   * @param {string} chatId
   * @returns {string}
   */
  _stateKey(agentId, chatId, scope) {
    if (!scope) return `${agentId}:${chatId}`;
    return `${agentId}:${chatId}::${scope}`;
  }

  /**
   * Obtém ou cria o estado de um agente.
   * @param {string} agentId
   * @param {string} chatId
   * @returns {AgentState}
   */
  getOrCreateState(agentId, chatId, scope) {
    const key = this._stateKey(agentId, chatId, scope);
    if (!this.activeStates.has(key)) {
      this.activeStates.set(key, new AgentState(agentId, chatId));
    }
    return this.activeStates.get(key);
  }

  /**
   * Executa uma chamada externa preservando o estado do agente.
   * 
   * Fluxo:
   * 1. Salvar estado atual (waiting_external)
   * 2. Executar chamada externa
   * 3. Restaurar estado com resultado
   * 4. Retornar resultado
   * 
   * @param {string} agentId - Identificador do agente
   * @param {string} chatId - Identificador do chat
   * @param {Function} externalFn - Função externa a executar (async)
   * @param {Object} params - Parâmetros para a função externa
   * @param {string} systemName - Nome do sistema externo (para logging)
   * @returns {Promise<Object>} Resultado da chamada externa
   */
  async executeWithState(agentId, chatId, externalFn, params, systemName = 'unknown', scope) {
    const state = this.getOrCreateState(agentId, chatId, scope);

    // 1. Marcar como aguardando sistema externo
    state.markWaitingExternal(systemName, params);

    logger.logic('DEBUG', 'ExternalCallManager', `Agente "${agentId}" aguardando "${systemName}"`, {
      chatId,
      pendingCalls: state.pendingExternalCalls.length,
    });

    try {
      // 2. Executar chamada externa
      const result = await externalFn(params);

      // 3. Restaurar estado com resultado
      state.resumeExecution(result);

      logger.logic('DEBUG', 'ExternalCallManager', `Agente "${agentId}" retomou após "${systemName}"`, {
        chatId,
      });

      return result;
    } catch (error) {
      // 4. Em caso de erro, registrar no estado
      state.markError(error.message);

      logger.error('ExternalCallManager', 'logic', `Falha na chamada externa "${systemName}" para agente "${agentId}"`, {
        chatId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Obtém o estado atual de um agente.
   * @param {string} agentId
   * @param {string} chatId
   * @returns {AgentState|null}
   */
  getState(agentId, chatId, scope) {
    const key = this._stateKey(agentId, chatId, scope);
    return this.activeStates.get(key) || null;
  }

  /**
   * Remove o estado de um agente (após conclusão do ciclo).
   * @param {string} agentId
   * @param {string} chatId
   */
  clearState(agentId, chatId, scope) {
    const key = this._stateKey(agentId, chatId, scope);
    this.activeStates.delete(key);
  }

  /**
   * Remove todos os estados de um chat (cleanup após ciclo completo).
   * @param {string} chatId
   */
  clearChatStates(chatId) {
    for (const [key] of this.activeStates) {
      if (key.endsWith(`:${chatId}`) || key.includes(`:${chatId}::`)) {
        this.activeStates.delete(key);
      }
    }
  }
}

module.exports = ExternalCallManager;
