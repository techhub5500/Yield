/**
 * @module core/investments/metrics-registry
 * @description Registro de métricas padrão da base de investimentos.
 */

const { registerMetric } = require('../metrics/registry');
const {
  isTickerLike,
  normalizeTicker,
  adjustWeekendDate,
  extractDailyHistory,
  pickPriceForDate,
  buildAdaptiveAnchorDates,
  toIsoDate,
} = require('./brapi-utils');
const {
  addDays,
  indexSeriesByDate,
  buildCdiBenchmarks,
  buildIbovBenchmarks,
  buildSelicBenchmarks,
  buildIfixBenchmarks,
} = require('./benchmarks');

let _initialized = false;

function formatCurrencyBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatPercent(value) {
  const parsed = Number(value || 0);
  const signal = parsed >= 0 ? '+' : '';
  return `${signal}${parsed.toFixed(2).replace('.', ',')}%`;
}

function classifyAssetGroup(assetClass) {
  if (assetClass === 'fixed_income' || assetClass === 'cash') return 'rf';
  return 'rv';
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDateLabel(isoDate) {
  if (!isoDate) return 'Atual';
  const [year, month] = isoDate.split('-');
  if (!year || !month) return isoDate;
  return `${month}/${String(year).slice(-2)}`;
}

function toMonthLabel(isoDate) {
  if (!isoDate) return 'Atual';
  const [year, month] = String(isoDate).split('-');
  if (!year || !month) return isoDate;
  return `${month}/${year}`;
}

function normalizePeriodPreset(value) {
  const preset = String(value || '').toLowerCase();
  if (['mtd', 'ytd', '12m', 'origin'].includes(preset)) return preset;
  return 'origin';
}

function startOfMonth(isoDate) {
  const [year, month] = String(isoDate || '').split('-');
  return `${year}-${month}-01`;
}

function firstBusinessDayOfMonth(isoDate) {
  const [year, month] = String(isoDate || '').split('-');
  const date = new Date(`${year}-${month}-01T00:00:00.000Z`);
  while ([0, 6].includes(date.getUTCDay())) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return toIsoDate(date);
}

function firstBusinessDayOfYear(isoDate) {
  const [year] = String(isoDate || '').split('-');
  const date = new Date(`${year}-01-01T00:00:00.000Z`);
  while ([0, 6].includes(date.getUTCDay())) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return toIsoDate(date);
}

function rolling12mStart(isoDate) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() - 12);
  date.setUTCDate(date.getUTCDate() + 1);
  return toIsoDate(date);
}

function resolvePeriodRange({ preset, asOfDate, originDate }) {
  const normalized = normalizePeriodPreset(preset);
  if (normalized === 'mtd') {
    return { preset: normalized, start: firstBusinessDayOfMonth(asOfDate), end: asOfDate, label: 'MTD' };
  }
  if (normalized === 'ytd') {
    return { preset: normalized, start: firstBusinessDayOfYear(asOfDate), end: asOfDate, label: 'YTD' };
  }
  if (normalized === '12m') {
    return { preset: normalized, start: rolling12mStart(asOfDate), end: asOfDate, label: '12M' };
  }
  return { preset: 'origin', start: originDate, end: asOfDate, label: 'Origem' };
}

function sortByDateAndCreation(a, b) {
  const dateCompare = String(a.referenceDate || '').localeCompare(String(b.referenceDate || ''));
  if (dateCompare !== 0) return dateCompare;
  return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
}

function resolveTicker(asset) {
  const ticker = normalizeTicker(asset?.ticker || asset?.metadata?.ticker || asset?.name);
  return isTickerLike(ticker) ? ticker : null;
}

function applyTransactionState(state, tx) {
  const operation = String(tx.operation || '');
  const quantity = safeNumber(tx.quantity);
  const price = safeNumber(tx.price);
  const grossAmount = safeNumber(tx.grossAmount);
  const fees = safeNumber(tx.fees);

  if (operation === 'manual_create' || operation === 'manual_buy') {
    if (quantity <= 0) return;

    const buyCost = grossAmount > 0 ? grossAmount : (quantity * price) + fees;
    const previousCost = state.quantity * state.avgCost;
    state.quantity += quantity;
    state.avgCost = state.quantity > 0 ? (previousCost + buyCost) / state.quantity : 0;
    state.investedCapital += buyCost;
    return;
  }

  if (operation === 'manual_sale') {
    const soldQuantity = Math.max(0, Math.min(quantity, state.quantity));
    if (soldQuantity <= 0) return;

    const proceeds = grossAmount > 0 ? grossAmount : (soldQuantity * price) - fees;
    const costBasis = soldQuantity * state.avgCost;

    state.realizedCash += proceeds;
    state.realizedResult += proceeds - costBasis;
    state.realizedCostBasis += costBasis;

    state.quantity = Math.max(0, state.quantity - soldQuantity);
    if (state.quantity === 0) state.avgCost = 0;
    return;
  }

  if (operation === 'manual_income') {
    state.realizedCash += grossAmount;
    state.realizedResult += grossAmount;
  }
}

function buildStateUntilDate(transactions, targetDate) {
  const state = {
    quantity: 0,
    avgCost: 0,
    realizedCash: 0,
    realizedResult: 0,
    realizedCostBasis: 0,
    investedCapital: 0,
  };

  for (const tx of transactions) {
    const referenceDate = String(tx.referenceDate || '');
    if (!referenceDate || referenceDate > targetDate) break;
    applyTransactionState(state, tx);
  }

  return state;
}

function buildStateBeforeDate(transactions, targetDate) {
  const dayBefore = addDays(targetDate, -1);
  return buildStateUntilDate(transactions, dayBefore);
}

function toFixed2(value) {
  return Number((Number(value || 0)).toFixed(2));
}

function buildPercentRows(items) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    meta: item.meta,
    value: formatPercent(item.value),
    varText: `${item.contribution >= 0 ? '+' : ''}${item.contribution.toFixed(2).replace('.', ',')} p.p.`,
  }));
}

function buildAssetDetailsRows(assetsModel, groupKey) {
  return assetsModel
    .filter((item) => item.group === groupKey && item.currentValue > 0)
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 8)
    .map((item) => ({
      id: '',
      name: item.name,
      meta: item.ticker || item.assetClass,
      value: formatCurrencyBRL(item.currentValue),
      varText: `${item.unrealizedPnl >= 0 ? '+' : ''}${formatCurrencyBRL(item.unrealizedPnl)}`,
    }));
}

