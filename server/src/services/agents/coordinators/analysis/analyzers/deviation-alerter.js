/**
 * Deviation Alerter - Alertas de Desvio
 * Fase 5 - Agente de Análise
 * 
 * Responsável por:
 * - Calcular média histórica por categoria
 * - Comparar mês atual com a média
 * - Gerar alertas para desvios > 20%
 * - Priorizar alertas por impacto financeiro
 */

const logger = require('../../../../../utils/logger');
const { mathModule } = require('../../math/math-module');

/**
 * Threshold para considerar um desvio significativo (em %)
 */
const DEVIATION_THRESHOLD = 20;

/**
 * Níveis de severidade
 */
const SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

class DeviationAlerter {
  
  constructor(financeBridge) {
    this.financeBridge = financeBridge;
  }

  /**
   * Gera alertas de desvio comparando período atual com histórico
   * 
   * @param {Object} options - Opções de análise
   * @param {string} options.userId - ID do usuário
   * @param {number} options.historicalMonths - Meses para calcular média (padrão: 3)
   * @returns {Promise<Object>} Alertas gerados
   */
  async generateAlerts(options = {}) {
    const { userId, historicalMonths = 3 } = options;

    try {
      // 1. Buscar dados do mês atual
      const currentData = await this.fetchCurrentMonth(userId);
      
      // 2. Buscar dados históricos para calcular média
      const historicalData = await this.fetchHistoricalData(userId, historicalMonths);
      
      // 3. Calcular médias históricas por categoria
      const averages = this.calculateAverages(historicalData);
      
      // 4. Comparar atual com médias e gerar alertas
      const alerts = this.compareAndAlert(currentData, averages);
      
      // 5. Priorizar alertas por impacto
      const prioritized = this.prioritizeAlerts(alerts);

      return {
        success: true,
        period: 'current_month',
        historicalMonths,
        alertCount: prioritized.length,
        alerts: prioritized,
        summary: this.generateSummary(prioritized),
        recommendations: this.generateRecommendations(prioritized)
      };

    } catch (error) {
      logger.error('Erro ao gerar alertas de desvio', { error: error.message });
      throw error;
    }
  }

  /**
   * Busca gastos do mês atual agrupados por categoria
   */
  async fetchCurrentMonth(userId) {
    const payload = {
      operation: 'aggregate',
      params: {
        filters: {
          period: { named_period: 'current_month' },
          type: 'expense'
        },
        groupBy: 'category',
        aggregations: ['sum', 'count']
      },
      context: { user_id: userId }
    };

    const result = await this.financeBridge.process(payload);
    
    if (!result.success) {
      // Fallback: buscar transações e agregar manualmente
      return await this.fetchAndAggregate('current_month', userId);
    }

    return result.data?.groups || result.data || [];
  }

  /**
   * Busca e agrega manualmente (fallback)
   */
  async fetchAndAggregate(period, userId) {
    const payload = {
      operation: 'query',
      params: {
        filters: {
          period: { named_period: period },
          type: 'expense'
        },
        limit: 500
      },
      context: { user_id: userId }
    };

    const result = await this.financeBridge.process(payload);
    const transactions = result.data?.transactions || result.data || [];

    // Agrupar por categoria
    const groups = {};
    for (const tx of transactions) {
      const category = tx.category || 'Outros';
      if (!groups[category]) {
        groups[category] = { category, sum: 0, count: 0 };
      }
      groups[category].sum += Math.abs(tx.amount || 0);
      groups[category].count++;
    }

    return Object.values(groups);
  }

  /**
   * Busca dados históricos para cálculo de média
   */
  async fetchHistoricalData(userId, months) {
    const monthlyData = [];
    const now = new Date();

    // Começar do mês anterior (não incluir mês atual)
    for (let i = 1; i <= months; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const payload = {
        operation: 'query',
        params: {
          filters: {
            period: {
              start: startDate.toISOString().split('T')[0],
              end: endDate.toISOString().split('T')[0]
            },
            type: 'expense'
          },
          limit: 500
        },
        context: { user_id: userId }
      };

      const result = await this.financeBridge.process(payload);
      const transactions = result.data?.transactions || result.data || [];

      // Agrupar por categoria
      const groups = {};
      for (const tx of transactions) {
        const category = tx.category || 'Outros';
        if (!groups[category]) {
          groups[category] = { category, sum: 0, count: 0 };
        }
        groups[category].sum += Math.abs(tx.amount || 0);
        groups[category].count++;
      }

      monthlyData.push({
        period: `${year}-${String(month).padStart(2, '0')}`,
        categories: Object.values(groups)
      });
    }

    return monthlyData;
  }

