/**
 * Goal Manager - Gerenciador de Metas
 * Fase 5 - Agentes Coordenadores
 * 
 * Gerencia metas financeiras do usuário, incluindo
 * criação, acompanhamento e cálculo de progresso.
 */

const { logger } = require('../../../../../utils/logger');
const { mathModule } = require('../../math/math-module');

/**
 * Tipos de metas suportados
 */
const GOAL_TYPES = {
  SAVINGS: 'poupança',
  INVESTMENT: 'investimento',
  DEBT_PAYMENT: 'quitação_dívida',
  PURCHASE: 'compra',
  EMERGENCY_FUND: 'reserva_emergência',
  RETIREMENT: 'aposentadoria',
  TRAVEL: 'viagem',
  EDUCATION: 'educação',
  CUSTOM: 'personalizado'
};

/**
 * Prioridades de metas
 */
const GOAL_PRIORITY = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4
};

/**
 * Status de metas
 */
const GOAL_STATUS = {
  NOT_STARTED: 'não_iniciada',
  IN_PROGRESS: 'em_progresso',
  ON_TRACK: 'no_caminho',
  BEHIND: 'atrasada',
  AT_RISK: 'em_risco',
  COMPLETED: 'concluída',
  ABANDONED: 'abandonada'
};

class GoalManager {
  constructor(financeBridge) {
    this.financeBridge = financeBridge;
  }

  /**
   * Cria uma nova meta
   * 
   * @param {Object} goalData - Dados da meta
   * @returns {Object} Meta criada
   */
  createGoal(goalData) {
    const {
      userId,
      name,
      type = GOAL_TYPES.CUSTOM,
      targetAmount,
      currentAmount = 0,
      targetDate,
      priority = GOAL_PRIORITY.MEDIUM,
      monthlyContribution = null,
      autoCalculate = true,
      notes = ''
    } = goalData;

    logger.info('GoalManager: Criando meta', { userId, name, type });

    // Validações
    if (!name || !targetAmount) {
      throw new Error('Nome e valor alvo são obrigatórios');
    }

    // Calcular contribuição mensal se não fornecida
    let calculatedContribution = monthlyContribution;
    if (!calculatedContribution && targetDate && autoCalculate) {
      const monthsUntilTarget = this._monthsUntil(targetDate);
      if (monthsUntilTarget > 0) {
        const remaining = targetAmount - currentAmount;
        calculatedContribution = remaining / monthsUntilTarget;
      }
    }

    const goal = {
      id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      name,
      type,
      targetAmount,
      currentAmount,
      targetDate: targetDate ? new Date(targetDate).toISOString() : null,
      startDate: new Date().toISOString(),
      priority,
      
      // Planejamento
      monthlyContribution: calculatedContribution 
        ? Math.round(calculatedContribution * 100) / 100 
        : null,
      
      // Status
      status: currentAmount >= targetAmount 
        ? GOAL_STATUS.COMPLETED 
        : GOAL_STATUS.NOT_STARTED,
      
      // Progresso
      progress: {
        percentage: (currentAmount / targetAmount) * 100,
        remaining: targetAmount - currentAmount,
        formatted: {
          current: mathModule.formatCurrency(currentAmount),
          target: mathModule.formatCurrency(targetAmount),
          remaining: mathModule.formatCurrency(targetAmount - currentAmount)
        }
      },
      
      // Metadados
      notes,
      contributions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Adicionar projeções se houver data alvo
    if (targetDate && calculatedContribution) {
      goal.projection = this._calculateProjection(goal);
    }

    logger.info('GoalManager: Meta criada', { goalId: goal.id });

    return goal;
  }

  /**
   * Avalia progresso de uma meta
   * 
   * @param {Object} goal - Meta a avaliar
   * @returns {Object} Avaliação completa
   */
  evaluateProgress(goal) {
    logger.info('GoalManager: Avaliando progresso', { goalId: goal.id });

    const now = new Date();
    const startDate = new Date(goal.startDate);
    const targetDate = goal.targetDate ? new Date(goal.targetDate) : null;

    // Calcular tempo decorrido
    const totalDays = targetDate 
      ? Math.ceil((targetDate - startDate) / (1000 * 60 * 60 * 24))
      : null;
    
    const elapsedDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
    const remainingDays = targetDate 
      ? Math.max(0, Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24)))
      : null;

    // Calcular progresso esperado vs real
    const actualProgress = (goal.currentAmount / goal.targetAmount) * 100;
    const expectedProgress = totalDays 
      ? (elapsedDays / totalDays) * 100 
      : null;

