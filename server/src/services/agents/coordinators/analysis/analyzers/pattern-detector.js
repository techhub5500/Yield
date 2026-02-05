/**
 * Pattern Detector - Detector de Padrões
 * Fase 5 - Agente de Análise
 * 
 * Responsável por:
 * - Identificar cobranças recorrentes (assinaturas)
 * - Detectar cobranças duplicadas
 * - Identificar tendências de aumento/redução
 * - Detectar gastos sazonais
 */

const logger = require('../../../../../utils/logger');
const { mathModule } = require('../../math/math-module');

/**
 * Tolerância para considerar valores similares (em %)
 */
const AMOUNT_TOLERANCE = 5;

/**
 * Mínimo de ocorrências para considerar recorrente
 */
const MIN_RECURRENCE = 2;

class PatternDetector {
  
  constructor(financeBridge) {
    this.financeBridge = financeBridge;
  }

  /**
   * Detecta todos os padrões em um conjunto de transações
   * 
   * @param {Object} options - Opções de detecção
   * @returns {Promise<Object>} Padrões detectados
   */
  async detectAll(options = {}) {
    const { userId, months = 3 } = options;

    try {
      // Buscar transações dos últimos X meses
      const transactions = await this.fetchTransactions(userId, months);

      if (!transactions || transactions.length === 0) {
        return {
          success: true,
          isEmpty: true,
          patterns: {
            subscriptions: [],
            duplicates: [],
            trends: [],
            seasonal: []
          }
        };
      }

      // Executar detecções em paralelo
      const [subscriptions, duplicates, trends] = await Promise.all([
        this.detectSubscriptions(transactions),
        this.detectDuplicates(transactions),
        this.detectTrends(transactions)
      ]);

      return {
        success: true,
        isEmpty: false,
        analyzedTransactions: transactions.length,
        periodMonths: months,
        patterns: {
          subscriptions,
          duplicates,
          trends
        },
        summary: this.generateSummary({ subscriptions, duplicates, trends })
      };

    } catch (error) {
      logger.error('Erro na detecção de padrões', { error: error.message });
      throw error;
    }
  }

  /**
   * Detecta assinaturas/cobranças recorrentes
   * 
   * @param {Array} transactions - Transações a analisar
   * @returns {Array} Lista de possíveis assinaturas
   */
  async detectSubscriptions(transactions) {
    const subscriptions = [];
    
    // Agrupar por descrição similar e valor similar
    const groups = this.groupBySimilarity(transactions);

    for (const [key, group] of Object.entries(groups)) {
      if (group.occurrences.length >= MIN_RECURRENCE) {
        // Verificar se os intervalos são regulares
        const regularity = this.checkRegularity(group.occurrences);

        if (regularity.isRegular) {
          const avgAmount = mathModule.mean(group.occurrences.map(t => Math.abs(t.amount)));
          
          subscriptions.push({
            description: group.baseDescription,
            category: group.category,
            averageAmount: mathModule.round(avgAmount),
            averageAmountFormatted: mathModule.formatCurrency(avgAmount),
            frequency: regularity.frequency,
            occurrences: group.occurrences.length,
            confidence: regularity.confidence,
            lastCharge: group.occurrences[0]?.date,
            nextExpected: this.predictNextOccurrence(group.occurrences, regularity.frequency),
            monthlyImpact: this.calculateMonthlyImpact(avgAmount, regularity.frequency)
          });
        }
      }
    }

    // Ordenar por impacto mensal
    return subscriptions.sort((a, b) => b.monthlyImpact - a.monthlyImpact);
  }

  /**
   * Detecta cobranças duplicadas
   * 
   * @param {Array} transactions - Transações a analisar
   * @returns {Array} Lista de possíveis duplicatas
   */
  async detectDuplicates(transactions) {
    const duplicates = [];
    const checked = new Set();

    for (let i = 0; i < transactions.length; i++) {
      if (checked.has(i)) continue;

      const tx = transactions[i];
      const potentialDuplicates = [];

      for (let j = i + 1; j < transactions.length; j++) {
        if (checked.has(j)) continue;

        const other = transactions[j];
        
        // Verificar se é potencial duplicata
        if (this.isPotentialDuplicate(tx, other)) {
          potentialDuplicates.push({ index: j, transaction: other });
          checked.add(j);
        }
      }

      if (potentialDuplicates.length > 0) {
        checked.add(i);
        duplicates.push({
          original: {
            id: tx.id,
            description: tx.description,
            amount: tx.amount,
            date: tx.date
          },
          duplicates: potentialDuplicates.map(d => ({
            id: d.transaction.id,
            description: d.transaction.description,
            amount: d.transaction.amount,
            date: d.transaction.date
          })),
          totalDuplicatedAmount: mathModule.round(
            potentialDuplicates.reduce((sum, d) => sum + Math.abs(d.transaction.amount), 0)
          ),
          confidence: this.calculateDuplicateConfidence(tx, potentialDuplicates)
        });
      }
    }

    return duplicates;
  }

