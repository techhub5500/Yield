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

let _initialized = false;

function formatCurrencyBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
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

  _initialized = true;
}

module.exports = {
  ensureInvestmentsMetricsRegistered,
};
