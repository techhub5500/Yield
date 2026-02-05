/**
 * Cashflow Analyzer - Analisador de Fluxo de Caixa
 * Fase 5 - Agente de Análise
 * 
 * Responsável por:
 * - Calcular total de receitas
 * - Calcular total de despesas
 * - Calcular saldo (receitas - despesas)
 * - Identificar meses positivos/negativos
 * - Projetar tendência
 */

const logger = require('../../../../../utils/logger');
const { mathModule } = require('../../math/math-module');

class CashflowAnalyzer {
  
  constructor(financeBridge) {
    this.financeBridge = financeBridge;
  }

  /**
   * Analisa fluxo de caixa de um período
   * 
   * @param {Object} options - Opções de análise
   * @param {string} options.period - Período a analisar
   * @param {string} options.userId - ID do usuário
   * @returns {Promise<Object>} Análise de fluxo de caixa
   */
  async analyze(options = {}) {
    const { period = 'current_month', userId } = options;

    try {
      // Buscar receitas e despesas em paralelo
      const [incomes, expenses] = await Promise.all([
        this.fetchTransactions('income', period, userId),
        this.fetchTransactions('expense', period, userId)
      ]);

      // Calcular totais
      const totalIncome = this.sumTransactions(incomes);
      const totalExpense = this.sumTransactions(expenses);
      const balance = totalIncome - totalExpense;
      const savingsRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;

      // Agrupar por dia para ver o fluxo
      const dailyFlow = this.calculateDailyFlow(incomes, expenses);

      return {
        success: true,
        period,
        summary: {
          totalIncome: mathModule.round(totalIncome),
          totalIncomeFormatted: mathModule.formatCurrency(totalIncome),
          totalExpense: mathModule.round(totalExpense),
          totalExpenseFormatted: mathModule.formatCurrency(totalExpense),
          balance: mathModule.round(balance),
          balanceFormatted: mathModule.formatCurrency(balance),
          savingsRate: mathModule.roundPercent(savingsRate),
          status: balance >= 0 ? 'positivo' : 'negativo',
          incomeTransactions: incomes.length,
          expenseTransactions: expenses.length
        },
        incomeBreakdown: this.groupByCategory(incomes),
        expenseBreakdown: this.groupByCategory(expenses),
        dailyFlow,
        insights: this.generateInsights({
          totalIncome,
          totalExpense,
          balance,
          savingsRate,
          incomes,
          expenses
        })
      };

    } catch (error) {
      logger.error('Erro na análise de fluxo de caixa', { error: error.message });
      throw error;
    }
  }

