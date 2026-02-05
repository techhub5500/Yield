/**
 * Planning Agent - Agente de Planejamento
 * Fase 5 - Agentes Coordenadores
 * 
 * Coordenador especialista em planejamento financeiro.
 * Responsável por orçamentos, metas, simulações e planos de ação.
 */

const { BaseCoordinator, COORDINATOR_STATUS } = require('../base-coordinator');
const { logger } = require('../../../../utils/logger');
const { mathModule } = require('../math/math-module');
const fs = require('fs');
const path = require('path');

/**
 * Tipos de planejamento suportados
 */
const PLANNING_TYPES = {
  BUDGET_CREATE: 'criar_orcamento',
  BUDGET_TRACK: 'acompanhar_orcamento',
  GOAL_CREATE: 'criar_meta',
  GOAL_EVALUATE: 'avaliar_meta',
  GOAL_SUGGEST: 'sugerir_metas',
  SCENARIO_SIMULATE: 'simular_cenario',
  ACTION_PLAN: 'plano_acao',
  FINANCIAL_PLAN: 'plano_financeiro'
};

/**
 * Contrato do Agente de Planejamento
 */
const PLANNING_CONTRACT = {
  name: 'Agente de Planejamento',
  domain: 'planejamento',
  capabilities: [
    'criar_orcamento',
    'acompanhar_orcamento',
    'gerenciar_metas',
    'simular_cenarios',
    'gerar_plano_acao',
    'projetar_futuro'
  ],
  inputs: [
    'income', 'expenses', 'goals', 'budget', 
    'scenario_params', 'target_date', 'strategy'
  ],
  outputs: [
    'budget', 'budget_status', 'goal', 'goal_progress',
    'scenario_result', 'action_plan', 'projections'
  ]
};

class PlanningAgent extends BaseCoordinator {
  constructor(financeBridge) {
    super(financeBridge);
    
    this.name = 'PlanningAgent';
    this.domain = 'planejamento';
    this.contract = PLANNING_CONTRACT;
    
    // Lazy loading dos módulos
    this._budgetCreator = null;
    this._budgetTracker = null;
    this._goalManager = null;
    this._scenarioSimulator = null;
    this._actionPlanner = null;
    
    // Carregar prompt do sistema
    this._loadSystemPrompt();
  }

  /**
   * Carrega prompt do sistema
   */
  _loadSystemPrompt() {
    try {
      const promptPath = path.join(__dirname, 'prompts', 'planning-system.txt');
      this.systemPrompt = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
      logger.warn('PlanningAgent: Prompt não encontrado, usando padrão');
      this.systemPrompt = this._getDefaultPrompt();
    }
  }

  /**
   * Getters lazy para módulos
   */
  get budgetCreator() {
    if (!this._budgetCreator) {
      const { BudgetCreator } = require('./planners/budget-creator');
      this._budgetCreator = new BudgetCreator(this.financeBridge);
    }
    return this._budgetCreator;
  }

  get budgetTracker() {
    if (!this._budgetTracker) {
      const { BudgetTracker } = require('./planners/budget-tracker');
      this._budgetTracker = new BudgetTracker(this.financeBridge);
    }
    return this._budgetTracker;
  }

  get goalManager() {
    if (!this._goalManager) {
      const { GoalManager } = require('./planners/goal-manager');
      this._goalManager = new GoalManager(this.financeBridge);
    }
    return this._goalManager;
  }

  get scenarioSimulator() {
    if (!this._scenarioSimulator) {
      const { ScenarioSimulator } = require('./planners/scenario-simulator');
      this._scenarioSimulator = new ScenarioSimulator(this.financeBridge);
    }
    return this._scenarioSimulator;
  }

  get actionPlanner() {
    if (!this._actionPlanner) {
      const { ActionPlanner } = require('./planners/action-planner');
      this._actionPlanner = new ActionPlanner(this.financeBridge);
    }
    return this._actionPlanner;
  }

