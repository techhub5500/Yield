/**
 * Investment Calculator - Calculadora de Investimentos
 * Fase 5 - Agentes Coordenadores
 * 
 * Realiza cálculos de investimentos: juros compostos,
 * TIR, VPL, comparativos e projeções.
 */

const { logger } = require('../../../../../utils/logger');
const { mathModule } = require('../../math/math-module');

class InvestmentCalculator {
  constructor() {
    // Taxas de referência
    this.benchmarks = {
      selic: 0.1075,      // Taxa Selic (10.75% a.a.)
      ipca: 0.0453,       // IPCA últimos 12 meses
      cdi: 0.1065,        // CDI (próximo da Selic)
      poupanca: 0.0706    // Poupança (TR + 70% Selic quando Selic > 8.5%)
    };
  }

  /**
   * Calcula rendimento de investimento
   * 
   * @param {Object} params - Parâmetros
   * @returns {Object} Resultado
   */
  calculate(params) {
    const {
      initialAmount = 0,
      monthlyContribution = 0,
      annualRate,
      period, // em meses
      type = 'prefixado',
      inflationAdjusted = false
    } = params;

    logger.debug('InvestmentCalculator: Calculando investimento', {
      initialAmount,
      monthlyContribution,
      annualRate,
      period
    });

    const monthlyRate = annualRate / 100 / 12;
    
    // Valor futuro com aportes mensais
    let balance = initialAmount;
    const evolution = [];
    let totalContributed = initialAmount;

    for (let month = 1; month <= period; month++) {
      // Rendimento do mês
      const monthlyEarning = balance * monthlyRate;
      balance = balance + monthlyEarning + monthlyContribution;
      totalContributed += monthlyContribution;

      // Registro anual
      if (month % 12 === 0 || month === period) {
        evolution.push({
          month,
          year: Math.ceil(month / 12),
          balance: Math.round(balance * 100) / 100,
          contributed: totalContributed,
          earnings: balance - totalContributed,
          formatted: {
            balance: mathModule.formatCurrency(balance),
            earnings: mathModule.formatCurrency(balance - totalContributed)
          }
        });
      }
    }

    // Ajustar para inflação se solicitado
    let realReturn = null;
    if (inflationAdjusted) {
      const inflationFactor = Math.pow(1 + this.benchmarks.ipca, period / 12);
      const realBalance = balance / inflationFactor;
      realReturn = {
        nominalBalance: balance,
        realBalance,
        inflationImpact: balance - realBalance,
        formatted: {
          nominal: mathModule.formatCurrency(balance),
          real: mathModule.formatCurrency(realBalance),
          impact: mathModule.formatCurrency(balance - realBalance)
        }
      };
    }

    const totalEarnings = balance - totalContributed;
    const effectiveRate = totalContributed > 0 
      ? Math.pow(balance / initialAmount, 12 / period) - 1 
      : 0;

    return {
      params: {
        initialAmount: mathModule.formatCurrency(initialAmount),
        monthlyContribution: mathModule.formatCurrency(monthlyContribution),
        annualRate: `${annualRate}%`,
        period: `${period} meses (${(period/12).toFixed(1)} anos)`
      },
      result: {
        finalBalance: {
          value: balance,
          formatted: mathModule.formatCurrency(balance)
        },
        totalContributed: {
          value: totalContributed,
          formatted: mathModule.formatCurrency(totalContributed)
        },
        totalEarnings: {
          value: totalEarnings,
          formatted: mathModule.formatCurrency(totalEarnings)
        },
        returnPercentage: {
          total: (totalEarnings / totalContributed) * 100,
          annualized: effectiveRate * 100
        }
      },
      evolution,
      realReturn,
      calculatedAt: new Date().toISOString()
    };
  }

