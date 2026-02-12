/**
 * @module core/investments/filters
 * @description Normalização e validação leve de filtros para métricas de investimentos.
 *
 * LÓGICA PURA — sem IA.
 */

const { normalizeMonths } = require('./periods');

const DEFAULT_FILTERS = {
  currencies: [],
  assetClasses: [],
  statuses: [],
  accountIds: [],
  tags: [],
  asOf: null,
};

/**
 * Normaliza array de strings (trim, lower, remove vazios, unique).
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];

  return Array.from(new Set(value
    .map((item) => String(item).trim())
    .filter(Boolean)
  ));
}

/**
 * Normaliza filtros aceitos pela camada de métricas de investimentos.
 *
 * @param {Object|undefined} raw
 * @returns {{filters:Object, periodsMonths:number[], groupBy:string}}
 */
function normalizeInvestmentsFilters(raw = {}) {
  const input = raw || {};

  const periodsMonths = normalizeMonths(input.periodsMonths || input.periods || undefined);
  const groupBy = input.groupBy === 'day' ? 'day' : 'month';

  const filters = {
    ...DEFAULT_FILTERS,
    currencies: normalizeStringArray(input.currencies || input.currency),
    assetClasses: normalizeStringArray(input.assetClasses || input.assetClass),
    statuses: normalizeStringArray(input.statuses || input.status),
    accountIds: normalizeStringArray(input.accountIds || input.accountId),
    tags: normalizeStringArray(input.tags),
    asOf: input.asOf && /^\d{4}-\d{2}-\d{2}$/.test(input.asOf) ? input.asOf : null,
  };

  return { filters, periodsMonths, groupBy };
}

module.exports = {
  normalizeInvestmentsFilters,
};