  /**
   * Etapa de Recepção - Processa input inicial
   */
  async receptionStep(input) {
    logger.info('PlanningAgent: Etapa de Recepção');

    const { query, doc, memory } = input;

    // Identificar tipo de planejamento
    const planningType = this._identifyPlanningType(query, doc);

    // Extrair parâmetros relevantes
    const params = this._extractPlanningParams(query, doc, memory);

    return {
      originalQuery: query,
      planningType,
      params,
      userId: memory?.userId || 'unknown',
      context: {
        hasExistingBudget: !!params.budget,
        hasGoals: params.goals?.length > 0,
        hasMentionedValues: !!params.income || !!params.targetAmount
      }
    };
  }

  /**
   * Etapa de Metacognição
   */
  async metacognitionStep(reception) {
    logger.info('PlanningAgent: Etapa de Metacognição');

    const questions = {
      // 1. Entendi o que foi pedido?
      understood: this._assessUnderstanding(reception),
      
      // 2. Tenho todas as informações?
      hasAllInfo: this._checkRequiredInfo(reception),
      
      // 3. Qual a melhor abordagem?
      approach: this._determineApproach(reception),
      
      // 4. Quais os riscos?
      risks: this._identifyRisks(reception)
    };

    return {
      ...questions,
      readyToExecute: questions.understood.confident && questions.hasAllInfo.sufficient,
      needsMoreData: !questions.hasAllInfo.sufficient,
      missingInfo: questions.hasAllInfo.missing
    };
  }

  /**
   * Etapa de Planejamento
   */
  async planningStep(metacognition, reception) {
    logger.info('PlanningAgent: Etapa de Planejamento');

    const steps = [];

    // Se precisa mais dados, buscar primeiro
    if (metacognition.needsMoreData) {
      steps.push({
        action: 'fetch_data',
        what: metacognition.missingInfo,
        required: true
      });
    }

    // Planejar execução baseado no tipo
    switch (reception.planningType) {
      case PLANNING_TYPES.BUDGET_CREATE:
        steps.push(
          { action: 'get_income_data', required: !reception.params.income },
          { action: 'get_expense_history', required: true },
          { action: 'apply_strategy', required: true },
          { action: 'distribute_categories', required: true },
          { action: 'validate_budget', required: true }
        );
        break;

      case PLANNING_TYPES.BUDGET_TRACK:
        steps.push(
          { action: 'load_budget', required: true },
          { action: 'get_current_expenses', required: true },
          { action: 'compare_execution', required: true },
          { action: 'generate_projections', required: true }
        );
        break;

      case PLANNING_TYPES.GOAL_CREATE:
        steps.push(
          { action: 'validate_goal_params', required: true },
          { action: 'calculate_contributions', required: true },
          { action: 'create_goal', required: true },
          { action: 'suggest_strategy', required: true }
        );
        break;

      case PLANNING_TYPES.GOAL_EVALUATE:
        steps.push(
          { action: 'load_goal', required: true },
          { action: 'evaluate_progress', required: true },
          { action: 'generate_recommendations', required: true }
        );
        break;

      case PLANNING_TYPES.GOAL_SUGGEST:
        steps.push(
          { action: 'analyze_financial_situation', required: true },
          { action: 'identify_opportunities', required: true },
          { action: 'generate_suggestions', required: true }
        );
        break;

      case PLANNING_TYPES.SCENARIO_SIMULATE:
        steps.push(
          { action: 'load_baseline', required: true },
          { action: 'apply_scenario', required: true },
          { action: 'calculate_projections', required: true },
          { action: 'compare_scenarios', required: false }
        );
        break;

      case PLANNING_TYPES.ACTION_PLAN:
        steps.push(
          { action: 'gather_context', required: true },
          { action: 'identify_issues', required: true },
          { action: 'generate_actions', required: true },
          { action: 'prioritize_actions', required: true },
          { action: 'create_timeline', required: true }
        );
        break;

      case PLANNING_TYPES.FINANCIAL_PLAN:
        steps.push(
          { action: 'full_analysis', required: true },
          { action: 'create_budget', required: true },
          { action: 'set_goals', required: true },
          { action: 'create_action_plan', required: true }
        );
        break;

      default:
        steps.push({ action: 'analyze_request', required: true });
    }

    return {
      type: reception.planningType,
      steps: steps.filter(s => s.required !== false),
      estimatedComplexity: steps.length > 5 ? 'high' : steps.length > 3 ? 'medium' : 'low'
    };
  }

