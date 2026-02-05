/**
 * Budget Tracker - Rastreador de Orçamento
 * Fase 5 - Agentes Coordenadores
 * 
 * Monitora a execução do orçamento em tempo real,
 * comparando gastos realizados com orçamento planejado.
 */

const { logger } = require('../../../../../utils/logger');
const { mathModule } = require('../../math/math-module');

/**
 * Estados de execução de categoria
 */
const EXECUTION_STATUS = {
  ON_TRACK: 'on_track',       // Dentro do esperado
  WARNING: 'warning',          // 80-100% do orçamento
  EXCEEDED: 'exceeded',        // Acima do orçamento
  UNDER_BUDGET: 'under_budget' // Muito abaixo (< 50% quando esperado mais)
};

class BudgetTracker {
  constructor(financeBridge) {
    this.financeBridge = financeBridge;
  }

  /**
   * Rastreia execução do orçamento
   * 
   * @param {Object} options - Opções de rastreamento
   * @returns {Promise<Object>} Status de execução
   */
  async track(options) {
    const {
      userId,
      budget,
      asOfDate = new Date()
    } = options;

    logger.info('BudgetTracker: Iniciando rastreamento', { 
      userId, 
      budgetId: budget?.id 
    });

    try {
      // 1. Obter transações do período
      const transactions = await this._getTransactionsInPeriod(
        userId,
        budget.validFrom,
        asOfDate
      );

      // 2. Agrupar gastos por categoria
      const actualByCategory = this._groupByCategory(transactions);

      // 3. Comparar com orçamento
      const categoryStatus = this._compareWithBudget(
        actualByCategory,
        budget.categories,
        budget.validFrom,
        asOfDate
      );

      // 4. Calcular status geral
      const overallStatus = this._calculateOverallStatus(categoryStatus);

      // 5. Projetar fim do período
      const projections = this._projectEndOfPeriod(
        categoryStatus,
        budget,
        asOfDate
      );

      // 6. Gerar insights e recomendações
      const insights = this._generateInsights(categoryStatus, projections);

      const result = {
        asOfDate: asOfDate.toISOString(),
        budget: {
          id: budget.id,
          period: budget.period,
          validFrom: budget.validFrom,
          validTo: budget.validTo
        },
        
        // Status por categoria
        categories: categoryStatus,
        
        // Status geral
        overall: overallStatus,
        
        // Projeções
        projections,
        
        // Insights
        insights,
        
        // Resumo rápido
        summary: this._buildSummary(categoryStatus, overallStatus, projections)
      };

      logger.info('BudgetTracker: Rastreamento concluído', {
        status: overallStatus.status,
        categoriesExceeded: categoryStatus.filter(c => c.status === EXECUTION_STATUS.EXCEEDED).length
      });

      return result;

    } catch (error) {
      logger.error('BudgetTracker: Erro no rastreamento', { error: error.message });
      throw error;
    }
  }

  /**
   * Obtém transações do período
   */
  async _getTransactionsInPeriod(userId, startDate, endDate) {
    const result = await this.financeBridge.query({
      userId,
      type: 'despesa',
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString()
    });

    return result.success ? result.data : [];
  }

  /**
   * Agrupa transações por categoria
   */
  _groupByCategory(transactions) {
    const grouped = {};

    transactions.forEach(t => {
      const category = t.category || 'outros';
      
      if (!grouped[category]) {
        grouped[category] = {
          total: 0,
          count: 0,
          transactions: []
        };
      }

      grouped[category].total += t.value;
      grouped[category].count++;
      grouped[category].transactions.push({
        id: t._id || t.id,
        description: t.description,
        value: t.value,
        date: t.date
      });
    });

    return grouped;
  }

