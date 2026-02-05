/**
 * Construtor do DOC (Documento de Direção)
 * Fase 4 - Camada de Orquestração
 * 
 * Responsável por montar o documento JSON que instrui
 * os agentes coordenadores sobre suas tarefas.
 */

const logger = require('../../../utils/logger');

class DocBuilder {
  
  /**
   * Constrói o DOC completo
   * 
   * @param {Object} params - Parâmetros para construção
   * @param {string} params.query - Query original do usuário
   * @param {Object} params.memory - Memória filtrada
   * @param {Object} params.decomposition - Resultado da decomposição
   * @param {Array} params.dependencies - Dependências resolvidas
   * @param {Object} params.executionPlan - Plano de execução
   * @param {Object} params.context - Contexto adicional
   * @returns {Object} DOC completo
   */
  async build({ query, memory, decomposition, dependencies, executionPlan, context = {} }) {
    const startTime = Date.now();

    logger.debug('Construindo DOC', {
      query_length: query.length,
      tasks_count: decomposition.tasks.length
    });

    const doc = {
      // IDENTIFICAÇÃO
      id: this.generateId(),
      version: '1.0',
      timestamp: new Date().toISOString(),
      
      // CONTEXTO
      context: {
        user_id: context.user_id || 'unknown',
        session_id: context.session_id || this.generateSessionId(),
        timezone: context.timezone || 'America/Sao_Paulo'
      },

      // QUERY ORIGINAL
      original_query: query,
      
      // MEMÓRIA FILTRADA
      memory: memory,
      
      // ANÁLISE DO ORQUESTRADOR
      orchestrator_analysis: this.buildOrchestratorAnalysis(query, decomposition, dependencies, executionPlan),
      
      // DISTRIBUIÇÃO DE TAREFAS
      task_distribution: this.buildTaskDistribution(decomposition, dependencies, executionPlan),
      
      // CONTROLE DE EXECUÇÃO
      execution_control: this.buildExecutionControl(executionPlan, dependencies),

      // METADADOS
      metadata: {
        created_at: new Date().toISOString(),
        decomposition_confidence: decomposition.confidence,
        estimated_duration: executionPlan.estimatedTotalTime
      }
    };

    const duration = Date.now() - startTime;

    logger.debug('DOC construído', {
      duration_ms: duration,
      doc_id: doc.id
    });

    return doc;
  }

