/**
 * @module core/orchestrator/execution-manager
 * @description Gerenciador de execução dos Agentes Coordenadores.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 * Responsabilidades:
 * - Receber o DOC do Orquestrador
 * - Executar agentes respeitando prioridades e dependências
 * - Passar outputs de agentes dependentes como input
 * - Coletar e retornar todos os resultados
 * 
 * Fluxo:
 * 1. Ordenar agentes por prioridade
 * 2. Para cada agente:
 *    a. Aguardar dependências (se houver)
 *    b. Preparar input (com outputs de dependências)
 *    c. Executar agente coordenador
 *    d. Armazenar resultado
 *    e. Notificar sistema de dependências
 */

const ExecutionQueue = require('./queue');
const { prepareInput } = require('./input-builder');
const logger = require('../../utils/logger');

/**
 * @class ExecutionManager
 * Controla a execução dos coordenadores conforme o DOC.
 */
class ExecutionManager {
  /**
   * @param {Object} coordinators - Map de coordenadores disponíveis
   * @param {Object} coordinators.analysis - Agente de Análise
   * @param {Object} coordinators.investments - Agente de Investimentos
   * @param {Object} coordinators.planning - Agente de Planejamento
   */
  constructor(coordinators = {}) {
    this.coordinators = coordinators;
  }

  /**
   * Executa o plano de execução do DOC.
   * 
   * @param {Object} doc - Documento de Direção gerado pelo Orquestrador
   * @returns {Promise<Map<string, Object>>} Resultados de todos os agentes
   */
  async execute(doc) {
    const queue = new ExecutionQueue();
    const agents = doc.execution_plan.agents;

    logger.logic('INFO', 'ExecutionManager', `Iniciando execução do DOC ${doc.request_id}`, {
      agentCount: agents.length,
      agents: agents.map(a => a.agent).join(', '),
    });

    const startTime = Date.now();

    // Ordenar por prioridade
    const sorted = queue.sortByPriority(agents);

    for (const agentSpec of sorted) {
      const agentName = agentSpec.agent;

      logger.logic('DEBUG', 'ExecutionManager', `Processando agente "${agentName}" (prioridade: ${agentSpec.priority})`, {
        dependencies: agentSpec.dependencies.join(', ') || 'nenhuma',
      });

      try {
        // Aguardar dependências
        if (agentSpec.dependencies.length > 0) {
          logger.logic('DEBUG', 'ExecutionManager', `Aguardando dependências de "${agentName}": ${agentSpec.dependencies.join(', ')}`);
          await queue.waitForDependencies(agentSpec.dependencies);
        }

        // Preparar input com outputs de dependências
        const input = prepareInput(agentSpec, queue.getResults());

        // Executar coordenador
        const coordinator = this.coordinators[agentName];
        if (!coordinator) {
          throw new Error(`Coordenador "${agentName}" não disponível`);
        }

        const result = await coordinator.execute(input);

        // Marcar como concluído e notificar dependentes
        queue.markCompleted(agentName, result);

        logger.logic('INFO', 'ExecutionManager', `Agente "${agentName}" concluído com sucesso`, {
          confidence: result?.metadata?.confidence || 'unknown',
        });
      } catch (error) {
        logger.error('ExecutionManager', 'logic', `Falha no agente "${agentName}"`, {
          error: error.message,
        });

        // Marcar como concluído com erro para não bloquear dependentes
        const errorResult = {
          agent: agentName,
          task_completed: false,
          reasoning: `Falha na execução: ${error.message}`,
          tools_used: [],
          result: { error: error.message },
          metadata: { confidence: 'none' },
        };

        queue.markCompleted(agentName, errorResult);
      }
    }

    const elapsed = Date.now() - startTime;

    logger.logic('INFO', 'ExecutionManager', `Execução do DOC ${doc.request_id} concluída`, {
      elapsed: `${elapsed}ms`,
      agentsCompleted: queue.getResults().size,
    });

    // Limpar listeners
    const results = new Map(queue.getResults());
    queue.reset();

    return results;
  }
}

module.exports = ExecutionManager;