  /**
   * Analisa fluxo de caixa de múltiplos meses
   * 
   * @param {string} userId - ID do usuário
   * @param {number} months - Número de meses a analisar
   * @returns {Promise<Object>} Análise histórica
   */
  async analyzeHistory(userId, months = 6) {
    try {
      const monthlyData = [];
      const now = new Date();

      for (let i = 0; i < months; i++) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth() + 1;
        const period = `${year}-${String(month).padStart(2, '0')}`;

        // Buscar dados do mês
        const [incomes, expenses] = await Promise.all([
          this.fetchTransactionsByMonth('income', year, month, userId),
          this.fetchTransactionsByMonth('expense', year, month, userId)
        ]);

        const totalIncome = this.sumTransactions(incomes);
        const totalExpense = this.sumTransactions(expenses);
        const balance = totalIncome - totalExpense;

        monthlyData.push({
          period,
          year,
          month,
          monthName: targetDate.toLocaleString('pt-BR', { month: 'long' }),
          income: mathModule.round(totalIncome),
          expense: mathModule.round(totalExpense),
          balance: mathModule.round(balance),
          status: balance >= 0 ? 'positivo' : 'negativo'
        });
      }

      // Calcular estatísticas
      const avgIncome = mathModule.mean(monthlyData.map(m => m.income));
      const avgExpense = mathModule.mean(monthlyData.map(m => m.expense));
      const avgBalance = mathModule.mean(monthlyData.map(m => m.balance));
      const positiveMonths = monthlyData.filter(m => m.status === 'positivo').length;

      // Projetar tendência
      const projection = mathModule.projectLinear(
        monthlyData.map(m => m.balance).reverse(),
        3
      );

      return {
        success: true,
        months: months,
        data: monthlyData,
        statistics: {
          avgIncome: mathModule.round(avgIncome),
          avgIncomeFormatted: mathModule.formatCurrency(avgIncome),
          avgExpense: mathModule.round(avgExpense),
          avgExpenseFormatted: mathModule.formatCurrency(avgExpense),
          avgBalance: mathModule.round(avgBalance),
          avgBalanceFormatted: mathModule.formatCurrency(avgBalance),
          positiveMonths,
          negativeMonths: months - positiveMonths,
          healthScore: mathModule.roundPercent((positiveMonths / months) * 100)
        },
        projection: {
          trend: projection.trend,
          nextMonths: projection.projections,
          confidence: projection.confidence
        }
      };

    } catch (error) {
      logger.error('Erro na análise histórica', { error: error.message });
      throw error;
    }
  }

  /**
   * Calcula o saldo disponível atual
   * 
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} Saldo disponível
   */
  async calculateAvailable(userId) {
    // Análise do mês atual
    const current = await this.analyze({ 
      period: 'current_month', 
      userId 
    });

    // Calcular dias restantes no mês
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysRemaining = lastDay.getDate() - now.getDate();
    const daysElapsed = now.getDate();
    const totalDays = lastDay.getDate();

    // Projetar gastos até o fim do mês
    const dailyAvgExpense = current.summary.totalExpense / daysElapsed;
    const projectedMonthlyExpense = dailyAvgExpense * totalDays;

    // Disponível = Receita - Gastos Projetados
    const projectedBalance = current.summary.totalIncome - projectedMonthlyExpense;

    // Disponível por dia restante
    const dailyAvailable = daysRemaining > 0 
      ? (current.summary.balance / daysRemaining) 
      : 0;

    return {
      success: true,
      currentBalance: current.summary.balance,
      currentBalanceFormatted: current.summary.balanceFormatted,
      daysRemaining,
      dailyAvailable: mathModule.round(dailyAvailable),
      dailyAvailableFormatted: mathModule.formatCurrency(dailyAvailable),
      projectedMonthlyExpense: mathModule.round(projectedMonthlyExpense),
      projectedBalance: mathModule.round(projectedBalance),
      projectedBalanceFormatted: mathModule.formatCurrency(projectedBalance),
      status: projectedBalance >= 0 ? 'saudável' : 'atenção'
    };
  }

  // ==================== MÉTODOS AUXILIARES ====================

  /**
   * Busca transações por tipo e período
   */
  async fetchTransactions(type, period, userId) {
    const payload = {
      operation: 'query',
      params: {
        filters: {
          period: { named_period: period },
          type: type
        },
        sort: { field: 'date', order: 'desc' },
        limit: 500
      },
      context: { user_id: userId }
    };

    const result = await this.financeBridge.process(payload);
    
    if (!result.success) {
      throw new Error(result.error || 'Erro ao buscar transações');
    }

    return result.data?.transactions || result.data || [];
  }

  /**
   * Busca transações de um mês específico
   */
  async fetchTransactionsByMonth(type, year, month, userId) {
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
          type: type
        },
        limit: 500
      },
      context: { user_id: userId }
    };

    const result = await this.financeBridge.process(payload);
    
    if (!result.success) {
      return [];
    }

    return result.data?.transactions || result.data || [];
  }

  /**
   * Soma valores das transações
   */
  sumTransactions(transactions) {
    return transactions.reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);
  }

  /**
   * Agrupa transações por categoria
   */
  groupByCategory(transactions) {
    const groups = {};

    for (const tx of transactions) {
      const category = tx.category || 'Outros';
      
      if (!groups[category]) {
        groups[category] = {
          name: category,
          total: 0,
          count: 0
        };
      }

      groups[category].total += Math.abs(tx.amount || 0);
      groups[category].count++;
    }

    return Object.values(groups)
      .map(g => ({
        ...g,
        total: mathModule.round(g.total),
        totalFormatted: mathModule.formatCurrency(g.total)
      }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Calcula fluxo diário
   */
  calculateDailyFlow(incomes, expenses) {
    const byDay = {};

    // Processar receitas
    for (const tx of incomes) {
      const day = tx.date?.split('T')[0] || tx.date;
      if (!byDay[day]) byDay[day] = { date: day, income: 0, expense: 0 };
      byDay[day].income += Math.abs(tx.amount || 0);
    }

    // Processar despesas
    for (const tx of expenses) {
      const day = tx.date?.split('T')[0] || tx.date;
      if (!byDay[day]) byDay[day] = { date: day, income: 0, expense: 0 };
      byDay[day].expense += Math.abs(tx.amount || 0);
    }

    // Calcular saldo acumulado
    const days = Object.values(byDay).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    let cumulative = 0;
    for (const day of days) {
      cumulative += day.income - day.expense;
      day.balance = mathModule.round(day.income - day.expense);
      day.cumulative = mathModule.round(cumulative);
      day.income = mathModule.round(day.income);
      day.expense = mathModule.round(day.expense);
    }

    return days;
  }

  /**
   * Gera insights do fluxo de caixa
   */
  generateInsights(data) {
    const insights = [];
    const { totalIncome, totalExpense, balance, savingsRate, incomes, expenses } = data;

    // Insight sobre saldo
    if (balance < 0) {
      insights.push({
        type: 'alert',
        icon: '⚠️',
        message: `Saldo negativo de ${mathModule.formatCurrency(Math.abs(balance))}. Gastos superaram receitas.`
      });
    } else if (balance > 0 && savingsRate >= 20) {
      insights.push({
        type: 'positive',
        icon: '✅',
        message: `Excelente! Taxa de poupança de ${mathModule.formatPercentage(savingsRate)}.`
      });
    } else if (balance > 0 && savingsRate < 10) {
      insights.push({
        type: 'warning',
        icon: '💡',
        message: `Taxa de poupança baixa (${mathModule.formatPercentage(savingsRate)}). Considere reduzir gastos.`
      });
    }

    // Insight sobre receitas
    if (incomes.length === 0) {
      insights.push({
        type: 'info',
        icon: 'ℹ️',
        message: 'Nenhuma receita registrada no período.'
      });
    }

    // Insight sobre concentração de gastos
    if (expenses.length > 0) {
      const topCategory = this.groupByCategory(expenses)[0];
      if (topCategory) {
        const percentage = (topCategory.total / totalExpense) * 100;
        if (percentage > 40) {
          insights.push({
            type: 'info',
            icon: '📊',
            message: `${mathModule.formatPercentage(percentage)} dos gastos estão em ${topCategory.name}.`
          });
        }
      }
    }

    return insights;
  }
}

module.exports = { CashflowAnalyzer };