  /**
   * Compara gastos reais com orçamento
   */
  _compareWithBudget(actualByCategory, budgetCategories, validFrom, asOfDate) {
    const status = [];

    // Calcular progresso do período
    const periodStart = new Date(validFrom);
    const now = new Date(asOfDate);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const periodProgress = dayOfMonth / daysInMonth; // 0 a 1

    Object.entries(budgetCategories).forEach(([category, budgetData]) => {
      const actual = actualByCategory[category] || { total: 0, count: 0 };
      const budgetValue = budgetData.budget || 0;

      // Percentual usado
      const percentUsed = budgetValue > 0 
        ? (actual.total / budgetValue) * 100 
        : (actual.total > 0 ? 100 : 0);

      // Valor esperado até agora (proporcional ao período)
      const expectedByNow = budgetValue * periodProgress;
      
      // Status baseado na execução
      let categoryStatus;
      let statusMessage;

      if (actual.total > budgetValue) {
        categoryStatus = EXECUTION_STATUS.EXCEEDED;
        statusMessage = `Excedido em ${mathModule.formatCurrency(actual.total - budgetValue)}`;
      } else if (percentUsed >= 80) {
        categoryStatus = EXECUTION_STATUS.WARNING;
        statusMessage = `${(100 - percentUsed).toFixed(1)}% restante do orçamento`;
      } else if (actual.total < expectedByNow * 0.5 && percentUsed < 30) {
        categoryStatus = EXECUTION_STATUS.UNDER_BUDGET;
        statusMessage = 'Gastos abaixo do esperado para o período';
      } else {
        categoryStatus = EXECUTION_STATUS.ON_TRACK;
        statusMessage = 'Dentro do planejado';
      }

      // Taxa de consumo diário
      const dailyRate = actual.total / dayOfMonth;
      const daysRemaining = daysInMonth - dayOfMonth;
      const projectedTotal = actual.total + (dailyRate * daysRemaining);
      const projectedExcess = projectedTotal - budgetValue;

      status.push({
        category,
        budget: {
          value: budgetValue,
          formatted: mathModule.formatCurrency(budgetValue)
        },
        actual: {
          value: actual.total,
          formatted: mathModule.formatCurrency(actual.total),
          transactions: actual.count
        },
        remaining: {
          value: Math.max(0, budgetValue - actual.total),
          formatted: mathModule.formatCurrency(Math.max(0, budgetValue - actual.total))
        },
        percentUsed: Math.round(percentUsed * 100) / 100,
        status: categoryStatus,
        statusMessage,
        
        // Ritmo de gastos
        pace: {
          dailyAverage: Math.round(dailyRate * 100) / 100,
          expectedByNow: Math.round(expectedByNow * 100) / 100,
          variance: actual.total - expectedByNow,
          variancePercent: expectedByNow > 0 
            ? ((actual.total - expectedByNow) / expectedByNow) * 100 
            : 0
        },
        
        // Projeção
        projection: {
          endOfPeriod: Math.round(projectedTotal * 100) / 100,
          excess: projectedExcess > 0 ? Math.round(projectedExcess * 100) / 100 : 0,
          willExceed: projectedExcess > 0
        }
      });
    });

    // Adicionar categorias não orçadas mas com gastos
    Object.entries(actualByCategory).forEach(([category, actual]) => {
      const alreadyIncluded = status.some(s => s.category === category);
      if (!alreadyIncluded) {
        status.push({
          category,
          budget: {
            value: 0,
            formatted: 'R$ 0,00'
          },
          actual: {
            value: actual.total,
            formatted: mathModule.formatCurrency(actual.total),
            transactions: actual.count
          },
          remaining: {
            value: 0,
            formatted: 'R$ 0,00'
          },
          percentUsed: 100,
          status: EXECUTION_STATUS.EXCEEDED,
          statusMessage: 'Categoria sem orçamento definido',
          isUnbudgeted: true
        });
      }
    });

    // Ordenar por status (excedido primeiro) e depois por percentual
    return status.sort((a, b) => {
      const statusOrder = {
        [EXECUTION_STATUS.EXCEEDED]: 0,
        [EXECUTION_STATUS.WARNING]: 1,
        [EXECUTION_STATUS.UNDER_BUDGET]: 2,
        [EXECUTION_STATUS.ON_TRACK]: 3
      };
      
      const orderDiff = statusOrder[a.status] - statusOrder[b.status];
      if (orderDiff !== 0) return orderDiff;
      
      return b.percentUsed - a.percentUsed;
    });
  }

  /**
   * Calcula status geral do orçamento
   */
  _calculateOverallStatus(categoryStatus) {
    const exceeded = categoryStatus.filter(c => c.status === EXECUTION_STATUS.EXCEEDED);
    const warning = categoryStatus.filter(c => c.status === EXECUTION_STATUS.WARNING);
    const onTrack = categoryStatus.filter(c => c.status === EXECUTION_STATUS.ON_TRACK);
    const underBudget = categoryStatus.filter(c => c.status === EXECUTION_STATUS.UNDER_BUDGET);

    const totalBudget = categoryStatus.reduce((sum, c) => sum + c.budget.value, 0);
    const totalActual = categoryStatus.reduce((sum, c) => sum + c.actual.value, 0);
    const totalRemaining = totalBudget - totalActual;
    const overallPercent = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

    let status;
    let message;

    if (exceeded.length > 0) {
      const excessTotal = exceeded.reduce((sum, c) => 
        sum + (c.actual.value - c.budget.value), 0
      );
      status = 'critical';
      message = `${exceeded.length} categoria(s) excederam o orçamento em ${mathModule.formatCurrency(excessTotal)}`;
    } else if (warning.length > categoryStatus.length * 0.3) {
      status = 'warning';
      message = `${warning.length} categorias acima de 80% do orçamento`;
    } else if (overallPercent > 90) {
      status = 'attention';
      message = 'Orçamento geral acima de 90%';
    } else {
      status = 'healthy';
      message = 'Orçamento sob controle';
    }

    return {
      status,
      message,
      totals: {
        budget: {
          value: totalBudget,
          formatted: mathModule.formatCurrency(totalBudget)
        },
        actual: {
          value: totalActual,
          formatted: mathModule.formatCurrency(totalActual)
        },
        remaining: {
          value: Math.max(0, totalRemaining),
          formatted: mathModule.formatCurrency(Math.max(0, totalRemaining))
        },
        excess: totalRemaining < 0 ? {
          value: Math.abs(totalRemaining),
          formatted: mathModule.formatCurrency(Math.abs(totalRemaining))
        } : null
      },
      percentUsed: Math.round(overallPercent * 100) / 100,
      breakdown: {
        exceeded: exceeded.length,
        warning: warning.length,
        onTrack: onTrack.length,
        underBudget: underBudget.length
      }
    };
  }

