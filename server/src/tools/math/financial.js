/**
 * @module tools/math/financial
 * @description Funções financeiras de alta precisão.
 * Utiliza Decimal.js para evitar erros de ponto flutuante.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 * 
 * Funções disponíveis:
 * - Juros compostos
 * - Valor Presente Líquido (VPL/NPV)
 * - Taxa Interna de Retorno (TIR/IRR)
 * - Sharpe Ratio
 * - Value at Risk (VaR)
 * - Projeção de aportes
 */

const Decimal = require('decimal.js');

// Configuração de precisão global
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Calcula juros compostos.
 * Fórmula: M = P × (1 + r)^t
 * 
 * @param {number|string} principal - Capital inicial
 * @param {number|string} rate - Taxa por período (ex: 0.01 para 1%)
 * @param {number} periods - Número de períodos
 * @returns {{ amount: Decimal, interest: Decimal }} Montante final e juros acumulados
 */
function compoundInterest(principal, rate, periods) {
  const P = new Decimal(principal);
  const r = new Decimal(rate);
  const t = new Decimal(periods);

  // M = P × (1 + r)^t
  const amount = P.times(r.plus(1).pow(t));
  const interest = amount.minus(P);

  return {
    amount,
    interest,
  };
}

/**
 * Calcula o Valor Presente Líquido (VPL / NPV).
 * Fórmula: VPL = Σ [CF_t / (1 + r)^t] - Investimento Inicial
 * 
 * @param {number|string} rate - Taxa de desconto por período
 * @param {Array<number|string>} cashFlows - Fluxos de caixa (index 0 = investimento inicial, geralmente negativo)
 * @returns {Decimal} Valor presente líquido
 */
function netPresentValue(rate, cashFlows) {
  const r = new Decimal(rate);

  let npv = new Decimal(0);

  for (let t = 0; t < cashFlows.length; t++) {
    const cf = new Decimal(cashFlows[t]);
    const discountFactor = r.plus(1).pow(t);
    npv = npv.plus(cf.dividedBy(discountFactor));
  }

  return npv;
}

/**
 * Calcula a Taxa Interna de Retorno (TIR / IRR).
 * Usa método de Newton-Raphson para aproximar a taxa que zera o VPL.
 * 
 * @param {Array<number|string>} cashFlows - Fluxos de caixa (index 0 = investimento inicial)
 * @param {number} [maxIterations=100] - Máximo de iterações
 * @param {number} [tolerance=1e-8] - Tolerância de convergência
 * @returns {Decimal|null} TIR encontrada ou null se não convergir
 */
function internalRateOfReturn(cashFlows, maxIterations = 100, tolerance = 1e-8) {
  let guess = new Decimal(0.1); // Chute inicial: 10%
  const tol = new Decimal(tolerance);

  for (let i = 0; i < maxIterations; i++) {
    let npv = new Decimal(0);
    let dnpv = new Decimal(0); // Derivada do NPV em relação a r

    for (let t = 0; t < cashFlows.length; t++) {
      const cf = new Decimal(cashFlows[t]);
      const factor = guess.plus(1).pow(t);
      npv = npv.plus(cf.dividedBy(factor));

      if (t > 0) {
        dnpv = dnpv.minus(cf.times(t).dividedBy(guess.plus(1).pow(t + 1)));
      }
    }

    if (dnpv.abs().lessThan(tol)) {
      break; // Derivada muito pequena, risco de divisão instável
    }

    const newGuess = guess.minus(npv.dividedBy(dnpv));

    if (newGuess.minus(guess).abs().lessThan(tol)) {
      return newGuess;
    }

    guess = newGuess;
  }

  return guess; // Retorna melhor estimativa
}

/**
 * Calcula o Sharpe Ratio.
 * Fórmula: (Retorno médio - Taxa livre de risco) / Desvio padrão dos retornos
 * 
 * @param {Array<number|string>} returns - Array de retornos por período
 * @param {number|string} riskFreeRate - Taxa livre de risco por período
 * @returns {Decimal} Sharpe Ratio
 */
function sharpeRatio(returns, riskFreeRate) {
  if (!returns || returns.length < 2) {
    return new Decimal(0);
  }

  const rf = new Decimal(riskFreeRate);
  const n = returns.length;

  // Média dos retornos
  let sum = new Decimal(0);
  for (const ret of returns) {
    sum = sum.plus(new Decimal(ret));
  }
  const mean = sum.dividedBy(n);

  // Desvio padrão
  let varianceSum = new Decimal(0);
  for (const ret of returns) {
    const diff = new Decimal(ret).minus(mean);
    varianceSum = varianceSum.plus(diff.pow(2));
  }
  const stdDev = varianceSum.dividedBy(n - 1).sqrt();

  if (stdDev.isZero()) {
    return new Decimal(0);
  }

  return mean.minus(rf).dividedBy(stdDev);
}

/**
 * Calcula o Value at Risk (VaR) histórico.
 * Estima a perda máxima esperada em um determinado nível de confiança.
 * 
 * @param {Array<number|string>} returns - Array de retornos históricos
 * @param {number} [confidence=0.95] - Nível de confiança (padrão: 95%)
 * @returns {Decimal} VaR (valor negativo indica perda)
 */
function valueAtRisk(returns, confidence = 0.95) {
  if (!returns || returns.length === 0) {
    return new Decimal(0);
  }

  // Ordenar retornos do menor para o maior
  const sorted = returns
    .map(r => new Decimal(r))
    .sort((a, b) => a.minus(b).toNumber());

  // Percentil = (1 - confiança) * n
  const index = Math.floor((1 - confidence) * sorted.length);
  const clampedIndex = Math.max(0, Math.min(index, sorted.length - 1));

  return sorted[clampedIndex];
}

/**
 * Calcula projeção de aportes mensais com juros compostos.
 * Fórmula: FV = PMT × [((1 + r)^n - 1) / r]
 * 
 * @param {number|string} monthlyPayment - Aporte mensal
 * @param {number|string} monthlyRate - Taxa mensal
 * @param {number} months - Número de meses
 * @param {number|string} [initialAmount=0] - Valor inicial
 * @returns {{ futureValue: Decimal, totalInvested: Decimal, totalInterest: Decimal }}
 */
function projectionWithContributions(monthlyPayment, monthlyRate, months, initialAmount = 0) {
  const PMT = new Decimal(monthlyPayment);
  const r = new Decimal(monthlyRate);
  const n = new Decimal(months);
  const P = new Decimal(initialAmount);

  // Montante do principal: P × (1 + r)^n
  const principalFV = P.times(r.plus(1).pow(n));

  // Montante dos aportes: PMT × [((1 + r)^n - 1) / r]
  let contributionsFV;
  if (r.isZero()) {
    contributionsFV = PMT.times(n);
  } else {
    contributionsFV = PMT.times(r.plus(1).pow(n).minus(1).dividedBy(r));
  }

  const futureValue = principalFV.plus(contributionsFV);
  const totalInvested = P.plus(PMT.times(n));
  const totalInterest = futureValue.minus(totalInvested);

  return {
    futureValue,
    totalInvested,
    totalInterest,
  };
}

module.exports = {
  compoundInterest,
  netPresentValue,
  internalRateOfReturn,
  sharpeRatio,
  valueAtRisk,
  projectionWithContributions,
};
