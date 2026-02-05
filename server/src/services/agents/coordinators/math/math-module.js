/**
 * Módulo Matemático (Precision Engine)
 * Fase 5 - Agentes Coordenadores
 * 
 * Fornece cálculos financeiros precisos para os coordenadores.
 * Ativado automaticamente quando a tarefa envolve:
 * - Cálculos com mais de 2 operações encadeadas
 * - Fórmulas financeiras (juros, VPL, TIR)
 * - Projeções financeiras
 * - Análises de risco
 */

const logger = require('../../../../utils/logger');

/**
 * Palavras-chave que ativam o módulo matemático
 */
const MATH_TRIGGERS = [
  // Cálculos financeiros
  'juros', 'composto', 'compostos', 'rendimento', 'rentabilidade',
  'vpl', 'valor presente', 'tir', 'taxa interna',
  'projeção', 'projecao', 'simular', 'simulação',
  // Análises
  'média', 'media', 'variação', 'variacao', 'percentual',
  'crescimento', 'redução', 'comparar', 'diferença',
  // Risco
  'risco', 'var', 'sharpe', 'volatilidade', 'desvio'
];

class MathModule {
  
  constructor() {
    this.precision = 2; // Casas decimais para valores monetários
    this.percentPrecision = 2; // Casas decimais para percentuais
  }

  /**
   * Verifica se o módulo matemático deve ser ativado
   * 
   * @param {string|Object} task - Tarefa ou descrição
   * @returns {boolean} true se deve ativar
   */
  shouldActivate(task) {
    const text = typeof task === 'string' ? task : JSON.stringify(task);
    const lowerText = text.toLowerCase();
    
    return MATH_TRIGGERS.some(trigger => lowerText.includes(trigger));
  }

  // ==================== CÁLCULOS FINANCEIROS ====================

  /**
   * Calcula juros compostos
   * Fórmula: M = P * (1 + r)^n
   * 
   * @param {number} principal - Valor inicial (P)
   * @param {number} rate - Taxa de juros por período (r) - em decimal (0.01 = 1%)
   * @param {number} time - Número de períodos (n)
   * @returns {Object} Resultado detalhado
   */
  calculateCompoundInterest(principal, rate, time) {
    if (principal < 0) throw new Error('Principal não pode ser negativo');
    if (rate < -1) throw new Error('Taxa não pode ser menor que -100%');
    if (time < 0) throw new Error('Tempo não pode ser negativo');

    const finalAmount = principal * Math.pow(1 + rate, time);
    const totalInterest = finalAmount - principal;
    const effectiveRate = Math.pow(1 + rate, time) - 1;

    return {
      principal: this.round(principal),
      rate: this.roundPercent(rate * 100),
      time,
      finalAmount: this.round(finalAmount),
      totalInterest: this.round(totalInterest),
      effectiveRate: this.roundPercent(effectiveRate * 100),
      formula: `${this.formatCurrency(principal)} × (1 + ${this.formatPercentage(rate * 100)})^${time}`,
      steps: [
        `1. Principal: ${this.formatCurrency(principal)}`,
        `2. Taxa por período: ${this.formatPercentage(rate * 100)}`,
        `3. Número de períodos: ${time}`,
        `4. Fator de crescimento: (1 + ${rate.toFixed(4)})^${time} = ${Math.pow(1 + rate, time).toFixed(6)}`,
        `5. Montante final: ${this.formatCurrency(finalAmount)}`,
        `6. Juros totais: ${this.formatCurrency(totalInterest)}`
      ]
    };
  }

  /**
   * Calcula juros compostos com aportes mensais
   * 
   * @param {number} initial - Valor inicial
   * @param {number} monthly - Aporte mensal
   * @param {number} rate - Taxa mensal (decimal)
   * @param {number} months - Número de meses
   * @returns {Object} Resultado detalhado
   */
  calculateCompoundWithContributions(initial, monthly, rate, months) {
    let balance = initial;
    const history = [];

    for (let i = 1; i <= months; i++) {
      // Aplica juros
      const interest = balance * rate;
      balance += interest;
      
      // Adiciona aporte
      balance += monthly;

      if (i <= 12 || i % 12 === 0 || i === months) {
        history.push({
          month: i,
          balance: this.round(balance),
          totalContributed: this.round(initial + (monthly * i)),
          totalInterest: this.round(balance - initial - (monthly * i))
        });
      }
    }

    const totalContributed = initial + (monthly * months);
    const totalInterest = balance - totalContributed;

    return {
      initial: this.round(initial),
      monthly: this.round(monthly),
      rate: this.roundPercent(rate * 100),
      months,
      finalBalance: this.round(balance),
      totalContributed: this.round(totalContributed),
      totalInterest: this.round(totalInterest),
      returnRate: this.roundPercent((totalInterest / totalContributed) * 100),
      history
    };
  }

