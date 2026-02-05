/**
 * Controlador de Execução
 * Fase 4 + 5 - Camada de Orquestração com Agentes Coordenadores
 * 
 * Responsável por executar o DOC, coordenando os agentes
 * conforme as dependências e fases definidas.
 * 
 * Integra com os três agentes coordenadores (Fase 5):
 * - Analysis: Análise de gastos e padrões
 * - Planning: Orçamentos e metas
 * - Investments: Cotações e projeções
 */

const logger = require('../../../utils/logger');

// Lazy loading dos coordenadores para evitar dependências circulares
let Coordinators = null;

const getCoordinators = () => {
  if (!Coordinators) {
    Coordinators = require('../coordinators');
  }
  return Coordinators;
};

/**
 * Status possíveis de uma tarefa
 */
const TASK_STATUS = {
  PENDING: 'pending',
  WAITING: 'waiting',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped'
};

/**
 * Timeout padrão para execução de agentes (em ms)
 */
const DEFAULT_TIMEOUT = parseInt(process.env.AGENT_TIMEOUT) || 80000;

class ExecutionController {
  
  constructor() {
    this.runningTasks = new Map();
    this.completedTasks = new Map();
    this.pendingTasks = new Map();
    this.failedTasks = new Map();
    this.timeout = DEFAULT_TIMEOUT;
    this.coordinatorsInitialized = false;
  }

  /**
   * Inicializa os agentes coordenadores
   * @returns {Promise<void>}
   */
  async initializeCoordinators() {
    if (this.coordinatorsInitialized) return;

    try {
      const Coordinators = getCoordinators();
      await Coordinators.initializeAll();
      this.coordinatorsInitialized = true;
      logger.info('Agentes coordenadores inicializados');
    } catch (error) {
      logger.warn('Falha ao inicializar coordenadores, usando modo simulado', {
        error: error.message
      });
      this.coordinatorsInitialized = false;
    }
  }

  /**
   * Obtém o agente coordenador apropriado para um tipo
   * @param {string} agentType - Tipo do agente (analysis, planning, investments)
   * @returns {Object|null} Instância do coordenador ou null
   */
  getCoordinatorAgent(agentType) {
    if (!this.coordinatorsInitialized) return null;

    try {
      const Coordinators = getCoordinators();
      return Coordinators.getInstance(agentType);
    } catch (error) {
      logger.warn('Coordenador não disponível', { agentType, error: error.message });
      return null;
    }
  }

  /**
   * Executa o DOC completo, coordenando os agentes
   * 
   * @param {Object} doc - DOC gerado pelo Orquestrador
   * @param {Object} coordinatorAgents - Mapa de agentes coordenadores disponíveis (opcional)
   * @returns {Object} Resultados da execução
   */
  async execute(doc, coordinatorAgents = {}) {
    const startTime = Date.now();
    
    // Reset do estado
    this.reset();

    // Tentar inicializar coordenadores reais (Fase 5)
    await this.initializeCoordinators();

    // Mesclar coordenadores injetados com os inicializados
    const agents = { ...coordinatorAgents };
    if (this.coordinatorsInitialized) {
      const Coordinators = getCoordinators();
      agents.analysis = agents.analysis || Coordinators.AnalysisAgent;
      agents.planning = agents.planning || Coordinators.PlanningAgent;
      agents.investments = agents.investments || Coordinators.InvestmentsAgent;
    }

    logger.info('Iniciando execução do DOC', {
      doc_id: doc.id,
      total_tasks: doc.task_distribution.length,
      total_phases: doc.execution_control.total_phases,
      coordinators_available: this.coordinatorsInitialized
    });

    try {
      // Inicializar tarefas pendentes
      for (const task of doc.task_distribution) {
        this.pendingTasks.set(task.agent, {
          ...task,
          status: TASK_STATUS.PENDING
        });
      }

      // Atualizar status do DOC
      doc.execution_control.status.started_at = new Date().toISOString();

      // Executar por fases
      for (const phase of doc.execution_control.phases) {
        logger.debug('Executando fase', {
          phase: phase.phaseNumber,
          agents: phase.agents
        });

        doc.execution_control.status.current_phase = phase.phaseNumber;
        
        await this.executePhase(phase, doc, coordinatorAgents);
      }

      // Coletar resultados finais
      const results = this.collectResults();
      
      // Atualizar status final do DOC
      doc.execution_control.status.completed_at = new Date().toISOString();
      doc.execution_control.status.completed_agents = Array.from(this.completedTasks.keys());
      doc.execution_control.status.failed_agents = Array.from(this.failedTasks.keys());

      const duration = Date.now() - startTime;

      logger.info('Execução do DOC concluída', {
        doc_id: doc.id,
        duration_ms: duration,
        completed: this.completedTasks.size,
        failed: this.failedTasks.size
      });

      return {
        success: this.failedTasks.size === 0,
        doc_id: doc.id,
        duration_ms: duration,
        results,
        summary: this.buildExecutionSummary(results)
      };

    } catch (error) {
      logger.error('Erro na execução do DOC', {
        doc_id: doc.id,
        error: error.message
      });

      return {
        success: false,
        doc_id: doc.id,
        error: error.message,
        results: this.collectResults(),
        partial: true
      };
    }
  }