  /**
   * Etapa de Execução
   */
  async executeStep(plan, reception) {
    logger.info('PlanningAgent: Etapa de Execução', { type: plan.type });

    try {
      let result;

      switch (plan.type) {
        case PLANNING_TYPES.BUDGET_CREATE:
          result = await this.createBudget(reception.params);
          break;

        case PLANNING_TYPES.BUDGET_TRACK:
          result = await this.trackBudget(reception.params);
          break;

        case PLANNING_TYPES.GOAL_CREATE:
          result = await this.createGoal(reception.params);
          break;

        case PLANNING_TYPES.GOAL_EVALUATE:
          result = await this.evaluateGoal(reception.params);
          break;

        case PLANNING_TYPES.GOAL_SUGGEST:
          result = await this.suggestGoals(reception.params);
          break;

        case PLANNING_TYPES.SCENARIO_SIMULATE:
          result = await this.simulateScenario(reception.params);
          break;

        case PLANNING_TYPES.ACTION_PLAN:
          result = await this.generateActionPlan(reception.params);
          break;

        case PLANNING_TYPES.FINANCIAL_PLAN:
          result = await this.createFinancialPlan(reception.params);
          break;

        default:
          throw new Error(`Tipo de planejamento não suportado: ${plan.type}`);
      }

      return {
        success: true,
        type: plan.type,
        data: result
      };

    } catch (error) {
      logger.error('PlanningAgent: Erro na execução', { error: error.message });
      return {
        success: false,
        type: plan.type,
        error: error.message
      };
    }
  }

  /**
   * Etapa de Validação
   */
  async validationStep(execution) {
    logger.info('PlanningAgent: Etapa de Validação');

    if (!execution.success) {
      return {
        valid: false,
        reason: execution.error,
        canRetry: true
      };
    }

    const data = execution.data;
    const validations = [];

    // Validações específicas por tipo
    switch (execution.type) {
      case PLANNING_TYPES.BUDGET_CREATE:
        validations.push({
          check: 'has_allocations',
          passed: !!data.allocations && Object.keys(data.allocations).length > 0,
          message: 'Orçamento tem alocações definidas'
        });
        validations.push({
          check: 'income_matches',
          passed: data.metrics?.percentageUsed <= 100,
          message: 'Alocações não excedem a renda'
        });
        break;

      case PLANNING_TYPES.GOAL_CREATE:
        validations.push({
          check: 'has_target',
          passed: !!data.targetAmount && data.targetAmount > 0,
          message: 'Meta tem valor alvo definido'
        });
        validations.push({
          check: 'has_plan',
          passed: !!data.monthlyContribution,
          message: 'Meta tem contribuição mensal calculada'
        });
        break;

      case PLANNING_TYPES.ACTION_PLAN:
        validations.push({
          check: 'has_actions',
          passed: data.actions?.length > 0,
          message: 'Plano tem ações definidas'
        });
        validations.push({
          check: 'has_timeline',
          passed: !!data.timeline,
          message: 'Plano tem cronograma'
        });
        break;
    }

    const allPassed = validations.every(v => v.passed);

    return {
      valid: allPassed,
      validations,
      warnings: validations.filter(v => !v.passed).map(v => v.message)
    };
  }