  /**
   * Gera ID único para o DOC
   */
  generateId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `doc_${timestamp}_${random}`;
  }

  /**
   * Gera ID de sessão
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Constrói a análise do orquestrador (Chain of Thought)
   */
  buildOrchestratorAnalysis(query, decomposition, dependencies, executionPlan) {
    return {
      // Intenção identificada
      intent: {
        type: decomposition.intent.type,
        description: decomposition.intent.description,
        complexity: decomposition.intent.complexity
      },

      // Raciocínio completo (Chain of Thought)
      chain_of_thought: {
        step1_decomposition: {
          description: 'Identificação de agentes necessários',
          result: `Identificados ${decomposition.tasks.length} agente(s): ${decomposition.tasks.map(t => t.agentName).join(', ')}`,
          agents: decomposition.tasks.map(t => ({
            agent: t.agent,
            name: t.agentName,
            matchScore: t.matchScore,
            keywords: t.matchedKeywords
          }))
        },

        step2_dependencies: {
          description: 'Verificação de ordem de execução',
          result: dependencies.length > 0 
            ? `${dependencies.length} dependência(s) encontrada(s)`
            : 'Sem dependências entre agentes',
          dependencies: dependencies.map(d => ({
            agent: d.agent,
            dependsOn: d.mustWaitFor,
            reasons: d.reasons
          }))
        },

        step3_memory: {
          description: 'Extração de memória relevante',
          result: 'Memória filtrada para contexto relevante',
          summary: {
            contextItems: (decomposition.memory?.context || []).length,
            criticalDataKeys: Object.keys(decomposition.memory?.critical_data || {}).length
          }
        },

        step4_priority: {
          description: 'Definição de ordem e paralelismo',
          result: `Plano com ${executionPlan.totalPhases} fase(s)`,
          phases: executionPlan.phases.map(p => ({
            phase: p.phaseNumber,
            agents: p.agents,
            parallel: p.canParallelize
          }))
        }
      },

      // Resumo executivo
      summary: this.buildExecutiveSummary(decomposition, dependencies, executionPlan)
    };
  }

  /**
   * Constrói resumo executivo da análise
   */
  buildExecutiveSummary(decomposition, dependencies, executionPlan) {
    const agents = decomposition.tasks.map(t => t.agentName);
    const hasDeps = dependencies.length > 0;
    const canParallelize = executionPlan.canRunInParallel.length > 0;

    let summary = `Tarefa requer ${agents.length} agente(s) especialista(s): ${agents.join(', ')}.`;
    
    if (hasDeps) {
      summary += ` Existem ${dependencies.length} dependência(s) que definem a ordem de execução.`;
    }
    
    if (canParallelize) {
      summary += ` Algumas tarefas podem executar em paralelo para otimizar tempo.`;
    }

    summary += ` Tempo estimado: ${executionPlan.estimatedTotalTime}.`;

    return summary;
  }

  /**
   * Constrói a distribuição de tarefas
   */
  buildTaskDistribution(decomposition, dependencies, executionPlan) {
    const distribution = [];

    for (const task of decomposition.tasks) {
      // Encontrar fase da tarefa
      const phase = this.findTaskPhase(task.agent, executionPlan);
      
      // Encontrar dependências da tarefa
      const taskDep = dependencies.find(d => d.agent === task.agent);
      
      distribution.push({
        // Identificação
        agent: task.agent,
        agent_name: task.agentName,
        
        // Tarefa
        task_description: task.taskDescription,
        expected_output: task.expectedOutput,
        
        // Prioridade e dependências
        priority: phase,
        depends_on: taskDep?.mustWaitFor || [],
        dependency_reasons: taskDep?.reasons || [],
        
        // Contexto específico
        context: task.context || {},
        
        // Status inicial
        status: 'pending',
        started_at: null,
        completed_at: null,
        result: null,
        error: null
      });
    }

    // Ordenar por prioridade
    distribution.sort((a, b) => a.priority - b.priority);

    return distribution;
  }

  /**
   * Encontra a fase de uma tarefa
   */
  findTaskPhase(agent, executionPlan) {
    for (const phase of executionPlan.phases) {
      if (phase.agents.includes(agent)) {
        return phase.phaseNumber;
      }
    }
    return 1;
  }

  /**
   * Constrói o controle de execução
   */
  buildExecutionControl(executionPlan, dependencies) {
    return {
      // Fases de execução
      phases: executionPlan.phases,
      
      // Totais
      total_phases: executionPlan.totalPhases,
      total_agents: executionPlan.executionOrder.length,
      
      // Flags
      has_dependencies: dependencies.length > 0,
      has_parallel_opportunities: executionPlan.canRunInParallel.length > 0,
      
      // Ordem de execução
      execution_order: executionPlan.executionOrder,
      
      // Estimativas
      estimated_total_time: executionPlan.estimatedTotalTime,
      
      // Status de controle
      status: {
        current_phase: 0,
        completed_agents: [],
        failed_agents: [],
        pending_agents: executionPlan.executionOrder.map(e => e.agent),
        started_at: null,
        completed_at: null
      }
    };
  }

  /**
   * Valida a estrutura do DOC
   */
  validateDoc(doc) {
    const requiredFields = [
      'id', 'version', 'timestamp', 
      'original_query', 'memory',
      'orchestrator_analysis', 'task_distribution', 
      'execution_control'
    ];

    const missingFields = requiredFields.filter(field => !doc[field]);
    
    if (missingFields.length > 0) {
      logger.error('DOC inválido: campos faltando', { missingFields });
      return {
        valid: false,
        missingFields
      };
    }

    // Validar distribuição de tarefas
    if (!Array.isArray(doc.task_distribution) || doc.task_distribution.length === 0) {
      return {
        valid: false,
        error: 'task_distribution deve ser um array não vazio'
      };
    }

    // Validar controle de execução
    if (!doc.execution_control.phases || !Array.isArray(doc.execution_control.phases)) {
      return {
        valid: false,
        error: 'execution_control.phases deve ser um array'
      };
    }

    return { valid: true };
  }

  /**
   * Serializa o DOC para armazenamento
   */
  serialize(doc) {
    return JSON.stringify(doc, null, 2);
  }

  /**
   * Deserializa um DOC do armazenamento
   */
  deserialize(jsonString) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      logger.error('Erro ao deserializar DOC', { error: error.message });
      return null;
    }
  }
}

module.exports = { DocBuilder };