    // Determinar status
    let status;
    let statusMessage;

    if (goal.currentAmount >= goal.targetAmount) {
      status = GOAL_STATUS.COMPLETED;
      statusMessage = 'Meta alcançada! 🎉';
    } else if (targetDate && now > targetDate) {
      status = GOAL_STATUS.BEHIND;
      statusMessage = `Meta atrasada. Faltam ${mathModule.formatCurrency(goal.targetAmount - goal.currentAmount)}`;
    } else if (expectedProgress && actualProgress < expectedProgress - 20) {
      status = GOAL_STATUS.AT_RISK;
      statusMessage = `Progresso ${(expectedProgress - actualProgress).toFixed(1)}% abaixo do esperado`;
    } else if (expectedProgress && actualProgress < expectedProgress - 5) {
      status = GOAL_STATUS.BEHIND;
      statusMessage = 'Levemente atrasada em relação ao planejado';
    } else if (goal.currentAmount > 0) {
      status = GOAL_STATUS.ON_TRACK;
      statusMessage = 'Meta no caminho certo';
    } else {
      status = GOAL_STATUS.NOT_STARTED;
      statusMessage = 'Meta ainda não iniciada';
    }

    // Calcular ritmo necessário
    let requiredMonthlyContribution = null;
    if (remainingDays && remainingDays > 0) {
      const remaining = goal.targetAmount - goal.currentAmount;
      const remainingMonths = remainingDays / 30;
      requiredMonthlyContribution = remaining / remainingMonths;
    }

    // Calcular nova data de conclusão baseada no ritmo atual
    let projectedCompletionDate = null;
    if (goal.monthlyContribution && goal.monthlyContribution > 0) {
      const remaining = goal.targetAmount - goal.currentAmount;
      const monthsNeeded = remaining / goal.monthlyContribution;
      projectedCompletionDate = new Date();
      projectedCompletionDate.setMonth(projectedCompletionDate.getMonth() + Math.ceil(monthsNeeded));
    }