  /**
   * Calcula médias históricas por categoria
   */
  calculateAverages(historicalData) {
    const categoryTotals = {};

    for (const month of historicalData) {
      for (const cat of month.categories) {
        if (!categoryTotals[cat.category]) {
          categoryTotals[cat.category] = {
            category: cat.category,
            values: [],
            counts: []
          };
        }
        categoryTotals[cat.category].values.push(cat.sum);
        categoryTotals[cat.category].counts.push(cat.count);
      }
    }

    // Calcular médias e desvios padrão
    const averages = {};
    for (const [category, data] of Object.entries(categoryTotals)) {
      const avgValue = mathModule.mean(data.values);
      const stdDev = mathModule.standardDeviation(data.values);
      const avgCount = mathModule.mean(data.counts);

      averages[category] = {
        category,
        average: mathModule.round(avgValue),
        stdDev: mathModule.round(stdDev),
        avgCount: Math.round(avgCount),
        monthsWithData: data.values.length,
        min: mathModule.min(data.values),
        max: mathModule.max(data.values)
      };
    }

    return averages;
  }

  /**
   * Compara dados atuais com médias e gera alertas
   */
  compareAndAlert(currentData, averages) {
    const alerts = [];

    for (const current of currentData) {
      const category = current.category;
      const historical = averages[category];

      // Categoria nova (não tem histórico)
      if (!historical) {
        alerts.push({
          type: 'new_category',
          category,
          currentValue: mathModule.round(current.sum),
          message: `Nova categoria detectada: ${category}`,
          severity: SEVERITY.LOW
        });
        continue;
      }

      // Calcular desvio
      const deviation = mathModule.percentChange(historical.average, current.sum);
      const absoluteDeviation = Math.abs(deviation);

      // Gerar alerta se desvio significativo
      if (absoluteDeviation >= DEVIATION_THRESHOLD) {
        const isIncrease = deviation > 0;
        const severity = this.calculateSeverity(absoluteDeviation, current.sum);
        const zScore = historical.stdDev > 0 
          ? (current.sum - historical.average) / historical.stdDev 
          : 0;

        alerts.push({
          type: isIncrease ? 'increase' : 'decrease',
          category,
          currentValue: mathModule.round(current.sum),
          currentValueFormatted: mathModule.formatCurrency(current.sum),
          historicalAverage: historical.average,
          historicalAverageFormatted: mathModule.formatCurrency(historical.average),
          deviation: mathModule.roundPercent(deviation),
          absoluteDeviation: mathModule.roundPercent(absoluteDeviation),
          zScore: mathModule.round(zScore),
          severity,
          impact: mathModule.round(current.sum - historical.average),
          impactFormatted: mathModule.formatCurrency(Math.abs(current.sum - historical.average)),
          message: this.buildAlertMessage(category, deviation, current.sum, historical.average)
        });
      }
    }

    // Verificar categorias que sumiram (estavam no histórico mas não no atual)
    for (const [category, historical] of Object.entries(averages)) {
      const current = currentData.find(c => c.category === category);
      
      if (!current && historical.average > 100) { // Ignora valores muito pequenos
        alerts.push({
          type: 'missing',
          category,
          currentValue: 0,
          historicalAverage: historical.average,
          deviation: -100,
          severity: SEVERITY.LOW,
          message: `Categoria ${category} não teve gastos este mês (média: ${mathModule.formatCurrency(historical.average)})`
        });
      }
    }

    return alerts;
  }

  /**
   * Calcula severidade do alerta
   */
  calculateSeverity(deviationPercent, absoluteValue) {
    // Combinar desvio percentual com valor absoluto
    
    // Se o valor é baixo, mesmo com alto desvio, severidade é menor
    if (absoluteValue < 100) return SEVERITY.LOW;
    if (absoluteValue < 500 && deviationPercent < 50) return SEVERITY.LOW;

    // Baseado principalmente no percentual de desvio
    if (deviationPercent >= 100) return SEVERITY.CRITICAL;
    if (deviationPercent >= 50) return SEVERITY.HIGH;
    if (deviationPercent >= 30) return SEVERITY.MEDIUM;
    
    return SEVERITY.LOW;
  }

