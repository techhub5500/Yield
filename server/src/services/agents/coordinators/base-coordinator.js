/**
 * Base Coordinator - Classe Abstrata Base
 * Fase 5 - Agentes Coordenadores
 * 
 * Define o pipeline padrão de 6 passos que todo coordenador deve seguir:
 * 1. Recepção - Recebe e prepara os inputs
 * 2. Metacognição - Pausa analítica para reflexão
 * 3. Planejamento Interno - Define sequência de ferramentas
 * 4. Execução - Executa as ferramentas planejadas
 * 5. Validação - Verifica qualidade do resultado
 * 6. Entrega Estruturada - Formata e retorna resultado
 */

const logger = require('../../../utils/logger');

/**
 * Status de execução do coordenador
 */
const COORDINATOR_STATUS = {
  IDLE: 'idle',
  RECEIVING: 'receiving',
  REFLECTING: 'reflecting',
  PLANNING: 'planning',
  EXECUTING: 'executing',
  VALIDATING: 'validating',
  DELIVERING: 'delivering',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Classe abstrata base para todos os coordenadores
 */
class BaseCoordinator {
  
  constructor(agentType) {
    if (this.constructor === BaseCoordinator) {
      throw new Error('BaseCoordinator é uma classe abstrata e não pode ser instanciada diretamente');
    }
    
    this.agentType = agentType;
    this.status = COORDINATOR_STATUS.IDLE;
    this.executionLog = [];
    this.startTime = null;
    this.context = null;
  }

  /**
   * Processa uma tarefa completa seguindo o pipeline de 6 passos
   * 
   * @param {Object} memory - Memória filtrada do chat
   * @param {string} query - Query original do usuário
   * @param {Object} doc - DOC do Orquestrador
   * @param {Object} taskInfo - Informações da tarefa específica
   * @returns {Promise<Object>} Resultado estruturado
   */
  async process(memory, query, doc, taskInfo) {
    this.startTime = Date.now();
    this.executionLog = [];

    try {
      // 1. RECEPÇÃO
      this.log('step', 'Iniciando recepção');
      this.status = COORDINATOR_STATUS.RECEIVING;
      const context = await this.receive(memory, query, doc, taskInfo);
      this.log('step', 'Recepção concluída');

      // 2. METACOGNIÇÃO
      this.log('step', 'Iniciando metacognição');
      this.status = COORDINATOR_STATUS.REFLECTING;
      const reflection = await this.reflect(context);
      this.log('step', 'Metacognição concluída');

      // 3. PLANEJAMENTO INTERNO
      this.log('step', 'Iniciando planejamento');
      this.status = COORDINATOR_STATUS.PLANNING;
      const plan = await this.planExecution(reflection);
      this.log('step', 'Planejamento concluído');

      // 4. EXECUÇÃO
      this.log('step', 'Iniciando execução');
      this.status = COORDINATOR_STATUS.EXECUTING;
      const result = await this.execute(plan);
      this.log('step', 'Execução concluída');

      // 5. VALIDAÇÃO
      this.log('step', 'Iniciando validação');
      this.status = COORDINATOR_STATUS.VALIDATING;
      const validated = await this.validate(result, context);
      this.log('step', 'Validação concluída');

      // 6. ENTREGA ESTRUTURADA
      this.log('step', 'Preparando entrega');
      this.status = COORDINATOR_STATUS.DELIVERING;
      const delivery = await this.deliver(validated, context);
      this.log('step', 'Entrega preparada');

      this.status = COORDINATOR_STATUS.COMPLETED;

      const duration = Date.now() - this.startTime;
      this.log('completed', `Processamento concluído em ${duration}ms`);

      return {
        success: true,
        agent: this.agentType,
        result: delivery,
        metadata: {
          duration_ms: duration,
          steps_completed: 6,
          execution_log: this.executionLog
        }
      };

    } catch (error) {
      this.status = COORDINATOR_STATUS.FAILED;
      this.log('error', `Erro: ${error.message}`);

      logger.error(`Erro no coordenador ${this.agentType}`, {
        error: error.message,
        stack: error.stack,
        status: this.status
      });

      return {
        success: false,
        agent: this.agentType,
        error: error.message,
        metadata: {
          duration_ms: Date.now() - this.startTime,
          failed_at_status: this.status,
          execution_log: this.executionLog
        }
      };
    }
  }

  /**
   * PASSO 1: Recepção
   * Extrai e prepara informações dos inputs
   * 
   * @param {Object} memory - Memória do chat
   * @param {string} query - Query do usuário
   * @param {Object} doc - DOC do Orquestrador
   * @param {Object} taskInfo - Informações da tarefa
   * @returns {Object} Contexto preparado
   */
  async receive(memory, query, doc, taskInfo) {
    this.context = {
      memory,
      query,
      doc,
      taskInfo,
      agentType: this.agentType,
      timestamp: new Date().toISOString()
    };

    // Extrair informações relevantes do DOC
    const myTask = taskInfo || this.findMyTask(doc);
    
    // Extrair contexto específico da memória
    const relevantContext = this.extractRelevantContext(memory);

    // Coletar outputs de dependências (se houver)
    const dependencyOutputs = taskInfo?.dependency_outputs || {};

    return {
      mission: myTask?.task_description || 'Executar tarefa especializada',
      expectedOutput: myTask?.expected_output || {},
      relevantContext,
      dependencyOutputs,
      originalQuery: query,
      memory
    };
  }

  /**
   * PASSO 2: Metacognição (Pausa Analítica)
   * Reflexão interna antes de executar
   * 
   * @param {Object} context - Contexto da recepção
   * @returns {Object} Reflexão estruturada
   */
  async reflect(context) {
    // Responder as 4 perguntas obrigatórias
    const reflection = {
      // 1. Clareza de Missão
      mission: {
        description: context.mission,
        expectedDelivery: context.expectedOutput?.type || 'resultado estruturado',
        format: context.expectedOutput?.description || 'formato padrão'
      },
      
      // 2. Inventário de Recursos
      resources: {
        tools: this.getAvailableTools(),
        dataNeeded: this.identifyDataNeeds(context),
        dataProvided: Object.keys(context.dependencyOutputs),
        memoryContext: context.relevantContext?.summary || 'sem contexto adicional'
      },
      
      // 3. Planejamento de Execução
      execution: {
        steps: this.planSteps(context),
        estimatedTime: this.estimateTime(context),
        fallbacks: this.identifyFallbacks(context)
      },
      
      // 4. Critério de Qualidade
      quality: {
        completionCriteria: this.defineCompletionCriteria(context),
        minimumAcceptable: this.defineMinimumAcceptable(context),
        validationRules: this.defineValidationRules(context)
      }
    };

    this.log('reflection', JSON.stringify(reflection.mission));

    return reflection;
  }

  /**
   * PASSO 3: Planejamento Interno
   * Define a sequência de ferramentas e ações
   * 
   * @param {Object} reflection - Resultado da metacognição
   * @returns {Object} Plano de execução
   */
  async planExecution(reflection) {
    const plan = {
      steps: reflection.execution.steps,
      currentStep: 0,
      results: [],
      fallbacksUsed: []
    };

    // Ordenar steps por dependência se necessário
    plan.steps = this.orderStepsByDependency(plan.steps);

    this.log('plan', `Plano com ${plan.steps.length} passos`);

    return plan;
  }

  /**
   * PASSO 4: Execução
   * Executa as ferramentas na ordem planejada
   * 
   * @param {Object} plan - Plano de execução
   * @returns {Object} Resultados da execução
   */
  async execute(plan) {
    const results = [];

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      plan.currentStep = i;

      this.log('execute_step', `Executando passo ${i + 1}: ${step.name}`);

      try {
        const stepResult = await this.executeStep(step, results);
        results.push({
          step: step.name,
          success: true,
          result: stepResult
        });
      } catch (error) {
        this.log('step_error', `Erro no passo ${step.name}: ${error.message}`);

        // Tentar fallback se disponível
        if (step.fallback) {
          this.log('fallback', `Usando fallback para ${step.name}`);
          try {
            const fallbackResult = await this.executeFallback(step.fallback, results);
            results.push({
              step: step.name,
              success: true,
              result: fallbackResult,
              usedFallback: true
            });
            plan.fallbacksUsed.push(step.name);
          } catch (fallbackError) {
            results.push({
              step: step.name,
              success: false,
              error: error.message,
              fallbackError: fallbackError.message
            });
          }
        } else {
          results.push({
            step: step.name,
            success: false,
            error: error.message
          });
        }
      }
    }

    return {
      steps: results,
      totalSteps: plan.steps.length,
      successfulSteps: results.filter(r => r.success).length,
      fallbacksUsed: plan.fallbacksUsed
    };
  }

  /**
   * PASSO 5: Validação
   * Verifica se a tarefa foi completada adequadamente
   * 
   * @param {Object} result - Resultados da execução
   * @param {Object} context - Contexto original
   * @returns {Object} Resultado validado
   */
  async validate(result, context) {
    const validation = {
      isComplete: result.successfulSteps > 0,
      hasMinimumData: this.hasMinimumData(result),
      meetsQualityCriteria: this.meetsQualityCriteria(result, context),
      warnings: [],
      errors: []
    };

    // Verificar steps que falharam
    const failedSteps = result.steps.filter(s => !s.success);
    if (failedSteps.length > 0) {
      validation.warnings.push(`${failedSteps.length} passos falharam`);
    }

    // Verificar se usou fallbacks
    if (result.fallbacksUsed?.length > 0) {
      validation.warnings.push(`Usou ${result.fallbacksUsed.length} fallbacks`);
    }

    // Validar formato do resultado
    const formatValid = this.validateResultFormat(result);
    if (!formatValid.valid) {
      validation.errors.push(formatValid.error);
    }

    this.log('validation', `Completo: ${validation.isComplete}, Warnings: ${validation.warnings.length}`);

    return {
      result,
      validation,
      isValid: validation.isComplete && validation.errors.length === 0
    };
  }

  /**
   * PASSO 6: Entrega Estruturada
   * Formata o resultado final
   * 
   * @param {Object} validated - Resultado validado
   * @param {Object} context - Contexto original
   * @returns {Object} Resultado formatado para entrega
   */
  async deliver(validated, context) {
    const delivery = {
      type: this.getOutputType(),
      agent: this.agentType,
      timestamp: new Date().toISOString(),
      
      // Resultado principal
      content: this.formatContent(validated.result),
      
      // Metadados de qualidade
      quality: {
        confidence: this.calculateConfidence(validated),
        completeness: validated.result.successfulSteps / validated.result.totalSteps,
        warnings: validated.validation.warnings
      },
      
      // Dados estruturados para outros agentes usarem
      structuredData: this.extractStructuredData(validated.result),
      
      // Resumo executivo
      summary: this.generateSummary(validated.result)
    };

    return delivery;
  }

  // ================== MÉTODOS AUXILIARES ==================

  /**
   * Encontra a tarefa específica deste agente no DOC
   */
  findMyTask(doc) {
    if (!doc?.task_distribution) return null;
    return doc.task_distribution.find(t => t.agent === this.agentType);
  }

  /**
   * Extrai contexto relevante da memória
   * Deve ser sobrescrito pelos agentes específicos
   */
  extractRelevantContext(memory) {
    return {
      summary: 'Contexto base',
      cycles: memory?.recent || [],
      criticalInfo: []
    };
  }

  /**
   * Retorna lista de ferramentas disponíveis
   * Deve ser sobrescrito pelos agentes específicos
   */
  getAvailableTools() {
    return ['finance_bridge'];
  }

  /**
   * Identifica quais dados são necessários
   * Deve ser sobrescrito pelos agentes específicos
   */
  identifyDataNeeds(context) {
    return [];
  }

  /**
   * Define os passos de execução
   * Deve ser sobrescrito pelos agentes específicos
   */
  planSteps(context) {
    return [
      { name: 'collect_data', tool: 'finance_bridge', priority: 1 },
      { name: 'process_data', tool: 'internal', priority: 2 },
      { name: 'generate_output', tool: 'internal', priority: 3 }
    ];
  }

  /**
   * Estima tempo de execução
   */
  estimateTime(context) {
    return '5-10 segundos';
  }

  /**
   * Identifica fallbacks possíveis
   */
  identifyFallbacks(context) {
    return [];
  }

  /**
   * Define critérios de conclusão
   * Deve ser sobrescrito pelos agentes específicos
   */
  defineCompletionCriteria(context) {
    return 'Tarefa executada com dados válidos';
  }

  /**
   * Define mínimo aceitável
   */
  defineMinimumAcceptable(context) {
    return 'Ao menos um resultado válido';
  }

  /**
   * Define regras de validação
   */
  defineValidationRules(context) {
    return ['has_data', 'valid_format'];
  }

  /**
   * Ordena steps por dependência
   */
  orderStepsByDependency(steps) {
    return steps.sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }

  /**
   * Executa um passo individual
   * Deve ser sobrescrito pelos agentes específicos
   */
  async executeStep(step, previousResults) {
    throw new Error('executeStep deve ser implementado pelo agente específico');
  }

  /**
   * Executa um fallback
   */
  async executeFallback(fallback, previousResults) {
    return { fallback: true, message: 'Fallback executado' };
  }

  /**
   * Verifica se tem dados mínimos
   */
  hasMinimumData(result) {
    return result.successfulSteps > 0;
  }

  /**
   * Verifica se atende critérios de qualidade
   */
  meetsQualityCriteria(result, context) {
    return result.successfulSteps >= result.totalSteps * 0.5;
  }

  /**
   * Valida formato do resultado
   */
  validateResultFormat(result) {
    return { valid: true };
  }

  /**
   * Retorna tipo de output
   * Deve ser sobrescrito pelos agentes específicos
   */
  getOutputType() {
    return 'generic_result';
  }

  /**
   * Formata o conteúdo principal
   * Deve ser sobrescrito pelos agentes específicos
   */
  formatContent(result) {
    return result;
  }

  /**
   * Calcula nível de confiança
   */
  calculateConfidence(validated) {
    const base = validated.result.successfulSteps / validated.result.totalSteps;
    const penalty = validated.result.fallbacksUsed?.length * 0.1 || 0;
    return Math.max(0, Math.min(1, base - penalty));
  }

  /**
   * Extrai dados estruturados
   * Deve ser sobrescrito pelos agentes específicos
   */
  extractStructuredData(result) {
    return {};
  }

  /**
   * Gera resumo executivo
   * Deve ser sobrescrito pelos agentes específicos
   */
  generateSummary(result) {
    return `Processamento concluído: ${result.successfulSteps}/${result.totalSteps} passos`;
  }

  /**
   * Adiciona entrada ao log de execução
   */
  log(type, message) {
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      message
    };
    this.executionLog.push(entry);
    
    logger.debug(`[${this.agentType}] ${type}: ${message}`);
  }

  /**
   * Retorna contrato do agente
   * Deve ser sobrescrito pelos agentes específicos
   */
  getContract() {
    throw new Error('getContract deve ser implementado pelo agente específico');
  }

  /**
   * Retorna capacidades do agente
   * Deve ser sobrescrito pelos agentes específicos
   */
  getCapabilities() {
    throw new Error('getCapabilities deve ser implementado pelo agente específico');
  }

  /**
   * Health check do coordenador
   */
  async healthCheck() {
    return {
      status: 'healthy',
      agent: this.agentType,
      currentStatus: this.status,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  BaseCoordinator,
  COORDINATOR_STATUS
};
