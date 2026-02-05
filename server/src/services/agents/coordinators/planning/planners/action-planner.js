/**
 * Action Planner - Planejador de Ações
 * Fase 5 - Agentes Coordenadores
 * 
 * Gera planos de ação concretos baseados em
 * análises, metas e situação financeira.
 */

const { logger } = require('../../../../../utils/logger');
const { mathModule } = require('../../math/math-module');

/**
 * Tipos de ações
 */
const ACTION_TYPES = {
  CUT_EXPENSE: 'cortar_despesa',
  REDUCE_EXPENSE: 'reduzir_despesa',
  INCREASE_INCOME: 'aumentar_renda',
  START_SAVING: 'iniciar_poupança',
  INCREASE_SAVING: 'aumentar_poupança',
  PAY_DEBT: 'quitar_dívida',
  INVEST: 'investir',
  CREATE_RESERVE: 'criar_reserva',
  RENEGOTIATE: 'renegociar',
  CANCEL_SUBSCRIPTION: 'cancelar_assinatura',
  TRANSFER: 'transferir',
  REVIEW: 'revisar'
};

/**
 * Urgência de ações
 */
const ACTION_URGENCY = {
  IMMEDIATE: 'imediata',
  SHORT_TERM: 'curto_prazo',
  MEDIUM_TERM: 'médio_prazo',
  LONG_TERM: 'longo_prazo'
};

class ActionPlanner {
  constructor(financeBridge) {
    this.financeBridge = financeBridge;
  }

  /**
   * Gera plano de ação completo
   * 
   * @param {Object} context - Contexto financeiro
   * @returns {Promise<Object>} Plano de ação
   */
  async generatePlan(context) {
    const {
      userId,
      analysis = null,
      goals = [],
      budget = null,
      issues = [],
      objective = 'geral'
    } = context;

    logger.info('ActionPlanner: Gerando plano de ação', { userId, objective });

    try {
      // Obter dados se não fornecidos
      const financialData = analysis || await this._getFinancialOverview(userId);
      
      const actions = [];

      // 1. Ações baseadas em problemas identificados
      if (issues.length > 0) {
        const issueActions = this._generateIssueActions(issues);
        actions.push(...issueActions);
      }

      // 2. Ações baseadas em análise financeira
      if (financialData) {
        const analysisActions = this._generateAnalysisActions(financialData);
        actions.push(...analysisActions);
      }

      // 3. Ações para metas
      if (goals.length > 0) {
        const goalActions = this._generateGoalActions(goals, financialData);
        actions.push(...goalActions);
      }

      // 4. Ações de orçamento
      if (budget) {
        const budgetActions = this._generateBudgetActions(budget);
        actions.push(...budgetActions);
      }

      // 5. Ações preventivas/proativas
      const proactiveActions = this._generateProactiveActions(financialData);
      actions.push(...proactiveActions);

      // Priorizar e organizar
      const prioritizedActions = this._prioritizeActions(actions);
      
      // Criar timeline
      const timeline = this._createTimeline(prioritizedActions);

      // Calcular impacto potencial
      const potentialImpact = this._calculatePotentialImpact(prioritizedActions);

      const plan = {
        id: `plan_${Date.now()}`,
        userId,
        objective,
        createdAt: new Date().toISOString(),
        
        // Resumo
        summary: {
          totalActions: prioritizedActions.length,
          immediateActions: prioritizedActions.filter(a => a.urgency === ACTION_URGENCY.IMMEDIATE).length,
          potentialMonthlySavings: potentialImpact.monthlySavings,
          estimatedTimeToComplete: timeline.estimatedDuration
        },

        // Ações
        actions: prioritizedActions,

        // Timeline
        timeline,

        // Impacto
        potentialImpact,

        // Quick wins
        quickWins: prioritizedActions.filter(a => 
          a.difficulty === 'fácil' && a.urgency === ACTION_URGENCY.IMMEDIATE
        ).slice(0, 3),

        // Próximos passos
        nextSteps: this._generateNextSteps(prioritizedActions)
      };

      logger.info('ActionPlanner: Plano gerado', {
        planId: plan.id,
        actionsCount: plan.summary.totalActions
      });

      return plan;

    } catch (error) {
      logger.error('ActionPlanner: Erro ao gerar plano', { error: error.message });
      throw error;
    }
  }