function parsePercentValue(rawValue) {
  if (rawValue === null || rawValue === undefined) return null;
  const normalized = String(rawValue).trim().replace('%', '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBrapiDateToIso(rawDate) {
  const text = String(rawDate || '').trim();
  if (!text) return null;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split('/');
    return `${year}-${month}-${day}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return toIsoDate(parsed);
}

function extractInflationEntries(payload) {
  const rows = [
    payload?.inflation,
    payload?.results,
    payload?.results?.[0]?.inflation,
    payload?.data?.inflation,
  ].find((item) => Array.isArray(item)) || [];
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const date = parseBrapiDateToIso(row?.date || row?.referenceDate);
      const valuePct = parsePercentValue(row?.value);
      if (!date || !Number.isFinite(valuePct)) return null;
      return { date, valuePct };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function collapseInflationByMonth(entries) {
  const byMonth = new Map();

  entries.forEach((entry) => {
    const monthKey = String(entry.date || '').slice(0, 7);
    if (!monthKey) return;
    const previous = byMonth.get(monthKey);
    if (!previous || entry.date > previous.date) {
      byMonth.set(monthKey, entry);
    }
  });

  return Array.from(byMonth.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function resolveInflationPctFromEntries(entries) {
  if (!Array.isArray(entries) || !entries.length) return 0;

  const monthlyEntries = collapseInflationByMonth(entries);
  if (!monthlyEntries.length) return 0;

  const values = monthlyEntries.map((item) => Number(item.valuePct || 0)).filter(Number.isFinite);
  if (!values.length) return 0;

  const lastValue = values[values.length - 1];

  const looksLikeAlreadyAccumulated = values.length >= 3
    && values.filter((value) => Math.abs(value) >= 2).length >= Math.ceil(values.length * 0.6);

  if (looksLikeAlreadyAccumulated) {
    return lastValue;
  }

  let factor = 1;
  values.forEach((valuePct) => {
    factor *= (1 + (valuePct / 100));
  });

  const compoundedPct = (factor - 1) * 100;

  if (Math.abs(compoundedPct) > 40 && Math.abs(lastValue) <= 20) {
    return lastValue;
  }

  return compoundedPct;
}

function extractDividendEntries(payload) {
  const firstResult = payload?.results?.[0] || {};

  const rawRows = [
    firstResult?.dividendsData,
    firstResult?.dividends,
    firstResult?.stockDividends,
    firstResult?.cashDividends,
    firstResult?.earningsData,
    firstResult?.earnings,
    payload?.dividends,
    payload?.dividendsData,
  ].find((item) => Array.isArray(item)) || [];

  return rawRows
    .map((row) => {
      const nested = row?.dividend || row?.event || row || {};
      const amount = Number(
        nested?.rate
        ?? nested?.value
        ?? nested?.amount
        ?? nested?.cashAmount
        ?? nested?.cashDividends
        ?? nested?.price
      );

      const date = parseBrapiDateToIso(
        nested?.paymentDate
        || nested?.date
        || nested?.approvedOn
        || nested?.lastDatePrior
        || nested?.comDate
        || nested?.exDate
      );

      if (!date || !Number.isFinite(amount) || amount <= 0) return null;
      return {
        date,
        amount,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function resolveTaxRate(asset) {
  const metadata = asset?.metadata || {};
  const taxConfig = metadata.taxConfig || metadata.taxProfile || {};

  const candidates = [
    metadata.irRate,
    metadata.taxRate,
    taxConfig.irRate,
    taxConfig.taxRate,
    taxConfig.rate,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed >= 0) {
      if (parsed > 1) return parsed / 100;
      return parsed;
    }
  }

  if (metadata.taxConfigured || taxConfig.enabled) {
    return 0.15;
  }

  return null;
}

function resolveResultKind(value) {
  const normalized = String(value || '').toLowerCase();
  if (['realized', 'unrealized', 'both'].includes(normalized)) return normalized;
  return 'both';
}

function toBrapiDate(isoDate) {
  const [year, month, day] = String(isoDate || '').split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

async function resolveCumulativeInflationPct(context, startIso, endIso) {
  if (!context?.brapiClient || typeof context.brapiClient.getInflationHistory !== 'function') return 0;
  if (!startIso || !endIso || startIso > endIso) return 0;

  try {
    const payload = await context.brapiClient.getInflationHistory({
      country: 'brazil',
      historical: true,
      start: toBrapiDate(startIso),
      end: toBrapiDate(endIso),
      sortBy: 'date',
      sortOrder: 'asc',
    });

    const entries = extractInflationEntries(payload);
    if (!entries.length) return 0;
    return resolveInflationPctFromEntries(entries);
  } catch (_error) {
    return 0;
  }
}

function buildWidgetModel(input) {
  const {
    assetsModel,
    chartPoints,
    openMarketValue,
    investedCapital,
    openInvested,
    realizedCash,
    realizedResult,
    realizedCostBasis,
  } = input;

  const unrealizedPnl = openMarketValue - openInvested;
  const totalReturn = unrealizedPnl + realizedResult;
  const investedBase = openInvested + realizedCostBasis;
  const totalReturnPct = investedBase > 0 ? (totalReturn / investedBase) * 100 : 0;
  const totalPatrimony = openMarketValue + realizedCash;

  const grouped = assetsModel.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = { total: 0, count: 0 };
    acc[item.group].total += item.currentValue;
    acc[item.group].count += 1;
    return acc;
  }, { rv: { total: 0, count: 0 }, rf: { total: 0, count: 0 } });

  const openTotal = openMarketValue || 1;

  return {
    rootView: 'total',
    chart: {
      currency: 'BRL',
      points: chartPoints,
    },
    views: {
      total: {
        title: 'Patrimônio Total',
        subtitle: 'Ativos em aberto + caixa',
        label: 'Patrimônio atual',
        value: formatCurrencyBRL(totalPatrimony),
        variation: `${totalReturn >= 0 ? '+' : ''}${formatCurrencyBRL(totalReturn)} (${totalReturnPct.toFixed(2)}%)`,
        secondaryLabel: 'Capital investido',
        secondaryValue: formatCurrencyBRL(investedCapital),
        tertiaryLabel: 'Realizado (Em caixa)',
        tertiaryValue: formatCurrencyBRL(realizedCash),
        details: {
          left: [
            {
              id: 'renda-variavel',
              name: 'Renda Variável',
              meta: `${grouped.rv.count} ativo(s)`,
              value: formatCurrencyBRL(grouped.rv.total),
              varText: `${((grouped.rv.total / openTotal) * 100).toFixed(1)}%`,
            },
            {
              id: 'renda-fixa',
              name: 'Renda Fixa',
              meta: `${grouped.rf.count} ativo(s)`,
              value: formatCurrencyBRL(grouped.rf.total),
              varText: `${((grouped.rf.total / openTotal) * 100).toFixed(1)}%`,
            },
          ],
          right: [
            {
              id: '',
              name: 'Resultado realizado',
              meta: 'Vendas e proventos',
              value: formatCurrencyBRL(realizedResult),
              varText: '',
            },
            {
              id: '',
              name: 'Resultado não realizado',
              meta: 'Posições abertas',
              value: formatCurrencyBRL(unrealizedPnl),
              varText: '',
            },
            {
              id: '',
              name: 'Patrimônio em aberto',
              meta: 'Ativos não realizados',
              value: formatCurrencyBRL(openMarketValue),
              varText: '',
            },
          ],
        },
      },
      'renda-variavel': {
        title: 'Renda Variável',
        subtitle: 'Ativos de mercado com atualização dinâmica',
        label: 'Total em RV',
        value: formatCurrencyBRL(grouped.rv.total),
        variation: `${((grouped.rv.total / openTotal) * 100).toFixed(1)}% da carteira aberta`,
        secondaryLabel: 'Quantidade de ativos',
        secondaryValue: String(grouped.rv.count),
        details: {
          left: buildAssetDetailsRows(assetsModel, 'rv'),
          right: [],
        },
      },
      'renda-fixa': {
        title: 'Renda Fixa',
        subtitle: 'Ativos de previsibilidade e caixa',
        label: 'Total em RF',
        value: formatCurrencyBRL(grouped.rf.total),
        variation: `${((grouped.rf.total / openTotal) * 100).toFixed(1)}% da carteira aberta`,
        secondaryLabel: 'Quantidade de ativos',
        secondaryValue: String(grouped.rf.count),
        details: {
          left: buildAssetDetailsRows(assetsModel, 'rf'),
          right: [],
        },
      },
    },
  };
}

async function getTickerHistory(context, ticker, cache) {
  if (!context?.brapiClient || !ticker) return [];
  if (cache.has(ticker)) return cache.get(ticker);

  try {
    const payload = await context.brapiClient.getQuoteHistory(ticker, {
      interval: '1d',
      range: 'max',
    });
    const history = extractDailyHistory(payload);
    cache.set(ticker, history);
    return history;
  } catch (_error) {
    cache.set(ticker, []);
    return [];
  }
}

function ensureInvestmentsMetricsRegistered() {
  if (_initialized) return;

  registerMetric({
    id: 'investments.net_worth',
    title: 'Patrimônio líquido consolidado',
    description: 'Consolida posições por usuário e retorna modelo de widget para card de patrimônio.',
    supportedFilters: ['currencies', 'assetClasses', 'statuses', 'accountIds', 'tags', 'periodsMonths', 'groupBy'],
    output: { kind: 'widget' },
    tags: ['investments', 'dashboard', 'patrimonio'],
    async handler({ context, filters, periodWindows }) {
      const positions = await context.repository.listLatestPositionsByUser({
        userId: context.userId,
        filters,
        end: filters.asOf || null,
      });

      const transactions = await context.repository.listTransactions({
        userId: context.userId,
        filters,
        end: filters.asOf || null,
      });

      const assets = await context.repository.listAssets({
        userId: context.userId,
        filters,
      });

      const asOfDate = filters.asOf || toIsoDate(new Date());

      const transactionsByAsset = new Map();
      transactions
        .sort(sortByDateAndCreation)
        .forEach((tx) => {
          if (!tx.assetId) return;
          if (!transactionsByAsset.has(tx.assetId)) transactionsByAsset.set(tx.assetId, []);
          transactionsByAsset.get(tx.assetId).push(tx);
        });

      const positionByAsset = new Map(positions.map((item) => [item.assetId, item]));
      const assetById = new Map(assets.map((item) => [item.assetId, item]));

      const allAssetIds = new Set([
        ...Array.from(positionByAsset.keys()),
        ...Array.from(transactionsByAsset.keys()),
      ]);

      if (!allAssetIds.size) {
        return {
          status: 'empty',
          data: {
            widget: buildWidgetModel({
              assetsModel: [],
              chartPoints: [{ label: 'Atual', value: 0, currency: 'BRL' }],
              openMarketValue: 0,
              investedCapital: 0,
              openInvested: 0,
              realizedCash: 0,
              realizedResult: 0,
              realizedCostBasis: 0,
            }),
          },
        };
      }

      let globalStartDate = asOfDate;
      allAssetIds.forEach((assetId) => {
        const txs = transactionsByAsset.get(assetId) || [];
        const firstDate = txs[0]?.referenceDate || positionByAsset.get(assetId)?.referenceDate || asOfDate;
        if (firstDate < globalStartDate) globalStartDate = firstDate;
      });

      const hasExplicitSinglePeriod = Array.isArray(periodWindows) && periodWindows.length === 1;
      const explicitWindow = hasExplicitSinglePeriod ? periodWindows[0] : null;

      const chartStartDate = explicitWindow?.start || globalStartDate;
      const chartEndDate = explicitWindow?.end || asOfDate;
      const chartTargetDates = buildAdaptiveAnchorDates(chartStartDate, chartEndDate, 24);

      const historyCache = new Map();

      const assetsModel = [];
      let openMarketValue = 0;
      let openInvested = 0;
      let investedCapital = 0;
      let realizedCash = 0;
      let realizedResult = 0;
      let realizedCostBasis = 0;

      for (const assetId of allAssetIds) {
        const position = positionByAsset.get(assetId) || null;
        const asset = assetById.get(assetId) || {
          assetId,
          name: assetId,
          assetClass: position?.assetClass || 'equity',
          metadata: {},
        };

        const txs = (transactionsByAsset.get(assetId) || []).sort(sortByDateAndCreation);
        const stateAsOf = buildStateUntilDate(txs, asOfDate);
        const group = classifyAssetGroup(asset.assetClass);

        const quantityCurrent = txs.length ? stateAsOf.quantity : safeNumber(position?.quantity);
        const avgCostCurrent = txs.length ? stateAsOf.avgCost : safeNumber(position?.avgPrice);

        const ticker = resolveTicker(asset);
        const canUseBrapi = asset.assetClass === 'equity' && !!ticker;
        const history = canUseBrapi
          ? await getTickerHistory(context, ticker, historyCache)
          : [];

        let currentPrice = safeNumber(position?.marketPrice, avgCostCurrent);
        if (history.length) {
          const matched = pickPriceForDate(history, adjustWeekendDate(asOfDate));
          if (matched) currentPrice = safeNumber(matched.price, currentPrice);
        }

        const currentValue = quantityCurrent > 0
          ? quantityCurrent * currentPrice
          : safeNumber(position?.marketValue);

        const investedOpen = quantityCurrent * avgCostCurrent;
        const unrealizedPnl = currentValue - investedOpen;

        const assetInvestedCapital = txs.length
          ? stateAsOf.investedCapital
          : safeNumber(position?.investedAmount, investedOpen);

        openMarketValue += currentValue;
        openInvested += investedOpen;
        investedCapital += assetInvestedCapital;
        realizedCash += stateAsOf.realizedCash;
        realizedResult += stateAsOf.realizedResult;
        realizedCostBasis += stateAsOf.realizedCostBasis;

        assetsModel.push({
          assetId,
          name: asset.name || assetId,
          ticker,
          assetClass: asset.assetClass,
          group,
          currentValue,
          investedOpen,
          unrealizedPnl,
          history,
          transactions: txs,
          position,
        });
      }

      const chartPoints = chartTargetDates.map((targetDate) => {
        let openValueAtDate = 0;
        let realizedCashAtDate = 0;

        assetsModel.forEach((assetModel) => {
          const state = buildStateUntilDate(assetModel.transactions, targetDate);
          realizedCashAtDate += state.realizedCash;

          const quantityAtDate = assetModel.transactions.length
            ? state.quantity
            : (assetModel.position?.referenceDate && assetModel.position.referenceDate <= targetDate
              ? safeNumber(assetModel.position.quantity)
              : 0);

          if (quantityAtDate <= 0) return;

          let priceAtDate = safeNumber(assetModel.position?.marketPrice, safeNumber(assetModel.position?.avgPrice));
          if (assetModel.history.length) {
            const matched = pickPriceForDate(assetModel.history, adjustWeekendDate(targetDate));
            if (matched) priceAtDate = safeNumber(matched.price, priceAtDate);
          }

          openValueAtDate += quantityAtDate * priceAtDate;
        });

        const value = openValueAtDate + realizedCashAtDate;

        return {
          label: toDateLabel(targetDate),
          value,
          currency: 'BRL',
        };
      });

      return {
        status: 'ok',
        data: {
          widget: buildWidgetModel({
            assetsModel,
            chartPoints: chartPoints.length
              ? chartPoints
              : [{ label: 'Atual', value: openMarketValue + realizedCash, currency: 'BRL' }],
            openMarketValue,
            investedCapital,
            openInvested,
            realizedCash,
            realizedResult,
            realizedCostBasis,
          }),
        },
      };
    },
  });

  const profitabilityHandler = async ({ context, filters }) => {
      const transactions = await context.repository.listTransactions({
        userId: context.userId,
        filters,
        end: filters.asOf || null,
      });

      const assets = await context.repository.listAssets({
        userId: context.userId,
        filters,
      });

      const positions = await context.repository.listLatestPositionsByUser({
        userId: context.userId,
        filters,
        end: filters.asOf || null,
      });

      const asOfDate = filters.asOf || toIsoDate(new Date());

      const transactionsByAsset = new Map();
      transactions
        .sort(sortByDateAndCreation)
        .forEach((tx) => {
          if (!tx.assetId) return;
          if (!transactionsByAsset.has(tx.assetId)) transactionsByAsset.set(tx.assetId, []);
          transactionsByAsset.get(tx.assetId).push(tx);
        });

      const positionByAsset = new Map(positions.map((item) => [item.assetId, item]));
      const assetById = new Map(assets.map((item) => [item.assetId, item]));

      const allAssetIds = new Set([
        ...Array.from(transactionsByAsset.keys()),
        ...Array.from(positionByAsset.keys()),
      ]);

      if (!allAssetIds.size) {
        return {
          status: 'empty',
          data: {
            widget: {
              rootView: 'total',
              period: { preset: 'origin', start: asOfDate, end: asOfDate, label: 'Origem' },
              chart: { currency: 'PERCENT', points: [] },
              views: {
                total: {
                  title: 'Rentabilidade Consolidada',
                  subtitle: 'Sem dados para o período selecionado',
                  label: 'Retorno do Período',
                  value: '0,00%',
                  variation: 'Alfa: +0,00 p.p.',
                  benchmarks: [
                    { id: 'cdi', name: 'CDI', value: '0,00%' },
                    { id: 'selic', name: 'Selic', value: '0,00%' },
                    { id: 'ibov', name: 'Ibovespa', value: '0,00%' },
                    { id: 'ifix', name: 'IFIX', value: '0,00%' },
                  ],
                  details: { left: [], right: [] },
                },
              },
            },
          },
        };
      }

      let originDate = asOfDate;
      allAssetIds.forEach((assetId) => {
        const txs = transactionsByAsset.get(assetId) || [];
        const firstDate = txs[0]?.referenceDate || positionByAsset.get(assetId)?.referenceDate || asOfDate;
        if (firstDate < originDate) originDate = firstDate;
      });

      const period = resolvePeriodRange({
        preset: filters.periodPreset,
        asOfDate,
        originDate,
      });

      const anchorDates = buildAdaptiveAnchorDates(period.start, period.end, 24);
      const historyCache = new Map();

      const assetsModel = [];

      for (const assetId of allAssetIds) {
        const txs = (transactionsByAsset.get(assetId) || []).sort(sortByDateAndCreation);
        const position = positionByAsset.get(assetId) || null;
        const asset = assetById.get(assetId) || {
          assetId,
          name: assetId,
          assetClass: position?.assetClass || 'equity',
          metadata: {},
        };

        const ticker = resolveTicker(asset);
        const canUseBrapi = !!ticker && ['equity', 'crypto'].includes(asset.assetClass);
        const history = canUseBrapi
          ? await getTickerHistory(context, ticker, historyCache)
          : [];

        const pointsByDate = new Map();

        anchorDates.forEach((targetDate) => {
          const state = buildStateUntilDate(txs, targetDate);
          const quantityAtDate = txs.length
            ? state.quantity
            : (position?.referenceDate && position.referenceDate <= targetDate
              ? safeNumber(position.quantity)
              : 0);

          let priceAtDate = safeNumber(position?.marketPrice, safeNumber(position?.avgPrice));
          if (history.length) {
            const matched = pickPriceForDate(history, adjustWeekendDate(targetDate));
            if (matched) priceAtDate = safeNumber(matched.price, priceAtDate);
          }

          const openValue = quantityAtDate * priceAtDate;
          const totalValue = openValue + state.realizedCash;

          pointsByDate.set(targetDate, {
            date: targetDate,
            openValue,
            realizedCash: state.realizedCash,
            totalValue,
          });
        });

        const stateBeforeStart = buildStateBeforeDate(txs, period.start);
        const firstPoint = pointsByDate.get(anchorDates[0]) || { totalValue: 0, openValue: 0, realizedCash: 0 };
        const endPoint = pointsByDate.get(period.end) || pointsByDate.get(anchorDates[anchorDates.length - 1]) || firstPoint;

        const startValue = firstPoint.totalValue;
        const endValue = endPoint.totalValue;
        const returnPct = startValue > 0 ? ((endValue / startValue) - 1) * 100 : 0;

        assetsModel.push({
          assetId,
          name: asset.name || assetId,
          ticker,
          assetClass: asset.assetClass,
          group: classifyAssetGroup(asset.assetClass),
          txCount: txs.length,
          pointsByDate,
          stateBeforeStart,
          startValue,
          endValue,
          returnPct,
          openEndValue: endPoint.openValue,
        });
      }

      const totalsByDate = new Map();
      anchorDates.forEach((date) => {
        const total = assetsModel.reduce((sum, assetModel) => {
          const point = assetModel.pointsByDate.get(date);
          return sum + Number(point?.totalValue || 0);
        }, 0);

        totalsByDate.set(date, total);
      });

      const startTotal = Number(totalsByDate.get(period.start) || totalsByDate.get(anchorDates[0]) || 0);

      const cdiSeries = await buildCdiBenchmarks(anchorDates, period.start);
      const ibovSeries = await buildIbovBenchmarks(anchorDates, period.start);
      const selicSeries = await buildSelicBenchmarks(anchorDates, period.start, period.end, context.brapiClient);
      const ifixSeries = await buildIfixBenchmarks(anchorDates, period.start, context.brapiClient);

      const cdiByDate = indexSeriesByDate(cdiSeries);
      const selicByDate = indexSeriesByDate(selicSeries);
      const ibovByDate = indexSeriesByDate(ibovSeries);
      const ifixByDate = indexSeriesByDate(ifixSeries);

      const chartPoints = anchorDates.map((date) => {
        const totalAtDate = Number(totalsByDate.get(date) || 0);
        const portfolioPct = startTotal > 0 ? ((totalAtDate / startTotal) - 1) * 100 : 0;

        return {
          date,
          label: toMonthLabel(date),
          value: toFixed2(portfolioPct),
          benchmarks: {
            cdi: toFixed2(cdiByDate.get(date) || 0),
            selic: toFixed2(selicByDate.get(date) || 0),
            ibov: toFixed2(ibovByDate.get(date) || 0),
            ifix: toFixed2(ifixByDate.get(date) || 0),
          },
        };
      });

      const endPoint = chartPoints[chartPoints.length - 1] || { value: 0, benchmarks: { cdi: 0, selic: 0, ibov: 0, ifix: 0 } };
      const openPatrimony = assetsModel.reduce((sum, item) => sum + item.openEndValue, 0);
      const totalPatrimony = Number(totalsByDate.get(period.end) || openPatrimony || 0);
      const alpha = endPoint.value - endPoint.benchmarks.cdi;

      const rvItems = assetsModel
        .filter((item) => item.group === 'rv' && item.endValue > 0)
        .map((item) => {
          const weight = totalPatrimony > 0 ? item.endValue / totalPatrimony : 0;
          return {
            id: `asset-${item.assetId}`,
            name: item.name,
            meta: item.ticker || item.assetClass,
            value: item.returnPct,
            contribution: item.returnPct * weight,
            group: 'rv',
            weight,
          };
        })
        .sort((a, b) => b.contribution - a.contribution);

      const rfItems = assetsModel
        .filter((item) => item.group === 'rf' && item.endValue > 0)
        .map((item) => {
          const weight = totalPatrimony > 0 ? item.endValue / totalPatrimony : 0;
          return {
            id: `asset-${item.assetId}`,
            name: item.name,
            meta: item.ticker || item.assetClass,
            value: item.returnPct,
            contribution: item.returnPct * weight,
            group: 'rf',
            weight,
          };
        })
        .sort((a, b) => b.contribution - a.contribution);

      const assetViews = assetsModel.reduce((acc, item) => {
        const weight = totalPatrimony > 0 ? item.endValue / totalPatrimony : 0;
        acc[`asset-${item.assetId}`] = {
          title: item.name,
          subtitle: item.ticker || item.assetClass,
          label: 'Rentabilidade',
          value: formatPercent(item.returnPct),
          variation: `Peso na carteira: ${(weight * 100).toFixed(2).replace('.', ',')}%`,
          benchmarks: [
            { id: 'cdi', name: 'CDI', value: formatPercent(endPoint.benchmarks.cdi) },
            { id: 'selic', name: 'Selic', value: formatPercent(endPoint.benchmarks.selic) },
          ],
          details: {
            left: [
              {
                id: '',
                name: 'Valor no início',
                meta: period.start,
                value: formatCurrencyBRL(item.startValue),
                varText: '',
              },
              {
                id: '',
                name: 'Valor no fim',
                meta: period.end,
                value: formatCurrencyBRL(item.endValue),
                varText: '',
              },
            ],
            right: [],
          },
        };
        return acc;
      }, {});

      const views = {
        total: {
          title: 'Rentabilidade Consolidada',
          subtitle: `Período: ${period.label}`,
          label: 'Retorno do Período',
          value: formatPercent(endPoint.value),
          variation: `Alfa: ${alpha >= 0 ? '+' : ''}${alpha.toFixed(2).replace('.', ',')} p.p.`,
          benchmarks: [
            { id: 'cdi', name: 'CDI', value: formatPercent(endPoint.benchmarks.cdi) },
            { id: 'selic', name: 'Selic', value: formatPercent(endPoint.benchmarks.selic) },
            { id: 'ibov', name: 'Ibovespa', value: formatPercent(endPoint.benchmarks.ibov) },
            { id: 'ifix', name: 'IFIX', value: formatPercent(endPoint.benchmarks.ifix) },
          ],
          details: {
            left: buildPercentRows(rvItems.slice(0, 8)),
            right: buildPercentRows(rfItems.slice(0, 8)),
          },
        },
        'renda-variavel': {
          title: 'Renda Variável',
          subtitle: 'Contribuição para rentabilidade total',
          label: 'Retorno da Classe',
          value: formatPercent(rvItems.reduce((sum, item) => sum + item.value * item.weight, 0)),
          variation: `Contribuição total: ${rvItems.reduce((sum, item) => sum + item.contribution, 0).toFixed(2).replace('.', ',')} p.p.`,
          benchmarks: [
            { id: 'ibov', name: 'Ibovespa', value: formatPercent(endPoint.benchmarks.ibov) },
            { id: 'ifix', name: 'IFIX', value: formatPercent(endPoint.benchmarks.ifix) },
          ],
          details: {
            left: buildPercentRows(rvItems.slice(0, 12)),
            right: [],
          },
        },
        'renda-fixa': {
          title: 'Renda Fixa',
          subtitle: 'Contribuição para rentabilidade total',
          label: 'Retorno da Classe',
          value: formatPercent(rfItems.reduce((sum, item) => sum + item.value * item.weight, 0)),
          variation: `Contribuição total: ${rfItems.reduce((sum, item) => sum + item.contribution, 0).toFixed(2).replace('.', ',')} p.p.`,
          benchmarks: [
            { id: 'cdi', name: 'CDI', value: formatPercent(endPoint.benchmarks.cdi) },
            { id: 'selic', name: 'Selic', value: formatPercent(endPoint.benchmarks.selic) },
          ],
          details: {
            left: buildPercentRows(rfItems.slice(0, 12)),
            right: [],
          },
        },
        ...assetViews,
      };

      if (views.total.details.left.length) {
        views.total.details.left[0].id = 'renda-variavel';
      }
      if (views.total.details.right.length) {
        views.total.details.right[0].id = 'renda-fixa';
      }

      return {
        status: 'ok',
        data: {
          widget: {
            rootView: 'total',
            period,
            chart: {
              currency: 'PERCENT',
              points: chartPoints,
            },
            views,
          },
        },
      };
    };

  const profitabilityMetricAliases = [
    'investments.profitability',
    'investments.rentabilidade',
    'investments.rentabilidade_consolidada',
    'investments.profitability_consolidated',
    'investments.consolidated_profitability',
  ];

  profitabilityMetricAliases.forEach((metricId) => {
    registerMetric({
      id: metricId,
    title: 'Rentabilidade consolidada',
    description: 'Rentabilidade do portfólio com comparação temporal por benchmarks (CDI, Selic, Ibovespa e IFIX).',
    supportedFilters: ['currencies', 'assetClasses', 'statuses', 'accountIds', 'tags', 'periodPreset', 'asOf'],
    output: { kind: 'widget' },
    tags: ['investments', 'dashboard', 'rentabilidade'],
    handler: profitabilityHandler,
    });
  });

  const financialResultHandler = async ({ context, filters }) => {
    const transactions = await context.repository.listTransactions({
      userId: context.userId,
      filters,
      end: filters.asOf || null,
    });

    const assets = await context.repository.listAssets({
      userId: context.userId,
      filters,
    });

    const positions = await context.repository.listLatestPositionsByUser({
      userId: context.userId,
      filters,
      end: filters.asOf || null,
    });

    const asOfDate = filters.asOf || toIsoDate(new Date());
    const resultType = resolveResultKind(filters.resultType);

    const transactionsByAsset = new Map();
    transactions
      .sort(sortByDateAndCreation)
      .forEach((tx) => {
        if (!tx.assetId) return;
        if (!transactionsByAsset.has(tx.assetId)) transactionsByAsset.set(tx.assetId, []);
        transactionsByAsset.get(tx.assetId).push(tx);
      });

    const positionByAsset = new Map(positions.map((item) => [item.assetId, item]));
    const assetById = new Map(assets.map((item) => [item.assetId, item]));

    const allAssetIds = new Set([
      ...Array.from(transactionsByAsset.keys()),
      ...Array.from(positionByAsset.keys()),
    ]);

    if (!allAssetIds.size) {
      return {
        status: 'empty',
        data: {
          widget: {
            rootView: 'total',
            period: { preset: 'origin', start: asOfDate, end: asOfDate, label: 'Origem' },
            resultType,
            taxes: {
              configured: false,
              warning: '',
            },
            chart: { kind: 'waterfall', points: [] },
            views: {
              total: {
                title: 'Resultado Financeiro',
                subtitle: 'Sem dados para o período selecionado',
                label: 'Resultado Bruto',
                value: formatCurrencyBRL(0),
                valueClass: 'neutral',
                roiNominal: 'ROI Nominal: 0,00%',
                roiReal: 'ROI Real: 0,00%',
                netLabel: 'Resultado Líquido (Est.)',
                netValue: formatCurrencyBRL(0),
                netDescription: 'Após impostos e taxas',
                warning: '',
                dividendsLabel: 'Proventos (Div/JCP)',
                dividendsValue: formatCurrencyBRL(0),
                realizedLabel: 'Realizado (Caixa)',
                realizedValue: formatCurrencyBRL(0),
                realizedShare: '0,0%',
                unrealizedLabel: 'Não Realizado (Papel)',
                unrealizedValue: formatCurrencyBRL(0),
                unrealizedShare: '0,0%',
                details: { left: [], right: [] },
              },
            },
          },
        },
      };
    }

    let originDate = asOfDate;
    allAssetIds.forEach((assetId) => {
      const txs = transactionsByAsset.get(assetId) || [];
      const firstDate = txs[0]?.referenceDate || positionByAsset.get(assetId)?.referenceDate || asOfDate;
      if (firstDate < originDate) originDate = firstDate;
    });

    const period = resolvePeriodRange({
      preset: filters.periodPreset,
      asOfDate,
      originDate,
    });

    const historyCache = new Map();
    const dividendsCache = new Map();
    const assetModels = [];

    for (const assetId of allAssetIds) {
      const txs = (transactionsByAsset.get(assetId) || []).sort(sortByDateAndCreation);
      const position = positionByAsset.get(assetId) || null;
      const asset = assetById.get(assetId) || {
        assetId,
        name: assetId,
        assetClass: position?.assetClass || 'equity',
        status: position?.status || 'open',
        metadata: {},
      };

      const stateStart = buildStateBeforeDate(txs, period.start);
      const stateEnd = buildStateUntilDate(txs, period.end);

      const ticker = resolveTicker(asset);
      const canUseBrapi = !!ticker && ['equity', 'crypto', 'funds'].includes(asset.assetClass);
      const history = canUseBrapi
        ? await getTickerHistory(context, ticker, historyCache)
        : [];

      let priceStart = safeNumber(position?.avgPrice, safeNumber(position?.marketPrice));
      let priceEnd = safeNumber(position?.marketPrice, safeNumber(position?.avgPrice));

      if (history.length) {
        const startMatch = pickPriceForDate(history, adjustWeekendDate(period.start));
        const endMatch = pickPriceForDate(history, adjustWeekendDate(period.end));
        if (startMatch) priceStart = safeNumber(startMatch.price, priceStart);
        if (endMatch) priceEnd = safeNumber(endMatch.price, priceEnd);
      }

      const quantityStart = txs.length
        ? stateStart.quantity
        : (position?.referenceDate && position.referenceDate <= period.start ? safeNumber(position.quantity) : 0);
      const quantityEnd = txs.length
        ? stateEnd.quantity
        : (position?.referenceDate && position.referenceDate <= period.end ? safeNumber(position.quantity) : 0);

      const openValueStart = quantityStart * priceStart;
      const openValueEnd = quantityEnd * priceEnd;
      const openInvestedStart = quantityStart * stateStart.avgCost;
      const openInvestedEnd = quantityEnd * stateEnd.avgCost;

      const unrealizedPnlStart = openValueStart - openInvestedStart;
      const unrealizedPnlEnd = openValueEnd - openInvestedEnd;
      const unrealizedResult = unrealizedPnlEnd - unrealizedPnlStart;
      const realizedResultRaw = stateEnd.realizedResult - stateStart.realizedResult;

      const manualIncome = txs
        .filter((tx) => tx.referenceDate >= period.start && tx.referenceDate <= period.end && tx.operation === 'manual_income')
        .reduce((sum, tx) => sum + safeNumber(tx.grossAmount), 0);

      const feesInPeriod = txs
        .filter((tx) => tx.referenceDate >= period.start && tx.referenceDate <= period.end)
        .reduce((sum, tx) => sum + safeNumber(tx.fees), 0);

      let grossDividendsBrapi = 0;

      if (ticker && context?.brapiClient && typeof context.brapiClient.getDividendsHistory === 'function') {
        if (!dividendsCache.has(ticker)) {
          try {
            const payload = await context.brapiClient.getDividendsHistory(ticker);
            dividendsCache.set(ticker, extractDividendEntries(payload));
          } catch (_error) {
            dividendsCache.set(ticker, []);
          }
        }

        const entries = dividendsCache.get(ticker) || [];
        entries
          .filter((entry) => entry.date >= period.start && entry.date <= period.end)
          .forEach((entry) => {
            const stateAtDate = buildStateUntilDate(txs, entry.date);
            if (stateAtDate.quantity > 0) {
              grossDividendsBrapi += stateAtDate.quantity * entry.amount;
            }
          });
      }

      const realizedTradingResult = realizedResultRaw - manualIncome;
      const proventosReceived = grossDividendsBrapi > 0 ? grossDividendsBrapi : manualIncome;
      const realizedComponent = realizedTradingResult + proventosReceived;
      const unrealizedComponent = unrealizedResult;
      const grossResult = realizedComponent + unrealizedComponent;

      const txsInPeriod = txs.filter((tx) => tx.referenceDate >= period.start && tx.referenceDate <= period.end);
      const hasRealizedStatus = txsInPeriod.some((tx) => {
        const status = String(tx.status || '').toLowerCase();
        return ['closed', 'realized', 'settled'].includes(status) || ['manual_sale', 'manual_income'].includes(String(tx.operation || ''));
      }) || proventosReceived > 0;

      const hasUnrealizedStatus = txsInPeriod.some((tx) => {
        const status = String(tx.status || '').toLowerCase();
        return ['open', 'pending_settlement', 'unrealized'].includes(status);
      }) || quantityEnd > 0;

      const selectedResult = resultType === 'realized'
        ? (hasRealizedStatus ? realizedComponent : 0)
        : resultType === 'unrealized'
          ? (hasUnrealizedStatus ? unrealizedComponent : 0)
          : grossResult;

      const selectedRealized = resultType === 'unrealized' ? 0 : (hasRealizedStatus ? realizedComponent : 0);
      const selectedUnrealized = resultType === 'realized' ? 0 : (hasUnrealizedStatus ? unrealizedComponent : 0);

      const investedBase = Math.max(
        0,
        openInvestedEnd + (stateEnd.realizedCostBasis - stateStart.realizedCostBasis)
      );

      const taxRate = resolveTaxRate(asset);
      const hasTaxConfig = taxRate !== null;
      const taxProvision = hasTaxConfig && selectedResult > 0
        ? selectedResult * taxRate
        : 0;

      const netResult = selectedResult - taxProvision;

      assetModels.push({
        assetId,
        name: asset.name || assetId,
        ticker,
        assetClass: asset.assetClass,
        status: asset.status || 'open',
        group: classifyAssetGroup(asset.assetClass),
        selectedResult,
        selectedRealized,
        selectedUnrealized,
        grossResult,
        proventosReceived,
        netResult,
        taxProvision,
        taxRate,
        investedBase,
        feesInPeriod,
      });
    }

    const totalResult = assetModels.reduce((sum, item) => sum + item.selectedResult, 0);
    const totalNetResult = assetModels.reduce((sum, item) => sum + item.netResult, 0);
    const totalRealized = assetModels.reduce((sum, item) => sum + item.selectedRealized, 0);
    const totalUnrealized = assetModels.reduce((sum, item) => sum + item.selectedUnrealized, 0);
    const totalInvested = assetModels.reduce((sum, item) => sum + item.investedBase, 0);
    const totalTaxProvision = assetModels.reduce((sum, item) => sum + item.taxProvision, 0);
    const totalProventos = assetModels.reduce((sum, item) => sum + item.proventosReceived, 0);

    const hasAnyTaxConfigured = assetModels.some((item) => Number.isFinite(item.taxRate));
    const warningText = '';

    const inflationPct = await resolveCumulativeInflationPct(context, period.start, period.end);
    const roiNominal = totalInvested > 0 ? (totalResult / totalInvested) : 0;
    const roiReal = (((1 + roiNominal) / (1 + (inflationPct / 100))) - 1) * 100;

    const grouped = assetModels.reduce((acc, assetModel) => {
      if (!acc[assetModel.group]) {
        acc[assetModel.group] = {
          group: assetModel.group,
          result: 0,
          netResult: 0,
          realized: 0,
          unrealized: 0,
          taxProvision: 0,
          assets: [],
        };
      }

      const target = acc[assetModel.group];
      target.result += assetModel.selectedResult;
      target.netResult += assetModel.netResult;
      target.realized += assetModel.selectedRealized;
      target.unrealized += assetModel.selectedUnrealized;
      target.taxProvision += assetModel.taxProvision;
      target.assets.push(assetModel);
      return acc;
    }, { rv: { group: 'rv', result: 0, netResult: 0, realized: 0, unrealized: 0, taxProvision: 0, assets: [] }, rf: { group: 'rf', result: 0, netResult: 0, realized: 0, unrealized: 0, taxProvision: 0, assets: [] } });

    const classLabel = {
      rv: 'Renda Variável',
      rf: 'Renda Fixa',
    };

    const toResultClass = (value) => {
      if (value > 0) return 'positive';
      if (value < 0) return 'negative';
      return 'neutral';
    };

    const toAssetStatus = (assetModel) => {
      const hasRealized = Math.abs(assetModel.selectedRealized) > 0.0001;
      const hasUnrealized = Math.abs(assetModel.selectedUnrealized) > 0.0001;
      if (hasRealized && hasUnrealized) return 'Parcial';
      if (hasRealized) return 'Realizado';
      if (hasUnrealized) return 'Não Realizado';
      return 'Neutro';
    };

    const classRows = ['rv', 'rf']
      .map((groupKey) => {
        const item = grouped[groupKey];
        const contribution = totalResult !== 0 ? (item.result / totalResult) * 100 : 0;
        return {
          id: `class-${groupKey}`,
          name: classLabel[groupKey],
          meta: `Contribuição: ${contribution.toFixed(1).replace('.', ',')}%`,
          value: formatCurrencyBRL(item.result),
          varText: `${item.result >= 0 ? '+' : ''}${contribution.toFixed(1).replace('.', ',')}%`,
          contribution,
        };
      })
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    const chartTotal = classRows.map((row) => ({
      id: row.id,
      label: row.name,
      value: grouped[row.id === 'class-rv' ? 'rv' : 'rf'].result,
    }));

    const views = {
      total: {
        title: 'Resultado Financeiro',
        subtitle: `Geração de valor no período (${period.label})`,
        label: 'Resultado Bruto',
        value: formatCurrencyBRL(totalResult),
        valueClass: toResultClass(totalResult),
        roiNominal: `ROI Nominal: ${formatPercent(roiNominal * 100)}`,
        roiReal: `ROI Real: ${formatPercent(roiReal)}`,
        netLabel: 'Resultado Líquido (Est.)',
        netValue: formatCurrencyBRL(hasAnyTaxConfigured ? totalNetResult : totalResult),
        netDescription: hasAnyTaxConfigured
          ? `IR provisionado: ${formatCurrencyBRL(totalTaxProvision)}`
          : 'Sem IR configurado (líquido = bruto)',
        warning: warningText,
        dividendsLabel: 'Proventos (Div/JCP)',
        dividendsValue: formatCurrencyBRL(totalProventos),
        realizedLabel: 'Realizado (Caixa)',
        realizedValue: formatCurrencyBRL(totalRealized),
        realizedShare: `${(totalResult !== 0 ? ((totalRealized / totalResult) * 100) : 0).toFixed(1).replace('.', ',')}%`,
        unrealizedLabel: 'Não Realizado (Papel)',
        unrealizedValue: formatCurrencyBRL(totalUnrealized),
        unrealizedShare: `${(totalResult !== 0 ? ((totalUnrealized / totalResult) * 100) : 0).toFixed(1).replace('.', ',')}%`,
        chart: {
          kind: 'waterfall',
          points: chartTotal,
        },
        details: {
          left: classRows,
          right: [],
        },
      },
    };

    ['rv', 'rf'].forEach((groupKey) => {
      const groupModel = grouped[groupKey];
      const sortedAssets = groupModel.assets
        .slice()
        .sort((a, b) => Math.abs(b.selectedResult) - Math.abs(a.selectedResult));

      const viewId = `class-${groupKey}`;
      const invested = sortedAssets.reduce((sum, item) => sum + item.investedBase, 0);
      const classRoiNominal = invested > 0 ? ((groupModel.result / invested) * 100) : 0;

      const assetRows = sortedAssets.map((assetModel) => ({
        id: `asset-${assetModel.assetId}`,
        name: assetModel.name,
        meta: `${toAssetStatus(assetModel)}${assetModel.ticker ? ` · ${assetModel.ticker}` : ''}`,
        value: formatCurrencyBRL(assetModel.selectedResult),
        varText: assetModel.status || 'open',
      }));

      views[viewId] = {
        title: `Resultado: ${classLabel[groupKey]}`,
        subtitle: 'Detalhamento por ativo',
        label: 'Resultado Bruto',
        value: formatCurrencyBRL(groupModel.result),
        valueClass: toResultClass(groupModel.result),
        roiNominal: `ROI Nominal: ${formatPercent(classRoiNominal)}`,
        roiReal: `ROI Real: ${formatPercent((((1 + (classRoiNominal / 100)) / (1 + (inflationPct / 100))) - 1) * 100)}`,
        netLabel: 'Resultado Líquido (Est.)',
        netValue: formatCurrencyBRL(hasAnyTaxConfigured ? groupModel.netResult : groupModel.result),
        netDescription: hasAnyTaxConfigured
          ? `IR provisionado: ${formatCurrencyBRL(groupModel.taxProvision)}`
          : 'Sem IR configurado (líquido = bruto)',
        warning: warningText,
        dividendsLabel: 'Proventos (Div/JCP)',
        dividendsValue: formatCurrencyBRL(sortedAssets.reduce((sum, item) => sum + item.proventosReceived, 0)),
        realizedLabel: 'Realizado (Caixa)',
        realizedValue: formatCurrencyBRL(groupModel.realized),
        realizedShare: `${(groupModel.result !== 0 ? ((groupModel.realized / groupModel.result) * 100) : 0).toFixed(1).replace('.', ',')}%`,
        unrealizedLabel: 'Não Realizado (Papel)',
        unrealizedValue: formatCurrencyBRL(groupModel.unrealized),
        unrealizedShare: `${(groupModel.result !== 0 ? ((groupModel.unrealized / groupModel.result) * 100) : 0).toFixed(1).replace('.', ',')}%`,
        chart: {
          kind: 'waterfall',
          points: sortedAssets.map((assetModel) => ({
            id: `asset-${assetModel.assetId}`,
            label: assetModel.ticker || assetModel.name,
            value: assetModel.selectedResult,
          })),
        },
        details: {
          left: assetRows,
          right: [],
        },
      };

      sortedAssets.forEach((assetModel) => {
        const assetViewId = `asset-${assetModel.assetId}`;
        const grossGain = assetModel.selectedResult + assetModel.feesInPeriod;

        views[assetViewId] = {
          title: `Resultado: ${assetModel.name}`,
          subtitle: 'Decomposição do resultado individual',
          label: 'Resultado Bruto',
          value: formatCurrencyBRL(assetModel.selectedResult),
          valueClass: toResultClass(assetModel.selectedResult),
          roiNominal: `ROI Nominal: ${formatPercent(assetModel.investedBase > 0 ? ((assetModel.selectedResult / assetModel.investedBase) * 100) : 0)}`,
          roiReal: `ROI Real: ${formatPercent((((1 + (assetModel.investedBase > 0 ? (assetModel.selectedResult / assetModel.investedBase) : 0)) / (1 + (inflationPct / 100))) - 1) * 100)}`,
          netLabel: 'Resultado Líquido (Est.)',
          netValue: formatCurrencyBRL(hasAnyTaxConfigured ? assetModel.netResult : assetModel.selectedResult),
          netDescription: hasAnyTaxConfigured
            ? `IR provisionado: ${formatCurrencyBRL(assetModel.taxProvision)}`
            : 'Sem IR configurado (líquido = bruto)',
          warning: warningText,
          dividendsLabel: 'Proventos (Div/JCP)',
          dividendsValue: formatCurrencyBRL(assetModel.proventosReceived),
          realizedLabel: 'Realizado (Caixa)',
          realizedValue: formatCurrencyBRL(assetModel.selectedRealized),
          realizedShare: `${(assetModel.selectedResult !== 0 ? ((assetModel.selectedRealized / assetModel.selectedResult) * 100) : 0).toFixed(1).replace('.', ',')}%`,
          unrealizedLabel: 'Não Realizado (Papel)',
          unrealizedValue: formatCurrencyBRL(assetModel.selectedUnrealized),
          unrealizedShare: `${(assetModel.selectedResult !== 0 ? ((assetModel.selectedUnrealized / assetModel.selectedResult) * 100) : 0).toFixed(1).replace('.', ',')}%`,
          chart: {
            kind: 'waterfall',
            points: [
              { id: '', label: 'Ganho Bruto', value: grossGain },
              { id: '', label: 'Custos', value: -Math.abs(assetModel.feesInPeriod) },
              { id: '', label: 'Resultado', value: hasAnyTaxConfigured ? assetModel.netResult : assetModel.selectedResult },
            ],
          },
          details: {
            left: [
              {
                id: '',
                name: 'Ganho bruto',
                meta: 'Valorização, juros ou rendimento',
                value: formatCurrencyBRL(grossGain),
                varText: '',
              },
              {
                id: '',
                name: 'Custos',
                meta: 'Corretagem, taxas e encargos',
                value: formatCurrencyBRL(-Math.abs(assetModel.feesInPeriod)),
                varText: '',
              },
              {
                id: '',
                name: 'Resultado líquido estimado',
                meta: hasAnyTaxConfigured ? 'Com provisão de IR' : 'Sem provisão de IR',
                value: formatCurrencyBRL(hasAnyTaxConfigured ? assetModel.netResult : assetModel.selectedResult),
                varText: '',
              },
            ],
            right: [],
          },
        };
      });
    });

    return {
      status: 'ok',
      data: {
        widget: {
          rootView: 'total',
          period,
          resultType,
          taxes: {
            configured: hasAnyTaxConfigured,
            warning: warningText,
          },
          chart: {
            kind: 'waterfall',
            points: chartTotal,
          },
          views,
        },
      },
    };
  };

  const financialResultAliases = [
    'investments.financial_result',
    'investments.resultado_financeiro',
    'investments.financial_result_consolidated',
  ];

  financialResultAliases.forEach((metricId) => {
    registerMetric({
      id: metricId,
      title: 'Resultado financeiro consolidado',
      description: 'Resultado financeiro por classe e ativo, com níveis hierárquicos, ROI nominal/real e suporte a provisão de IR.',
      supportedFilters: ['currencies', 'assetClasses', 'statuses', 'accountIds', 'tags', 'periodPreset', 'resultType', 'asOf'],
      output: { kind: 'widget' },
      tags: ['investments', 'dashboard', 'resultado'],
      handler: financialResultHandler,
    });
  });

  _initialized = true;
}

module.exports = {
  ensureInvestmentsMetricsRegistered,
};
