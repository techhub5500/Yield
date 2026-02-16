/**
 * @module core/investments/benchmarks
 * @description Utilitários para benchmark de rentabilidade (CDI, IBOV, SELIC, IFIX).
 */

const fs = require('fs/promises');
const path = require('path');
const {
  toIsoDate,
  isIsoDate,
  adjustWeekendDate,
  extractDailyHistory,
  pickPriceForDate,
} = require('./brapi-utils');

const MONTH_INDEX_BY_NAME = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

const JSON_PATHS = {
  cdi: path.resolve(__dirname, '../../../docs/md_sistema/taxa_cdi.json'),
  ibov: path.resolve(__dirname, '../../../docs/md_sistema/ibov.json'),
};

const cache = {
  cdi: null,
  ibov: null,
};

function parsePct(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text === '-') return null;
  const normalized = text.replace('%', '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function toBrapiDate(isoDate) {
  const [year, month, day] = String(isoDate || '').split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

async function readMonthlyJsonSeries(kind) {
  if (cache[kind]) return cache[kind];

  const filePath = JSON_PATHS[kind];
  const content = await fs.readFile(filePath, 'utf8');
  const payload = JSON.parse(content);

  const rootKey = kind === 'cdi' ? 'cdi_historical_performance' : 'ibovespa_historical_performance';
  const rows = Array.isArray(payload?.[rootKey]) ? payload[rootKey] : [];

  const monthly = new Map();

  rows.forEach((row) => {
    const year = Number(row?.ano);
    const months = row?.mensal || {};
    if (!Number.isFinite(year)) return;

    Object.entries(months).forEach(([name, rawPct]) => {
      const month = MONTH_INDEX_BY_NAME[String(name || '').toLowerCase()];
      if (!month) return;

      const pct = parsePct(rawPct);
      if (pct === null) return;

      const isoMonth = `${year}-${String(month).padStart(2, '0')}`;
      monthly.set(isoMonth, pct);
    });
  });

  cache[kind] = monthly;
  return monthly;
}

function iterateMonthKeys(startIso, endIso) {
  if (!isIsoDate(startIso) || !isIsoDate(endIso)) return [];

  const startDate = new Date(`${startIso}T00:00:00.000Z`);
  const endDate = new Date(`${endIso}T00:00:00.000Z`);
  const result = [];

  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  const endCursor = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));

  while (cursor <= endCursor) {
    result.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return result;
}

function cumulativePctFromMonthlyRange(monthlyMap, startIso, endIso) {
  const monthKeys = iterateMonthKeys(startIso, endIso);
  if (!monthKeys.length) return 0;

  let factor = 1;
  monthKeys.forEach((monthKey) => {
    const pct = monthlyMap.get(monthKey);
    if (Number.isFinite(pct)) {
      factor *= (1 + (pct / 100));
    }
  });

  return (factor - 1) * 100;
}

async function buildCdiBenchmarks(anchorDates, startIso) {
  const monthly = await readMonthlyJsonSeries('cdi');
  return anchorDates.map((date) => ({
    date,
    value: cumulativePctFromMonthlyRange(monthly, startIso, date),
  }));
}

async function buildIbovBenchmarks(anchorDates, startIso) {
  const monthly = await readMonthlyJsonSeries('ibov');
  return anchorDates.map((date) => ({
    date,
    value: cumulativePctFromMonthlyRange(monthly, startIso, date),
  }));
}

