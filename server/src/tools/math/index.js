/**
 * @module tools/math/index
 * @description Interface pública do Módulo Matemático (Precision Engine).
 * Centraliza acesso a funções financeiras e formatadores.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 * Os Coordenadores usam este módulo como ferramenta de cálculo.
 * 
 * Funcionalidades:
 * - Juros compostos, VPL, TIR, Sharpe Ratio, VaR
 * - Formatação monetária, percentual e numérica
 * - Projeção de aportes com juros compostos
 */

const financial = require('./financial');
const formatters = require('./formatters');
const logger = require('../../utils/logger');

/**
 * @class MathModule
 * Interface unificada para cálculos financeiros de alta precisão.
 */
class MathModule {
  /**
   * Calcula juros compostos.
   * @param {number|string} principal - Capital inicial
   * @param {number|string} rate - Taxa por período (ex: 0.01 para 1%)
   * @param {number} periods - Número de períodos
   * @returns {{ amount: string, interest: string, formatted: { amount: string, interest: string } }}
   */
  compoundInterest(principal, rate, periods) {
    logger.logic('DEBUG', 'MathModule', `Juros compostos: P=${principal}, r=${rate}, t=${periods}`);

    const result = financial.compoundInterest(principal, rate, periods);

    return {
      amount: result.amount.toFixed(2),
      interest: result.interest.toFixed(2),
      formatted: {
        amount: formatters.formatCurrency(result.amount),
        interest: formatters.formatCurrency(result.interest),
      },
    };
  }

  /**
   * Calcula o Valor Presente Líquido (VPL/NPV).
   * @param {number|string} rate - Taxa de desconto
   * @param {Array<number|string>} cashFlows - Fluxos de caixa
   * @returns {{ value: string, formatted: string }}
   */
  netPresentValue(rate, cashFlows) {
    logger.logic('DEBUG', 'MathModule', `VPL: taxa=${rate}, fluxos=${cashFlows.length} períodos`);

    const result = financial.netPresentValue(rate, cashFlows);

    return {
      value: result.toFixed(2),
      formatted: formatters.formatCurrency(result),
    };
  }

  /**
   * Calcula a Taxa Interna de Retorno (TIR/IRR).
   * @param {Array<number|string>} cashFlows - Fluxos de caixa
   * @returns {{ value: string, formatted: string }}
   */
  internalRateOfReturn(cashFlows) {
    logger.logic('DEBUG', 'MathModule', `TIR: ${cashFlows.length} fluxos`);

    const result = financial.internalRateOfReturn(cashFlows);

    if (!result) {
      logger.warn('MathModule', 'logic', 'TIR não convergiu');
      return { value: null, formatted: 'N/A' };
    }

    return {
      value: result.toFixed(6),
      formatted: formatters.formatPercentage(result),
    };
  }

  /**
   * Calcula o Sharpe Ratio.
   * @param {Array<number|string>} returns - Retornos por período
   * @param {number|string} riskFreeRate - Taxa livre de risco
   * @returns {{ value: string, formatted: string }}
   */
  sharpeRatio(returns, riskFreeRate) {
    logger.logic('DEBUG', 'MathModule', `Sharpe: ${returns.length} retornos`);

    const result = financial.sharpeRatio(returns, riskFreeRate);

    return {
      value: result.toFixed(4),
      formatted: formatters.formatNumber(result, 4),
    };
  }

  /**
   * Calcula o Value at Risk (VaR).
   * @param {Array<number|string>} returns - Retornos históricos
   * @param {number} [confidence=0.95] - Nível de confiança
   * @returns {{ value: string, formatted: string }}
   */
  valueAtRisk(returns, confidence = 0.95) {
    logger.logic('DEBUG', 'MathModule', `VaR: ${returns.length} retornos, confiança=${confidence}`);

    const result = financial.valueAtRisk(returns, confidence);

    return {
      value: result.toFixed(4),
      formatted: formatters.formatPercentage(result),
    };
  }

  /**
   * Projeção de aportes mensais com juros compostos.
   * @param {number|string} monthlyPayment - Aporte mensal
   * @param {number|string} monthlyRate - Taxa mensal
   * @param {number} months - Número de meses
   * @param {number|string} [initialAmount=0] - Valor inicial
   * @returns {{ futureValue: string, totalInvested: string, totalInterest: string, formatted: Object }}
   */
  projectionWithContributions(monthlyPayment, monthlyRate, months, initialAmount = 0) {
    logger.logic('DEBUG', 'MathModule', `Projeção: PMT=${monthlyPayment}, r=${monthlyRate}, n=${months}`);

    const result = financial.projectionWithContributions(monthlyPayment, monthlyRate, months, initialAmount);

    return {
      futureValue: result.futureValue.toFixed(2),
      totalInvested: result.totalInvested.toFixed(2),
      totalInterest: result.totalInterest.toFixed(2),
      formatted: {
        futureValue: formatters.formatCurrency(result.futureValue),
        totalInvested: formatters.formatCurrency(result.totalInvested),
        totalInterest: formatters.formatCurrency(result.totalInterest),
      },
    };
  }

  /**
   * Acesso direto aos formatadores.
   */
  format = {
    currency: formatters.formatCurrency,
    percentage: formatters.formatPercentage,
    number: formatters.formatNumber,
  };
}

module.exports = new MathModule();
