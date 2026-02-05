/**
 * Spending Analyzer - Analisador de Gastos
 * Fase 5 - Agente de Análise
 * 
 * Responsável por:
 * - Buscar transações por período
 * - Calcular totais por categoria
 * - Calcular percentuais de participação
 * - Comparar com períodos anteriores
 * - Formatar relatório de gastos
 */

const logger = require('../../../../../utils/logger');
const { mathModule } = require('../../math/math-module');

class SpendingAnalyzer {
  
  constructor(financeBridge) {
    this.financeBridge = financeBridge;
  }

  /**
   * Analisa gastos de um período
   * 
   * @param {Object} options - Opções de análise
   * @param {string} options.period - Período a analisar (current_month, last_month, etc)
   * @param {string} options.userId - ID do usuário
   * @param {string[]} options.categories - Categorias específicas (opcional)
   * @returns {Promise<Object>} Análise de gastos
   */
  async analyze(options = {}) {
    const { period = 'current_month', userId, categories } = options;

    try {
      // 1. Buscar transações do período
      const transactions = await this.fetchTransactions(period, userId, categories);
      
      if (!transactions || transactions.length === 0) {
        return {
          success: true,
          isEmpty: true,
          period,
          message: 'Nenhuma transação encontrada no período',
          data: {
            total: 0,
            categories: [],
            transactionCount: 0
          }
        };
      }

      // 2. Agrupar por categoria
      const byCategory = this.groupByCategory(transactions);

      // 3. Calcular totais e percentuais
      const totals = this.calculateTotals(byCategory);

      // 4. Ordenar por valor (maior para menor)
      const sorted = this.sortByAmount(totals);

      // 5. Formatar resultado
      const result = {
        success: true,
        isEmpty: false,
        period,
        data: {
          total: mathModule.round(sorted.total),
          totalFormatted: mathModule.formatCurrency(sorted.total),
          transactionCount: transactions.length,
          categories: sorted.categories,
          topCategories: sorted.categories.slice(0, 5),
          averagePerTransaction: mathModule.round(sorted.total / transactions.length)
        }
      };

      logger.debug('Análise de gastos concluída', {
        period,
        total: result.data.total,
        categories: result.data.categories.length
      });

      return result;

    } catch (error) {
      logger.error('Erro na análise de gastos', { error: error.message });
      throw error;
    }
  }

  /**
   * Compara gastos entre dois períodos
   * 
   * @param {string} currentPeriod - Período atual
   * @param {string} previousPeriod - Período anterior
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} Comparativo
   */
  async compare(currentPeriod, previousPeriod, userId) {
    const [current, previous] = await Promise.all([
      this.analyze({ period: currentPeriod, userId }),
      this.analyze({ period: previousPeriod, userId })
    ]);

    // Calcular variação total
    const totalChange = mathModule.percentChange(
      previous.data?.total || 0,
      current.data?.total || 0
    );

    // Comparar categorias
    const categoryComparison = this.compareCategories(
      current.data?.categories || [],
      previous.data?.categories || []
    );

    return {
      success: true,
      currentPeriod: {
        period: currentPeriod,
        total: current.data?.total || 0,
        totalFormatted: current.data?.totalFormatted || 'R$ 0,00'
      },
      previousPeriod: {
        period: previousPeriod,
        total: previous.data?.total || 0,
        totalFormatted: previous.data?.totalFormatted || 'R$ 0,00'
      },
      change: {
        absolute: mathModule.round((current.data?.total || 0) - (previous.data?.total || 0)),
        percentage: mathModule.roundPercent(totalChange),
        trend: totalChange > 0 ? 'aumento' : totalChange < 0 ? 'redução' : 'estável'
      },
      categoryComparison
    };
  }