  /**
   * Detecta tendências de aumento/redução por categoria
   * 
   * @param {Array} transactions - Transações a analisar
   * @returns {Array} Tendências por categoria
   */
  async detectTrends(transactions) {
    // Agrupar por mês e categoria
    const byMonthCategory = {};

    for (const tx of transactions) {
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const category = tx.category || 'Outros';

      if (!byMonthCategory[category]) {
        byMonthCategory[category] = {};
      }
      if (!byMonthCategory[category][monthKey]) {
        byMonthCategory[category][monthKey] = 0;
      }

      byMonthCategory[category][monthKey] += Math.abs(tx.amount || 0);
    }

    const trends = [];

    for (const [category, months] of Object.entries(byMonthCategory)) {
      const sortedMonths = Object.keys(months).sort();
      
      if (sortedMonths.length >= 2) {
        const values = sortedMonths.map(m => months[m]);
        const trend = this.analyzeTrend(values);

        if (trend.isSignificant) {
          trends.push({
            category,
            trend: trend.direction,
            changePercent: mathModule.roundPercent(trend.changePercent),
            monthlyAverage: mathModule.round(mathModule.mean(values)),
            monthlyAverageFormatted: mathModule.formatCurrency(mathModule.mean(values)),
            months: sortedMonths.length,
            firstMonth: sortedMonths[0],
            lastMonth: sortedMonths[sortedMonths.length - 1],
            values: sortedMonths.map(m => ({
              month: m,
              value: mathModule.round(months[m])
            }))
          });
        }
      }
    }

    // Ordenar por maior variação absoluta
    return trends.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  }

  // ==================== MÉTODOS AUXILIARES ====================