  /**
   * Projeta gastos até fim do período
   */
  _projectEndOfPeriod(categoryStatus, budget, asOfDate) {
    const now = new Date(asOfDate);
    const periodEnd = new Date(budget.validTo);
    const daysRemaining = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));

    const projections = {
      daysRemaining,
      categories: [],
      overall: {}
    };

    // Projeção por categoria
    categoryStatus.forEach(cat => {
      if (cat.projection) {
        projections.categories.push({
          category: cat.category,
          currentSpending: cat.actual.value,
          projectedTotal: cat.projection.endOfPeriod,
          budgetLimit: cat.budget.value,
          willExceed: cat.projection.willExceed,
          projectedExcess: cat.projection.excess
        });
      }
    });

    // Projeção geral
    const totalProjected = projections.categories.reduce(
      (sum, c) => sum + c.projectedTotal, 0
    );
    const totalBudget = categoryStatus.reduce(
      (sum, c) => sum + c.budget.value, 0
    );

    projections.overall = {
      projectedTotal: Math.round(totalProjected * 100) / 100,
      projectedTotalFormatted: mathModule.formatCurrency(totalProjected),
      budget: totalBudget,
      budgetFormatted: mathModule.formatCurrency(totalBudget),
      projectedRemaining: totalBudget - totalProjected,
      projectedRemainingFormatted: mathModule.formatCurrency(totalBudget - totalProjected),
      willExceed: totalProjected > totalBudget,
      categoriesWillExceed: projections.categories.filter(c => c.willExceed).length
    };

    return projections;
  }

  /**
   * Gera insights baseado na execução
   */
  _generateInsights(categoryStatus, projections) {
    const insights = [];

    // Categorias em risco
    const atRisk = categoryStatus.filter(c => 
      c.projection?.willExceed || c.status === EXECUTION_STATUS.EXCEEDED
    );

    if (atRisk.length > 0) {
      insights.push({
        type: 'risk',
        priority: 'high',
        title: `${atRisk.length} categoria(s) em risco de estouro`,
        categories: atRisk.map(c => c.category),
        recommendation: 'Revisar gastos nestas categorias até o fim do mês'
      });
    }

    // Categorias com folga
    const withSlack = categoryStatus.filter(c => 
      c.status === EXECUTION_STATUS.UNDER_BUDGET && c.percentUsed < 40
    );

    if (withSlack.length > 0 && atRisk.length > 0) {
      const slackTotal = withSlack.reduce((sum, c) => 
        sum + (c.budget.value - c.actual.value), 0
      );
      
      insights.push({
        type: 'opportunity',
        priority: 'medium',
        title: 'Possibilidade de realocação',
        message: `Há ${mathModule.formatCurrency(slackTotal)} disponível em categorias sub-utilizadas`,
        from: withSlack.map(c => c.category),
        to: atRisk.map(c => c.category)
      });
    }

    // Ritmo de gastos
    const fastPace = categoryStatus.filter(c => 
      c.pace?.variancePercent > 30
    );

    if (fastPace.length > 0) {
      insights.push({
        type: 'trend',
        priority: 'medium',
        title: 'Ritmo acelerado de gastos',
        categories: fastPace.map(c => ({
          name: c.category,
          aboveExpected: `${c.pace.variancePercent.toFixed(1)}%`
        })),
        recommendation: 'Considere desacelerar gastos nestas categorias'
      });
    }

    // Projeção positiva
    if (!projections.overall.willExceed && projections.overall.projectedRemaining > 0) {
      insights.push({
        type: 'positive',
        priority: 'low',
        title: 'Projeção positiva',
        message: `Mantendo o ritmo atual, sobrará ${mathModule.formatCurrency(projections.overall.projectedRemaining)} no fim do mês`
      });
    }

    return insights;
  }

  /**
   * Constrói resumo rápido
   */
  _buildSummary(categoryStatus, overallStatus, projections) {
    return {
      emoji: this._getStatusEmoji(overallStatus.status),
      headline: overallStatus.message,
      spent: overallStatus.totals.actual.formatted,
      budget: overallStatus.totals.budget.formatted,
      remaining: overallStatus.totals.remaining.formatted,
      percentUsed: `${overallStatus.percentUsed.toFixed(1)}%`,
      daysRemaining: projections.daysRemaining,
      topConcern: categoryStatus.length > 0 
        ? categoryStatus[0].category 
        : null,
      needsAttention: overallStatus.breakdown.exceeded + overallStatus.breakdown.warning
    };
  }

  _getStatusEmoji(status) {
    const emojis = {
      healthy: '✅',
      attention: '⚡',
      warning: '⚠️',
      critical: '🚨'
    };
    return emojis[status] || '📊';
  }
}

module.exports = { BudgetTracker, EXECUTION_STATUS };