  /**
   * Reseta o estado do controlador
   */
  reset() {
    this.runningTasks.clear();
    this.completedTasks.clear();
    this.pendingTasks.clear();
    this.failedTasks.clear();
  }

  /**
   * Executa uma fase (conjunto de tarefas)
   */
  async executePhase(phase, doc, coordinatorAgents) {
    // Preparar tarefas da fase
    const tasksToRun = phase.agents.map(agent => {
      const task = this.pendingTasks.get(agent);
      if (!task) {
        logger.warn('Tarefa não encontrada para agente', { agent });
        return null;
      }
      return { agent, task };
    }).filter(Boolean);

    if (tasksToRun.length === 0) {
      logger.warn('Nenhuma tarefa para executar na fase', { phase: phase.phaseNumber });
      return;
    }

    // Executar tarefas
    if (phase.canParallelize && tasksToRun.length > 1) {
      // Execução paralela
      logger.debug('Executando tarefas em paralelo', {
        agents: tasksToRun.map(t => t.agent)
      });

      const promises = tasksToRun.map(({ agent, task }) => 
        this.runTask(task, doc, coordinatorAgents[agent])
          .catch(error => ({
            agent,
            status: TASK_STATUS.FAILED,
            error: error.message
          }))
      );

      await Promise.all(promises);
    } else {
      // Execução sequencial
      for (const { agent, task } of tasksToRun) {
        try {
          await this.runTask(task, doc, coordinatorAgents[agent]);
        } catch (error) {
          logger.error('Falha na tarefa', {
            agent,
            error: error.message
          });
          // Continua para a próxima tarefa
        }
      }
    }
  }