  /**
   * Etapa de Entrega
   */
  async deliveryStep(validation, execution, reception) {
    logger.info('PlanningAgent: Etapa de Entrega');

    if (!validation.valid) {
      return {
        status: COORDINATOR_STATUS.ERROR,
        message: 'Resultado não passou nas validações',
        warnings: validation.warnings,
        raw: execution.data
      };
    }

    // Formatar resposta para o usuário
    const formattedResponse = this._formatResponse(
      execution.type,
      execution.data,
      reception.originalQuery
    );

    return {
      status: COORDINATOR_STATUS.SUCCESS,
      type: execution.type,
      result: execution.data,
      response: formattedResponse,
      summary: this._generateSummary(execution.type, execution.data)
    };
  }

  // ========== Métodos de Planejamento ==========

  /**
   * Cria orçamento
   */
  async createBudget(params) {
    return this.budgetCreator.create({
      userId: params.userId,
      period: params.period || 'mensal',
      strategy: params.strategy || 'FIFTY_THIRTY_TWENTY',
      income: params.income,
      customAllocations: params.customAllocations,
      goals: params.goals || [],
      adjustments: params.adjustments || {}
    });
  }

  /**
   * Acompanha orçamento
   */
  async trackBudget(params) {
    if (!params.budget) {
      throw new Error('Orçamento não fornecido para acompanhamento');
    }

    return this.budgetTracker.track({
      userId: params.userId,
      budget: params.budget,
      asOfDate: params.asOfDate || new Date()
    });
  }

  /**
   * Cria meta
   */
  async createGoal(params) {
    return this.goalManager.createGoal({
      userId: params.userId,
      name: params.name || params.goalName,
      type: params.type || params.goalType,
      targetAmount: params.targetAmount,
      currentAmount: params.currentAmount || 0,
      targetDate: params.targetDate,
      priority: params.priority,
      monthlyContribution: params.monthlyContribution,
      notes: params.notes
    });
  }

  /**
   * Avalia progresso de meta
   */
  async evaluateGoal(params) {
    if (!params.goal) {
      throw new Error('Meta não fornecida para avaliação');
    }

    return this.goalManager.evaluateProgress(params.goal);
  }

  /**
   * Sugere metas
   */
  async suggestGoals(params) {
    return this.goalManager.suggestGoals({
      userId: params.userId,
      income: params.income,
      expenses: params.expenses,
      existingGoals: params.goals || []
    });
  }

  /**
   * Simula cenário
   */
  async simulateScenario(params) {
    return this.scenarioSimulator.simulate({
      type: params.scenarioType || params.type,
      params: {
        userId: params.userId,
        ...params
      }
    });
  }

  /**
   * Gera plano de ação
   */
  async generateActionPlan(params) {
    return this.actionPlanner.generatePlan({
      userId: params.userId,
      analysis: params.analysis,
      goals: params.goals || [],
      budget: params.budget,
      issues: params.issues || [],
      objective: params.objective || 'geral'
    });
  }

  /**
   * Cria plano financeiro completo
   */
  async createFinancialPlan(params) {
    const { userId } = params;

    // 1. Criar orçamento
    const budget = await this.createBudget({
      userId,
      strategy: params.strategy || 'HISTORICAL',
      income: params.income
    });

    // 2. Sugerir metas
    const goalSuggestions = await this.suggestGoals({
      userId,
      income: budget.income.estimated,
      expenses: budget.metrics.totalAllocated
    });

    // 3. Gerar plano de ação
    const actionPlan = await this.generateActionPlan({
      userId,
      budget,
      goals: goalSuggestions.suggestions
    });

    return {
      budget,
      suggestedGoals: goalSuggestions,
      actionPlan,
      summary: {
        monthlyIncome: budget.income.formatted,
        totalBudgeted: mathModule.formatCurrency(budget.metrics.totalAllocated),
        savingsCapacity: mathModule.formatCurrency(budget.income.estimated - budget.metrics.totalAllocated),
        priorityGoals: goalSuggestions.suggestions.slice(0, 3).map(g => g.name),
        immediateActions: actionPlan.quickWins?.length || 0
      }
    };
  }