    return {
      goal: {
        id: goal.id,
        name: goal.name,
        type: goal.type
      },
      
      // Valores
      amounts: {
        current: goal.currentAmount,
        target: goal.targetAmount,
        remaining: goal.targetAmount - goal.currentAmount,
        formatted: {
          current: mathModule.formatCurrency(goal.currentAmount),
          target: mathModule.formatCurrency(goal.targetAmount),
          remaining: mathModule.formatCurrency(goal.targetAmount - goal.currentAmount)
        }
      },
      
      // Progresso
      progress: {
        actual: Math.round(actualProgress * 100) / 100,
        expected: expectedProgress ? Math.round(expectedProgress * 100) / 100 : null,
        variance: expectedProgress ? actualProgress - expectedProgress : null
      },
      
      // Tempo
      timeline: {
        startDate: goal.startDate,
        targetDate: goal.targetDate,
        today: now.toISOString(),
        elapsedDays,
        remainingDays,
        totalDays,
        timeProgress: totalDays ? (elapsedDays / totalDays) * 100 : null
      },
      
      // Status
      status,
      statusMessage,
      
      // Contribuições
      contributions: {
        planned: goal.monthlyContribution,
        required: requiredMonthlyContribution 
          ? Math.round(requiredMonthlyContribution * 100) / 100 
          : null,
        difference: goal.monthlyContribution && requiredMonthlyContribution
          ? requiredMonthlyContribution - goal.monthlyContribution
          : null
      },
      
      // Projeção
      projection: {
        completionDate: projectedCompletionDate?.toISOString() || null,
        onSchedule: targetDate 
          ? projectedCompletionDate <= targetDate 
          : null,
        delayDays: targetDate && projectedCompletionDate
          ? Math.max(0, Math.ceil((projectedCompletionDate - targetDate) / (1000 * 60 * 60 * 24)))
          : null
      },
      
      // Recomendações
      recommendations: this._generateRecommendations(
        goal, 
        status, 
        requiredMonthlyContribution,
        projectedCompletionDate
      )
    };
  }

  /**
   * Registra contribuição para meta
   * 
   * @param {Object} goal - Meta
   * @param {number} amount - Valor da contribuição
   * @param {string} source - Fonte do valor
   * @returns {Object} Meta atualizada
   */
  addContribution(goal, amount, source = 'manual') {
    logger.info('GoalManager: Registrando contribuição', { 
      goalId: goal.id, 
      amount 
    });

    const contribution = {
      id: `contrib_${Date.now()}`,
      amount,
      source,
      date: new Date().toISOString(),
      balanceBefore: goal.currentAmount,
      balanceAfter: goal.currentAmount + amount
    };

    goal.currentAmount += amount;
    goal.contributions = goal.contributions || [];
    goal.contributions.push(contribution);
    goal.updatedAt = new Date().toISOString();

    // Atualizar progresso
    goal.progress = {
      percentage: (goal.currentAmount / goal.targetAmount) * 100,
      remaining: goal.targetAmount - goal.currentAmount,
      formatted: {
        current: mathModule.formatCurrency(goal.currentAmount),
        target: mathModule.formatCurrency(goal.targetAmount),
        remaining: mathModule.formatCurrency(goal.targetAmount - goal.currentAmount)
      }
    };

    // Verificar se completou
    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = GOAL_STATUS.COMPLETED;
      goal.completedAt = new Date().toISOString();
    }

    return {
      goal,
      contribution,
      message: goal.status === GOAL_STATUS.COMPLETED
        ? `Meta "${goal.name}" alcançada! 🎉`
        : `Contribuição de ${mathModule.formatCurrency(amount)} registrada. ` +
          `Faltam ${goal.progress.formatted.remaining} para a meta.`
    };
  }

  /**
   * Sugere metas baseadas no perfil
   * 
   * @param {Object} options - Opções
   * @returns {Promise<Array>} Sugestões de metas
   */
  async suggestGoals(options) {
    const { userId, income, expenses, existingGoals = [] } = options;

    logger.info('GoalManager: Gerando sugestões de metas', { userId });

    const suggestions = [];
    const monthlyIncome = income || 5000;
    const monthlyExpenses = expenses || monthlyIncome * 0.7;
    const monthlySavingsCapacity = monthlyIncome - monthlyExpenses;

    // 1. Reserva de Emergência (se não existir)
    const hasEmergencyFund = existingGoals.some(
      g => g.type === GOAL_TYPES.EMERGENCY_FUND
    );

    if (!hasEmergencyFund) {
      const emergencyTarget = monthlyExpenses * 6; // 6 meses de despesas
      suggestions.push({
        type: GOAL_TYPES.EMERGENCY_FUND,
        name: 'Reserva de Emergência',
        description: 'Fundo para cobrir 6 meses de despesas',
        targetAmount: emergencyTarget,
        priority: GOAL_PRIORITY.CRITICAL,
        monthlyContribution: monthlySavingsCapacity * 0.5, // 50% da capacidade
        timeToComplete: Math.ceil(emergencyTarget / (monthlySavingsCapacity * 0.5)),
        reasoning: 'Toda pessoa deve ter uma reserva de emergência antes de outros investimentos'
      });
    }

    // 2. Aposentadoria
    const hasRetirement = existingGoals.some(
      g => g.type === GOAL_TYPES.RETIREMENT
    );

    if (!hasRetirement) {
      const retirementMonthly = monthlyIncome * 0.1; // 10% da renda
      suggestions.push({
        type: GOAL_TYPES.RETIREMENT,
        name: 'Aposentadoria',
        description: 'Contribuição mensal para aposentadoria',
        monthlyContribution: retirementMonthly,
        priority: GOAL_PRIORITY.HIGH,
        isRecurring: true,
        reasoning: 'Quanto mais cedo começar, menor o esforço necessário graças aos juros compostos'
      });
    }

    // 3. Quitação de dívidas (se houver gastos com juros)
    // Isso seria verificado com dados reais do Finance Bridge
    
    // 4. Meta de curto prazo baseada na sobra
    if (monthlySavingsCapacity > 0) {
      const shortTermTarget = monthlySavingsCapacity * 12; // 1 ano de economia
      suggestions.push({
        type: GOAL_TYPES.SAVINGS,
        name: 'Meta Anual de Poupança',
        description: 'Guardar sua sobra mensal por 1 ano',
        targetAmount: shortTermTarget,
        targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        priority: GOAL_PRIORITY.MEDIUM,
        monthlyContribution: monthlySavingsCapacity,
        reasoning: 'Aproveitar a capacidade de poupança identificada'
      });
    }

    return {
      suggestions,
      context: {
        monthlyIncome,
        monthlyExpenses,
        savingsCapacity: monthlySavingsCapacity,
        savingsRate: (monthlySavingsCapacity / monthlyIncome) * 100
      }
    };
  }

  /**
   * Prioriza metas
   * 
   * @param {Array} goals - Lista de metas
   * @returns {Array} Metas priorizadas
   */
  prioritizeGoals(goals) {
    // Ordenar por prioridade e status
    const sorted = [...goals].sort((a, b) => {
      // Prioridade primeiro
      const priorityDiff = (a.priority || 3) - (b.priority || 3);
      if (priorityDiff !== 0) return priorityDiff;

      // Depois por proximidade da data alvo
      if (a.targetDate && b.targetDate) {
        return new Date(a.targetDate) - new Date(b.targetDate);
      }
      if (a.targetDate) return -1;
      if (b.targetDate) return 1;

      return 0;
    });

    // Adicionar recomendação de alocação
    let remainingCapacity = 100; // Percentual da capacidade de poupança

    return sorted.map((goal, index) => {
      let allocationPercentage;

      if (goal.priority === GOAL_PRIORITY.CRITICAL) {
        allocationPercentage = Math.min(50, remainingCapacity);
      } else if (goal.priority === GOAL_PRIORITY.HIGH) {
        allocationPercentage = Math.min(30, remainingCapacity);
      } else if (goal.priority === GOAL_PRIORITY.MEDIUM) {
        allocationPercentage = Math.min(15, remainingCapacity);
      } else {
        allocationPercentage = Math.min(5, remainingCapacity);
      }

      remainingCapacity -= allocationPercentage;

      return {
        ...goal,
        rank: index + 1,
        recommendedAllocation: allocationPercentage,
        allocationReasoning: this._getAllocationReasoning(goal.priority)
      };
    });
  }

  /**
   * Helpers
   */
  _monthsUntil(dateStr) {
    const target = new Date(dateStr);
    const now = new Date();
    return (target.getFullYear() - now.getFullYear()) * 12 + 
           (target.getMonth() - now.getMonth());
  }

  _calculateProjection(goal) {
    if (!goal.monthlyContribution || !goal.targetDate) return null;

    const remaining = goal.targetAmount - goal.currentAmount;
    const monthsNeeded = remaining / goal.monthlyContribution;
    const monthsAvailable = this._monthsUntil(goal.targetDate);

    return {
      monthsNeeded: Math.ceil(monthsNeeded),
      monthsAvailable,
      onTrack: monthsNeeded <= monthsAvailable,
      surplus: monthsAvailable - monthsNeeded
    };
  }

  _generateRecommendations(goal, status, requiredContribution, projectedDate) {
    const recommendations = [];

    if (status === GOAL_STATUS.AT_RISK || status === GOAL_STATUS.BEHIND) {
      if (requiredContribution && goal.monthlyContribution) {
        const increase = requiredContribution - goal.monthlyContribution;
        recommendations.push({
          type: 'increase_contribution',
          message: `Aumentar contribuição em ${mathModule.formatCurrency(increase)}/mês`,
          impact: 'Colocar meta de volta no caminho'
        });
      }

      recommendations.push({
        type: 'extend_deadline',
        message: 'Considerar estender a data alvo',
        impact: 'Reduzir pressão financeira mensal'
      });

      recommendations.push({
        type: 'review_target',
        message: 'Revisar se o valor alvo é realista',
        impact: 'Ajustar expectativas às possibilidades'
      });
    }

    if (status === GOAL_STATUS.ON_TRACK) {
      recommendations.push({
        type: 'maintain',
        message: 'Continue com o plano atual',
        impact: 'Meta será alcançada no prazo'
      });

      if (goal.monthlyContribution && requiredContribution && 
          goal.monthlyContribution > requiredContribution * 1.2) {
        recommendations.push({
          type: 'ahead_of_schedule',
          message: 'Você está à frente do cronograma!',
          impact: 'Pode antecipar a meta ou realocar para outras prioridades'
        });
      }
    }

    return recommendations;
  }

  _getAllocationReasoning(priority) {
    const reasons = {
      [GOAL_PRIORITY.CRITICAL]: 'Meta crítica - prioridade máxima de alocação',
      [GOAL_PRIORITY.HIGH]: 'Meta importante - alocação significativa recomendada',
      [GOAL_PRIORITY.MEDIUM]: 'Meta relevante - alocação moderada',
      [GOAL_PRIORITY.LOW]: 'Meta secundária - alocação após outras prioridades'
    };
    return reasons[priority] || reasons[GOAL_PRIORITY.MEDIUM];
  }
}

module.exports = { 
  GoalManager, 
  GOAL_TYPES, 
  GOAL_PRIORITY, 
  GOAL_STATUS 
};
