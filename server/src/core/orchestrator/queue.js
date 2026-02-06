/**
 * @module core/orchestrator/queue
 * @description Fila de execução para Agentes Coordenadores.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 * Responsabilidades:
 * - Ordenar agentes por prioridade
 * - Verificar se dependências foram concluídas
 * - Gerenciar timeouts por agente
 * - Emitir eventos de conclusão para agentes dependentes
 */

const { EventEmitter } = require('events');
const logger = require('../../utils/logger');
const config = require('../../config');

/**
 * @class ExecutionQueue
 * Gerencia a fila de execução dos coordenadores.
 * @extends EventEmitter
 */
class ExecutionQueue extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, Object>} Resultados por agente */
    this.completedAgents = new Map();
    /** @type {number} Timeout por agente em ms */
    this.agentTimeout = config.timeouts.agent || 80000;
  }

  /**
   * Ordena os agentes por prioridade (menor prioridade primeiro).
   * @param {Object[]} agents - Array de agents do DOC
   * @returns {Object[]} Agentes ordenados
   */
  sortByPriority(agents) {
    return [...agents].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Verifica se todas as dependências de um agente foram concluídas.
   * @param {string[]} dependencies - Nomes dos agentes dependentes
   * @returns {boolean}
   */
  areDependenciesMet(dependencies) {
    if (!dependencies || dependencies.length === 0) return true;
    return dependencies.every(dep => this.completedAgents.has(dep));
  }

  /**
   * Aguarda até que todas as dependências de um agente sejam concluídas.
   * Usa EventEmitter para espera assíncrona eficiente.
   * 
   * @param {string[]} dependencies - Nomes dos agentes dependentes
   * @param {number} [timeout] - Timeout em ms (padrão: config.timeouts.agent)
   * @returns {Promise<void>} Resolve quando todas as dependências terminam
   * @throws {Error} Se timeout for atingido
   */
  async waitForDependencies(dependencies, timeout) {
    if (this.areDependenciesMet(dependencies)) return;

    const _timeout = timeout || this.agentTimeout;

    return new Promise((resolve, reject) => {
      const checkDeps = () => {
        if (this.areDependenciesMet(dependencies)) {
          this.removeListener('agent-completed', checkDeps);
          clearTimeout(timer);
          resolve();
        }
      };

      const timer = setTimeout(() => {
        this.removeListener('agent-completed', checkDeps);
        const pending = dependencies.filter(d => !this.completedAgents.has(d));
        reject(new Error(`Timeout aguardando dependências: ${pending.join(', ')} (${_timeout}ms)`));
      }, _timeout);

      this.on('agent-completed', checkDeps);

      // Checar novamente caso alguma dependência tenha terminado entre check inicial e aqui
      checkDeps();
    });
  }

  /**
   * Marca um agente como concluído e emite evento.
   * @param {string} agentName - Nome do agente
   * @param {Object} result - Resultado da execução
   */
  markCompleted(agentName, result) {
    this.completedAgents.set(agentName, result);

    logger.logic('DEBUG', 'ExecutionQueue', `Agente "${agentName}" concluído`, {
      agentName,
      success: result?.task_completed !== false,
    });

    this.emit('agent-completed', agentName, result);
  }

  /**
   * Retorna os resultados de todos os agentes concluídos.
   * @returns {Map<string, Object>}
   */
  getResults() {
    return this.completedAgents;
  }

  /**
   * Limpa o estado da fila para nova execução.
   */
  reset() {
    this.completedAgents.clear();
    this.removeAllListeners('agent-completed');
  }
}

module.exports = ExecutionQueue;
