/**
 * Resolutor de Dependências
 * Fase 4 - Camada de Orquestração
 * 
 * Responsável por identificar dependências entre tarefas
 * e determinar a ordem correta de execução.
 */

const logger = require('../../../utils/logger');

/**
 * Regras de dependência entre agentes
 * Define quando um agente precisa esperar outro terminar
 */
const DEPENDENCY_RULES = [
  {
    dependent: 'planning',
    dependsOn: 'analysis',
    condition: 'needs_spending_data',
    description: 'Planejamento precisa de análise de gastos para criar orçamento realista',
    triggers: ['orçamento', 'ajuste', 'economizar', 'plano', 'limite']
  },
  {
    dependent: 'investments',
    dependsOn: 'analysis',
    condition: 'needs_cash_flow',
    description: 'Investimentos pode precisar do fluxo de caixa para recomendar aportes',
    triggers: ['quanto posso investir', 'sobra', 'excedente', 'aporte mensal']
  },
  {
    dependent: 'planning',
    dependsOn: 'investments',
    condition: 'needs_portfolio_data',
    description: 'Planejamento pode precisar de dados da carteira para metas',
    triggers: ['patrimônio', 'total investido', 'reserva']
  }
];

/**
 * Agentes que podem executar em paralelo (sem dependência mútua)
 */
const PARALLEL_SAFE = [
  { agents: ['analysis', 'investments'], when: 'independent_queries' }
];

class DependencyResolver {
  
  constructor() {
    this.rules = DEPENDENCY_RULES;
    this.parallelSafe = PARALLEL_SAFE;
  }

  /**
   * Resolve dependências entre tarefas
   * 
   * @param {Array} tasks - Lista de tarefas decompostas
   * @returns {Array} Lista de dependências identificadas
   */
  async resolve(tasks) {
    const startTime = Date.now();
    const dependencies = [];
    const agents = tasks.map(t => t.agent);

    logger.debug('Resolvendo dependências', { agents });

    // Verificar cada par de tarefas
    for (const task of tasks) {
      const taskDeps = this.findDependencies(task, agents, tasks);
      
      if (taskDeps.length > 0) {
        dependencies.push({
          agent: task.agent,
          dependsOn: taskDeps,
          mustWaitFor: taskDeps.map(d => d.agent),
          reasons: taskDeps.map(d => d.reason)
        });
      }
    }

    const duration = Date.now() - startTime;

    logger.debug('Dependências resolvidas', {
      duration_ms: duration,
      dependencies_count: dependencies.length
    });

    return dependencies;
  }

  /**
   * Encontra dependências para uma tarefa específica
   */
  findDependencies(task, availableAgents, allTasks) {
    const deps = [];

    for (const rule of this.rules) {
      // Verificar se a regra se aplica
      if (rule.dependent !== task.agent) continue;
      if (!availableAgents.includes(rule.dependsOn)) continue;

      // Verificar se os triggers estão presentes na descrição da tarefa
      const hasRelevantTrigger = this.checkTriggers(task, rule.triggers);
      
      if (hasRelevantTrigger) {
        deps.push({
          agent: rule.dependsOn,
          reason: rule.description,
          condition: rule.condition
        });
      }
    }

    // Verificar dependências implícitas baseado no contexto das tarefas
    const implicitDeps = this.checkImplicitDependencies(task, allTasks);
    deps.push(...implicitDeps);

    // Remover duplicatas
    const uniqueDeps = this.removeDuplicates(deps);

    return uniqueDeps;
  }

  /**
   * Verifica se triggers estão presentes na tarefa
   */
  checkTriggers(task, triggers) {
    if (!triggers || triggers.length === 0) return true;

    const taskText = (task.taskDescription || '').toLowerCase();
    const matchedKeywords = (task.matchedKeywords || []).join(' ').toLowerCase();
    const fullText = `${taskText} ${matchedKeywords}`;

    return triggers.some(trigger => 
      fullText.includes(trigger.toLowerCase())
    );
  }

  /**
   * Verifica dependências implícitas baseado no contexto
   */
  checkImplicitDependencies(task, allTasks) {
    const implicitDeps = [];

    // Se o planejamento precisa de dados específicos de análise
    if (task.agent === 'planning') {
      const analysisTask = allTasks.find(t => t.agent === 'analysis');
      
      if (analysisTask) {
        // Verificar se o planejamento precisa de dados de gastos
        const planningKeywords = ['orçamento', 'ajuste', 'limite', 'cortar'];
        const needsAnalysis = planningKeywords.some(kw => 
          task.taskDescription.toLowerCase().includes(kw)
        );

        if (needsAnalysis) {
          const alreadyDepends = implicitDeps.some(d => d.agent === 'analysis');
          if (!alreadyDepends) {
            implicitDeps.push({
              agent: 'analysis',
              reason: 'Planejamento precisa dos dados de gastos atuais',
              condition: 'implicit_data_need'
            });
          }
        }
      }
    }

    // Se investimentos precisa saber quanto sobra
    if (task.agent === 'investments') {
      const analysisTask = allTasks.find(t => t.agent === 'analysis');
      
      if (analysisTask) {
        const investKeywords = ['quanto investir', 'aporte', 'sobra', 'disponível'];
        const needsFlowData = investKeywords.some(kw => 
          task.taskDescription.toLowerCase().includes(kw)
        );

        if (needsFlowData) {
          const alreadyDepends = implicitDeps.some(d => d.agent === 'analysis');
          if (!alreadyDepends) {
            implicitDeps.push({
              agent: 'analysis',
              reason: 'Investimentos precisa saber o fluxo de caixa atual',
              condition: 'implicit_flow_need'
            });
          }
        }
      }
    }

    return implicitDeps;
  }

  /**
   * Remove dependências duplicadas
   */
  removeDuplicates(deps) {
    const seen = new Set();
    return deps.filter(dep => {
      const key = dep.agent;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Verifica se dois agentes podem executar em paralelo
   */
  canRunInParallel(agent1, agent2, tasks) {
    // Verificar se há dependência entre eles
    const task1 = tasks.find(t => t.agent === agent1);
    const task2 = tasks.find(t => t.agent === agent2);

    if (!task1 || !task2) return false;

    const deps1 = this.findDependencies(task1, [agent2], tasks);
    const deps2 = this.findDependencies(task2, [agent1], tasks);

    // Se nenhum depende do outro, podem rodar em paralelo
    return deps1.length === 0 && deps2.length === 0;
  }

  /**
   * Detecta ciclos de dependência (erro de configuração)
   */
  detectCycles(dependencies) {
    const graph = new Map();
    
    // Construir grafo
    for (const dep of dependencies) {
      if (!graph.has(dep.agent)) {
        graph.set(dep.agent, []);
      }
      graph.get(dep.agent).push(...dep.mustWaitFor);
    }

    // DFS para detectar ciclos
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (node) => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (hasCycle(node)) {
          logger.error('Ciclo de dependência detectado!');
          return true;
        }
      }
    }

    return false;
  }
}

module.exports = { DependencyResolver };
