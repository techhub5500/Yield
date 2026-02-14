/**
 * @module core/investments/brapi-utils
 * @description Utilitários para integração de investimentos com Brapi.
 *
 * LÓGICA PURA — sem IA.
 */

/**
 * @param {Date} value
 * @returns {string}
 */
function toIsoDate(value) {
  return value.toISOString().split('T')[0];
}

/**
 * @param {string|undefined|null} value
 * @returns {boolean}
 */
function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

/**
 * @param {string|undefined|null} value
 * @returns {string}
 */
function normalizeTicker(value) {
  return String(value || '').trim().toUpperCase();
}

/**
 * @param {string|undefined|null} value
 * @returns {boolean}
 */
function isTickerLike(value) {
  const ticker = normalizeTicker(value);
  if (!ticker) return false;
  return /^[A-Z]{3,6}\d{0,2}$/.test(ticker);
}

/**
 * Regra de ajuste de datas para final de semana:
 * - sábado -> sexta anterior
 * - domingo -> segunda seguinte
 *
 * @param {string} isoDate
 * @returns {string}
 */
function adjustWeekendDate(isoDate) {
  if (!isIsoDate(isoDate)) return isoDate;

  const date = new Date(`${isoDate}T00:00:00.000Z`);
  const day = date.getUTCDay();

  if (day === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  } else if (day === 0) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return toIsoDate(date);
}

/**
 * @param {Object} entry
 * @returns {{date:string, close:number}|null}
 */
function normalizeHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const close = Number(
    entry.close
    ?? entry.price
    ?? entry.regularMarketPrice
    ?? entry.value
  );

  if (!Number.isFinite(close)) return null;

  if (typeof entry.date === 'number' && Number.isFinite(entry.date)) {
    const epoch = entry.date > 9999999999 ? entry.date : entry.date * 1000;
    return { date: toIsoDate(new Date(epoch)), close };
  }

  if (typeof entry.datetime === 'number' && Number.isFinite(entry.datetime)) {
    const epoch = entry.datetime > 9999999999 ? entry.datetime : entry.datetime * 1000;
    return { date: toIsoDate(new Date(epoch)), close };
  }

  const rawDate = String(entry.date || entry.datetime || '').trim();
  if (rawDate) {
    if (isIsoDate(rawDate)) {
      return { date: rawDate, close };
    }

    const parsed = new Date(rawDate);
    if (!Number.isNaN(parsed.getTime())) {
      return { date: toIsoDate(parsed), close };
    }
  }

  return null;
}

/**
 * Extrai série diária de resposta da Brapi em formatos possíveis.
 *
 * @param {Object} payload
 * @returns {Array<{date:string,close:number}>}
 */
function extractDailyHistory(payload) {
  const candidates = [
    payload?.results?.[0]?.historicalDataPrice,
    payload?.results?.[0]?.historicalData,
    payload?.historicalDataPrice,
    payload?.historicalData,
    payload?.results?.[0]?.prices,
    payload?.prices,
  ];

  const rawSeries = candidates.find((item) => Array.isArray(item)) || [];
  const normalized = rawSeries
    .map((entry) => normalizeHistoryEntry(entry))
    .filter(Boolean);

  const byDate = new Map();
  normalized.forEach((entry) => {
    byDate.set(entry.date, entry.close);
  });

  return Array.from(byDate.entries())
    .map(([date, close]) => ({ date, close }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Seleciona preço para data alvo com fallback para anterior/seguinte.
 *
 * @param {Array<{date:string,close:number}>} history
 * @param {string} targetIsoDate
 * @returns {{price:number,date:string}|null}
 */
function pickPriceForDate(history, targetIsoDate) {
  if (!Array.isArray(history) || !history.length || !isIsoDate(targetIsoDate)) return null;

  const exact = history.find((item) => item.date === targetIsoDate);
  if (exact) return { price: exact.close, date: exact.date };

  let previous = null;
  let next = null;

  for (const item of history) {
    if (item.date < targetIsoDate) previous = item;
    if (item.date > targetIsoDate) {
      next = item;
      break;
    }
  }

  if (previous) return { price: previous.close, date: previous.date };
  if (next) return { price: next.close, date: next.date };
  return null;
}

/**
 * @param {string} startIso
 * @param {string} endIso
 * @param {number} [maxPoints=18]
 * @returns {string[]}
 */
function buildMonthlyAnchorDates(startIso, endIso, maxPoints = 18) {
  if (!isIsoDate(startIso) || !isIsoDate(endIso)) return [endIso].filter(Boolean);
  if (startIso >= endIso) return [startIso];

  const start = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${endIso}T00:00:00.000Z`);

  const monthDelta = ((end.getUTCFullYear() - start.getUTCFullYear()) * 12)
    + (end.getUTCMonth() - start.getUTCMonth());

  const step = Math.max(1, Math.ceil((monthDelta + 1) / maxPoints));
  const result = [];

  for (let offset = 0; offset <= monthDelta; offset += step) {
    const cursor = new Date(Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth() + offset,
      start.getUTCDate()
    ));

    if (cursor > end) break;
    result.push(toIsoDate(cursor));
  }

  const last = result[result.length - 1];
  if (last !== endIso) result.push(endIso);

  return Array.from(new Set(result));
}

/**
 * Gera datas âncora distribuídas por dias (janela rolante), mantendo fim em endIso.
 *
 * @param {string} startIso
 * @param {string} endIso
 * @param {number} [maxPoints=24]
 * @returns {string[]}
 */
function buildAdaptiveAnchorDates(startIso, endIso, maxPoints = 24) {
  if (!isIsoDate(startIso) || !isIsoDate(endIso)) return [endIso].filter(Boolean);
  if (startIso >= endIso) return [startIso];

  const start = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${endIso}T00:00:00.000Z`);
  const spanMs = end.getTime() - start.getTime();
  const spanDays = Math.max(1, Math.round(spanMs / 86400000));
  const stepDays = Math.max(1, Math.ceil(spanDays / Math.max(2, maxPoints - 1)));

  const dates = [];
  for (let offset = 0; offset <= spanDays; offset += stepDays) {
    const cursor = new Date(start.getTime() + (offset * 86400000));
    if (cursor > end) break;
    dates.push(toIsoDate(cursor));
  }

  const last = dates[dates.length - 1];
  if (last !== endIso) dates.push(endIso);

  return Array.from(new Set(dates));
}

module.exports = {
  toIsoDate,
  isIsoDate,
  normalizeTicker,
  isTickerLike,
  adjustWeekendDate,
  extractDailyHistory,
  pickPriceForDate,
  buildMonthlyAnchorDates,
  buildAdaptiveAnchorDates,
};
