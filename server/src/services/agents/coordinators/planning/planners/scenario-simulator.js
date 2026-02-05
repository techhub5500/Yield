/**
 * Scenario Simulator - Simulador de Cenários
 * Fase 5 - Agentes Coordenadores
 * 
 * Simula diferentes cenários financeiros para apoiar
 * tomada de decisão e planejamento.
 */

const { logger } = require('../../../../../utils/logger');
const { mathModule } = require('../../math/math-module');

/**
 * Tipos de cenários suportados
 */
const SCENARIO_TYPES = {
  INCOME_CHANGE: 'mudança_renda',
  EXPENSE_CHANGE: 'mudança_despesa',
  NEW_EXPENSE: 'nova_despesa',
  INVESTMENT: 'investimento',
  LOAN: 'empréstimo',
  GOAL_ANALYSIS: 'análise_meta',
  EMERGENCY: 'emergência',
  COMPARISON: 'comparação',
  CUSTOM: 'personalizado'
};

class ScenarioSimulator {
  constructor(financeBridge) {
    this.financeBridge = financeBridge;
  }

  /**
   * Simula um cenário
   * 
   * @param {Object} scenario - Configuração do cenário
   * @returns {Promise<Object>} Resultado da simulação
   */
  async simulate(scenario) {
    const { type, params, baseline = null } = scenario;

    logger.info('ScenarioSimulator: Iniciando simulação', { type });

    try {
      // Obter baseline se não fornecido
      const baselineData = baseline || await this._getBaseline(params.userId);

      let result;

      switch (type) {
        case SCENARIO_TYPES.INCOME_CHANGE:
          result = this._simulateIncomeChange(baselineData, params);
          break;
        case SCENARIO_TYPES.EXPENSE_CHANGE:
          result = this._simulateExpenseChange(baselineData, params);
          break;
        case SCENARIO_TYPES.NEW_EXPENSE:
          result = this._simulateNewExpense(baselineData, params);
          break;
        case SCENARIO_TYPES.INVESTMENT:
          result = this._simulateInvestment(baselineData, params);
          break;
        case SCENARIO_TYPES.LOAN:
          result = this._simulateLoan(baselineData, params);
          break;
        case SCENARIO_TYPES.GOAL_ANALYSIS:
          result = this._simulateGoalScenarios(baselineData, params);
          break;
        case SCENARIO_TYPES.EMERGENCY:
          result = this._simulateEmergency(baselineData, params);
          break;
        case SCENARIO_TYPES.COMPARISON:
          result = await this._simulateComparison(baselineData, params);
          break;
        default:
          result = this._simulateCustom(baselineData, params);
      }

      return {
        type,
        simulatedAt: new Date().toISOString(),
        baseline: {
          monthlyIncome: baselineData.monthlyIncome,
          monthlyExpenses: baselineData.monthlyExpenses,
          monthlySavings: baselineData.monthlySavings
        },
        result
      };

    } catch (error) {
      logger.error('ScenarioSimulator: Erro na simulação', { error: error.message });
      throw error;
    }
  }

  /**
   * Obtém baseline financeiro
   */
  async _getBaseline(userId) {
    // Buscar dados dos últimos 3 meses
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const [incomeResult, expenseResult] = await Promise.all([
      this.financeBridge.query({
        userId,
        type: 'receita',
        startDate: threeMonthsAgo.toISOString()
      }),
      this.financeBridge.query({
        userId,
        type: 'despesa',
        startDate: threeMonthsAgo.toISOString()
      })
    ]);

    const totalIncome = incomeResult.success 
      ? incomeResult.data.reduce((sum, t) => sum + t.value, 0) 
      : 0;
    
    const totalExpenses = expenseResult.success 
      ? expenseResult.data.reduce((sum, t) => sum + t.value, 0) 
      : 0;

    const monthlyIncome = totalIncome / 3;
    const monthlyExpenses = totalExpenses / 3;

    return {
      userId,
      monthlyIncome,
      monthlyExpenses,
      monthlySavings: monthlyIncome - monthlyExpenses,
      savingsRate: monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0
    };
  }