  // ========== Métodos Auxiliares ==========

  /**
   * Identifica tipo de planejamento
   */
  _identifyPlanningType(query, doc) {
    const queryLower = query.toLowerCase();

    if (doc?.taskType) {
      const typeMap = {
        'criar_orcamento': PLANNING_TYPES.BUDGET_CREATE,
        'acompanhar_orcamento': PLANNING_TYPES.BUDGET_TRACK,
        'criar_meta': PLANNING_TYPES.GOAL_CREATE,
        'avaliar_meta': PLANNING_TYPES.GOAL_EVALUATE,
        'simular': PLANNING_TYPES.SCENARIO_SIMULATE,
        'plano_acao': PLANNING_TYPES.ACTION_PLAN
      };
      if (typeMap[doc.taskType]) return typeMap[doc.taskType];
    }

    // Detecção por palavras-chave
    if (queryLower.includes('orçamento') || queryLower.includes('orcamento')) {
      if (queryLower.includes('criar') || queryLower.includes('novo')) {
        return PLANNING_TYPES.BUDGET_CREATE;
      }
      return PLANNING_TYPES.BUDGET_TRACK;
    }

    if (queryLower.includes('meta')) {
      if (queryLower.includes('criar') || queryLower.includes('nova')) {
        return PLANNING_TYPES.GOAL_CREATE;
      }
      if (queryLower.includes('sugest') || queryLower.includes('recomen')) {
        return PLANNING_TYPES.GOAL_SUGGEST;
      }
      return PLANNING_TYPES.GOAL_EVALUATE;
    }

    if (queryLower.includes('simul') || queryLower.includes('cenário')) {
      return PLANNING_TYPES.SCENARIO_SIMULATE;
    }

    if (queryLower.includes('plano') && queryLower.includes('ação')) {
      return PLANNING_TYPES.ACTION_PLAN;
    }

    if (queryLower.includes('planej') && queryLower.includes('financ')) {
      return PLANNING_TYPES.FINANCIAL_PLAN;
    }

    return PLANNING_TYPES.BUDGET_TRACK; // Default
  }

  /**
   * Extrai parâmetros de planejamento
   */
  _extractPlanningParams(query, doc, memory) {
    const params = {
      userId: memory?.userId || 'unknown'
    };

    // Extrair valores monetários
    const moneyPattern = /R\$\s*([\d.,]+)|(\d+(?:\.\d{3})*(?:,\d{2})?)\s*(?:reais|mil)/gi;
    const moneyMatches = query.match(moneyPattern);
    if (moneyMatches) {
      params.mentionedValues = moneyMatches.map(m => 
        parseFloat(m.replace(/[R$\s.]/g, '').replace(',', '.'))
      );
      // Assumir primeiro valor como principal
      if (params.mentionedValues.length > 0) {
        params.targetAmount = params.mentionedValues[0];
      }
    }

    // Extrair datas
    const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|até\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/gi;
    const dateMatches = query.match(datePattern);
    if (dateMatches) {
      params.targetDate = dateMatches[0];
    }

    // Extrair períodos
    if (query.includes('ano')) {
      params.period = 'anual';
    } else if (query.includes('semana')) {
      params.period = 'semanal';
    } else {
      params.period = 'mensal';
    }

    // Extrair estratégia
    if (query.includes('50/30/20') || query.includes('50-30-20')) {
      params.strategy = 'FIFTY_THIRTY_TWENTY';
    } else if (query.includes('60/20/20') || query.includes('60-20-20')) {
      params.strategy = 'SIXTY_TWENTY_TWENTY';
    } else if (query.includes('envelope')) {
      params.strategy = 'ENVELOPE';
    }

    // Dados do DOC se disponível
    if (doc) {
      params.income = doc.income || params.income;
      params.goals = doc.goals || [];
      params.budget = doc.budget;
    }

    return params;
  }

