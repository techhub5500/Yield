/**
 * Budget Creator - Criador de Orçamentos
 * Fase 5 - Agentes Coordenadores
 * 
 * Responsável por criar orçamentos inteligentes baseados
 * no histórico financeiro e metas do usuário.
 */

const { logger } = require('../../../../../utils/logger');
const { mathModule } = require('../../math/math-module');

/**
 * Estratégias de orçamento disponíveis
 */
const BUDGET_STRATEGIES = {
  FIFTY_THIRTY_TWENTY: {
    name: '50/30/20',
    description: 'Necessidades 50%, Desejos 30%, Poupança 20%',
    allocations: {
      necessidades: 0.50,
      desejos: 0.30,
      poupanca: 0.20
    }
  },
  SIXTY_TWENTY_TWENTY: {
    name: '60/20/20',
    description: 'Despesas Fixas 60%, Variáveis 20%, Investimentos 20%',
    allocations: {
      fixas: 0.60,
      variaveis: 0.20,
      investimentos: 0.20
    }
  },
  ENVELOPE: {
    name: 'Envelope',
    description: 'Alocação por categoria específica',
    allocations: null // Definido pelo usuário
  },
  ZERO_BASED: {
    name: 'Base Zero',
    description: 'Cada real tem um destino',
    allocations: null // Toda receita alocada
  },
  HISTORICAL: {
    name: 'Baseado em Histórico',
    description: 'Orçamento baseado em gastos passados com ajustes',
    allocations: null // Calculado dinamicamente
  }
};

/**
 * Categorização padrão de despesas
 */
const EXPENSE_CLASSIFICATION = {
  necessidades: [
    'moradia', 'alimentação', 'transporte', 'saúde',
    'educação', 'utilidades', 'seguros'
  ],
  desejos: [
    'lazer', 'entretenimento', 'restaurantes', 'compras',
    'viagens', 'hobbies', 'assinaturas'
  ],
  poupanca: [
    'investimentos', 'reserva', 'previdência', 'poupança'
  ]
};

class BudgetCreator {
  constructor(financeBridge) {
    this.financeBridge = financeBridge;
  }

  /**
   * Cria um novo orçamento
   * 
   * @param {Object} options - Opções de criação
   * @returns {Promise<Object>} Orçamento criado
   */
  async create(options) {
    const {
      userId,
      period = 'mensal',
      strategy = 'FIFTY_THIRTY_TWENTY',
      income = null,
      customAllocations = null,
      goals = [],
      adjustments = {}
    } = options;

    logger.info('BudgetCreator: Criando orçamento', { userId, period, strategy });

    try {
      // 1. Obter renda base
      const baseIncome = income || await this._estimateMonthlyIncome(userId);
      
      // 2. Obter histórico de gastos
      const historicalData = await this._getHistoricalSpending(userId);
      
      // 3. Aplicar estratégia escolhida
      const strategyConfig = BUDGET_STRATEGIES[strategy];
      let allocations;
      
      switch (strategy) {
        case 'FIFTY_THIRTY_TWENTY':
        case 'SIXTY_TWENTY_TWENTY':
          allocations = this._applyPercentageStrategy(baseIncome, strategyConfig);
          break;
        case 'ENVELOPE':
          allocations = this._applyEnvelopeStrategy(baseIncome, customAllocations);
          break;
        case 'ZERO_BASED':
          allocations = this._applyZeroBasedStrategy(baseIncome, customAllocations);
          break;
        case 'HISTORICAL':
          allocations = await this._applyHistoricalStrategy(
            userId, baseIncome, historicalData, adjustments
          );
          break;
        default:
          allocations = this._applyPercentageStrategy(
            baseIncome, 
            BUDGET_STRATEGIES.FIFTY_THIRTY_TWENTY
          );
      }

      // 4. Ajustar para metas
      if (goals.length > 0) {
        allocations = this._adjustForGoals(allocations, goals, baseIncome);
      }

      // 5. Distribuir por categorias
      const categoryBudgets = this._distributeByCatagories(
        allocations, 
        historicalData
      );

      // 6. Montar resultado
      const budget = {
        id: `budget_${Date.now()}`,
        userId,
        period,
        strategy: strategyConfig.name,
        createdAt: new Date().toISOString(),
        validFrom: this._getValidFrom(period),
        validTo: this._getValidTo(period),
        
        // Valores principais
        income: {
          estimated: baseIncome,
          formatted: mathModule.formatCurrency(baseIncome)
        },
        
        // Alocações de alto nível
        allocations,
        
        // Orçamentos por categoria
        categories: categoryBudgets,
        
        // Metas associadas
        goals: this._mapGoalsTobudget(goals, allocations),
        
        // Métricas
        metrics: {
          totalAllocated: this._sumAllocations(allocations),
          percentageUsed: mathModule.percentage(
            this._sumAllocations(allocations), 
            baseIncome
          ),
          unallocated: baseIncome - this._sumAllocations(allocations)
        },
        
        // Comparação com histórico
        comparison: this._compareWithHistory(allocations, historicalData),
        
        // Alertas e sugestões
        alerts: this._generateBudgetAlerts(allocations, historicalData, goals)
      };

      logger.info('BudgetCreator: Orçamento criado com sucesso', { 
        budgetId: budget.id,
        income: baseIncome,
        categories: Object.keys(categoryBudgets).length
      });

      return budget;

    } catch (error) {
      logger.error('BudgetCreator: Erro ao criar orçamento', { error: error.message });
      throw error;
    }
  }