  /**
   * Simula mudança de renda
   */
  _simulateIncomeChange(baseline, params) {
    const { 
      changeType = 'percentage', 
      value, 
      duration = 12 // meses
    } = params;

    let newIncome;
    if (changeType === 'percentage') {
      newIncome = baseline.monthlyIncome * (1 + value / 100);
    } else {
      newIncome = baseline.monthlyIncome + value;
    }

    const newSavings = newIncome - baseline.monthlyExpenses;
    const savingsChange = newSavings - baseline.monthlySavings;

    // Projeção ao longo do tempo
    const projections = [];
    let cumulativeSavings = 0;
    let cumulativeOldSavings = 0;

    for (let month = 1; month <= duration; month++) {
      cumulativeSavings += newSavings;
      cumulativeOldSavings += baseline.monthlySavings;
      
      projections.push({
        month,
        newSavings: cumulativeSavings,
        oldSavings: cumulativeOldSavings,
        difference: cumulativeSavings - cumulativeOldSavings
      });
    }

    return {
      scenario: {
        description: value > 0 ? 'Aumento de renda' : 'Redução de renda',
        changeType,
        value,
        duration
      },
      impact: {
        newMonthlyIncome: {
          value: newIncome,
          formatted: mathModule.formatCurrency(newIncome)
        },
        previousIncome: {
          value: baseline.monthlyIncome,
          formatted: mathModule.formatCurrency(baseline.monthlyIncome)
        },
        incomeChange: {
          absolute: newIncome - baseline.monthlyIncome,
          formatted: mathModule.formatCurrency(newIncome - baseline.monthlyIncome),
          percentage: ((newIncome - baseline.monthlyIncome) / baseline.monthlyIncome) * 100
        },
        newMonthlySavings: {
          value: newSavings,
          formatted: mathModule.formatCurrency(newSavings)
        },
        savingsChange: {
          absolute: savingsChange,
          formatted: mathModule.formatCurrency(savingsChange),
          percentage: baseline.monthlySavings > 0 
            ? (savingsChange / baseline.monthlySavings) * 100 
            : 100
        },
        newSavingsRate: (newSavings / newIncome) * 100
      },
      projections,
      totalImpact: {
        additionalSavings: savingsChange * duration,
        formatted: mathModule.formatCurrency(savingsChange * duration)
      },
      recommendation: this._getIncomeChangeRecommendation(value, newSavings)
    };
  }

  /**
   * Simula mudança de despesas
   */
  _simulateExpenseChange(baseline, params) {
    const { 
      category = null,
      changeType = 'percentage', 
      value,
      duration = 12
    } = params;

    let newExpenses;
    if (changeType === 'percentage') {
      newExpenses = baseline.monthlyExpenses * (1 + value / 100);
    } else {
      newExpenses = baseline.monthlyExpenses + value;
    }

    const newSavings = baseline.monthlyIncome - newExpenses;
    const savingsChange = newSavings - baseline.monthlySavings;

    return {
      scenario: {
        description: category 
          ? `Mudança em ${category}` 
          : 'Mudança geral de despesas',
        category,
        changeType,
        value,
        duration
      },
      impact: {
        newMonthlyExpenses: {
          value: newExpenses,
          formatted: mathModule.formatCurrency(newExpenses)
        },
        previousExpenses: {
          value: baseline.monthlyExpenses,
          formatted: mathModule.formatCurrency(baseline.monthlyExpenses)
        },
        expenseChange: {
          absolute: newExpenses - baseline.monthlyExpenses,
          formatted: mathModule.formatCurrency(newExpenses - baseline.monthlyExpenses)
        },
        newMonthlySavings: {
          value: newSavings,
          formatted: mathModule.formatCurrency(newSavings)
        },
        savingsImpact: {
          absolute: savingsChange,
          formatted: mathModule.formatCurrency(savingsChange)
        }
      },
      warning: newSavings < 0 
        ? `⚠️ Cenário resulta em déficit de ${mathModule.formatCurrency(Math.abs(newSavings))}/mês` 
        : null,
      totalImpact: {
        over: `${duration} meses`,
        value: savingsChange * duration,
        formatted: mathModule.formatCurrency(savingsChange * duration)
      }
    };
  }

