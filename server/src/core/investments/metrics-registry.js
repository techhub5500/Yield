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
    return { preset: normalized, start: startOfMonth(asOfDate), end: asOfDate, label: 'MTD' };
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

  _initialized = true;
}

module.exports = {
  ensureInvestmentsMetricsRegistered,
};