  _assessUnderstanding(reception) {
    return {
      confident: reception.planningType !== null,
      planningType: reception.planningType,
      clarity: reception.params.targetAmount ? 'high' : 'medium'
    };
  }

  _checkRequiredInfo(reception) {
    const missing = [];
    const { planningType, params } = reception;

    switch (planningType) {
      case PLANNING_TYPES.BUDGET_CREATE:
        if (!params.income) missing.push('renda_mensal');
        break;
      case PLANNING_TYPES.GOAL_CREATE:
        if (!params.targetAmount) missing.push('valor_alvo');
        break;
      case PLANNING_TYPES.BUDGET_TRACK:
        if (!params.budget) missing.push('orcamento_existente');
        break;
    }

    return {
      sufficient: missing.length === 0,
      missing
    };
  }

  _determineApproach(reception) {
    return {
      primary: reception.planningType,
      willUseAI: false, // Planejamento é majoritariamente matemático
      estimatedSteps: 4
    };
  }

  _identifyRisks(reception) {
    const risks = [];

    if (!reception.params.income) {
      risks.push({
        type: 'data_quality',
        description: 'Renda não informada, será estimada do histórico'
      });
    }

    return risks;
  }

  _formatResponse(type, data, query) {
    // Formatação simplificada - em produção seria mais elaborada
    switch (type) {
      case PLANNING_TYPES.BUDGET_CREATE:
        return `Criei um orçamento ${data.period} usando a estratégia ${data.strategy}. ` +
               `Sua renda estimada é ${data.income?.formatted} com ${Object.keys(data.categories || {}).length} categorias definidas.`;

      case PLANNING_TYPES.BUDGET_TRACK:
        return `${data.summary?.emoji || '📊'} ${data.summary?.headline || 'Status do orçamento'}. ` +
               `Você já gastou ${data.summary?.spent} de ${data.summary?.budget} (${data.summary?.percentUsed}).`;

      case PLANNING_TYPES.GOAL_CREATE:
        return `Meta "${data.name}" criada! Alvo: ${data.progress?.formatted?.target}. ` +
               `Com contribuição de ${mathModule.formatCurrency(data.monthlyContribution)}/mês.`;

      case PLANNING_TYPES.ACTION_PLAN:
        return `Plano de ação criado com ${data.summary?.totalActions} ações. ` +
               `${data.summary?.immediateActions} são imediatas. ` +
               `Potencial de economia: ${data.potentialImpact?.monthlySavings?.formatted}/mês.`;

      default:
        return 'Planejamento concluído com sucesso.';
    }
  }

  _generateSummary(type, data) {
    switch (type) {
      case PLANNING_TYPES.BUDGET_CREATE:
        return {
          income: data.income?.formatted,
          categories: Object.keys(data.categories || {}).length,
          strategy: data.strategy
        };

      case PLANNING_TYPES.ACTION_PLAN:
        return {
          totalActions: data.actions?.length,
          quickWins: data.quickWins?.length,
          potentialSavings: data.potentialImpact?.monthlySavings?.formatted
        };

      default:
        return { completed: true };
    }
  }

  _getDefaultPrompt() {
    return `Você é o Agente de Planejamento Financeiro.

Sua especialidade é ajudar usuários a:
- Criar e acompanhar orçamentos
- Definir e monitorar metas financeiras
- Simular cenários e decisões
- Gerar planos de ação concretos

Sempre seja preciso com números e realista com expectativas.
Priorize a saúde financeira de longo prazo.`;
  }

  /**
   * Health check do agente
   */
  async healthCheck() {
    return {
      status: 'healthy',
      name: this.name,
      domain: this.domain,
      modules: {
        budgetCreator: 'ready',
        budgetTracker: 'ready',
        goalManager: 'ready',
        scenarioSimulator: 'ready',
        actionPlanner: 'ready'
      }
    };
  }
}

module.exports = { 
  PlanningAgent, 
  PLANNING_TYPES,
  PLANNING_CONTRACT
};