function parsePrimeRateResponse(payload) {
  const rows = payload?.['prime-rate']
    || payload?.primeRate
    || payload?.results
    || [];

  if (!Array.isArray(rows)) return [];

  return rows
    .map((item) => {
      const rawDate = String(item?.date || '').trim();
      const rawValue = parsePct(item?.value);
      if (!rawDate || !Number.isFinite(rawValue)) return null;

      const [day, month, year] = rawDate.split('/');
      if (!day || !month || !year) return null;
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      if (!isIsoDate(isoDate)) return null;

      return {
        date: isoDate,
        annualRatePct: rawValue,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function diffDays(startIso, endIso) {
  const start = new Date(`${startIso}T00:00:00.000Z`).getTime();
  const end = new Date(`${endIso}T00:00:00.000Z`).getTime();
  return Math.max(0, Math.round((end - start) / 86400000));
}

function findPrimeRateForDate(rates, isoDate) {
  let selected = rates[0] || null;
  rates.forEach((row) => {
    if (row.date <= isoDate) selected = row;
  });
  return selected;
}

function cumulativeFromPrimeRate(rates, startIso, targetIso) {
  if (!rates.length || !isIsoDate(startIso) || !isIsoDate(targetIso) || targetIso <= startIso) {
    return 0;
  }

  const pivotDates = new Set([startIso, targetIso]);
  rates.forEach((row) => {
    if (row.date > startIso && row.date < targetIso) {
      pivotDates.add(row.date);
    }
  });

  const ordered = Array.from(pivotDates).sort((a, b) => a.localeCompare(b));
  let factor = 1;

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const from = ordered[index];
    const to = ordered[index + 1];
    const days = diffDays(from, to);
    if (!days) continue;

    const rate = findPrimeRateForDate(rates, from);
    const annualRate = Number(rate?.annualRatePct || 0);
    factor *= Math.pow(1 + (annualRate / 100), days / 365);
  }

  return (factor - 1) * 100;
}

async function buildSelicBenchmarks(anchorDates, startIso, endIso, brapiClient) {
  if (!brapiClient || typeof brapiClient.getPrimeRateHistory !== 'function') {
    return anchorDates.map((date) => ({ date, value: 0 }));
  }

  try {
    const payload = await brapiClient.getPrimeRateHistory({
      country: 'brazil',
      historical: true,
      start: toBrapiDate(startIso),
      end: toBrapiDate(endIso),
      sortBy: 'date',
      sortOrder: 'asc',
    });

    const rates = parsePrimeRateResponse(payload);
    if (!rates.length) {
      return anchorDates.map((date) => ({ date, value: 0 }));
    }

    return anchorDates.map((date) => ({
      date,
      value: cumulativeFromPrimeRate(rates, startIso, date),
    }));
  } catch (_error) {
    return anchorDates.map((date) => ({ date, value: 0 }));
  }
}

async function buildIfixBenchmarks(anchorDates, startIso, brapiClient) {
  if (!brapiClient || typeof brapiClient.getQuoteHistory !== 'function') {
    return anchorDates.map((date) => ({ date, value: 0 }));
  }

  try {
    const payload = await brapiClient.getQuoteHistory('IFIX', {
      interval: '1d',
      range: 'max',
    });

    const history = extractDailyHistory(payload);
    const startQuote = pickPriceForDate(history, adjustWeekendDate(startIso));
    const startPrice = Number(startQuote?.price || 0);

    if (!startPrice) {
      return anchorDates.map((date) => ({ date, value: 0 }));
    }

    return anchorDates.map((date) => {
      const quote = pickPriceForDate(history, adjustWeekendDate(date));
      const price = Number(quote?.price || startPrice);
      const value = ((price / startPrice) - 1) * 100;
      return { date, value: Number.isFinite(value) ? value : 0 };
    });
  } catch (_error) {
    return anchorDates.map((date) => ({ date, value: 0 }));
  }
}

function indexSeriesByDate(series) {
  const map = new Map();
  (Array.isArray(series) ? series : []).forEach((item) => {
    if (!item?.date) return;
    map.set(item.date, Number(item.value || 0));
  });
  return map;
}

function isBusinessDay(date) {
  const weekday = date.getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

function buildBusinessDates(startIso, endIso) {
  if (!isIsoDate(startIso) || !isIsoDate(endIso) || startIso > endIso) return [];

  const start = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${endIso}T00:00:00.000Z`);
  const dates = [];

  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (!isBusinessDay(cursor)) continue;
    dates.push(toIsoDate(cursor));
  }

  return dates;
}

function countBusinessDaysInMonth(year, month) {
  const cursor = new Date(Date.UTC(year, month - 1, 1));
  let count = 0;

  while (cursor.getUTCMonth() === (month - 1)) {
    if (isBusinessDay(cursor)) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return Math.max(1, count);
}

async function buildDailyBenchmarkSeries(kind, startIso, endIso) {
  if (!['cdi', 'ibov'].includes(String(kind || '').toLowerCase())) return [];

  const normalizedKind = String(kind).toLowerCase();
  const monthly = await readMonthlyJsonSeries(normalizedKind);
  const businessDates = buildBusinessDates(startIso, endIso);

  if (!businessDates.length) return [];

  let cumulativeFactor = 1;

  return businessDates.map((date) => {
    const [yearText, monthText] = date.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const monthKey = `${yearText}-${monthText}`;
    const monthPct = Number(monthly.get(monthKey) || 0);

    const businessDaysInMonth = countBusinessDaysInMonth(year, month);
    const monthFactor = 1 + (monthPct / 100);
    const dailyFactor = monthFactor > 0
      ? Math.pow(monthFactor, 1 / businessDaysInMonth)
      : 1;
    const dailyReturn = dailyFactor - 1;

    cumulativeFactor *= dailyFactor;

    return {
      date,
      value: (cumulativeFactor - 1) * 100,
      dailyReturn,
    };
  });
}

module.exports = {
  addDays,
  indexSeriesByDate,
  buildCdiBenchmarks,
  buildIbovBenchmarks,
  buildSelicBenchmarks,
  buildIfixBenchmarks,
  buildDailyBenchmarkSeries,
};
