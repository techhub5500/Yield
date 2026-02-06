/**
 * @module tools/math/formatters
 * @description Formatadores numéricos para o sistema financeiro.
 * Converte valores brutos em strings legíveis para humanos.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 * 
 * Padrões:
 * - Valores monetários: R$ 1.234,56
 * - Percentuais: 12,34%
 * - Números grandes: 1.234.567
 */

const Decimal = require('decimal.js');

/**
 * Formata um valor como moeda brasileira (BRL).
 * @param {number|string|Decimal} value - Valor numérico
 * @param {number} [decimals=2] - Casas decimais
 * @returns {string} Ex: "R$ 1.234,56"
 */
function formatCurrency(value, decimals = 2) {
  const num = new Decimal(value).toDecimalPlaces(decimals);
  const parts = num.toFixed(decimals).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decPart = parts[1] || '00';

  // Preservar sinal negativo
  if (num.isNegative()) {
    return `-R$ ${intPart.replace('-', '')},${decPart}`;
  }

  return `R$ ${intPart},${decPart}`;
}

/**
 * Formata um valor como percentual.
 * @param {number|string|Decimal} value - Valor numérico (ex: 0.1234 → 12,34%)
 * @param {number} [decimals=2] - Casas decimais
 * @param {boolean} [isAlreadyPercent=false] - Se true, valor já está em % (12.34 → 12,34%)
 * @returns {string} Ex: "12,34%"
 */
function formatPercentage(value, decimals = 2, isAlreadyPercent = false) {
  let num = new Decimal(value);

  if (!isAlreadyPercent) {
    num = num.times(100);
  }

  const fixed = num.toDecimalPlaces(decimals).toFixed(decimals);
  const formatted = fixed.replace('.', ',');

  return `${formatted}%`;
}

/**
 * Formata um número grande com separadores de milhar.
 * @param {number|string|Decimal} value - Valor numérico
 * @param {number} [decimals=0] - Casas decimais
 * @returns {string} Ex: "1.234.567"
 */
function formatNumber(value, decimals = 0) {
  const num = new Decimal(value).toDecimalPlaces(decimals);
  const parts = num.toFixed(decimals).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decPart = parts[1];

  if (decimals > 0 && decPart) {
    return `${intPart},${decPart}`;
  }

  return intPart;
}

module.exports = { formatCurrency, formatPercentage, formatNumber };