  /**
   * Simula nova despesa
   */
  _simulateNewExpense(baseline, params) {
    const {
      description,
      value,
      isRecurring = true,
      frequency = 'mensal',
      duration = 12 // meses para despesa recorrente
    } = params;

    const monthlyImpact = isRecurring 
      ? (frequency === 'mensal' ? value : value / 12)
      : value / duration;

    const newExpenses = baseline.monthlyExpenses + monthlyImpact;
    const newSavings = baseline.monthlyIncome - newExpenses;

    // Análise de viabilidade
    const savingsAfter = baseline.monthlySavings - monthlyImpact;
    const viability = {
      canAfford: savingsAfter >= 0,
      impactOnSavingsRate: ((baseline.monthlySavings - savingsAfter) / baseline.monthlySavings) * 100,
      remainingSavings: savingsAfter
    };

    // Alternativas se não puder
    const alternatives = [];
    if (!viability.canAfford) {
      alternatives.push({
        option: 'Reduzir outras despesas',
        required: monthlyImpact - baseline.monthlySavings
      });
      alternatives.push({
        option: 'Aumentar renda',
        required: monthlyImpact - baseline.monthlySavings
      });
      alternatives.push({
        option: 'Parcelar/Financiar',
        suggestion: `Dividir em ${Math.ceil(value / (baseline.monthlySavings * 0.5))} parcelas`
      });
    }

    return {
      scenario: {
        description: `Nova despesa: ${description || 'Não especificado'}`,
        value,
        isRecurring,
        frequency,
        duration
      },
      impact: {
        monthlyImpact: {
          value: monthlyImpact,
          formatted: mathModule.formatCurrency(monthlyImpact)
        },
        newMonthlySavings: {
          value: newSavings,
          formatted: mathModule.formatCurrency(newSavings)
        },
        savingsReduction: {
          absolute: monthlyImpact,
          percentage: (monthlyImpact / baseline.monthlySavings) * 100
        }
      },
      viability: {
        ...viability,
        status: viability.canAfford ? 'Viável' : 'Inviável sem ajustes',
        remainingFormatted: mathModule.formatCurrency(savingsAfter)
      },
      alternatives: viability.canAfford ? [] : alternatives,
      recommendation: viability.canAfford
        ? `Despesa comportável. Sua nova taxa de poupança será ${((newSavings / baseline.monthlyIncome) * 100).toFixed(1)}%`
        : `Despesa excede sua capacidade atual. Considere as alternativas sugeridas.`
    };
  }