  /**
   * Executa uma tarefa individual
   */
  async runTask(task, doc, agent) {
    const startTime = Date.now();
    
    // Verificar dependências
    if (!this.dependenciesMet(task)) {
      logger.warn('Dependências não satisfeitas', {
        agent: task.agent,
        depends_on: task.depends_on
      });
      
      // Marcar como esperando
      task.status = TASK_STATUS.WAITING;
      return;
    }

    // Mover para execução
    this.pendingTasks.delete(task.agent);
    task.status = TASK_STATUS.RUNNING;
    task.started_at = new Date().toISOString();
    this.runningTasks.set(task.agent, task);

    logger.debug('Iniciando tarefa', { agent: task.agent });

    try {
      // Coletar outputs de dependências
      const dependencyOutputs = this.getDependencyOutputs(task.depends_on);

      // Preparar payload para o agente
      const payload = {
        memory: doc.memory,
        query: doc.original_query,
        task_description: task.task_description,
        expected_output: task.expected_output,
        context: task.context,
        dependency_outputs: dependencyOutputs,
        coordinatorType: task.agent
      };

      let result;

      // Verificar se o agente está disponível (módulo de coordenadores)
      if (agent && typeof agent.process === 'function') {
        // Usar coordenador real (Fase 5)
        logger.debug('Executando com coordenador real', { agent: task.agent });
        
        result = await this.executeWithTimeout(
          () => agent.process(payload, {
            doc_id: doc.id,
            phase: task.execution_phase,
            memory: doc.memory
          }),
          this.timeout
        );
        
        task.simulated = false;
      } else if (agent && typeof agent.execute === 'function') {
        // Usar agente legado com método execute
        logger.debug('Executando com agente legado', { agent: task.agent });
        
        result = await this.executeWithTimeout(
          () => agent.execute(payload),
          this.timeout
        );
        
        task.simulated = false;
      } else {
        // Agente não disponível - simular execução para demo
        logger.warn('Agente não disponível, simulando execução', { agent: task.agent });
        
        result = await this.simulateAgentExecution(task, doc);
        task.simulated = true;
      }

      // Marcar como completo
      task.status = TASK_STATUS.COMPLETED;
      task.completed_at = new Date().toISOString();
      task.result = result;
      task.duration_ms = Date.now() - startTime;

      this.completedTasks.set(task.agent, task);
      this.runningTasks.delete(task.agent);

      logger.debug('Tarefa concluída', {
        agent: task.agent,
        duration_ms: task.duration_ms,
        simulated: task.simulated
      });

      return result;

    } catch (error) {
      // Marcar como falha
      task.status = TASK_STATUS.FAILED;
      task.completed_at = new Date().toISOString();
      task.error = error.message;
      task.duration_ms = Date.now() - startTime;

      this.failedTasks.set(task.agent, task);
      this.runningTasks.delete(task.agent);

      logger.error('Tarefa falhou', {
        agent: task.agent,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Simula a execução de um agente (para demonstração/testes)
   */
  async simulateAgentExecution(task, doc) {
    // Simular tempo de processamento
    await new Promise(resolve => setTimeout(resolve, 500));

    // Gerar resultado simulado baseado no tipo de agente
    const simulatedResults = {
      analysis: {
        type: 'analysis_report',
        summary: 'Análise de gastos realizada com sucesso (simulado)',
        data: {
          total_expenses: 'R$ 3.500,00',
          top_categories: ['Alimentação', 'Transporte', 'Lazer'],
          trend: 'estável',
          alerts: []
        }
      },
      investments: {
        type: 'investment_recommendation',
        summary: 'Recomendações de investimento geradas (simulado)',
        data: {
          available_for_investment: 'R$ 500,00',
          recommended_assets: ['Tesouro Selic', 'CDB'],
          risk_level: 'baixo'
        }
      },
      planning: {
        type: 'budget_plan',
        summary: 'Plano de orçamento criado (simulado)',
        data: {
          suggested_limits: {
            'Alimentação': 'R$ 800,00',
            'Transporte': 'R$ 400,00',
            'Lazer': 'R$ 300,00'
          },
          savings_target: 'R$ 500,00/mês',
          action_items: ['Reduzir delivery', 'Usar transporte público']
        }
      }
    };

    return simulatedResults[task.agent] || {
      type: 'generic_result',
      summary: `Tarefa do ${task.agent_name} concluída (simulado)`,
      simulated: true
    };
  }

  /**
   * Executa com timeout
   */
  async executeWithTimeout(fn, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout após ${timeoutMs}ms`));
      }, timeoutMs);

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
   * Verifica se todas as dependências foram satisfeitas
   */
  dependenciesMet(task) {
    if (!task.depends_on || task.depends_on.length === 0) {
      return true;
    }

    for (const dep of task.depends_on) {
      const completedTask = this.completedTasks.get(dep);
      if (!completedTask || completedTask.status !== TASK_STATUS.COMPLETED) {
        return false;
      }
    }

    return true;
  }

  /**
   * Obtém outputs das dependências
   */
  getDependencyOutputs(dependencies) {
    if (!dependencies || dependencies.length === 0) {
      return {};
    }

    const outputs = {};
    
    for (const dep of dependencies) {
      const task = this.completedTasks.get(dep);
      if (task && task.result) {
        outputs[dep] = task.result;
      }
    }

    return outputs;
  }

  /**
   * Coleta todos os resultados
   */
  collectResults() {
    const results = {
      completed: {},
      failed: {},
      pending: {}
    };

    for (const [agent, task] of this.completedTasks) {
      results.completed[agent] = {
        status: task.status,
        result: task.result,
        duration_ms: task.duration_ms,
        simulated: task.simulated || false
      };
    }

    for (const [agent, task] of this.failedTasks) {
      results.failed[agent] = {
        status: task.status,
        error: task.error,
        duration_ms: task.duration_ms
      };
    }

    for (const [agent, task] of this.pendingTasks) {
      results.pending[agent] = {
        status: task.status
      };
    }

    return results;
  }

  /**
   * Constrói resumo da execução
   */
  buildExecutionSummary(results) {
    const completed = Object.keys(results.completed);
    const failed = Object.keys(results.failed);
    const pending = Object.keys(results.pending);

    let summary = '';

    if (completed.length > 0) {
      summary += `✅ Concluídas: ${completed.join(', ')}. `;
    }

    if (failed.length > 0) {
      summary += `❌ Falharam: ${failed.join(', ')}. `;
    }

    if (pending.length > 0) {
      summary += `⏳ Pendentes: ${pending.join(', ')}. `;
    }

    if (failed.length === 0 && pending.length === 0) {
      summary += 'Todas as tarefas foram concluídas com sucesso!';
    }

    return summary.trim();
  }

  /**
   * Obtém status atual da execução
   */
  getStatus() {
    return {
      running: Array.from(this.runningTasks.keys()),
      completed: Array.from(this.completedTasks.keys()),
      failed: Array.from(this.failedTasks.keys()),
      pending: Array.from(this.pendingTasks.keys())
    };
  }

  /**
   * Cancela a execução atual
   */
  cancel() {
    logger.warn('Cancelando execução');
    
    // Mover todas as tarefas em execução para pendentes
    for (const [agent, task] of this.runningTasks) {
      task.status = TASK_STATUS.SKIPPED;
      task.error = 'Execução cancelada';
      this.failedTasks.set(agent, task);
    }
    
    this.runningTasks.clear();
  }
}

module.exports = { ExecutionController, TASK_STATUS };