  /**
   * Compara múltiplos investimentos
   * 
   * @param {Object} params - Parâmetros
   * @returns {Object} Comparação
   */
  compare(params) {
    const {
      initialAmount = 0,
      monthlyContribution = 0,
      period,
      investments
    } = params;

    logger.info('InvestmentCalculator: Comparando investimentos', {
      count: investments.length
    });

    const results = investments.map(inv => {
      const result = this.calculate({
        initialAmount,
        monthlyContribution,
        annualRate: inv.annualRate,
        period,
        type: inv.type
      });

      // Aplicar IR se aplicável
      let netBalance = result.result.finalBalance.value;
      let taxPaid = 0;

      if (inv.taxable !== false) {
        const grossEarnings = result.result.totalEarnings.value;
        const irRate = this._getIRRate(period, inv.type);
        taxPaid = grossEarnings * irRate;
        netBalance = result.result.finalBalance.value - taxPaid;
      }

      return {
        name: inv.name,
        type: inv.type,
        annualRate: inv.annualRate,
        grossBalance: result.result.finalBalance.value,
        netBalance,
        taxPaid,
        netEarnings: netBalance - result.result.totalContributed.value,
        formatted: {
          gross: mathModule.formatCurrency(result.result.finalBalance.value),
          net: mathModule.formatCurrency(netBalance),
          tax: mathModule.formatCurrency(taxPaid),
          netEarnings: mathModule.formatCurrency(netBalance - result.result.totalContributed.value)
        }
      };
    });

    // Ordenar por retorno líquido
    results.sort((a, b) => b.netBalance - a.netBalance);

    // Adicionar ranking
    results.forEach((r, i) => {
      r.rank = i + 1;
      r.differenceFromBest = i === 0 ? 0 : results[0].netBalance - r.netBalance;
      r.differenceFormatted = mathModule.formatCurrency(r.differenceFromBest);
    });

    return {
      params: {
        initialAmount: mathModule.formatCurrency(initialAmount),
        monthlyContribution: mathModule.formatCurrency(monthlyContribution),
        period: `${period} meses`
      },
      results,
      winner: results[0],
      summary: `${results[0].name} oferece o melhor retorno líquido: ${results[0].formatted.net}`,
      calculatedAt: new Date().toISOString()
    };
  }

  /**
   * Calcula tempo para atingir meta
   * 
   * @param {Object} params - Parâmetros
   * @returns {Object} Resultado
   */
  timeToGoal(params) {
    const {
      targetAmount,
      initialAmount = 0,
      monthlyContribution,
      annualRate
    } = params;

    if (!monthlyContribution && !initialAmount) {
      throw new Error('Precisa de aporte inicial ou contribuição mensal');
    }

    const monthlyRate = annualRate / 100 / 12;
    let balance = initialAmount;
    let months = 0;
    const maxMonths = 1200; // Limite de 100 anos

    while (balance < targetAmount && months < maxMonths) {
      balance = balance * (1 + monthlyRate) + monthlyContribution;
      months++;
    }

    if (months >= maxMonths) {
      return {
        reachable: false,
        message: 'Meta inatingível com os parâmetros fornecidos'
      };
    }

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    const totalContributed = initialAmount + (monthlyContribution * months);

    return {
      reachable: true,
      months,
      years,
      remainingMonths,
      formatted: years > 0 
        ? `${years} ano(s) e ${remainingMonths} mês(es)` 
        : `${months} mês(es)`,
      finalBalance: {
        value: balance,
        formatted: mathModule.formatCurrency(balance)
      },
      totalContributed: {
        value: totalContributed,
        formatted: mathModule.formatCurrency(totalContributed)
      },
      targetAmount: {
        value: targetAmount,
        formatted: mathModule.formatCurrency(targetAmount)
      }
    };
  }

  /**
   * Calcula contribuição necessária para atingir meta
   * 
   * @param {Object} params - Parâmetros
   * @returns {Object} Resultado
   */
  requiredContribution(params) {
    const {
      targetAmount,
      initialAmount = 0,
      period, // meses
      annualRate
    } = params;

    const monthlyRate = annualRate / 100 / 12;
    
    // Fórmula PMT
    // FV = PV(1+r)^n + PMT * ((1+r)^n - 1) / r
    // PMT = (FV - PV(1+r)^n) * r / ((1+r)^n - 1)
    
    const compoundFactor = Math.pow(1 + monthlyRate, period);
    const futureValueOfPrincipal = initialAmount * compoundFactor;
    
    if (futureValueOfPrincipal >= targetAmount) {
      return {
        requiredContribution: 0,
        message: 'Valor inicial já atinge a meta apenas com rendimentos',
        finalBalance: futureValueOfPrincipal
      };
    }

    const remainingNeeded = targetAmount - futureValueOfPrincipal;
    const annuityFactor = (compoundFactor - 1) / monthlyRate;
    const monthlyContribution = remainingNeeded / annuityFactor;

    const totalContributed = initialAmount + (monthlyContribution * period);

    return {
      requiredContribution: {
        monthly: monthlyContribution,
        formatted: mathModule.formatCurrency(monthlyContribution)
      },
      totalContributed: {
        value: totalContributed,
        formatted: mathModule.formatCurrency(totalContributed)
      },
      targetAmount: {
        value: targetAmount,
        formatted: mathModule.formatCurrency(targetAmount)
      },
      totalEarnings: {
        value: targetAmount - totalContributed,
        formatted: mathModule.formatCurrency(targetAmount - totalContributed)
      },
      period: `${period} meses`
    };
  }

