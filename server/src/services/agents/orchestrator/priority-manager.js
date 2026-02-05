/**
 * Gerenciador de Prioridades
 * Fase 4 - Camada de Orquestração
 * 
 * Responsável por definir a ordem de execução das tarefas
 * e identificar quais podem rodar em paralelo.
 */

const logger = require('../../../utils/logger');

class PriorityManager {
  
  /**
   * Cria um plano de execução baseado nas tarefas e dependências
   * 
   * @param {Array} tasks - Lista de tarefas decompostas
   * @param {Array} dependencies - Lista de dependências resolvidas
   * @returns {Object} Plano de execução com fases
   */
  async plan(tasks, dependencies) {
    const startTime = Date.now();

    logger.debug('Criando plano de execução', {
      tasks_count: tasks.length,
      dependencies_count: dependencies.length
    });

    // Construir grafo de dependências
    const graph = this.buildDependencyGraph(tasks, dependencies);

    // Ordenação topológica para definir fases
    const phases = this.topologicalSort(graph, tasks);

    // Identificar oportunidades de paralelização
    const parallelGroups = this.identifyParallelGroups(phases);

    // Calcular estimativas de tempo
    const timeEstimates = this.calculateTimeEstimates(phases);

    const executionPlan = {
      phases: phases.map((phase, index) => ({
        phaseNumber: index + 1,
        agents: phase,
        canParallelize: phase.length > 1,
        estimatedDuration: timeEstimates[index] || 'unknown'
      })),
      totalPhases: phases.length,
      canRunInParallel: parallelGroups,
      estimatedTotalTime: this.sumEstimates(timeEstimates),
      executionOrder: this.flattenPhases(phases)
    };

    const duration = Date.now() - startTime;

    logger.debug('Plano de execução criado', {
      duration_ms: duration,
      phases_count: phases.length,
      can_parallelize: parallelGroups.length > 0
    });

    return executionPlan;
  }

  /**
   * Constrói um grafo de dependências
   */
  buildDependencyGraph(tasks, dependencies) {
    const graph = {};

    // Inicializar nós para todas as tarefas
    for (const task of tasks) {
      graph[task.agent] = {
        task,
        dependsOn: [],
        dependents: []
      };
    }

    // Adicionar arestas de dependência
    for (const dep of dependencies) {
      if (graph[dep.agent]) {
        graph[dep.agent].dependsOn = dep.mustWaitFor || [];
        
        // Atualizar dependentes inversos
        for (const parent of (dep.mustWaitFor || [])) {
          if (graph[parent]) {
            graph[parent].dependents.push(dep.agent);
          }
        }
      }
    }

    return graph;
  }

  /**
   * Realiza ordenação topológica para definir fases de execução
   */
  topologicalSort(graph, tasks) {
    const phases = [];
    const visited = new Set();
    const remaining = new Set(Object.keys(graph));

    // Continuar até processar todos os nós
    let iterations = 0;
    const maxIterations = tasks.length + 1;

    while (remaining.size > 0 && iterations < maxIterations) {
      iterations++;
      const currentPhase = [];

      // Encontrar todos os nós sem dependências pendentes
      for (const agent of remaining) {
        const node = graph[agent];
        const deps = node.dependsOn || [];
        
        // Se todas as dependências já foram visitadas, pode executar
        const allDepsVisited = deps.every(d => visited.has(d));
        
        if (allDepsVisited) {
          currentPhase.push(agent);
        }
      }

      // Se não encontrou nenhum nó, há um ciclo ou erro
      if (currentPhase.length === 0 && remaining.size > 0) {
        logger.warn('Possível ciclo de dependências detectado', {
          remaining: Array.from(remaining)
        });
        // Forçar inclusão do restante na última fase
        phases.push(Array.from(remaining));
        break;
      }

      // Mover nós para visitados
      for (const agent of currentPhase) {
        visited.add(agent);
        remaining.delete(agent);
      }

      if (currentPhase.length > 0) {
        phases.push(currentPhase);
      }
    }

    return phases;
  }

  /**
   * Identifica grupos que podem rodar em paralelo
   */
  identifyParallelGroups(phases) {
    const parallelGroups = [];

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      
      if (phase.length > 1) {
        parallelGroups.push({
          phaseNumber: i + 1,
          agents: phase,
          reason: 'Sem dependências mútuas nesta fase'
        });
      }
    }

    return parallelGroups;
  }

  /**
   * Calcula estimativas de tempo por fase (em ms)
   */
  calculateTimeEstimates(phases) {
    // Estimativas base por tipo de agente (em ms)
    const baseEstimates = {
      analysis: 5000,    // 5 segundos
      investments: 8000, // 8 segundos (pode consultar APIs)
      planning: 4000     // 4 segundos
    };

    const estimates = [];

    for (const phase of phases) {
      if (phase.length === 1) {
        // Fase sequencial: tempo do único agente
        const agent = phase[0];
        estimates.push(baseEstimates[agent] || 5000);
      } else {
        // Fase paralela: tempo do mais lento
        const maxTime = Math.max(
          ...phase.map(agent => baseEstimates[agent] || 5000)
        );
        estimates.push(maxTime);
      }
    }

    return estimates;
  }

  /**
   * Soma as estimativas de tempo
   */
  sumEstimates(estimates) {
    const total = estimates.reduce((sum, est) => sum + est, 0);
    return `~${Math.round(total / 1000)} segundos`;
  }

  /**
   * Achata as fases em uma ordem de execução linear
   */
  flattenPhases(phases) {
    const order = [];
    
    for (let i = 0; i < phases.length; i++) {
      for (const agent of phases[i]) {
        order.push({
          agent,
          phase: i + 1,
          position: order.length + 1
        });
      }
    }

    return order;
  }

  /**
   * Recalcula prioridades após uma tarefa falhar
   * Útil para reroteamento em caso de erros
   */
  recalculateAfterFailure(executionPlan, failedAgent) {
    logger.warn('Recalculando plano após falha', { failedAgent });

    const newPhases = [];

    for (const phase of executionPlan.phases) {
      const agentsWithoutFailed = phase.agents.filter(a => a !== failedAgent);
      
      // Também remover agentes que dependiam do que falhou
      const agentsToKeep = agentsWithoutFailed.filter(agent => {
        // Verificar se não dependia do agente que falhou
        // (precisaria do grafo original para fazer isso corretamente)
        return true; // Por simplicidade, mantém todos os outros
      });

      if (agentsToKeep.length > 0) {
        newPhases.push({
          ...phase,
          agents: agentsToKeep,
          canParallelize: agentsToKeep.length > 1
        });
      }
    }

    return {
      ...executionPlan,
      phases: newPhases,
      totalPhases: newPhases.length,
      modifiedDueToFailure: true,
      failedAgent
    };
  }
}

module.exports = { PriorityManager };