  /**
   * Constrói mensagem do alerta
   */
  buildAlertMessage(category, deviation, current, average) {
    const isIncrease = deviation > 0;
    const absDeviation = Math.abs(deviation);
    
    if (isIncrease) {
      return `${category}: Aumento de ${mathModule.formatPercentage(absDeviation)} ` +
             `(${mathModule.formatCurrency(current)} vs média de ${mathModule.formatCurrency(average)})`;
    } else {
      return `${category}: Redução de ${mathModule.formatPercentage(absDeviation)} ` +
             `(${mathModule.formatCurrency(current)} vs média de ${mathModule.formatCurrency(average)})`;
    }
  }

  /**
   * Prioriza alertas por impacto financeiro e severidade
   */
  prioritizeAlerts(alerts) {
    const severityOrder = {
      [SEVERITY.CRITICAL]: 4,
      [SEVERITY.HIGH]: 3,
      [SEVERITY.MEDIUM]: 2,
      [SEVERITY.LOW]: 1
    };

    return alerts.sort((a, b) => {
      // Primeiro por severidade
      const sevDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (sevDiff !== 0) return sevDiff;

      // Depois por impacto absoluto
      return Math.abs(b.impact || 0) - Math.abs(a.impact || 0);
    });
  }

  /**
   * Gera resumo dos alertas
   */
  generateSummary(alerts) {
    const byType = {
      increase: alerts.filter(a => a.type === 'increase'),
      decrease: alerts.filter(a => a.type === 'decrease'),
      new_category: alerts.filter(a => a.type === 'new_category'),
      missing: alerts.filter(a => a.type === 'missing')
    };

    const bySeverity = {
      critical: alerts.filter(a => a.severity === SEVERITY.CRITICAL),
      high: alerts.filter(a => a.severity === SEVERITY.HIGH),
      medium: alerts.filter(a => a.severity === SEVERITY.MEDIUM),
      low: alerts.filter(a => a.severity === SEVERITY.LOW)
    };

    const totalExtraSpending = byType.increase.reduce(
      (sum, a) => sum + (a.impact || 0), 0
    );

    const totalSavings = byType.decrease.reduce(
      (sum, a) => sum + Math.abs(a.impact || 0), 0
    );

    return {
      totalAlerts: alerts.length,
      byType: {
        increases: byType.increase.length,
        decreases: byType.decrease.length,
        newCategories: byType.new_category.length,
        missing: byType.missing.length
      },
      bySeverity: {
        critical: bySeverity.critical.length,
        high: bySeverity.high.length,
        medium: bySeverity.medium.length,
        low: bySeverity.low.length
      },
      financialImpact: {
        extraSpending: mathModule.round(totalExtraSpending),
        extraSpendingFormatted: mathModule.formatCurrency(totalExtraSpending),
        savings: mathModule.round(totalSavings),
        savingsFormatted: mathModule.formatCurrency(totalSavings),
        netImpact: mathModule.round(totalExtraSpending - totalSavings)
      }
    };
  }

  /**
   * Gera recomendações baseadas nos alertas
   */
  generateRecommendations(alerts) {
    const recommendations = [];

    // Alertas críticos ou altos de aumento
    const highIncreases = alerts.filter(
      a => a.type === 'increase' && 
           (a.severity === SEVERITY.CRITICAL || a.severity === SEVERITY.HIGH)
    );

    for (const alert of highIncreases.slice(0, 3)) {
      recommendations.push({
        priority: 'high',
        category: alert.category,
        action: `Revisar gastos em ${alert.category}`,
        reason: `Aumento de ${mathModule.formatPercentage(alert.absoluteDeviation)} acima da média`,
        potentialSavings: alert.impactFormatted
      });
    }

    // Reduções (positivo - parabenizar)
    const significantDecreases = alerts.filter(
      a => a.type === 'decrease' && a.absoluteDeviation > 30
    );

    for (const alert of significantDecreases.slice(0, 2)) {
      recommendations.push({
        priority: 'info',
        category: alert.category,
        action: `Continue assim!`,
        reason: `Redução de ${mathModule.formatPercentage(Math.abs(alert.deviation))} em ${alert.category}`,
        saved: mathModule.formatCurrency(Math.abs(alert.impact))
      });
    }

    return recommendations;
  }
}

module.exports = { DeviationAlerter };