  /**
   * Busca transações dos últimos N meses
   */
  async fetchTransactions(userId, months) {
    const payload = {
      operation: 'query',
      params: {
        filters: {
          period: { named_period: `last_${months}_months` },
          type: 'expense'
        },
        sort: { field: 'date', order: 'desc' },
        limit: 1000
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
   * Agrupa transações por descrição e valor similares
   */
  groupBySimilarity(transactions) {
    const groups = {};

    for (const tx of transactions) {
      // Normalizar descrição
      const normalizedDesc = this.normalizeDescription(tx.description);
      
      // Encontrar grupo existente ou criar novo
      let foundGroup = false;
      
      for (const [key, group] of Object.entries(groups)) {
        if (this.isSimilarDescription(normalizedDesc, group.normalizedDescription) &&
            this.isSimilarAmount(tx.amount, group.averageAmount)) {
          group.occurrences.push(tx);
          group.averageAmount = mathModule.mean(group.occurrences.map(t => Math.abs(t.amount)));
          foundGroup = true;
          break;
        }
      }

      if (!foundGroup) {
        const key = `${normalizedDesc}_${Math.round(Math.abs(tx.amount))}`;
        groups[key] = {
          baseDescription: tx.description,
          normalizedDescription: normalizedDesc,
          category: tx.category,
          averageAmount: Math.abs(tx.amount),
          occurrences: [tx]
        };
      }
    }

    return groups;
  }

  /**
   * Normaliza descrição para comparação
   */
  normalizeDescription(description) {
    if (!description) return '';
    return description
      .toLowerCase()
      .replace(/[0-9]/g, '')  // Remove números
      .replace(/[^a-z\s]/g, '')  // Remove caracteres especiais
      .replace(/\s+/g, ' ')  // Normaliza espaços
      .trim();
  }

  /**
   * Verifica se duas descrições são similares
   */
  isSimilarDescription(desc1, desc2) {
    if (!desc1 || !desc2) return false;
    
    // Distância de Levenshtein simplificada
    const words1 = desc1.split(' ').filter(w => w.length > 2);
    const words2 = desc2.split(' ').filter(w => w.length > 2);
    
    const common = words1.filter(w => words2.includes(w));
    const similarity = common.length / Math.max(words1.length, words2.length);
    
    return similarity >= 0.6;
  }

  /**
   * Verifica se dois valores são similares
   */
  isSimilarAmount(amount1, amount2) {
    const diff = Math.abs(Math.abs(amount1) - Math.abs(amount2));
    const avg = (Math.abs(amount1) + Math.abs(amount2)) / 2;
    
    if (avg === 0) return true;
    
    const percentDiff = (diff / avg) * 100;
    return percentDiff <= AMOUNT_TOLERANCE;
  }

  /**
   * Verifica regularidade das ocorrências
   */
  checkRegularity(occurrences) {
    if (occurrences.length < 2) {
      return { isRegular: false };
    }

    // Ordenar por data
    const sorted = [...occurrences].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    // Calcular intervalos em dias
    const intervals = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = Math.round(
        (new Date(sorted[i].date) - new Date(sorted[i-1].date)) / (1000 * 60 * 60 * 24)
      );
      intervals.push(days);
    }

    if (intervals.length === 0) {
      return { isRegular: false };
    }

    const avgInterval = mathModule.mean(intervals);
    const stdDev = mathModule.standardDeviation(intervals);

    // Determinar frequência
    let frequency;
    if (avgInterval >= 25 && avgInterval <= 35) frequency = 'mensal';
    else if (avgInterval >= 6 && avgInterval <= 8) frequency = 'semanal';
    else if (avgInterval >= 13 && avgInterval <= 16) frequency = 'quinzenal';
    else if (avgInterval >= 85 && avgInterval <= 95) frequency = 'trimestral';
    else if (avgInterval >= 355 && avgInterval <= 375) frequency = 'anual';
    else frequency = 'irregular';

    // Calcular confiança baseada no desvio padrão
    const coefficientOfVariation = avgInterval > 0 ? stdDev / avgInterval : 1;
    const confidence = Math.max(0, 1 - coefficientOfVariation);

    return {
      isRegular: frequency !== 'irregular' && confidence >= 0.6,
      frequency,
      avgInterval: Math.round(avgInterval),
      confidence: mathModule.roundPercent(confidence * 100)
    };
  }

  /**
   * Prediz próxima ocorrência
   */
  predictNextOccurrence(occurrences, frequency) {
    if (occurrences.length === 0) return null;

    const lastDate = new Date(occurrences[0].date);
    const daysToAdd = {
      'semanal': 7,
      'quinzenal': 14,
      'mensal': 30,
      'trimestral': 90,
      'anual': 365
    };

    if (!daysToAdd[frequency]) return null;

    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + daysToAdd[frequency]);

    return nextDate.toISOString().split('T')[0];
  }

  /**
   * Calcula impacto mensal
   */
  calculateMonthlyImpact(amount, frequency) {
    const multiplier = {
      'semanal': 4.33,
      'quinzenal': 2.17,
      'mensal': 1,
      'trimestral': 0.33,
      'anual': 0.083
    };

    return mathModule.round(amount * (multiplier[frequency] || 1));
  }

  /**
   * Verifica se é potencial duplicata
   */
  isPotentialDuplicate(tx1, tx2) {
    // Mesmo valor (tolerância de 1%)
    const sameAmount = Math.abs(Math.abs(tx1.amount) - Math.abs(tx2.amount)) < 
                       Math.abs(tx1.amount) * 0.01;
    
    // Mesma data ou muito próxima (até 3 dias)
    const date1 = new Date(tx1.date);
    const date2 = new Date(tx2.date);
    const daysDiff = Math.abs((date1 - date2) / (1000 * 60 * 60 * 24));
    const closeDate = daysDiff <= 3;

    // Descrição similar
    const similarDesc = this.isSimilarDescription(
      this.normalizeDescription(tx1.description),
      this.normalizeDescription(tx2.description)
    );

    return sameAmount && closeDate && similarDesc;
  }

  /**
   * Calcula confiança de duplicata
   */
  calculateDuplicateConfidence(original, duplicates) {
    let confidence = 50;

    // Mesmo valor exato = +20
    if (duplicates.every(d => d.transaction.amount === original.amount)) {
      confidence += 20;
    }

    // Mesma data = +20
    if (duplicates.every(d => d.transaction.date === original.date)) {
      confidence += 20;
    }

    // Mesma descrição = +10
    if (duplicates.every(d => d.transaction.description === original.description)) {
      confidence += 10;
    }

    return Math.min(100, confidence);
  }

  /**
   * Analisa tendência de valores
   */
  analyzeTrend(values) {
    if (values.length < 2) {
      return { isSignificant: false };
    }

    const first = values[0];
    const last = values[values.length - 1];
    const changePercent = mathModule.percentChange(first, last);

    // Verificar consistência da tendência
    let increases = 0;
    let decreases = 0;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i-1]) increases++;
      else if (values[i] < values[i-1]) decreases++;
    }

    const direction = increases > decreases ? 'crescente' :
                      decreases > increases ? 'decrescente' : 'estável';

    // Tendência é significativa se > 10% de variação
    const isSignificant = Math.abs(changePercent) > 10;

    return {
      isSignificant,
      direction,
      changePercent,
      consistency: Math.max(increases, decreases) / (values.length - 1)
    };
  }

  /**
   * Gera resumo dos padrões detectados
   */
  generateSummary(patterns) {
    const { subscriptions, duplicates, trends } = patterns;

    const totalSubscriptionCost = subscriptions.reduce(
      (sum, s) => sum + s.monthlyImpact, 0
    );

    const totalDuplicatedAmount = duplicates.reduce(
      (sum, d) => sum + d.totalDuplicatedAmount, 0
    );

    const significantTrends = trends.filter(t => Math.abs(t.changePercent) > 20);

    return {
      subscriptions: {
        count: subscriptions.length,
        monthlyTotal: mathModule.round(totalSubscriptionCost),
        monthlyTotalFormatted: mathModule.formatCurrency(totalSubscriptionCost)
      },
      duplicates: {
        count: duplicates.length,
        potentialSavings: mathModule.round(totalDuplicatedAmount),
        potentialSavingsFormatted: mathModule.formatCurrency(totalDuplicatedAmount)
      },
      trends: {
        increasing: trends.filter(t => t.trend === 'crescente').length,
        decreasing: trends.filter(t => t.trend === 'decrescente').length,
        significantAlerts: significantTrends.length
      }
    };
  }
}

module.exports = { PatternDetector };