  /**
   * Calcula Valor Presente Líquido (VPL)
   * 
   * @param {number[]} cashflows - Array de fluxos de caixa (primeiro é o investimento, negativo)
   * @param {number} rate - Taxa de desconto por período (decimal)
   * @returns {Object} Resultado detalhado
   */
  calculateNPV(cashflows, rate) {
    if (!Array.isArray(cashflows) || cashflows.length === 0) {
      throw new Error('Cashflows deve ser um array não vazio');
    }

    let npv = 0;
    const details = [];

    for (let t = 0; t < cashflows.length; t++) {
      const pv = cashflows[t] / Math.pow(1 + rate, t);
      npv += pv;
      details.push({
        period: t,
        cashflow: this.round(cashflows[t]),
        presentValue: this.round(pv)
      });
    }

    return {
      npv: this.round(npv),
      rate: this.roundPercent(rate * 100),
      isViable: npv > 0,
      details,
      interpretation: npv > 0 
        ? `Projeto viável. VPL positivo de ${this.formatCurrency(npv)}`
        : `Projeto inviável. VPL negativo de ${this.formatCurrency(npv)}`
    };
  }

  /**
   * Calcula Taxa Interna de Retorno (TIR)
   * Usa método de Newton-Raphson
   * 
   * @param {number[]} cashflows - Array de fluxos de caixa
   * @param {number} guess - Estimativa inicial (padrão: 0.1 = 10%)
   * @returns {Object} Resultado detalhado
   */
  calculateIRR(cashflows, guess = 0.1) {
    if (!Array.isArray(cashflows) || cashflows.length < 2) {
      throw new Error('Cashflows deve ter ao menos 2 elementos');
    }

    const maxIterations = 100;
    const tolerance = 0.0001;
    let rate = guess;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let derivative = 0;

      for (let t = 0; t < cashflows.length; t++) {
        npv += cashflows[t] / Math.pow(1 + rate, t);
        if (t > 0) {
          derivative -= t * cashflows[t] / Math.pow(1 + rate, t + 1);
        }
      }

      if (Math.abs(npv) < tolerance) {
        return {
          irr: this.roundPercent(rate * 100),
          iterations: i + 1,
          converged: true,
          interpretation: `TIR de ${this.formatPercentage(rate * 100)} ao período`
        };
      }

      if (derivative === 0) break;
      rate = rate - npv / derivative;
    }