  /**
   * Estima renda mensal baseada no histórico
   */
  async _estimateMonthlyIncome(userId) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const result = await this.financeBridge.query({
      userId,
      type: 'receita',
      startDate: threeMonthsAgo.toISOString()
    });

    if (!result.success || result.data.length === 0) {
      logger.warn('BudgetCreator: Nenhuma receita encontrada, usando valor padrão');
      return 5000; // Valor padrão
    }

    const totalIncome = result.data.reduce((sum, t) => sum + t.value, 0);
    const monthlyAverage = totalIncome / 3;

    return Math.round(monthlyAverage * 100) / 100;
  }

  /**
   * Obtém histórico de gastos por categoria
   */
  async _getHistoricalSpending(userId) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const result = await this.financeBridge.query({
      userId,
      type: 'despesa',
      startDate: sixMonthsAgo.toISOString()
    });

    if (!result.success || result.data.length === 0) {
      return { byCategory: {}, total: 0, averageMonthly: 0 };
    }

    // Agrupar por categoria
    const byCategory = {};
    result.data.forEach(t => {
      const category = t.category || 'outros';
      if (!byCategory[category]) {
        byCategory[category] = { total: 0, count: 0, transactions: [] };
      }
      byCategory[category].total += t.value;
      byCategory[category].count++;
      byCategory[category].transactions.push(t);
    });

    // Calcular médias
    const total = result.data.reduce((sum, t) => sum + t.value, 0);
    const averageMonthly = total / 6;

    // Calcular média por categoria
    Object.keys(byCategory).forEach(cat => {
      byCategory[cat].averageMonthly = byCategory[cat].total / 6;
      byCategory[cat].percentage = (byCategory[cat].total / total) * 100;
    });

    return { byCategory, total, averageMonthly };
  }

  /**
   * Aplica estratégia baseada em percentuais (50/30/20, 60/20/20)
   */
  _applyPercentageStrategy(income, strategy) {
    const allocations = {};
    
    Object.entries(strategy.allocations).forEach(([key, percentage]) => {
      const value = income * percentage;
      allocations[key] = {
        percentage: percentage * 100,
        value: Math.round(value * 100) / 100,
        formatted: mathModule.formatCurrency(value),
        categories: EXPENSE_CLASSIFICATION[key] || []
      };
    });

    return allocations;
  }

  /**
   * Aplica estratégia de envelopes
   */
  _applyEnvelopeStrategy(income, customAllocations) {
    if (!customAllocations) {
      throw new Error('Estratégia Envelope requer alocações customizadas');
    }

    const allocations = {};
    let totalAllocated = 0;

    Object.entries(customAllocations).forEach(([category, allocation]) => {
      let value;
      
      if (typeof allocation === 'number') {
        // Valor absoluto
        value = allocation;
      } else if (typeof allocation === 'string' && allocation.endsWith('%')) {
        // Percentual
        value = income * (parseFloat(allocation) / 100);
      } else {
        throw new Error(`Alocação inválida para ${category}`);
      }

      allocations[category] = {
        value: Math.round(value * 100) / 100,
        formatted: mathModule.formatCurrency(value),
        percentage: (value / income) * 100
      };

      totalAllocated += value;
    });

    // Adicionar sobra se houver
    if (totalAllocated < income) {
      const unallocated = income - totalAllocated;
      allocations._reserva = {
        value: Math.round(unallocated * 100) / 100,
        formatted: mathModule.formatCurrency(unallocated),
        percentage: (unallocated / income) * 100,
        isAutoGenerated: true
      };
    }

    return allocations;
  }

  /**
   * Aplica estratégia Base Zero
   */
  _applyZeroBasedStrategy(income, customAllocations) {
    const allocations = this._applyEnvelopeStrategy(income, customAllocations);
    
    // Em base zero, todo valor deve ser alocado
    const totalAllocated = this._sumAllocations(allocations);
    
    if (Math.abs(totalAllocated - income) > 0.01) {
      throw new Error(
        `Base Zero: Total alocado (${mathModule.formatCurrency(totalAllocated)}) ` +
        `deve ser igual à renda (${mathModule.formatCurrency(income)})`
      );
    }

    return allocations;
  }

  /**
   * Aplica estratégia baseada em histórico
   */
  async _applyHistoricalStrategy(userId, income, historicalData, adjustments) {
    const allocations = {};

    if (!historicalData.byCategory || Object.keys(historicalData.byCategory).length === 0) {
      // Sem histórico, usar 50/30/20
      return this._applyPercentageStrategy(
        income, 
        BUDGET_STRATEGIES.FIFTY_THIRTY_TWENTY
      );
    }

    // Usar média histórica com ajustes
    Object.entries(historicalData.byCategory).forEach(([category, data]) => {
      let targetValue = data.averageMonthly;

      // Aplicar ajuste se especificado
      if (adjustments[category]) {
        if (typeof adjustments[category] === 'number') {
          targetValue = adjustments[category];
        } else if (adjustments[category].percentage) {
          targetValue *= (1 + adjustments[category].percentage / 100);
        } else if (adjustments[category].absolute) {
          targetValue += adjustments[category].absolute;
        }
      }

      allocations[category] = {
        value: Math.round(targetValue * 100) / 100,
        formatted: mathModule.formatCurrency(targetValue),
        percentage: (targetValue / income) * 100,
        historical: {
          average: data.averageMonthly,
          variation: ((targetValue - data.averageMonthly) / data.averageMonthly) * 100
        }
      };
    });

    // Calcular reserva/investimento com sobra
    const totalAllocated = this._sumAllocations(allocations);
    if (totalAllocated < income) {
      const savings = income - totalAllocated;
      allocations.poupanca = {
        value: Math.round(savings * 100) / 100,
        formatted: mathModule.formatCurrency(savings),
        percentage: (savings / income) * 100,
        isCalculated: true
      };
    }

    return allocations;
  }

  /**
   * Ajusta orçamento para acomodar metas
   */
  _adjustForGoals(allocations, goals, income) {
    const adjusted = { ...allocations };
    let totalForGoals = 0;

    // Calcular quanto precisa para metas
    goals.forEach(goal => {
      if (goal.monthlyContribution) {
        totalForGoals += goal.monthlyContribution;
      } else if (goal.targetAmount && goal.targetDate) {
        const monthsLeft = this._monthsUntil(goal.targetDate);
        if (monthsLeft > 0) {
          const monthlyNeeded = goal.targetAmount / monthsLeft;
          goal.monthlyContribution = monthlyNeeded;
          totalForGoals += monthlyNeeded;
        }
      }
    });

    // Verificar se cabe no orçamento
    const savingsKey = Object.keys(adjusted).find(k => 
      k === 'poupanca' || k === 'investimentos' || k === 'savings'
    );

    if (savingsKey && adjusted[savingsKey]) {
      // Verificar se poupança atual cobre as metas
      if (adjusted[savingsKey].value < totalForGoals) {
        // Precisa realocar de outras categorias
        const deficit = totalForGoals - adjusted[savingsKey].value;
        adjusted._goalDeficit = {
          value: deficit,
          message: `Necessário realocar ${mathModule.formatCurrency(deficit)} para atingir metas`
        };
      }
      
      // Ajustar valor de poupança
      adjusted[savingsKey].value = Math.max(adjusted[savingsKey].value, totalForGoals);
      adjusted[savingsKey].formatted = mathModule.formatCurrency(adjusted[savingsKey].value);
      adjusted[savingsKey].percentage = (adjusted[savingsKey].value / income) * 100;
      adjusted[savingsKey].goals = goals.map(g => ({
        name: g.name,
        monthlyContribution: g.monthlyContribution
      }));
    }

    return adjusted;
  }

  /**
   * Distribui alocações por categorias detalhadas
   */
  _distributeByCatagories(allocations, historicalData) {
    const categories = {};

    Object.entries(allocations).forEach(([key, allocation]) => {
      if (key.startsWith('_')) return; // Pular metadados

      // Se já é uma categoria específica
      if (!allocation.categories || allocation.categories.length === 0) {
        categories[key] = {
          budget: allocation.value,
          formatted: allocation.formatted,
          percentage: allocation.percentage
        };
        return;
      }

      // Distribuir entre subcategorias baseado no histórico
      const relevantCategories = allocation.categories.filter(
        cat => historicalData.byCategory && historicalData.byCategory[cat]
      );

      if (relevantCategories.length === 0) {
        // Distribuir igualmente
        const perCategory = allocation.value / allocation.categories.length;
        allocation.categories.forEach(cat => {
          categories[cat] = {
            budget: Math.round(perCategory * 100) / 100,
            formatted: mathModule.formatCurrency(perCategory),
            percentage: (perCategory / allocation.value) * 100,
            parentGroup: key
          };
        });
      } else {
        // Distribuir proporcionalmente ao histórico
        const totalHistorical = relevantCategories.reduce(
          (sum, cat) => sum + historicalData.byCategory[cat].averageMonthly, 
          0
        );

        relevantCategories.forEach(cat => {
          const proportion = historicalData.byCategory[cat].averageMonthly / totalHistorical;
          const catBudget = allocation.value * proportion;
          categories[cat] = {
            budget: Math.round(catBudget * 100) / 100,
            formatted: mathModule.formatCurrency(catBudget),
            percentage: (catBudget / allocation.value) * 100,
            parentGroup: key,
            basedOnHistory: true
          };
        });

        // Adicionar categorias sem histórico
        const missingCategories = allocation.categories.filter(
          cat => !relevantCategories.includes(cat)
        );
        if (missingCategories.length > 0) {
          const remaining = allocation.value - Object.values(categories)
            .filter(c => c.parentGroup === key)
            .reduce((sum, c) => sum + c.budget, 0);
          
          const perMissing = remaining / missingCategories.length;
          missingCategories.forEach(cat => {
            categories[cat] = {
              budget: Math.round(perMissing * 100) / 100,
              formatted: mathModule.formatCurrency(perMissing),
              percentage: (perMissing / allocation.value) * 100,
              parentGroup: key,
              isEstimated: true
            };
          });
        }
      }
    });

    return categories;
  }

  /**
   * Mapeia metas para o orçamento
   */
  _mapGoalsTobudget(goals, allocations) {
    return goals.map(goal => ({
      name: goal.name,
      type: goal.type,
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate,
      monthlyContribution: goal.monthlyContribution,
      formattedContribution: mathModule.formatCurrency(goal.monthlyContribution || 0),
      percentageOfIncome: goal.monthlyContribution 
        ? (goal.monthlyContribution / this._sumAllocations(allocations)) * 100 
        : 0
    }));
  }

  /**
   * Compara orçamento com histórico
   */
  _compareWithHistory(allocations, historicalData) {
    const comparison = {
      items: [],
      summary: {}
    };

    if (!historicalData.byCategory) {
      comparison.summary = { noHistoricalData: true };
      return comparison;
    }

    Object.entries(allocations).forEach(([key, allocation]) => {
      if (key.startsWith('_')) return;

      const historical = historicalData.byCategory[key];
      if (historical) {
        const difference = allocation.value - historical.averageMonthly;
        comparison.items.push({
          category: key,
          budget: allocation.value,
          historical: historical.averageMonthly,
          difference,
          percentChange: (difference / historical.averageMonthly) * 100,
          status: difference > 0 ? 'aumento' : difference < 0 ? 'redução' : 'mantido'
        });
      }
    });

    const increases = comparison.items.filter(i => i.status === 'aumento');
    const decreases = comparison.items.filter(i => i.status === 'redução');

    comparison.summary = {
      categoriesIncreased: increases.length,
      categoriesDecreased: decreases.length,
      totalIncrease: increases.reduce((sum, i) => sum + i.difference, 0),
      totalDecrease: decreases.reduce((sum, i) => sum + i.difference, 0)
    };

    return comparison;
  }

  /**
   * Gera alertas e sugestões para o orçamento
   */
  _generateBudgetAlerts(allocations, historicalData, goals) {
    const alerts = [];

    // Verificar se poupança é muito baixa
    const savingsAlloc = allocations.poupanca || allocations.investimentos;
    if (savingsAlloc && savingsAlloc.percentage < 10) {
      alerts.push({
        type: 'warning',
        message: 'Taxa de poupança abaixo do recomendado (mínimo 10%)',
        category: 'poupança',
        suggestion: 'Considere reduzir gastos em categorias não essenciais'
      });
    }

    // Verificar categorias com aumento significativo
    if (historicalData.byCategory) {
      Object.entries(allocations).forEach(([key, allocation]) => {
        const historical = historicalData.byCategory[key];
        if (historical) {
          const increase = ((allocation.value - historical.averageMonthly) / historical.averageMonthly) * 100;
          if (increase > 30) {
            alerts.push({
              type: 'info',
              message: `Orçamento de ${key} aumentou ${increase.toFixed(1)}% vs histórico`,
              category: key,
              suggestion: 'Verifique se este aumento é intencional'
            });
          }
        }
      });
    }

    // Verificar metas
    goals.forEach(goal => {
      if (goal.targetDate) {
        const monthsLeft = this._monthsUntil(goal.targetDate);
        if (monthsLeft <= 0) {
          alerts.push({
            type: 'error',
            message: `Meta "${goal.name}" passou da data alvo`,
            category: 'metas'
          });
        } else if (monthsLeft <= 3) {
          alerts.push({
            type: 'warning',
            message: `Meta "${goal.name}" vence em ${monthsLeft} meses`,
            category: 'metas'
          });
        }
      }
    });

    return alerts;
  }

  /**
   * Helpers
   */
  _sumAllocations(allocations) {
    return Object.entries(allocations)
      .filter(([key]) => !key.startsWith('_'))
      .reduce((sum, [, alloc]) => sum + (alloc.value || 0), 0);
  }

  _getValidFrom(period) {
    const now = new Date();
    if (period === 'mensal') {
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }
    return now.toISOString();
  }

  _getValidTo(period) {
    const now = new Date();
    if (period === 'mensal') {
      return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
    }
    return null;
  }

  _monthsUntil(dateStr) {
    const target = new Date(dateStr);
    const now = new Date();
    return (target.getFullYear() - now.getFullYear()) * 12 + 
           (target.getMonth() - now.getMonth());
  }
}

module.exports = { 
  BudgetCreator, 
  BUDGET_STRATEGIES,
  EXPENSE_CLASSIFICATION
};