  /**
   * Simula cenários de taxa
   * 
   * @param {Object} params - Parâmetros
   * @returns {Object} Cenários
   */
  rateScenarios(params) {
    const {
      initialAmount,
      monthlyContribution,
      period,
      rates = [6, 8, 10, 12, 15]
    } = params;

    const scenarios = rates.map(rate => {
      const result = this.calculate({
        initialAmount,
        monthlyContribution,
        annualRate: rate,
        period
      });

      return {
        rate: `${rate}%`,
        finalBalance: result.result.finalBalance.formatted,
        earnings: result.result.totalEarnings.formatted,
        value: result.result.finalBalance.value
      };
    });

    return {
      params: {
        initialAmount: mathModule.formatCurrency(initialAmount),
        monthlyContribution: mathModule.formatCurrency(monthlyContribution),
        period: `${period} meses`
      },
      scenarios,
      insight: this._generateRateInsight(scenarios)
    };
  }

  /**
   * Compara com benchmarks (Selic, CDI, Poupança)
   * 
   * @param {Object} investment - Investimento
   * @returns {Object} Comparação
   */
  compareWithBenchmarks(investment) {
    const { initialAmount, monthlyContribution, period, annualRate, name } = investment;

    const benchmarkResults = [
      { name: 'Seu investimento', annualRate, taxable: true },
      { name: 'Selic (Tesouro)', annualRate: this.benchmarks.selic * 100, type: 'tesouro', taxable: true },
      { name: 'CDI (CDB 100%)', annualRate: this.benchmarks.cdi * 100, type: 'cdb', taxable: true },
      { name: 'Poupança', annualRate: this.benchmarks.poupanca * 100, type: 'poupanca', taxable: false }
    ];

    return this.compare({
      initialAmount,
      monthlyContribution,
      period,
      investments: benchmarkResults
    });
  }

  /**
   * Obtém taxa de IR
   */
  _getIRRate(periodMonths, type) {
    // Isentos
    if (['lci', 'lca', 'poupanca'].includes(type?.toLowerCase())) {
      return 0;
    }

    // Tabela regressiva
    if (periodMonths <= 6) return 0.225;
    if (periodMonths <= 12) return 0.20;
    if (periodMonths <= 24) return 0.175;
    return 0.15;
  }

  /**
   * Gera insight sobre cenários de taxa
   */
  _generateRateInsight(scenarios) {
    const lowest = scenarios[0];
    const highest = scenarios[scenarios.length - 1];
    const diff = highest.value - lowest.value;

    return `A diferença entre ${lowest.rate} e ${highest.rate} é de ${mathModule.formatCurrency(diff)}. ` +
           `Cada 1% a mais representa aproximadamente ${mathModule.formatCurrency(diff / (parseFloat(highest.rate) - parseFloat(lowest.rate)))}.`;
  }

  /**
   * Calcula rentabilidade efetiva
   * 
   * @param {Object} params - Parâmetros
   * @returns {Object} Rentabilidade
   */
  effectiveReturn(params) {
    const {
      initialValue,
      finalValue,
      periodMonths,
      contributions = [] // Array de { month, value }
    } = params;

    // Cálculo simples sem considerar contribuições
    const simpleReturn = (finalValue - initialValue) / initialValue;
    const annualizedSimple = Math.pow(1 + simpleReturn, 12 / periodMonths) - 1;

    // Se houver contribuições, calcular TIR
    let irr = null;
    if (contributions.length > 0) {
      // Montar fluxo de caixa
      const cashflows = [-initialValue];
      contributions.forEach(c => cashflows.push(-c.value));
      cashflows.push(finalValue);

      irr = mathModule.calculateIRR(cashflows);
    }

    return {
      simple: {
        totalReturn: simpleReturn * 100,
        annualized: annualizedSimple * 100,
        formatted: `${(annualizedSimple * 100).toFixed(2)}% a.a.`
      },
      irr: irr ? {
        monthly: irr * 100,
        annualized: (Math.pow(1 + irr, 12) - 1) * 100,
        formatted: `${((Math.pow(1 + irr, 12) - 1) * 100).toFixed(2)}% a.a.`
      } : null
    };
  }
}

module.exports = { InvestmentCalculator };