  /**
   * Simula investimento
   */
  _simulateInvestment(baseline, params) {
    const {
      initialAmount = 0,
      monthlyContribution,
      annualRate = 10, // % ao ano
      years = 5,
      compounding = 'mensal'
    } = params;

    const contribution = monthlyContribution || baseline.monthlySavings * 0.5;
    const monthlyRate = annualRate / 100 / 12;
    const months = years * 12;

    // Simular evolução
    const evolution = [];
    let balance = initialAmount;
    let totalContributed = initialAmount;

    for (let month = 1; month <= months; month++) {
      balance = balance * (1 + monthlyRate) + contribution;
      totalContributed += contribution;

      if (month % 12 === 0) {
        evolution.push({
          year: month / 12,
          balance: Math.round(balance * 100) / 100,
          contributed: totalContributed,
          earnings: balance - totalContributed
        });
      }
    }

    // Comparação com diferentes taxas
    const comparisons = [6, 8, 10, 12, 15].map(rate => {
      const futureValue = mathModule.calculateFutureValue(
        initialAmount, 
        contribution, 
        rate / 100 / 12, 
        months
      );
      return {
        rate: `${rate}% a.a.`,
        finalValue: futureValue,
        formatted: mathModule.formatCurrency(futureValue)
      };
    });

    return {
      scenario: {
        description: 'Simulação de investimento',
        initialAmount,
        monthlyContribution: contribution,
        annualRate: `${annualRate}%`,
        period: `${years} anos`
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
          value: balance - totalContributed,
          formatted: mathModule.formatCurrency(balance - totalContributed)
        },
        returnPercentage: ((balance - totalContributed) / totalContributed) * 100
      },
      evolution,
      comparisons,
      viability: {
        canAfford: contribution <= baseline.monthlySavings,
        percentOfSavings: (contribution / baseline.monthlySavings) * 100
      }
    };
  }

  /**
   * Simula empréstimo/financiamento
   */
  _simulateLoan(baseline, params) {
    const {
      principal,
      annualRate = 12,
      termMonths = 36,
      type = 'price' // price ou sac
    } = params;

    const monthlyRate = annualRate / 100 / 12;
    
    let monthlyPayment;
    let totalPaid;
    let totalInterest;
    const amortizationTable = [];

    if (type === 'price') {
      // Parcela fixa (Tabela Price)
      monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
                       (Math.pow(1 + monthlyRate, termMonths) - 1);
      totalPaid = monthlyPayment * termMonths;
      totalInterest = totalPaid - principal;

      let remainingBalance = principal;
      for (let month = 1; month <= Math.min(termMonths, 12); month++) {
        const interestPayment = remainingBalance * monthlyRate;
        const principalPayment = monthlyPayment - interestPayment;
        remainingBalance -= principalPayment;

        amortizationTable.push({
          month,
          payment: monthlyPayment,
          principal: principalPayment,
          interest: interestPayment,
          balance: remainingBalance
        });
      }
    } else {
      // SAC - Amortização constante
      const principalPayment = principal / termMonths;
      let remainingBalance = principal;
      totalPaid = 0;

      for (let month = 1; month <= termMonths; month++) {
        const interestPayment = remainingBalance * monthlyRate;
        const payment = principalPayment + interestPayment;
        remainingBalance -= principalPayment;
        totalPaid += payment;

        if (month <= 12) {
          amortizationTable.push({
            month,
            payment,
            principal: principalPayment,
            interest: interestPayment,
            balance: remainingBalance
          });
        }
      }

      monthlyPayment = amortizationTable[0].payment; // Primeira parcela (maior)
      totalInterest = totalPaid - principal;
    }

    // Impacto no orçamento
    const newSavings = baseline.monthlySavings - monthlyPayment;
    const viability = {
      canAfford: monthlyPayment <= baseline.monthlySavings * 0.7, // Máx 70% das economias
      percentOfIncome: (monthlyPayment / baseline.monthlyIncome) * 100,
      percentOfSavings: (monthlyPayment / baseline.monthlySavings) * 100
    };

    return {
      scenario: {
        description: `Empréstimo de ${mathModule.formatCurrency(principal)}`,
        type: type === 'price' ? 'Tabela Price' : 'SAC',
        principal,
        annualRate: `${annualRate}%`,
        termMonths
      },
      result: {
        monthlyPayment: {
          value: monthlyPayment,
          formatted: mathModule.formatCurrency(monthlyPayment),
          note: type === 'sac' ? 'Primeira parcela (maior valor)' : 'Parcela fixa'
        },
        totalPaid: {
          value: totalPaid,
          formatted: mathModule.formatCurrency(totalPaid)
        },
        totalInterest: {
          value: totalInterest,
          formatted: mathModule.formatCurrency(totalInterest),
          percentOfPrincipal: (totalInterest / principal) * 100
        }
      },
      amortizationTable: amortizationTable.map(row => ({
        ...row,
        paymentFormatted: mathModule.formatCurrency(row.payment),
        balanceFormatted: mathModule.formatCurrency(row.balance)
      })),
      impact: {
        newMonthlySavings: {
          value: newSavings,
          formatted: mathModule.formatCurrency(newSavings)
        },
        savingsReduction: mathModule.formatCurrency(monthlyPayment)
      },
      viability: {
        ...viability,
        status: viability.canAfford ? 'Viável' : 'Comprometeria demais o orçamento',
        warning: viability.percentOfIncome > 30 
          ? '⚠️ Parcela acima de 30% da renda' 
          : null
      }
    };
  }

  /**
   * Simula cenários para meta
   */
  _simulateGoalScenarios(baseline, params) {
    const {
      targetAmount,
      currentAmount = 0,
      targetDate = null,
      monthlyContribution = null
    } = params;

    const remaining = targetAmount - currentAmount;
    const scenarios = [];

    // Cenário 1: Usando toda a capacidade de poupança
    const maxCapacity = baseline.monthlySavings;
    const monthsWithMax = remaining / maxCapacity;
    scenarios.push({
      name: 'Capacidade máxima',
      monthlyContribution: maxCapacity,
      formatted: mathModule.formatCurrency(maxCapacity),
      monthsNeeded: Math.ceil(monthsWithMax),
      completionDate: this._addMonths(new Date(), Math.ceil(monthsWithMax)),
      viability: 'Usa 100% da poupança disponível'
    });

    // Cenário 2: 50% da capacidade
    const halfCapacity = baseline.monthlySavings * 0.5;
    const monthsWithHalf = remaining / halfCapacity;
    scenarios.push({
      name: 'Ritmo moderado',
      monthlyContribution: halfCapacity,
      formatted: mathModule.formatCurrency(halfCapacity),
      monthsNeeded: Math.ceil(monthsWithHalf),
      completionDate: this._addMonths(new Date(), Math.ceil(monthsWithHalf)),
      viability: 'Usa 50% da poupança, permite outras metas'
    });

    // Cenário 3: Contribuição especificada
    if (monthlyContribution) {
      const monthsWithCustom = remaining / monthlyContribution;
      scenarios.push({
        name: 'Contribuição desejada',
        monthlyContribution,
        formatted: mathModule.formatCurrency(monthlyContribution),
        monthsNeeded: Math.ceil(monthsWithCustom),
        completionDate: this._addMonths(new Date(), Math.ceil(monthsWithCustom)),
        viability: monthlyContribution <= baseline.monthlySavings ? 'Viável' : 'Excede capacidade atual'
      });
    }

    // Cenário 4: Para atingir na data alvo
    if (targetDate) {
      const monthsUntilTarget = this._monthsUntil(targetDate);
      if (monthsUntilTarget > 0) {
        const requiredContribution = remaining / monthsUntilTarget;
        scenarios.push({
          name: 'Para atingir na data',
          monthlyContribution: requiredContribution,
          formatted: mathModule.formatCurrency(requiredContribution),
          monthsNeeded: monthsUntilTarget,
          completionDate: new Date(targetDate),
          viability: requiredContribution <= baseline.monthlySavings 
            ? 'Viável no prazo' 
            : 'Necessário aumentar renda ou revisar meta'
        });
      }
    }

    return {
      goal: {
        target: targetAmount,
        current: currentAmount,
        remaining,
        targetDate
      },
      scenarios,
      recommendation: this._getGoalRecommendation(scenarios, baseline)
    };
  }

  /**
   * Simula emergência financeira
   */
  _simulateEmergency(baseline, params) {
    const {
      amount,
      description = 'Emergência'
    } = params;

    // Quanto tempo leva para cobrir
    const monthsToRecover = amount / baseline.monthlySavings;
    
    // Impacto em reserva existente
    const currentReserve = params.currentReserve || baseline.monthlySavings * 3;
    const reserveAfter = currentReserve - amount;

    // Opções de cobertura
    const options = [];

    // Opção 1: Usar reserva
    if (currentReserve >= amount) {
      options.push({
        name: 'Usar reserva de emergência',
        impact: `Reserva cai para ${mathModule.formatCurrency(reserveAfter)}`,
        recoveryTime: `${Math.ceil(monthsToRecover)} meses para recompor`,
        recommended: true
      });
    }

    // Opção 2: Parcelar
    const installments = [3, 6, 12];
    installments.forEach(n => {
      const monthly = amount / n;
      if (monthly <= baseline.monthlySavings * 0.8) {
        options.push({
          name: `Parcelar em ${n}x`,
          monthlyPayment: mathModule.formatCurrency(monthly),
          impact: `${((monthly / baseline.monthlySavings) * 100).toFixed(1)}% da poupança mensal`,
          recommended: monthly <= baseline.monthlySavings * 0.5
        });
      }
    });

    // Opção 3: Cortar gastos
    const cutNeeded = amount - (currentReserve > 0 ? currentReserve : 0);
    if (cutNeeded > 0) {
      options.push({
        name: 'Cortar gastos temporariamente',
        impact: `Reduzir ${mathModule.formatCurrency(cutNeeded / 3)} por 3 meses`,
        difficulty: cutNeeded > baseline.monthlyExpenses * 0.2 ? 'Alta' : 'Moderada'
      });
    }

    return {
      emergency: {
        description,
        amount,
        formatted: mathModule.formatCurrency(amount)
      },
      currentSituation: {
        monthlySavings: mathModule.formatCurrency(baseline.monthlySavings),
        currentReserve: mathModule.formatCurrency(currentReserve),
        monthsOfReserve: currentReserve / baseline.monthlyExpenses
      },
      impact: {
        canCoverWithReserve: currentReserve >= amount,
        reserveAfter: mathModule.formatCurrency(Math.max(0, reserveAfter)),
        recoveryMonths: Math.ceil(monthsToRecover)
      },
      options,
      recommendation: currentReserve >= amount
        ? 'Use a reserva de emergência - é para isso que ela existe'
        : `Considere parcelar para não comprometer as finanças`
    };
  }

  /**
   * Compara múltiplos cenários
   */
  async _simulateComparison(baseline, params) {
    const { scenarios } = params;

    const results = [];
    for (const scenario of scenarios) {
      const result = await this.simulate({
        type: scenario.type,
        params: { ...scenario.params, userId: params.userId },
        baseline
      });
      results.push({
        name: scenario.name || scenario.type,
        result: result.result
      });
    }

    return {
      scenarios: results,
      comparison: this._buildComparisonTable(results)
    };
  }

  /**
   * Cenário customizado
   */
  _simulateCustom(baseline, params) {
    const {
      incomeChange = 0,
      expenseChange = 0,
      oneTimeExpense = 0,
      duration = 12
    } = params;

    const newIncome = baseline.monthlyIncome + incomeChange;
    const newExpenses = baseline.monthlyExpenses + expenseChange;
    const newSavings = newIncome - newExpenses;

    const projections = [];
    let cumulativeSavings = 0;

    for (let month = 1; month <= duration; month++) {
      const monthSavings = month === 1 
        ? newSavings - oneTimeExpense 
        : newSavings;
      cumulativeSavings += monthSavings;
      projections.push({
        month,
        savings: monthSavings,
        cumulative: cumulativeSavings
      });
    }

    return {
      changes: {
        income: incomeChange,
        expenses: expenseChange,
        oneTime: oneTimeExpense
      },
      impact: {
        newMonthlyIncome: mathModule.formatCurrency(newIncome),
        newMonthlyExpenses: mathModule.formatCurrency(newExpenses),
        newMonthlySavings: mathModule.formatCurrency(newSavings),
        savingsChange: mathModule.formatCurrency(newSavings - baseline.monthlySavings)
      },
      projections,
      totalSavings: {
        value: cumulativeSavings,
        formatted: mathModule.formatCurrency(cumulativeSavings)
      }
    };
  }

  /**
   * Helpers
   */
  _getIncomeChangeRecommendation(change, newSavings) {
    if (change > 0 && newSavings > 0) {
      return 'Aproveite o aumento para acelerar suas metas ou investir mais';
    } else if (change < 0 && newSavings > 0) {
      return 'Apesar da redução, você ainda mantém capacidade de poupança';
    } else if (change < 0 && newSavings <= 0) {
      return 'ATENÇÃO: Revise seus gastos para evitar déficit mensal';
    }
    return 'Mantenha o planejamento atual';
  }

  _getGoalRecommendation(scenarios, baseline) {
    const viable = scenarios.filter(s => 
      s.monthlyContribution <= baseline.monthlySavings
    );
    
    if (viable.length === 0) {
      return 'Nenhum cenário é viável com a capacidade atual. Considere aumentar renda ou revisar a meta.';
    }
    
    const balanced = viable.find(s => s.name === 'Ritmo moderado');
    if (balanced) {
      return `Recomendado: ${balanced.name} - ${balanced.formatted}/mês por ${balanced.monthsNeeded} meses`;
    }
    
    return `Cenário viável: ${viable[0].name} - ${viable[0].formatted}/mês`;
  }

  _buildComparisonTable(results) {
    // Extrair métricas comuns para comparação
    return results.map(r => ({
      name: r.name,
      impact: r.result.impact || r.result.result || {}
    }));
  }

  _addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result.toISOString();
  }

  _monthsUntil(dateStr) {
    const target = new Date(dateStr);
    const now = new Date();
    return (target.getFullYear() - now.getFullYear()) * 12 + 
           (target.getMonth() - now.getMonth());
  }
}

module.exports = { ScenarioSimulator, SCENARIO_TYPES };