  /**
   * Gera ação específica
   * 
   * @param {string} type - Tipo de ação
   * @param {Object} params - Parâmetros
   * @returns {Object} Ação formatada
   */
  createAction(type, params) {
    const {
      title,
      description,
      category = null,
      value = null,
      urgency = ACTION_URGENCY.MEDIUM_TERM,
      difficulty = 'moderada',
      estimatedImpact = null,
      steps = [],
      deadline = null
    } = params;

    return {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      title,
      description,
      category,
      value: value ? {
        amount: value,
        formatted: mathModule.formatCurrency(value)
      } : null,
      urgency,
      difficulty,
      estimatedImpact: estimatedImpact ? {
        monthly: estimatedImpact,
        formatted: mathModule.formatCurrency(estimatedImpact),
        annual: estimatedImpact * 12,
        annualFormatted: mathModule.formatCurrency(estimatedImpact * 12)
      } : null,
      steps,
      deadline,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Obtém visão geral financeira
   */
  async _getFinancialOverview(userId) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const result = await this.financeBridge.query({
      userId,
      startDate: threeMonthsAgo.toISOString()
    });

    if (!result.success) return null;

    const income = result.data
      .filter(t => t.type === 'receita')
      .reduce((sum, t) => sum + t.value, 0);
    
    const expenses = result.data
      .filter(t => t.type === 'despesa')
      .reduce((sum, t) => sum + t.value, 0);

    // Agrupar por categoria
    const byCategory = {};
    result.data
      .filter(t => t.type === 'despesa')
      .forEach(t => {
        const cat = t.category || 'outros';
        byCategory[cat] = (byCategory[cat] || 0) + t.value;
      });

    return {
      monthlyIncome: income / 3,
      monthlyExpenses: expenses / 3,
      monthlySavings: (income - expenses) / 3,
      savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
      byCategory: Object.entries(byCategory).map(([cat, val]) => ({
        category: cat,
        value: val / 3,
        percentage: expenses > 0 ? (val / expenses) * 100 : 0
      }))
    };
  }

  /**
   * Gera ações baseadas em problemas
   */
  _generateIssueActions(issues) {
    const actions = [];

    issues.forEach(issue => {
      switch (issue.type) {
        case 'overspending':
          actions.push(this.createAction(ACTION_TYPES.REDUCE_EXPENSE, {
            title: `Reduzir gastos em ${issue.category}`,
            description: `Você está gastando ${issue.overAmount} acima do orçamento em ${issue.category}`,
            category: issue.category,
            value: issue.currentAmount,
            urgency: ACTION_URGENCY.IMMEDIATE,
            difficulty: 'moderada',
            estimatedImpact: issue.overAmount,
            steps: [
              `Revisar transações recentes em ${issue.category}`,
              'Identificar gastos que podem ser cortados',
              'Definir limite semanal'
            ]
          }));
          break;

        case 'no_savings':
          actions.push(this.createAction(ACTION_TYPES.START_SAVING, {
            title: 'Iniciar reserva financeira',
            description: 'Você não está poupando. Comece com pequenos valores.',
            urgency: ACTION_URGENCY.IMMEDIATE,
            difficulty: 'fácil',
            steps: [
              'Definir meta inicial de 10% da renda',
              'Configurar transferência automática',
              'Separar conta para poupança'
            ]
          }));
          break;

        case 'subscription_waste':
          actions.push(this.createAction(ACTION_TYPES.CANCEL_SUBSCRIPTION, {
            title: `Revisar assinatura: ${issue.subscription}`,
            description: `Assinatura de ${issue.value}/mês pode estar sendo subutilizada`,
            value: issue.value,
            urgency: ACTION_URGENCY.SHORT_TERM,
            difficulty: 'fácil',
            estimatedImpact: issue.value,
            steps: [
              'Verificar frequência de uso',
              'Comparar com alternativas gratuitas',
              'Decidir: manter, pausar ou cancelar'
            ]
          }));
          break;

        case 'high_interest_debt':
          actions.push(this.createAction(ACTION_TYPES.PAY_DEBT, {
            title: 'Priorizar quitação de dívida cara',
            description: `Dívida com juros de ${issue.rate}% está consumindo seu orçamento`,
            value: issue.principal,
            urgency: ACTION_URGENCY.IMMEDIATE,
            difficulty: 'difícil',
            steps: [
              'Verificar saldo devedor atualizado',
              'Negociar desconto para quitação',
              'Considerar portabilidade para taxa menor',
              'Direcionar sobra do mês para amortização'
            ]
          }));
          break;

        default:
          actions.push(this.createAction(ACTION_TYPES.REVIEW, {
            title: `Revisar: ${issue.description || issue.type}`,
            description: issue.description,
            urgency: ACTION_URGENCY.MEDIUM_TERM,
            difficulty: 'moderada'
          }));
      }
    });

    return actions;
  }

  /**
   * Gera ações baseadas em análise
   */
  _generateAnalysisActions(analysis) {
    const actions = [];

    // Taxa de poupança baixa
    if (analysis.savingsRate < 10) {
      const targetSavings = analysis.monthlyIncome * 0.10;
      const currentSavings = analysis.monthlySavings;
      const gap = targetSavings - currentSavings;

      actions.push(this.createAction(ACTION_TYPES.INCREASE_SAVING, {
        title: 'Aumentar taxa de poupança para 10%',
        description: `Sua taxa atual é ${analysis.savingsRate.toFixed(1)}%. Objetivo: 10%`,
        urgency: ACTION_URGENCY.SHORT_TERM,
        difficulty: 'moderada',
        estimatedImpact: gap,
        steps: [
          `Identificar ${mathModule.formatCurrency(gap)} para economizar`,
          'Revisar categorias de maior gasto',
          'Automatizar poupança no dia do pagamento'
        ]
      }));
    }

    // Categorias com alto percentual
    const highSpendCategories = analysis.byCategory
      .filter(c => c.percentage > 25 && !['moradia', 'alimentação'].includes(c.category));

    highSpendCategories.forEach(cat => {
      const targetReduction = cat.value * 0.15; // Reduzir 15%
      actions.push(this.createAction(ACTION_TYPES.REDUCE_EXPENSE, {
        title: `Otimizar gastos em ${cat.category}`,
        description: `${cat.category} representa ${cat.percentage.toFixed(1)}% das despesas`,
        category: cat.category,
        value: cat.value,
        urgency: ACTION_URGENCY.MEDIUM_TERM,
        difficulty: 'moderada',
        estimatedImpact: targetReduction,
        steps: [
          `Listar todos os gastos em ${cat.category}`,
          'Identificar redundâncias ou excessos',
          `Meta: reduzir ${mathModule.formatCurrency(targetReduction)}/mês`
        ]
      }));
    });

    // Sem reserva de emergência
    const emergencyTarget = analysis.monthlyExpenses * 6;
    actions.push(this.createAction(ACTION_TYPES.CREATE_RESERVE, {
      title: 'Construir reserva de emergência',
      description: `Meta: ${mathModule.formatCurrency(emergencyTarget)} (6 meses de despesas)`,
      value: emergencyTarget,
      urgency: ACTION_URGENCY.SHORT_TERM,
      difficulty: 'gradual',
      steps: [
        'Abrir conta separada para reserva',
        `Transferir ${mathModule.formatCurrency(analysis.monthlySavings * 0.5)}/mês`,
        'Não tocar exceto em emergências reais'
      ]
    }));

    return actions;
  }

  /**
   * Gera ações para metas
   */
  _generateGoalActions(goals, analysis) {
    const actions = [];

    goals.forEach(goal => {
      if (goal.status === 'em_risco' || goal.status === 'atrasada') {
        const monthlyNeeded = goal.monthlyContribution || 
          (goal.targetAmount - goal.currentAmount) / 12;

        actions.push(this.createAction(ACTION_TYPES.INCREASE_SAVING, {
          title: `Acelerar meta: ${goal.name}`,
          description: `Meta em risco. Contribuição atual insuficiente.`,
          value: goal.targetAmount,
          urgency: ACTION_URGENCY.IMMEDIATE,
          difficulty: 'difícil',
          estimatedImpact: monthlyNeeded,
          steps: [
            'Revisar prioridade desta meta',
            `Aumentar contribuição para ${mathModule.formatCurrency(monthlyNeeded)}/mês`,
            'Considerar estender prazo se inviável',
            'Buscar fonte extra de renda se necessário'
          ]
        }));
      } else if (goal.status === 'não_iniciada') {
        actions.push(this.createAction(ACTION_TYPES.START_SAVING, {
          title: `Iniciar meta: ${goal.name}`,
          description: `Meta planejada ainda não iniciada`,
          value: goal.targetAmount,
          urgency: ACTION_URGENCY.SHORT_TERM,
          difficulty: 'fácil',
          steps: [
            'Definir contribuição mensal',
            'Configurar débito automático',
            'Acompanhar progresso mensalmente'
          ]
        }));
      }
    });

    return actions;
  }

  /**
   * Gera ações de orçamento
   */
  _generateBudgetActions(budget) {
    const actions = [];

    if (budget.categories) {
      // Categorias excedidas
      Object.entries(budget.categories).forEach(([category, data]) => {
        if (data.status === 'exceeded' || data.percentUsed > 100) {
          actions.push(this.createAction(ACTION_TYPES.REDUCE_EXPENSE, {
            title: `Controlar gastos em ${category}`,
            description: `Orçamento excedido em ${((data.percentUsed || 100) - 100).toFixed(0)}%`,
            category,
            value: data.actual?.value || 0,
            urgency: ACTION_URGENCY.IMMEDIATE,
            difficulty: 'moderada',
            steps: [
              `Pausar novos gastos em ${category}`,
              'Revisar transações do período',
              'Realocar de categorias com sobra'
            ]
          }));
        }
      });
    }

    if (budget.alerts) {
      budget.alerts.forEach(alert => {
        if (alert.type === 'warning' || alert.type === 'error') {
          actions.push(this.createAction(ACTION_TYPES.REVIEW, {
            title: alert.message,
            description: alert.suggestion || '',
            category: alert.category,
            urgency: alert.type === 'error' 
              ? ACTION_URGENCY.IMMEDIATE 
              : ACTION_URGENCY.SHORT_TERM,
            difficulty: 'moderada'
          }));
        }
      });
    }

    return actions;
  }

  /**
   * Gera ações proativas
   */
  _generateProactiveActions(analysis) {
    const actions = [];

    // Sugerir investimentos se há sobra boa
    if (analysis && analysis.savingsRate > 20) {
      const investmentAmount = analysis.monthlySavings * 0.3;
      actions.push(this.createAction(ACTION_TYPES.INVEST, {
        title: 'Diversificar investimentos',
        description: 'Você tem boa capacidade de poupança. Hora de fazer o dinheiro trabalhar.',
        urgency: ACTION_URGENCY.MEDIUM_TERM,
        difficulty: 'moderada',
        estimatedImpact: investmentAmount,
        steps: [
          'Definir perfil de investidor',
          'Pesquisar opções (renda fixa, variável)',
          `Iniciar com ${mathModule.formatCurrency(investmentAmount)}/mês`,
          'Diversificar entre diferentes ativos'
        ]
      }));
    }

    // Revisar serviços anualmente
    actions.push(this.createAction(ACTION_TYPES.REVIEW, {
      title: 'Revisão anual de serviços',
      description: 'Renegociar planos de telefone, internet, seguros',
      urgency: ACTION_URGENCY.LONG_TERM,
      difficulty: 'fácil',
      steps: [
        'Listar todos os serviços contratados',
        'Pesquisar preços de concorrentes',
        'Solicitar desconto ou migrar'
      ]
    }));

    return actions;
  }

  /**
   * Prioriza ações
   */
  _prioritizeActions(actions) {
    // Remover duplicatas
    const unique = this._deduplicateActions(actions);

    // Ordenar por urgência e impacto
    const urgencyOrder = {
      [ACTION_URGENCY.IMMEDIATE]: 0,
      [ACTION_URGENCY.SHORT_TERM]: 1,
      [ACTION_URGENCY.MEDIUM_TERM]: 2,
      [ACTION_URGENCY.LONG_TERM]: 3
    };

    return unique.sort((a, b) => {
      // Urgência primeiro
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;

      // Depois por impacto (maior primeiro)
      const impactA = a.estimatedImpact?.monthly || 0;
      const impactB = b.estimatedImpact?.monthly || 0;
      return impactB - impactA;
    }).map((action, index) => ({
      ...action,
      priority: index + 1
    }));
  }

  /**
   * Remove ações duplicadas
   */
  _deduplicateActions(actions) {
    const seen = new Set();
    return actions.filter(action => {
      const key = `${action.type}_${action.category || ''}_${action.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Cria timeline de execução
   */
  _createTimeline(actions) {
    const immediate = actions.filter(a => a.urgency === ACTION_URGENCY.IMMEDIATE);
    const shortTerm = actions.filter(a => a.urgency === ACTION_URGENCY.SHORT_TERM);
    const mediumTerm = actions.filter(a => a.urgency === ACTION_URGENCY.MEDIUM_TERM);
    const longTerm = actions.filter(a => a.urgency === ACTION_URGENCY.LONG_TERM);

    return {
      phases: [
        {
          name: 'Esta semana',
          period: '1-7 dias',
          actions: immediate.map(a => ({ id: a.id, title: a.title }))
        },
        {
          name: 'Este mês',
          period: '1-4 semanas',
          actions: shortTerm.map(a => ({ id: a.id, title: a.title }))
        },
        {
          name: 'Próximos 3 meses',
          period: '1-3 meses',
          actions: mediumTerm.map(a => ({ id: a.id, title: a.title }))
        },
        {
          name: 'Longo prazo',
          period: '3-12 meses',
          actions: longTerm.map(a => ({ id: a.id, title: a.title }))
        }
      ],
      estimatedDuration: longTerm.length > 0 
        ? '12 meses' 
        : mediumTerm.length > 0 
          ? '3 meses' 
          : shortTerm.length > 0 
            ? '1 mês' 
            : '1 semana'
    };
  }

  /**
   * Calcula impacto potencial
   */
  _calculatePotentialImpact(actions) {
    const withImpact = actions.filter(a => a.estimatedImpact?.monthly > 0);
    const totalMonthly = withImpact.reduce(
      (sum, a) => sum + a.estimatedImpact.monthly, 
      0
    );

    return {
      actionsWithImpact: withImpact.length,
      monthlySavings: {
        value: totalMonthly,
        formatted: mathModule.formatCurrency(totalMonthly)
      },
      annualSavings: {
        value: totalMonthly * 12,
        formatted: mathModule.formatCurrency(totalMonthly * 12)
      },
      topImpactActions: withImpact
        .sort((a, b) => b.estimatedImpact.monthly - a.estimatedImpact.monthly)
        .slice(0, 3)
        .map(a => ({
          title: a.title,
          impact: a.estimatedImpact.formatted
        }))
    };
  }

  /**
   * Gera próximos passos
   */
  _generateNextSteps(actions) {
    const immediate = actions.filter(a => a.urgency === ACTION_URGENCY.IMMEDIATE);
    
    if (immediate.length === 0) {
      return ['Revisar metas financeiras', 'Acompanhar orçamento mensal'];
    }

    return immediate.slice(0, 3).map(a => a.title);
  }
}

module.exports = { ActionPlanner, ACTION_TYPES, ACTION_URGENCY };
