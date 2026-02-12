/**
 * @module core/investments/periods
 * @description Utilitários de janela temporal para métricas de investimentos.
 *
 * LÓGICA PURA — sem IA.
 */

const DEFAULT_WINDOWS = [2, 3, 6, 12];

/**
 * Converte Date para YYYY-MM-DD.
 * @param {Date} value
 * @returns {string}
 */
function toIsoDate(value) {
  return value.toISOString().split('T')[0];
}

/**
 * Normaliza lista de meses para janelas válidas e ordenadas.
 * @param {number[]|undefined} months
 * @returns {number[]}
 */
function normalizeMonths(months) {
  const values = Array.isArray(months) && months.length > 0 ? months : DEFAULT_WINDOWS;

  return Array.from(new Set(values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 60)
  )).sort((a, b) => a - b);
}

/**
 * Constrói janelas de período em meses, sempre iniciando no primeiro dia do mês inicial.
 *
 * @param {number[]|undefined} months
 * @param {string|undefined} asOf - Data de referência YYYY-MM-DD
 * @returns {Array<{months:number,start:string,end:string,label:string}>}
 */
function buildPeriodWindows(months, asOf) {
  const normalized = normalizeMonths(months);
  const endDate = asOf ? new Date(`${asOf}T00:00:00.000Z`) : new Date();

  return normalized.map((windowMonths) => {
    const startDate = new Date(Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth() - (windowMonths - 1),
      1
    ));

    return {
      months: windowMonths,
      start: toIsoDate(startDate),
      end: toIsoDate(endDate),
      label: `${windowMonths}m`,
    };
  });
}

module.exports = {
  normalizeMonths,
  buildPeriodWindows,
};
