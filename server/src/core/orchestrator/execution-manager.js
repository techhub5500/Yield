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
  async execute(doc, chatId) {
    const queue = new ExecutionQueue();
    const agents = doc.execution_plan.agents;

    logger.logic('INFO', 'ExecutionManager', `Iniciando execução do DOC ${doc.request_id}`, {
      agentCount: agents.length,
      agents: agents.map(a => a.agent).join(', '),
    });

    const startTime = Date.now();

    // Ordenar por prioridade (usado para retorno determinístico e logs)
    const sorted = queue.sortByPriority(agents);

    // Execução por ondas (wave-based): em cada onda, executa em paralelo os agentes cujas dependências já foram concluídas.
    let remaining = [...sorted];

    while (remaining.length > 0) {
      const ready = remaining.filter((agentSpec) => queue.areDependenciesMet(agentSpec.dependencies));

      if (ready.length === 0) {
        // DOC inválido ou dependências impossíveis — marcar o restante como erro para não travar.
        const pendingAgents = remaining.map(a => a.agent).join(', ');
        logger.error('ExecutionManager', 'logic', 'Deadlock de dependências detectado — nenhum agente está pronto para executar', {
          pendingAgents,
        });

        for (const agentSpec of remaining) {
          const agentName = agentSpec.agent;
          const errorResult = {
            agent: agentName,
            task_completed: false,
            reasoning: 'Falha na execução: dependências não resolvidas (deadlock) — DOC inválido ou dependências impossíveis.',
            tools_used: [],
            result: { error: 'Dependências não resolvidas (deadlock)' },
            metadata: { confidence: 'none' },
          };
          queue.markCompleted(agentName, errorResult);
        }
        break;
      }

      // Remover os prontos do pool antes de executar (evita re-entrada se a onda demorar)
      const readyNames = new Set(ready.map(r => r.agent));
      remaining = remaining.filter((agentSpec) => !readyNames.has(agentSpec.agent));

      logger.logic('INFO', 'ExecutionManager', `Iniciando onda com ${ready.length} agente(s) em paralelo`, {
        agents: ready.map(a => `${a.agent}#${a.priority}`).join(', '),
      });

      const waveResults = await Promise.all(
        ready.map(async (agentSpec) => {
          const agentName = agentSpec.agent;

          logger.logic('DEBUG', 'ExecutionManager', `Processando agente "${agentName}" (prioridade: ${agentSpec.priority})`, {
            dependencies: agentSpec.dependencies.join(', ') || 'nenhuma',
          });

          try {
            const input = prepareInput(agentSpec, queue.getResults(), chatId);

            const coordinator = this.coordinators[agentName];
            if (!coordinator) {
              throw new Error(`Coordenador "${agentName}" não disponível`);
            }

            const result = await coordinator.execute(input);
            return { agentName, result, ok: true };
          } catch (error) {
            const errorResult = {
              agent: agentName,
              task_completed: false,
              reasoning: `Falha na execução: ${error.message}`,
              tools_used: [],
              result: { error: error.message },
              metadata: { confidence: 'none' },
            };
            return { agentName, result: errorResult, ok: false, error };
          }
        })
      );

      for (const item of waveResults) {
        queue.markCompleted(item.agentName, item.result);
        if (item.ok) {
          logger.logic('INFO', 'ExecutionManager', `Agente "${item.agentName}" concluído com sucesso`, {
            confidence: item.result?.metadata?.confidence || 'unknown',
          });
        } else {
          logger.error('ExecutionManager', 'logic', `Falha no agente "${item.agentName}"`, {
            error: item.error?.message || 'Erro desconhecido',
          });
        }
      }
    }

    const elapsed = Date.now() - startTime;

    logger.logic('INFO', 'ExecutionManager', `Execução do DOC ${doc.request_id} concluída`, {
      elapsed: `${elapsed}ms`,
      agentsCompleted: queue.getResults().size,
    });

    // Retorno determinístico: sempre na ordem de prioridade do DOC (independente da ordem de conclusão em paralelo)
    const results = new Map();
    const completed = queue.getResults();
    for (const agentSpec of sorted) {
      if (completed.has(agentSpec.agent)) {
        results.set(agentSpec.agent, completed.get(agentSpec.agent));
      }
    }

    // Limpar listeners
    queue.reset();

    return results;
  }
}

module.exports = ExecutionManager;