  /**
   * Busca transações do Finance Bridge
   */
  async fetchTransactions(period, userId, categories) {
    const payload = {
      operation: 'query',
      params: {
        filters: {
          period: { named_period: period },
          type: 'expense'
        },
        sort: { field: 'date', order: 'desc' },
        limit: 500
      },
      context: { user_id: userId }
    };

    // Adicionar filtro de categorias se especificado
    if (categories && categories.length > 0) {
      payload.params.filters.categories = categories;
    }

    const result = await this.financeBridge.process(payload);
    
    if (!result.success) {
      throw new Error(result.error || 'Erro ao buscar transações');
    }

    return result.data?.transactions || result.data || [];
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
          transactions: [],
          total: 0,
          count: 0
        };
      }

      groups[category].transactions.push(tx);
      groups[category].total += Math.abs(tx.amount || 0);
      groups[category].count++;
    }

    return groups;
  }

  /**
   * Calcula totais e percentuais
   */
  calculateTotals(byCategory) {
    const categories = Object.values(byCategory);
    const grandTotal = categories.reduce((sum, cat) => sum + cat.total, 0);

    // Calcular percentual de cada categoria
    const withPercentage = categories.map(cat => ({
      name: cat.name,
      total: mathModule.round(cat.total),
      totalFormatted: mathModule.formatCurrency(cat.total),
      count: cat.count,
      percentage: grandTotal > 0 ? mathModule.roundPercent((cat.total / grandTotal) * 100) : 0,
      average: mathModule.round(cat.total / cat.count)
    }));

    return {
      total: grandTotal,
      categories: withPercentage
    };
  }

  /**
   * Ordena categorias por valor
   */
  sortByAmount(totals) {
    return {
      total: totals.total,
      categories: totals.categories.sort((a, b) => b.total - a.total)
    };
  }

  /**
   * Compara categorias entre períodos
   */
  compareCategories(current, previous) {
    const comparison = [];
    const previousMap = new Map(previous.map(p => [p.name, p]));

    for (const cat of current) {
      const prev = previousMap.get(cat.name);
      const prevTotal = prev?.total || 0;
      const change = mathModule.percentChange(prevTotal, cat.total);

      comparison.push({
        category: cat.name,
        current: cat.total,
        previous: prevTotal,
        change: mathModule.roundPercent(change),
        trend: change > 10 ? 'aumento_significativo' :
               change > 0 ? 'leve_aumento' :
               change < -10 ? 'reducao_significativa' :
               change < 0 ? 'leve_reducao' : 'estavel',
        isNew: !prev
      });
    }

    // Ordenar por maior variação absoluta
    return comparison.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }

  /**
   * Gera breakdown detalhado por categoria
   */
  async breakdown(category, period, userId) {
    const payload = {
      operation: 'query',
      params: {
        filters: {
          period: { named_period: period },
          categories: [category],
          type: 'expense'
        },
        sort: { field: 'amount', order: 'desc' },
        limit: 100
      },
      context: { user_id: userId }
    };

    const result = await this.financeBridge.process(payload);
    
    if (!result.success) {
      throw new Error(result.error || 'Erro ao buscar detalhes');
    }

    const transactions = result.data?.transactions || result.data || [];

    // Agrupar por subcategoria
    const bySubcategory = {};
    for (const tx of transactions) {
      const sub = tx.subcategory || 'Geral';
      if (!bySubcategory[sub]) {
        bySubcategory[sub] = { name: sub, total: 0, count: 0, items: [] };
      }
      bySubcategory[sub].total += Math.abs(tx.amount);
      bySubcategory[sub].count++;
      bySubcategory[sub].items.push({
        description: tx.description,
        amount: tx.amount,
        date: tx.date
      });
    }

    return {
      category,
      period,
      subcategories: Object.values(bySubcategory)
        .map(sub => ({
          ...sub,
          total: mathModule.round(sub.total),
          totalFormatted: mathModule.formatCurrency(sub.total),
          items: sub.items.slice(0, 5) // Top 5 por subcategoria
        }))
        .sort((a, b) => b.total - a.total)
    };
  }
}

module.exports = { SpendingAnalyzer };