    return {
      irr: this.roundPercent(rate * 100),
      iterations: maxIterations,
      converged: false,
      warning: 'Cálculo pode não ter convergido completamente'
    };
  }

  /**
   * Calcula payback simples e descontado
   * 
   * @param {number} investment - Investimento inicial (positivo)
   * @param {number[]} cashflows - Fluxos de caixa dos períodos
   * @param {number} rate - Taxa de desconto (para payback descontado)
   * @returns {Object} Resultado detalhado
   */
  calculatePayback(investment, cashflows, rate = 0) {
    let cumulativeSimple = -investment;
    let cumulativeDiscounted = -investment;
    let paybackSimple = null;
    let paybackDiscounted = null;
    const details = [];

    for (let t = 0; t < cashflows.length; t++) {
      const pv = cashflows[t] / Math.pow(1 + rate, t + 1);
      
      cumulativeSimple += cashflows[t];
      cumulativeDiscounted += pv;

      details.push({
        period: t + 1,
        cashflow: this.round(cashflows[t]),
        cumulativeSimple: this.round(cumulativeSimple),
        cumulativeDiscounted: this.round(cumulativeDiscounted)
      });

      if (paybackSimple === null && cumulativeSimple >= 0) {
        paybackSimple = t + 1;
      }
      if (paybackDiscounted === null && cumulativeDiscounted >= 0) {
        paybackDiscounted = t + 1;
      }
    }

    return {
      investment: this.round(investment),
      paybackSimple: paybackSimple || 'Não recuperado',
      paybackDiscounted: paybackDiscounted || 'Não recuperado',
      details
    };
  }

  // ==================== ANÁLISES DE RISCO ====================

  /**
   * Calcula Value at Risk (VaR) paramétrico
   * 
   * @param {number[]} returns - Array de retornos históricos (decimais)
   * @param {number} confidence - Nível de confiança (ex: 0.95 = 95%)
   * @param {number} portfolio - Valor do portfólio
   * @returns {Object} Resultado detalhado
   */
  calculateVaR(returns, confidence = 0.95, portfolio = 100000) {
    if (!Array.isArray(returns) || returns.length < 2) {
      throw new Error('Returns deve ter ao menos 2 elementos');
    }

    // Calcular média e desvio padrão
    const mean = this.mean(returns);
    const stdDev = this.standardDeviation(returns);

    // Z-score para o nível de confiança
    const zScores = { 0.90: 1.282, 0.95: 1.645, 0.99: 2.326 };
    const z = zScores[confidence] || 1.645;

    // VaR paramétrico
    const varPercent = mean - (z * stdDev);
    const varValue = Math.abs(varPercent * portfolio);

    return {
      var: this.round(varValue),
      varPercent: this.roundPercent(varPercent * 100),
      confidence: this.roundPercent(confidence * 100),
      portfolio: this.round(portfolio),
      mean: this.roundPercent(mean * 100),
      stdDev: this.roundPercent(stdDev * 100),
      interpretation: `Com ${confidence * 100}% de confiança, a perda máxima é de ${this.formatCurrency(varValue)} (${this.formatPercentage(Math.abs(varPercent) * 100)})`
    };
  }

  /**
   * Calcula Sharpe Ratio
   * 
   * @param {number[]} returns - Array de retornos do ativo
   * @param {number} riskFreeRate - Taxa livre de risco do período
   * @returns {Object} Resultado detalhado
   */
  calculateSharpeRatio(returns, riskFreeRate = 0) {
    if (!Array.isArray(returns) || returns.length < 2) {
      throw new Error('Returns deve ter ao menos 2 elementos');
    }

    const meanReturn = this.mean(returns);
    const stdDev = this.standardDeviation(returns);
    
    if (stdDev === 0) {
      return { sharpe: 0, warning: 'Desvio padrão zero' };
    }

    const sharpe = (meanReturn - riskFreeRate) / stdDev;

    let interpretation;
    if (sharpe < 0) interpretation = 'Retorno ajustado ao risco negativo';
    else if (sharpe < 1) interpretation = 'Retorno ajustado ao risco baixo';
    else if (sharpe < 2) interpretation = 'Retorno ajustado ao risco bom';
    else interpretation = 'Retorno ajustado ao risco excelente';

    return {
      sharpe: this.round(sharpe),
      meanReturn: this.roundPercent(meanReturn * 100),
      riskFreeRate: this.roundPercent(riskFreeRate * 100),
      stdDev: this.roundPercent(stdDev * 100),
      interpretation
    };
  }

  // ==================== ESTATÍSTICAS BÁSICAS ====================

  /**
   * Calcula média
   */
  mean(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calcula desvio padrão
   */
  standardDeviation(values) {
    if (values.length < 2) return 0;
    const avg = this.mean(values);
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    const avgSquareDiff = this.mean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Calcula variação percentual
   */
  percentChange(oldValue, newValue) {
    if (oldValue === 0) return newValue > 0 ? Infinity : 0;
    return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
  }

  /**
   * Calcula soma
   */
  sum(values) {
    return values.reduce((sum, v) => sum + v, 0);
  }

  /**
   * Calcula mínimo
   */
  min(values) {
    return Math.min(...values);
  }

  /**
   * Calcula máximo
   */
  max(values) {
    return Math.max(...values);
  }

  // ==================== FORMATAÇÃO ====================

  /**
   * Arredonda valor monetário
   */
  round(value) {
    return Math.round(value * Math.pow(10, this.precision)) / Math.pow(10, this.precision);
  }

  /**
   * Arredonda percentual
   */
  roundPercent(value) {
    return Math.round(value * Math.pow(10, this.percentPrecision)) / Math.pow(10, this.percentPrecision);
  }

  /**
   * Formata valor monetário em BRL
   */
  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  /**
   * Formata percentual
   */
  formatPercentage(value) {
    return `${value.toFixed(this.percentPrecision)}%`;
  }

  /**
   * Formata número com separadores
   */
  formatNumber(value) {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: this.precision,
      maximumFractionDigits: this.precision
    }).format(value);
  }

  // ==================== PROJEÇÕES ====================

  /**
   * Projeta valores futuros baseado em tendência linear
   * 
   * @param {number[]} historicalValues - Valores históricos
   * @param {number} periods - Períodos a projetar
   * @returns {Object} Projeção
   */
  projectLinear(historicalValues, periods) {
    const n = historicalValues.length;
    if (n < 2) throw new Error('Necessário ao menos 2 valores históricos');

    // Calcular regressão linear simples
    const xMean = (n - 1) / 2;
    const yMean = this.mean(historicalValues);
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (historicalValues[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - (slope * xMean);

    // Projetar
    const projections = [];
    for (let i = 0; i < periods; i++) {
      const x = n + i;
      const projected = intercept + (slope * x);
      projections.push({
        period: i + 1,
        value: this.round(projected)
      });
    }

    return {
      trend: slope > 0 ? 'crescente' : slope < 0 ? 'decrescente' : 'estável',
      slope: this.round(slope),
      projections,
      confidence: n >= 6 ? 'alta' : n >= 3 ? 'média' : 'baixa'
    };
  }

  /**
   * Health check do módulo
   */
  healthCheck() {
    try {
      // Teste básico
      const test = this.calculateCompoundInterest(1000, 0.01, 12);
      return {
        status: 'healthy',
        testResult: test.finalAmount > 1000
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

// Exportar instância singleton
const mathModule = new MathModule();

module.exports = {
  MathModule,
  mathModule,
  // Atalhos para funções comuns
  calculateCompoundInterest: (...args) => mathModule.calculateCompoundInterest(...args),
  calculateNPV: (...args) => mathModule.calculateNPV(...args),
  calculateIRR: (...args) => mathModule.calculateIRR(...args),
  formatCurrency: (...args) => mathModule.formatCurrency(...args),
  formatPercentage: (...args) => mathModule.formatPercentage(...args)
};
