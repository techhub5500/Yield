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
  buildDailyBenchmarkSeries,
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

function resolveActivityDateRange(activityPeriod) {
  const now = new Date();
  const end = toIsoDate(now);

  if (activityPeriod === '30d' || activityPeriod === '90d') {
    const startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() - (activityPeriod === '30d' ? 30 : 90));
    return {
      start: toIsoDate(startDate),
      end,
    };
  }

  return {
    start: null,
    end: null,
  };
}

function classifyActivityType(activity) {
  const kind = String(activity.activityType || activity.operation || '').toLowerCase();
  const assetClass = String(activity.metadata?.assetClass || '').toLowerCase();
  const targetUpdated = Boolean(activity.metadata?.allocationTargetUpdated);
  const deviationUpdated = Boolean(activity.metadata?.allocationDeviationUpdated);

  if (kind === 'add_buy' || kind === 'manual_create') {
    if (['fixed_income', 'funds', 'cash'].includes(assetClass)) return 'aporte';
    return 'compra';
  }

  if (kind === 'add_sell') return 'venda';
  if (kind === 'add_income') return 'dividendo';
  if (kind === 'update_allocation') {
    if (targetUpdated && deviationUpdated) return 'update_meta_margem';
    if (deviationUpdated) return 'update_margem';
    return 'update_meta';
  }
  if (kind === 'update_balance') return 'aporte';
  if (kind === 'delete_asset') return 'exclusao';

  return 'movimentacao';
}

function labelActivityType(activityType) {
  if (activityType === 'compra') return 'Compra de ativo';
  if (activityType === 'venda') return 'Venda de ativo';
  if (activityType === 'dividendo') return 'Recebimento de dividendos';
  if (activityType === 'aporte') return 'Aporte';
  if (activityType === 'exclusao') return 'Exclusão de movimentação';
  if (activityType === 'update_margem') return 'Atualização de margem de desvio (%)';
  if (activityType === 'update_meta_margem') return 'Atualização de meta e margem (%)';
  if (activityType === 'update_meta') return 'Atualização de meta (%)';
  return 'Movimentação';
}

function formatActivityImpactClass(value) {
  const parsed = Number(value || 0);
  if (parsed > 0) return 'positive';
  if (parsed < 0) return 'negative';
  return 'neutral';
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

function formatIsoDateBr(isoDate) {
  if (!isoDate) return '—';
  const [year, month, day] = String(isoDate).split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function formatQuantityNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 8 });
}

function summarizeCloseType(types = []) {
  const unique = Array.from(new Set(types.filter(Boolean)));
  if (!unique.length) return '—';
  if (unique.includes('Vencimento')) return 'Vencimento';
  if (unique.includes('Venda parcial')) return 'Venda parcial';
  if (unique.includes('Venda total')) return 'Venda total';
  return unique[0];
}

function buildAssetFlowDetails({
  assetModel,
  asOfDate,
  snapshotAsOf,
  referenceData,
  fallbackDate,
}) {
  const transactions = Array.isArray(assetModel?.transactions) ? assetModel.transactions : [];
  const buyOperations = new Set(['manual_create', 'manual_buy']);
  const saleOperation = 'manual_sale';

  const lots = [];
  const realizedEvents = [];
  let aporteCounter = 0;

  for (const tx of transactions) {
    const txDate = String(tx.referenceDate || '');
    if (!txDate || txDate > asOfDate) continue;

    const operation = String(tx.operation || '');
    const quantity = Math.max(0, safeNumber(tx.quantity));
    const price = Math.max(0, safeNumber(tx.price));
    const fees = Math.max(0, safeNumber(tx.fees));
    const grossAmount = safeNumber(tx.grossAmount);

    if (buyOperations.has(operation)) {
      if (quantity <= 0) continue;
      aporteCounter += 1;
      const buyCost = grossAmount > 0 ? grossAmount : (quantity * price) + fees;
      const unitCost = quantity > 0 ? buyCost / quantity : 0;
      lots.push({
        id: `aporte-${aporteCounter}`,
        label: `Aporte ${aporteCounter}`,
        date: txDate,
        quantityInitial: quantity,
        quantityRemaining: quantity,
        unitCost,
      });
      continue;
    }

    if (operation !== saleOperation || quantity <= 0) continue;

    const quantityBeforeSale = lots.reduce((sum, lot) => sum + Math.max(0, lot.quantityRemaining), 0);
    if (quantityBeforeSale <= 0) continue;

    let quantityToSell = Math.min(quantity, quantityBeforeSale);
    if (quantityToSell <= 0) continue;

    const totalProceeds = grossAmount > 0 ? grossAmount : (quantityToSell * price) - fees;
    const allocations = [];
    let totalCostBasis = 0;

    for (const lot of lots) {
      if (quantityToSell <= 0) break;
      const available = Math.max(0, lot.quantityRemaining);
      if (available <= 0) continue;

      const soldFromLot = Math.min(available, quantityToSell);
      lot.quantityRemaining = available - soldFromLot;
      quantityToSell -= soldFromLot;

      const costBasis = soldFromLot * lot.unitCost;
      const proceeds = totalProceeds * (soldFromLot / Math.min(quantity, quantityBeforeSale));
      totalCostBasis += costBasis;

      allocations.push({
        lotLabel: lot.label,
        lotDate: lot.date,
        quantity: soldFromLot,
        costBasis,
        proceeds,
      });
    }

    const quantitySold = allocations.reduce((sum, item) => sum + item.quantity, 0);
    const quantityAfterSale = lots.reduce((sum, lot) => sum + Math.max(0, lot.quantityRemaining), 0);
    const partialPct = quantityBeforeSale > 0
      ? (quantitySold / quantityBeforeSale) * 100
      : 0;
    const resultValue = totalProceeds - totalCostBasis;

    realizedEvents.push({
      date: txDate,
      closeType: quantityAfterSale > 0 ? 'Venda parcial' : 'Venda total',
      quantitySold,
      quantityBeforeSale,
      partialPct,
      investedValue: totalCostBasis,
      finalValue: totalProceeds,
      resultValue,
      resultPct: totalCostBasis > 0 ? (resultValue / totalCostBasis) * 100 : 0,
      allocations,
    });
  }

  const maturityDate = String(assetModel?.metadata?.maturityDate || '').trim();
  const isFixedIncome = assetModel?.assetClass === 'fixed_income';
  if (isFixedIncome && maturityDate && maturityDate <= asOfDate) {
    const remainingQuantity = lots.reduce((sum, lot) => sum + Math.max(0, lot.quantityRemaining), 0);
    if (remainingQuantity > 0) {
      const stateAtMaturity = buildStateUntilDate(transactions, maturityDate);
      const maturityUnitPrice = resolveUnitPriceAtDate({
        assetModel,
        targetDate: maturityDate,
        stateAtDate: stateAtMaturity,
        referenceData,
        fallbackDate,
      });

      const quantityBeforeSettlement = remainingQuantity;
      const allocations = [];
      let totalCostBasis = 0;

      lots.forEach((lot) => {
        const quantity = Math.max(0, lot.quantityRemaining);
        if (quantity <= 0) return;
        lot.quantityRemaining = 0;

        const costBasis = quantity * lot.unitCost;
        const proceeds = quantity * maturityUnitPrice;
        totalCostBasis += costBasis;
        allocations.push({
          lotLabel: lot.label,
          lotDate: lot.date,
          quantity,
          costBasis,
          proceeds,
        });
      });

      const totalProceeds = allocations.reduce((sum, item) => sum + item.proceeds, 0);
      const resultValue = totalProceeds - totalCostBasis;

      realizedEvents.push({
        date: maturityDate,
        closeType: 'Vencimento',
        quantitySold: quantityBeforeSettlement,
        quantityBeforeSale: quantityBeforeSettlement,
        partialPct: 100,
        investedValue: totalCostBasis,
        finalValue: totalProceeds,
        resultValue,
        resultPct: totalCostBasis > 0 ? (resultValue / totalCostBasis) * 100 : 0,
        allocations,
      });
    }
  }

  const openLots = lots.filter((lot) => lot.quantityRemaining > 0);
  const unitPriceAsOf = Math.max(0, safeNumber(snapshotAsOf?.unitPrice));
  const aporteDetails = openLots.map((lot) => {
    const investedValue = lot.quantityRemaining * lot.unitCost;
    const updatedValue = lot.quantityRemaining * unitPriceAsOf;
    const resultPct = investedValue > 0 ? ((updatedValue / investedValue) - 1) * 100 : 0;
    return {
      lotLabel: lot.label,
      lotDate: lot.date,
      quantity: lot.quantityRemaining,
      investedValue,
      updatedValue,
      resultPct,
    };
  });

  const totalRealizedInvested = realizedEvents.reduce((sum, item) => sum + item.investedValue, 0);
  const totalRealizedFinal = realizedEvents.reduce((sum, item) => sum + item.finalValue, 0);
  const totalRealizedResult = totalRealizedFinal - totalRealizedInvested;
  const firstInvestmentDate = transactions.find((tx) => buyOperations.has(String(tx.operation || '')))?.referenceDate
    || assetModel?.position?.referenceDate
    || null;

  return {
    firstInvestmentDate,
    aporteDetails,
    realizedEvents,
    totalRealizedInvested,
    totalRealizedFinal,
    totalRealizedResult,
    closeTypeSummary: summarizeCloseType(realizedEvents.map((item) => item.closeType)),
    liquidationDate: realizedEvents.length
      ? realizedEvents[realizedEvents.length - 1].date
      : null,
  };
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
      id: `asset-${item.assetId}`,
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

function toSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function normalizeAllocationTarget(value) {
  const parsed = parsePercentValue(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

function normalizeDeviationMargin(value) {
  const parsed = parsePercentValue(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

function formatSignedPercent(value, decimals = 2) {
  const parsed = Number(value || 0);
  const signal = parsed > 0 ? '+' : '';
  return `${signal}${parsed.toFixed(decimals).replace('.', ',')}%`;
}

function resolveAllocationStatus(diffPct, marginPct) {
  if (diffPct > marginPct) return 'over';
  if (diffPct < -marginPct) return 'under';
  return 'on-track';
}

function resolveAllocationActionText(status, diffPct) {
  if (status === 'over') return `Vender / Aguardar (${formatSignedPercent(diffPct, 1)})`;
  if (status === 'under') return `Aportar (${formatSignedPercent(diffPct, 1)})`;
  return `Manter (${formatSignedPercent(diffPct, 1)})`;
}

function resolveClassLabel(assetClass) {
  return classifyAssetGroup(assetClass) === 'rf' ? 'Renda Fixa' : 'Renda Variável';
}

function resolveSubclassLabel(asset) {
  return String(asset?.category || asset?.metadata?.subcategory || 'Sem subclasse').trim() || 'Sem subclasse';
}

function computeStrategyScore(rows) {
  const totalDeviation = rows.reduce((sum, row) => sum + Math.abs(safeNumber(row.diffPct)), 0);
  const score = 100 - (totalDeviation / 2);
  return Math.max(0, Math.min(100, Number(score.toFixed(1))));
}

function computeAporteRebalance(rows, totalPatrimony) {
  const candidates = rows
    .filter((row) => safeNumber(row.targetPct) > 0)
    .map((row) => {
      const currentValue = safeNumber(row.currentValue);
      const targetPct = safeNumber(row.targetPct);
      const desiredValueNow = (totalPatrimony * targetPct) / 100;
      const shortfallValue = desiredValueNow - currentValue;

      const idealTotal = targetPct > 0
        ? currentValue / (targetPct / 100)
        : totalPatrimony;

      const aporteNeeded = Math.max(0, idealTotal - totalPatrimony);

      return {
        ...row,
        shortfallValue,
        aporteNeeded,
      };
    })
    .filter((row) => row.shortfallValue > 0.0001)
    .sort((a, b) => b.aporteNeeded - a.aporteNeeded);

  if (!candidates.length || totalPatrimony <= 0) {
    return {
      amount: 0,
      basisId: null,
      basisName: null,
    };
  }

  const mostOff = candidates[0];

  return {
    amount: Number(safeNumber(mostOff.aporteNeeded).toFixed(2)),
    basisId: mostOff.id,
    basisName: mostOff.name,
  };
}

function computeTradeRebalance(rows) {
  const summary = rows.reduce((acc, row) => {
    const adjustment = safeNumber(row.adjustmentValue);

    if (adjustment > 0) {
      acc.buyAmount += adjustment;
    }

    if (adjustment < 0) {
      acc.sellAmount += Math.abs(adjustment);
    }

    return acc;
  }, {
    buyAmount: 0,
    sellAmount: 0,
  });

  return {
    buyAmount: Number(summary.buyAmount.toFixed(2)),
    sellAmount: Number(summary.sellAmount.toFixed(2)),
    netAmount: Number((summary.buyAmount - summary.sellAmount).toFixed(2)),
  };
}

function enrichAllocationRow(rawRow, totalPatrimony) {
  const currentValue = safeNumber(rawRow.currentValue);
  const targetPct = safeNumber(rawRow.targetPct);
  const marginPct = safeNumber(rawRow.marginPct);

  const realPct = totalPatrimony > 0
    ? (currentValue / totalPatrimony) * 100
    : 0;

  const diffPct = realPct - targetPct;
  const status = resolveAllocationStatus(diffPct, marginPct);
  const adjustmentValue = ((totalPatrimony * targetPct) / 100) - currentValue;
  const lossPct = safeNumber(rawRow.lossPct);
  const unrealizedPnl = safeNumber(rawRow.unrealizedPnl);

  const hasLossAlert = status === 'over' && adjustmentValue < 0 && unrealizedPnl < 0;
  const infoMessage = hasLossAlert
    ? `O sistema sugere vender ${formatCurrencyBRL(Math.abs(adjustmentValue))} para rebalancear, mas você está com prejuízo de ${formatSignedPercent(lossPct, 2)} neste ativo.`
    : '';

  return {
    ...rawRow,
    realPct: Number(realPct.toFixed(4)),
    diffPct: Number(diffPct.toFixed(4)),
    status,
    actionLabel: resolveAllocationActionText(status, diffPct),
    adjustmentValue: Number(adjustmentValue.toFixed(2)),
    hasLossAlert,
    infoMessage,
  };
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

function isBusinessDay(date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function buildBusinessDateRange(startIso, endIso) {
  if (!startIso || !endIso || startIso > endIso) return [];

  const start = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${endIso}T00:00:00.000Z`);
  const dates = [];

  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (!isBusinessDay(cursor)) continue;
    dates.push(toIsoDate(cursor));
  }

  return dates;
}

function formatPercentNoSignal(value, decimals = 2) {
  const parsed = Number(value || 0);
  return `${parsed.toFixed(decimals).replace('.', ',')}%`;
}

function toFixedNumber(value, decimals = 2) {
  return Number(Number(value || 0).toFixed(decimals));
}

function standardDeviationSample(values) {
  const series = (Array.isArray(values) ? values : []).filter((item) => Number.isFinite(item));
  if (series.length < 2) return 0;

  const mean = series.reduce((sum, value) => sum + value, 0) / series.length;
  const variance = series.reduce((sum, value) => {
    const diff = value - mean;
    return sum + (diff * diff);
  }, 0) / (series.length - 1);

  return variance > 0 ? Math.sqrt(variance) : 0;
}

function covarianceSample(aValues, bValues) {
  const paired = [];

  const maxLength = Math.min(
    Array.isArray(aValues) ? aValues.length : 0,
    Array.isArray(bValues) ? bValues.length : 0
  );

  for (let index = 0; index < maxLength; index += 1) {
    const a = Number(aValues[index]);
    const b = Number(bValues[index]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    paired.push([a, b]);
  }

  if (paired.length < 2) return 0;

  const meanA = paired.reduce((sum, row) => sum + row[0], 0) / paired.length;
  const meanB = paired.reduce((sum, row) => sum + row[1], 0) / paired.length;

  const cov = paired.reduce((sum, row) => {
    const da = row[0] - meanA;
    const db = row[1] - meanB;
    return sum + (da * db);
  }, 0) / (paired.length - 1);

  return cov;
}

function calculateMaxDrawdownPct(values) {
  const series = (Array.isArray(values) ? values : []).map((item) => Number(item)).filter((item) => Number.isFinite(item));
  if (!series.length) return 0;

  let peak = series[0];
  let maxDrawdown = 0;

  series.forEach((value) => {
    if (value > peak) peak = value;
    if (peak <= 0) return;
    const drawdown = ((value - peak) / peak) * 100;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  });

  return maxDrawdown;
}

function buildReturnsSeries(values) {
  const series = [];

  for (let index = 1; index < values.length; index += 1) {
    const previous = Number(values[index - 1]);
    const current = Number(values[index]);
    if (!Number.isFinite(previous) || previous <= 0 || !Number.isFinite(current)) {
      series.push(0);
      continue;
    }
    series.push((current - previous) / previous);
  }

  return series;
}

function classifyDrawdownLabel(drawdownPct) {
  const absValue = Math.abs(Number(drawdownPct || 0));
  if (absValue <= 5) return 'Risco Baixo';
  if (absValue <= 12) return 'Risco Médio';
  return 'Risco Alto';
}

function classifySharpeLabel(sharpe) {
  const value = Number(sharpe || 0);
  if (value < 0.5) return 'Ruim';
  if (value < 1) return 'Moderado';
  return 'Excelente';
}

function classifyBetaLabel(beta) {
  const value = Number(beta || 0);
  if (value < 0.8) return 'Defensivo';
  if (value > 1.2) return 'Agressivo';
  return 'Neutro';
}

function buildRollingBandMap(dates, returns, indexByDate) {
  const result = new Map();

  dates.forEach((date, index) => {
    const currentIndex = Number(indexByDate.get(date) || 100);

    if (index < 2) {
      result.set(date, 0.8);
      return;
    }

    const windowStart = Math.max(0, index - 21);
    const windowReturns = returns.slice(windowStart, index).filter((item) => Number.isFinite(item));
    const stdDaily = standardDeviationSample(windowReturns);
    const bandValue = currentIndex * stdDaily * Math.sqrt(21);
    result.set(date, Math.max(0.6, bandValue));
  });

  return result;
}

function pickMapValueOnOrBefore(map, isoDate) {
  if (!map?.size) return 0;
  if (map.has(isoDate)) return Number(map.get(isoDate) || 0);

  let selectedDate = null;
  for (const date of map.keys()) {
    if (date > isoDate) continue;
    if (!selectedDate || date > selectedDate) selectedDate = date;
  }

  if (!selectedDate) {
    const firstEntry = map.entries().next().value;
    return Number(firstEntry?.[1] || 0);
  }

  return Number(map.get(selectedDate) || 0);
}

function buildVolatilityChartPoints(anchorDates, portfolioIndexByDate, benchmarkIndexByDate, bandByDate) {
  return anchorDates.map((anchorDate) => {
    const adjustedDate = adjustWeekendDate(anchorDate);
    const portfolioValue = pickMapValueOnOrBefore(portfolioIndexByDate, adjustedDate);
    const benchmarkValue = pickMapValueOnOrBefore(benchmarkIndexByDate, adjustedDate);
    const bandValue = pickMapValueOnOrBefore(bandByDate, adjustedDate);

    return {
      date: adjustedDate,
      label: toMonthLabel(adjustedDate),
      val: toFixedNumber(portfolioValue, 2),
      dev: toFixedNumber(bandValue, 2),
      bench: toFixedNumber(benchmarkValue, 2),
    };
  });
}

function computeRiskMetrics({ values, benchmarkDailyReturns, riskFreeCumulativeReturn }) {
  const cleanValues = (Array.isArray(values) ? values : []).map((item) => Number(item)).filter((item) => Number.isFinite(item));

  if (cleanValues.length < 2) {
    return {
      volatilityAnnualPct: 0,
      maxDrawdownPct: 0,
      sharpe: 0,
      beta: 0,
      returns: [],
    };
  }

  const returns = buildReturnsSeries(cleanValues);
  const stdDaily = standardDeviationSample(returns);
  const volatilityAnnualDecimal = stdDaily * Math.sqrt(252);
  const volatilityAnnualPct = volatilityAnnualDecimal * 100;

  const maxDrawdownPct = calculateMaxDrawdownPct(cleanValues);

  const start = cleanValues[0];
  const end = cleanValues[cleanValues.length - 1];
  const portfolioReturn = start > 0 ? ((end / start) - 1) : 0;

  const sharpe = volatilityAnnualDecimal > 0
    ? (portfolioReturn - Number(riskFreeCumulativeReturn || 0)) / volatilityAnnualDecimal
    : 0;

  const benchmarkReturns = Array.isArray(benchmarkDailyReturns)
    ? benchmarkDailyReturns.slice(0, returns.length)
    : [];
  const benchmarkVariance = Math.pow(standardDeviationSample(benchmarkReturns), 2);
  const beta = benchmarkVariance > 0
    ? covarianceSample(returns, benchmarkReturns) / benchmarkVariance
    : 0;

  return {
    volatilityAnnualPct,
    maxDrawdownPct,
    sharpe,
    beta,
    returns,
  };
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

function normalizeFixedIncomeIndexer(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (['PRÉ-FIXADO', 'PRE-FIXADO', 'PRE FIXADO'].includes(normalized)) return 'PREFIXADO';
  if (['PREFIXADO', 'CDI', 'IPCA'].includes(normalized)) return normalized;
  return '';
}

function toMonthKey(isoDate) {
  return String(isoDate || '').slice(0, 7);
}

function shiftMonth(monthKey, deltaMonths) {
  const [yearText, monthText] = String(monthKey || '').split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;

  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + deltaMonths);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function resolveIpcaCutoffMonth(targetIsoDate) {
  const day = Number(String(targetIsoDate || '').slice(8, 10));
  const baseMonth = toMonthKey(targetIsoDate);
  if (!baseMonth) return '';
  return day <= 15 ? shiftMonth(baseMonth, -1) : baseMonth;
}

function resolveAssetOriginDate(assetModel, fallbackDate) {
  const txs = Array.isArray(assetModel?.transactions) ? assetModel.transactions : [];
  const firstTxDate = txs[0]?.referenceDate;
  const positionDate = assetModel?.position?.referenceDate;
  return firstTxDate || positionDate || fallbackDate;
}

async function buildFixedIncomeReferenceData(context, startIso, endIso) {
  const cdiDailySeries = await buildDailyBenchmarkSeries('cdi', startIso, endIso);
  const cdiDailyRateByDate = new Map(
    cdiDailySeries.map((item) => [item.date, Number(item.dailyReturn || 0)])
  );
  const businessDates = buildBusinessDateRange(startIso, endIso);

  const ipcaMonthlyByMonth = new Map();
  if (context?.brapiClient && typeof context.brapiClient.getInflationHistory === 'function' && startIso && endIso && startIso <= endIso) {
    try {
      const payload = await context.brapiClient.getInflationHistory({
        country: 'brazil',
        historical: true,
        start: toBrapiDate(startIso),
        end: toBrapiDate(endIso),
        sortBy: 'date',
        sortOrder: 'asc',
      });

      const entries = collapseInflationByMonth(extractInflationEntries(payload));
      entries.forEach((entry) => {
        const monthKey = toMonthKey(entry.date);
        if (!monthKey) return;
        ipcaMonthlyByMonth.set(monthKey, Number(entry.valuePct || 0));
      });
    } catch (_error) {
    }
  }

  return {
    cdiDailyRateByDate,
    businessDates,
    ipcaMonthlyByMonth,
  };
}

function countBusinessDaysExclusiveStart(startIso, endIso) {
  if (!startIso || !endIso || endIso <= startIso) return 0;
  return buildBusinessDateRange(startIso, endIso).filter((date) => date > startIso).length;
}

function resolveBusinessDatesInRange(referenceData, startIso, endIso) {
  if (!startIso || !endIso || endIso <= startIso) return [];

  const referenceDates = Array.isArray(referenceData?.businessDates)
    ? referenceData.businessDates
    : [];

  if (referenceDates.length) {
    return referenceDates.filter((date) => date > startIso && date <= endIso);
  }

  return buildBusinessDateRange(startIso, endIso).filter((date) => date > startIso);
}

function resolveFixedIncomeGrowthPct(asset, startIso, targetIso, referenceData) {
  if (!asset || !startIso || !targetIso || targetIso <= startIso) return 0;

  const maturityDate = String(asset?.metadata?.maturityDate || '').trim();
  const cappedTarget = maturityDate && maturityDate < targetIso ? maturityDate : targetIso;
  if (!cappedTarget || cappedTarget <= startIso) return 0;

  const indexer = normalizeFixedIncomeIndexer(asset?.metadata?.indexer);
  const rate = Number(asset?.metadata?.rate || 0);

  if (!indexer || !Number.isFinite(rate) || rate < 0) return 0;

  const businessDates = resolveBusinessDatesInRange(referenceData, startIso, cappedTarget);
  const businessDays = businessDates.length;

  if (indexer === 'PREFIXADO') {
    if (!businessDays) return 0;
    const annualRate = rate / 100;
    return (Math.pow(1 + annualRate, businessDays / 252) - 1) * 100;
  }

  if (indexer === 'CDI') {
    if (!businessDays) return 0;

    const contractedFactor = rate / 100;
    const cdiDailyRateByDate = referenceData?.cdiDailyRateByDate || new Map();

    let factor = 1;
    businessDates.forEach((date) => {
      const cdiDaily = Number(cdiDailyRateByDate.get(date) || 0);
      factor *= (1 + (cdiDaily * contractedFactor));
    });

    return (factor - 1) * 100;
  }

  if (indexer === 'IPCA') {
    if (!businessDays) return 0;

    const ipcaCutoffMonth = resolveIpcaCutoffMonth(cappedTarget);
    const ipcaMonthlyByMonth = referenceData?.ipcaMonthlyByMonth || new Map();

    let ipcaFactor = 1;
    businessDates.forEach((date) => {
      const monthKey = toMonthKey(date);
      if (!monthKey || monthKey > ipcaCutoffMonth) return;

      const monthPct = Number(ipcaMonthlyByMonth.get(monthKey) || 0);
      const monthDailyRate = Math.pow(1 + (monthPct / 100), 1 / 252) - 1;
      ipcaFactor *= (1 + monthDailyRate);
    });

    const additionalSpreadFactor = Math.pow(1 + (rate / 100), businessDays / 252);
    return ((ipcaFactor * additionalSpreadFactor) - 1) * 100;
  }

  return 0;
}

function resolveUnitPriceAtDate({ assetModel, targetDate, stateAtDate, referenceData, fallbackDate }) {
  const fallbackPrice = safeNumber(
    assetModel?.position?.marketPrice,
    safeNumber(assetModel?.position?.avgPrice)
  );

  if (!assetModel?.assetClass || assetModel.assetClass !== 'fixed_income') {
    let marketPrice = fallbackPrice;
    if (Array.isArray(assetModel?.history) && assetModel.history.length) {
      const matched = pickPriceForDate(assetModel.history, adjustWeekendDate(targetDate));
      if (matched) marketPrice = safeNumber(matched.price, marketPrice);
    }
    return marketPrice;
  }

  const baseUnitCost = safeNumber(
    stateAtDate?.avgCost,
    safeNumber(assetModel?.position?.avgPrice, fallbackPrice)
  );

  if (baseUnitCost <= 0) return fallbackPrice;

  const originDate = resolveAssetOriginDate(assetModel, fallbackDate);
  const growthPct = resolveFixedIncomeGrowthPct(assetModel, originDate, targetDate, referenceData);
  const adjustedPrice = baseUnitCost * (1 + (growthPct / 100));
  return Number.isFinite(adjustedPrice) && adjustedPrice > 0 ? adjustedPrice : fallbackPrice;
}

function resolveAssetSnapshotAtDate({
  assetModel,
  targetDate,
  stateAtDate,
  referenceData,
  fallbackDate,
  fallbackQuantity,
}) {
  const baseQuantity = assetModel?.transactions?.length
    ? safeNumber(stateAtDate?.quantity)
    : safeNumber(fallbackQuantity);

  const avgCost = assetModel?.transactions?.length
    ? safeNumber(stateAtDate?.avgCost)
    : safeNumber(assetModel?.position?.avgPrice);

  let realizedCash = safeNumber(stateAtDate?.realizedCash);
  let realizedResult = safeNumber(stateAtDate?.realizedResult);
  let realizedCostBasis = safeNumber(stateAtDate?.realizedCostBasis);
  let openQuantity = Math.max(0, baseQuantity);
  let unitPrice = resolveUnitPriceAtDate({
    assetModel,
    targetDate,
    stateAtDate,
    referenceData,
    fallbackDate,
  });

  const maturityDate = String(assetModel?.metadata?.maturityDate || '').trim();
  const shouldSettleAtMaturity = assetModel?.assetClass === 'fixed_income'
    && maturityDate
    && targetDate >= maturityDate
    && openQuantity > 0;

  if (shouldSettleAtMaturity) {
    const stateAtMaturity = buildStateUntilDate(assetModel?.transactions || [], maturityDate);
    const maturityPrice = resolveUnitPriceAtDate({
      assetModel,
      targetDate: maturityDate,
      stateAtDate: stateAtMaturity,
      referenceData,
      fallbackDate,
    });

    const settlementCostBasis = openQuantity * Math.max(0, avgCost);
    const settlementValue = openQuantity * Math.max(0, maturityPrice);

    realizedCash += settlementValue;
    realizedResult += (settlementValue - settlementCostBasis);
    realizedCostBasis += settlementCostBasis;

    openQuantity = 0;
    unitPrice = 0;
  }

  const openValue = openQuantity * Math.max(0, unitPrice);
  const openInvested = openQuantity * Math.max(0, avgCost);

  return {
    openQuantity,
    avgCost,
    unitPrice,
    openValue,
    openInvested,
    realizedCash,
    realizedResult,
    realizedCostBasis,
    totalValue: openValue + realizedCash,
  };
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

  const openAssets = assetsModel.filter((item) => safeNumber(item.openQuantity) > 0 && safeNumber(item.currentValue) > 0);
  const realizedAssets = assetsModel.filter((item) => Array.isArray(item?.flowDetails?.realizedEvents) && item.flowDetails.realizedEvents.length > 0);

  const grouped = openAssets.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = { total: 0, count: 0 };
    acc[item.group].total += item.currentValue;
    acc[item.group].count += 1;
    return acc;
  }, { rv: { total: 0, count: 0 }, rf: { total: 0, count: 0 } });

  const openTotal = openMarketValue || 1;

  const buildAporteRows = (assetModel) => {
    const aporteDetails = Array.isArray(assetModel?.flowDetails?.aporteDetails)
      ? assetModel.flowDetails.aporteDetails
      : [];

    return aporteDetails.map((aporte) => ({
      id: '',
      name: aporte.lotLabel,
      meta: `${formatIsoDateBr(aporte.lotDate)} · ${formatQuantityNumber(aporte.quantity)} unidade(s)`,
      value: formatCurrencyBRL(aporte.investedValue),
      varText: `${formatPercent(aporte.resultPct)} · Atualizado: ${formatCurrencyBRL(aporte.updatedValue)}`,
    }));
  };

  const buildRealizedRows = (assetModel) => {
    const events = Array.isArray(assetModel?.flowDetails?.realizedEvents)
      ? assetModel.flowDetails.realizedEvents
      : [];

    return events.map((event) => ({
      id: '',
      name: event.closeType === 'Venda parcial'
        ? `Venda parcial de ${event.partialPct.toFixed(1).replace('.', ',')}%`
        : event.closeType,
      meta: `${formatIsoDateBr(event.date)} · Quantidade: ${formatQuantityNumber(event.quantitySold)}`,
      value: formatCurrencyBRL(event.resultValue),
      varText: `Investido: ${formatCurrencyBRL(event.investedValue)} · Final: ${formatCurrencyBRL(event.finalValue)}`,
    }));
  };

  const unrealizedViews = openAssets.reduce((acc, assetModel) => {
    const viewId = `asset-${assetModel.assetId}`;
    const aporteRows = buildAporteRows(assetModel);
    const firstInvestmentDate = assetModel?.flowDetails?.firstInvestmentDate;

    acc[viewId] = {
      title: assetModel.name,
      subtitle: `${assetModel.ticker || assetModel.assetClass} · Detalhamento por ativo`,
      label: 'Patrimônio atual',
      value: formatCurrencyBRL(assetModel.currentValue),
      variation: `${assetModel.unrealizedPnl >= 0 ? '+' : ''}${formatCurrencyBRL(assetModel.unrealizedPnl)} (não realizado)`,
      secondaryLabel: 'Capital investido',
      secondaryValue: formatCurrencyBRL(assetModel.investedOpen),
      tertiaryLabel: 'Realizado (Em caixa)',
      tertiaryValue: formatCurrencyBRL(assetModel.realizedCash),
      chart: {
        currency: 'BRL',
        points: Array.isArray(assetModel.chartPoints) && assetModel.chartPoints.length
          ? assetModel.chartPoints
          : chartPoints,
      },
      details: {
        left: [
          {
            id: '',
            name: 'Data do investimento',
            meta: 'Data inicial do ativo',
            value: formatIsoDateBr(firstInvestmentDate),
            varText: '',
          },
          {
            id: '',
            name: 'Quantidade comprada',
            meta: 'Posição aberta atual',
            value: formatQuantityNumber(assetModel.openQuantity),
            varText: '',
          },
          {
            id: '',
            name: 'Preço médio pago',
            meta: 'Custo médio por unidade',
            value: formatCurrencyBRL(assetModel.avgCost),
            varText: '',
          },
          {
            id: '',
            name: 'Preço atual',
            meta: 'Preço na data de referência',
            value: formatCurrencyBRL(assetModel.unitPrice),
            varText: '',
          },
          {
            id: '',
            name: 'Capital investido',
            meta: 'Custo das posições abertas',
            value: formatCurrencyBRL(assetModel.investedOpen),
            varText: '',
          },
          {
            id: '',
            name: 'Patrimônio atual',
            meta: 'Valor de mercado da posição aberta',
            value: formatCurrencyBRL(assetModel.currentValue),
            varText: '',
          },
          {
            id: '',
            name: 'Realizado em caixa',
            meta: 'Vendas, proventos e liquidações',
            value: formatCurrencyBRL(assetModel.realizedCash),
            varText: '',
          },
        ],
        right: aporteRows,
      },
    };
    return acc;
  }, {});

  const realizedAssetViews = realizedAssets.reduce((acc, assetModel) => {
    const viewId = `asset-realizado-${assetModel.assetId}`;
    const flowDetails = assetModel.flowDetails || {};
    const events = Array.isArray(flowDetails.realizedEvents) ? flowDetails.realizedEvents : [];
    const totalInvested = safeNumber(flowDetails.totalRealizedInvested);
    const totalFinal = safeNumber(flowDetails.totalRealizedFinal);
    const totalResult = safeNumber(flowDetails.totalRealizedResult);
    const totalPct = totalInvested > 0 ? (totalResult / totalInvested) * 100 : 0;

    acc[viewId] = {
      title: `${assetModel.name} · Realizado`,
      subtitle: `${assetModel.ticker || assetModel.assetClass} · Histórico de encerramento`,
      label: 'Resultado final',
      value: formatCurrencyBRL(totalResult),
      variation: formatPercent(totalPct),
      secondaryLabel: 'Valor investido',
      secondaryValue: formatCurrencyBRL(totalInvested),
      tertiaryLabel: 'Valor final',
      tertiaryValue: formatCurrencyBRL(totalFinal),
      chart: {
        currency: 'BRL',
        points: [],
        hidden: true,
      },
      details: {
        left: [
          {
            id: '',
            name: 'Data(s) de aporte',
            meta: 'Data inicial do investimento',
            value: formatIsoDateBr(flowDetails.firstInvestmentDate),
            varText: '',
          },
          {
            id: '',
            name: 'Data de liquidação',
            meta: 'Último evento realizado',
            value: formatIsoDateBr(flowDetails.liquidationDate),
            varText: '',
          },
          {
            id: '',
            name: 'Tipo de encerramento',
            meta: 'Vencimento / venda total / parcial',
            value: flowDetails.closeTypeSummary || '—',
            varText: '',
          },
        ],
        right: buildRealizedRows(assetModel),
      },
    };
    return acc;
  }, {});

  const unrealizedListRows = openAssets
    .sort((a, b) => b.currentValue - a.currentValue)
    .map((assetModel) => ({
      id: `asset-${assetModel.assetId}`,
      name: assetModel.name,
      meta: assetModel.ticker || assetModel.assetClass,
      value: formatCurrencyBRL(assetModel.currentValue),
      varText: `${assetModel.unrealizedPnl >= 0 ? '+' : ''}${formatCurrencyBRL(assetModel.unrealizedPnl)}`,
    }));

  const realizedListRows = realizedAssets
    .sort((a, b) => safeNumber(b.flowDetails?.totalRealizedFinal) - safeNumber(a.flowDetails?.totalRealizedFinal))
    .map((assetModel) => ({
      id: `asset-realizado-${assetModel.assetId}`,
      name: assetModel.name,
      meta: `${assetModel.ticker || assetModel.assetClass} · ${assetModel.flowDetails?.closeTypeSummary || 'Realizado'}`,
      value: formatCurrencyBRL(assetModel.flowDetails?.totalRealizedFinal || 0),
      varText: `${safeNumber(assetModel.flowDetails?.totalRealizedResult) >= 0 ? '+' : ''}${formatCurrencyBRL(assetModel.flowDetails?.totalRealizedResult || 0)}`,
    }));

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
              id: 'realizado',
              name: 'Resultado realizado',
              meta: 'Vendas e proventos',
              value: formatCurrencyBRL(realizedResult),
              varText: '',
            },
            {
              id: 'nao-realizado',
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
          left: buildAssetDetailsRows(openAssets, 'rv'),
          right: [],
        },
        chart: {
          currency: 'BRL',
          points: chartPoints,
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
          left: buildAssetDetailsRows(openAssets, 'rf'),
          right: [],
        },
        chart: {
          currency: 'BRL',
          points: chartPoints,
        },
      },
      'nao-realizado': {
        title: 'Resultado Não Realizado',
        subtitle: 'Posições abertas com resultado em papel',
        label: 'Patrimônio em aberto',
        value: formatCurrencyBRL(openMarketValue),
        variation: `${unrealizedPnl >= 0 ? '+' : ''}${formatCurrencyBRL(unrealizedPnl)}`,
        secondaryLabel: 'Ativos em posição',
        secondaryValue: String(unrealizedListRows.length),
        tertiaryLabel: 'Capital investido',
        tertiaryValue: formatCurrencyBRL(openInvested),
        chart: {
          currency: 'BRL',
          points: chartPoints,
        },
        details: {
          left: unrealizedListRows,
          right: [],
        },
      },
      realizado: {
        title: 'Ativos Realizados',
        subtitle: 'Posições encerradas por venda ou vencimento',
        label: 'Realizado (Em caixa)',
        value: formatCurrencyBRL(realizedCash),
        variation: `${realizedResult >= 0 ? '+' : ''}${formatCurrencyBRL(realizedResult)}`,
        secondaryLabel: 'Ativos encerrados',
        secondaryValue: String(realizedListRows.length),
        tertiaryLabel: 'Base de custo realizada',
        tertiaryValue: formatCurrencyBRL(realizedCostBasis),
        chart: {
          currency: 'BRL',
          points: [],
          hidden: true,
        },
        details: {
          left: realizedListRows,
          right: [],
        },
      },
      ...unrealizedViews,
      ...realizedAssetViews,
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

      const fixedIncomeAssetIds = Array.from(allAssetIds).filter((assetId) => {
        const assetClass = assetById.get(assetId)?.assetClass || positionByAsset.get(assetId)?.assetClass;
        return assetClass === 'fixed_income';
      });

      const fixedIncomeStartDate = fixedIncomeAssetIds.reduce((minDate, assetId) => {
        const txs = transactionsByAsset.get(assetId) || [];
        const firstDate = txs[0]?.referenceDate || positionByAsset.get(assetId)?.referenceDate || chartStartDate;
        return !minDate || firstDate < minDate ? firstDate : minDate;
      }, null) || chartStartDate;

      const fixedIncomeReferenceData = fixedIncomeAssetIds.length
        ? await buildFixedIncomeReferenceData(context, fixedIncomeStartDate, chartEndDate)
        : null;

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

        const ticker = resolveTicker(asset);
        const canUseBrapi = asset.assetClass === 'equity' && !!ticker;
        const history = canUseBrapi
          ? await getTickerHistory(context, ticker, historyCache)
          : [];

        const assetModelBase = {
          ...asset,
          position,
          assetClass: asset.assetClass,
          history,
          transactions: txs,
        };

        const snapshotAsOf = resolveAssetSnapshotAtDate({
          assetModel: assetModelBase,
          targetDate: asOfDate,
          stateAtDate: stateAsOf,
          referenceData: fixedIncomeReferenceData,
          fallbackDate: chartStartDate,
          fallbackQuantity: position?.quantity,
        });

        const currentValue = snapshotAsOf.openValue;
        const investedOpen = snapshotAsOf.openInvested;
        const unrealizedPnl = currentValue - investedOpen;
        const flowDetails = buildAssetFlowDetails({
          assetModel: assetModelBase,
          asOfDate,
          snapshotAsOf,
          referenceData: fixedIncomeReferenceData,
          fallbackDate: chartStartDate,
        });

        const assetInvestedCapital = txs.length
          ? stateAsOf.investedCapital
          : safeNumber(position?.investedAmount, investedOpen);

        openMarketValue += currentValue;
        openInvested += investedOpen;
        investedCapital += assetInvestedCapital;
        realizedCash += snapshotAsOf.realizedCash;
        realizedResult += snapshotAsOf.realizedResult;
        realizedCostBasis += snapshotAsOf.realizedCostBasis;

        assetsModel.push({
          assetId,
          name: asset.name || assetId,
          ticker,
          assetClass: asset.assetClass,
          metadata: asset.metadata || {},
          group,
          openQuantity: snapshotAsOf.openQuantity,
          avgCost: snapshotAsOf.avgCost,
          unitPrice: snapshotAsOf.unitPrice,
          currentValue,
          investedOpen,
          realizedCash: snapshotAsOf.realizedCash,
          unrealizedPnl,
          history,
          transactions: txs,
          position,
          chartPoints: [],
          flowDetails,
        });
      }

      const chartPoints = chartTargetDates.map((targetDate) => {
        let openValueAtDate = 0;
        let realizedCashAtDate = 0;

        assetsModel.forEach((assetModel) => {
          const state = buildStateUntilDate(assetModel.transactions, targetDate);
          const snapshotAtDate = resolveAssetSnapshotAtDate({
            assetModel,
            targetDate,
            stateAtDate: state,
            referenceData: fixedIncomeReferenceData,
            fallbackDate: chartStartDate,
            fallbackQuantity: assetModel.position?.quantity,
          });

          realizedCashAtDate += snapshotAtDate.realizedCash;
          openValueAtDate += snapshotAtDate.openValue;
        });

        const value = openValueAtDate + realizedCashAtDate;

        return {
          label: toDateLabel(targetDate),
          value,
          currency: 'BRL',
        };
      });

      assetsModel.forEach((assetModel) => {
        assetModel.chartPoints = chartTargetDates.map((targetDate) => {
          const state = buildStateUntilDate(assetModel.transactions, targetDate);
          const snapshotAtDate = resolveAssetSnapshotAtDate({
            assetModel,
            targetDate,
            stateAtDate: state,
            referenceData: fixedIncomeReferenceData,
            fallbackDate: chartStartDate,
            fallbackQuantity: assetModel.position?.quantity,
          });

          return {
            label: toDateLabel(targetDate),
            value: snapshotAtDate.totalValue,
            currency: 'BRL',
          };
        });
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

  const allocationMetricHandler = async ({ context, filters }) => {
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
      ...Array.from(assetById.keys()),
    ]);

    const fixedIncomeAssetIds = Array.from(allAssetIds).filter((assetId) => {
      const assetClass = assetById.get(assetId)?.assetClass || positionByAsset.get(assetId)?.assetClass;
      return assetClass === 'fixed_income';
    });

    const fixedIncomeStartDate = fixedIncomeAssetIds.reduce((minDate, assetId) => {
      const txs = transactionsByAsset.get(assetId) || [];
      const firstDate = txs[0]?.referenceDate || positionByAsset.get(assetId)?.referenceDate || asOfDate;
      return !minDate || firstDate < minDate ? firstDate : minDate;
    }, null) || asOfDate;

    const fixedIncomeReferenceData = fixedIncomeAssetIds.length
      ? await buildFixedIncomeReferenceData(context, fixedIncomeStartDate, asOfDate)
      : null;

    if (!allAssetIds.size) {
      return {
        status: 'empty',
        data: {
          widget: {
            rootView: 'class-root',
            generatedAt: new Date().toISOString(),
            asOfDate,
            recalcPolicy: {
              basis: 'mark-to-market',
              refreshPerDay: 3,
              refreshIntervalHours: 8,
            },
            kpis: {
              class: {
                score: 100,
                aporteRebalance: { amount: 0, basisId: null, basisName: null },
                tradeRebalance: { buyAmount: 0, sellAmount: 0, netAmount: 0 },
              },
              subclass: {
                score: 100,
                aporteRebalance: { amount: 0, basisId: null, basisName: null },
                tradeRebalance: { buyAmount: 0, sellAmount: 0, netAmount: 0 },
              },
              asset: {
                score: 100,
                aporteRebalance: { amount: 0, basisId: null, basisName: null },
                tradeRebalance: { buyAmount: 0, sellAmount: 0, netAmount: 0 },
              },
            },
            totalPatrimony: 0,
            nodes: [],
          },
        },
      };
    }

    const historyCache = new Map();
    const assetRowsRaw = [];

    for (const assetId of allAssetIds) {
      const txs = (transactionsByAsset.get(assetId) || []).sort(sortByDateAndCreation);
      const position = positionByAsset.get(assetId) || null;
      const asset = assetById.get(assetId) || {
        assetId,
        name: assetId,
        assetClass: position?.assetClass || 'equity',
        category: position?.category || null,
        metadata: {},
      };

      const stateEnd = buildStateUntilDate(txs, asOfDate);

      const ticker = resolveTicker(asset);
      const canUseBrapi = !!ticker && ['equity', 'crypto', 'funds'].includes(asset.assetClass);
      const history = canUseBrapi
        ? await getTickerHistory(context, ticker, historyCache)
        : [];

      const assetModelBase = {
        ...asset,
        position,
        assetClass: asset.assetClass,
        history,
        transactions: txs,
      };

      const snapshotEnd = resolveAssetSnapshotAtDate({
        assetModel: assetModelBase,
        targetDate: asOfDate,
        stateAtDate: stateEnd,
        referenceData: fixedIncomeReferenceData,
        fallbackDate: fixedIncomeStartDate,
        fallbackQuantity: position?.quantity,
      });

      const quantityEnd = snapshotEnd.openQuantity;
      const currentPrice = snapshotEnd.unitPrice;
      const currentValue = snapshotEnd.openValue;

      if (quantityEnd <= 0 && safeNumber(position?.marketValue) <= 0 && currentValue <= 0) continue;

      if (currentValue <= 0) continue;

      const avgCost = snapshotEnd.avgCost;
      const investedOpen = snapshotEnd.openInvested;
      const unrealizedPnl = currentValue - investedOpen;
      const realizedResult = safeNumber(snapshotEnd.realizedResult);
      const financialResult = unrealizedPnl + realizedResult;
      const lossPct = avgCost > 0
        ? ((currentPrice / avgCost) - 1) * 100
        : 0;

      const metadata = asset.metadata || {};
      const targetPct = normalizeAllocationTarget(metadata.allocationTargetPct);
      const marginPct = normalizeDeviationMargin(
        metadata.allocationDeviationPct
        ?? metadata.deviationMarginPct
        ?? metadata.marginDeviationPct
      );

      const classKey = classifyAssetGroup(asset.assetClass);
      const classLabel = resolveClassLabel(asset.assetClass);
      const subclassLabel = resolveSubclassLabel(asset);

      const subclassKey = `${classKey}:${toSlug(subclassLabel) || 'sem-subclasse'}`;

      assetRowsRaw.push({
        id: `asset:${assetId}`,
        parentId: `subclass:${subclassKey}`,
        level: 'asset',
        name: asset.name || assetId,
        assetId,
        ticker,
        assetClass: asset.assetClass,
        classKey,
        classLabel,
        subclassKey,
        subclassLabel,
        currentValue,
        targetPct,
        marginPct,
        unrealizedPnl,
        realizedResult,
        financialResult,
        lossPct,
      });
    }

    const totalPatrimony = assetRowsRaw.reduce((sum, row) => sum + row.currentValue, 0);

    const classAcc = new Map();
    const subclassAcc = new Map();

    assetRowsRaw.forEach((row) => {
      const classTarget = classAcc.get(row.classKey) || {
        id: `class:${row.classKey}`,
        parentId: null,
        level: 'class',
        name: row.classLabel,
        classKey: row.classKey,
        classLabel: row.classLabel,
        currentValue: 0,
        targetPct: 0,
        marginWeightedSum: 0,
        marginWeightTotal: 0,
        unrealizedPnl: 0,
        realizedResult: 0,
        financialResult: 0,
      };

      classTarget.currentValue += row.currentValue;
      classTarget.targetPct += row.targetPct;
      classTarget.marginWeightedSum += row.marginPct * row.currentValue;
      classTarget.marginWeightTotal += row.currentValue;
      classTarget.unrealizedPnl += row.unrealizedPnl;
      classTarget.realizedResult += row.realizedResult;
      classTarget.financialResult += row.financialResult;
      classAcc.set(row.classKey, classTarget);

      const subTarget = subclassAcc.get(row.subclassKey) || {
        id: `subclass:${row.subclassKey}`,
        parentId: `class:${row.classKey}`,
        level: 'subclass',
        name: row.subclassLabel,
        classKey: row.classKey,
        classLabel: row.classLabel,
        subclassKey: row.subclassKey,
        subclassLabel: row.subclassLabel,
        currentValue: 0,
        targetPct: 0,
        marginWeightedSum: 0,
        marginWeightTotal: 0,
        unrealizedPnl: 0,
        realizedResult: 0,
        financialResult: 0,
      };

      subTarget.currentValue += row.currentValue;
      subTarget.targetPct += row.targetPct;
      subTarget.marginWeightedSum += row.marginPct * row.currentValue;
      subTarget.marginWeightTotal += row.currentValue;
      subTarget.unrealizedPnl += row.unrealizedPnl;
      subTarget.realizedResult += row.realizedResult;
      subTarget.financialResult += row.financialResult;
      subclassAcc.set(row.subclassKey, subTarget);
    });

    const classRows = Array.from(classAcc.values())
      .map((row) => ({
        ...row,
        marginPct: row.marginWeightTotal > 0 ? row.marginWeightedSum / row.marginWeightTotal : 0,
      }))
      .map((row) => enrichAllocationRow(row, totalPatrimony))
      .sort((a, b) => b.currentValue - a.currentValue);

    const subclassRows = Array.from(subclassAcc.values())
      .map((row) => ({
        ...row,
        marginPct: row.marginWeightTotal > 0 ? row.marginWeightedSum / row.marginWeightTotal : 0,
      }))
      .map((row) => enrichAllocationRow(row, totalPatrimony))
      .sort((a, b) => b.currentValue - a.currentValue);

    const assetRows = assetRowsRaw
      .map((row) => enrichAllocationRow(row, totalPatrimony))
      .sort((a, b) => b.currentValue - a.currentValue);

    const nodes = [
      ...classRows,
      ...subclassRows,
      ...assetRows,
    ].map((node) => ({
      ...node,
      currentValueText: formatCurrencyBRL(node.currentValue),
      realPctText: formatSignedPercent(node.realPct, 2),
      targetPctText: formatSignedPercent(node.targetPct, 2),
      diffPctText: formatSignedPercent(node.diffPct, 2),
      adjustmentValueText: formatCurrencyBRL(node.adjustmentValue),
      marginPctText: formatSignedPercent(node.marginPct, 2),
      lossPctText: formatSignedPercent(node.lossPct, 2),
      realizedResultText: formatCurrencyBRL(node.realizedResult),
      unrealizedPnlText: formatCurrencyBRL(node.unrealizedPnl),
      financialResultText: formatCurrencyBRL(node.financialResult),
      realizedResultClass: safeNumber(node.realizedResult) > 0 ? 'positive' : safeNumber(node.realizedResult) < 0 ? 'negative' : 'neutral',
      unrealizedPnlClass: safeNumber(node.unrealizedPnl) > 0 ? 'positive' : safeNumber(node.unrealizedPnl) < 0 ? 'negative' : 'neutral',
      financialResultClass: safeNumber(node.financialResult) > 0 ? 'positive' : safeNumber(node.financialResult) < 0 ? 'negative' : 'neutral',
    }));

    const kpis = {
      class: {
        score: computeStrategyScore(classRows),
        aporteRebalance: computeAporteRebalance(classRows, totalPatrimony),
        tradeRebalance: computeTradeRebalance(classRows),
      },
      subclass: {
        score: computeStrategyScore(subclassRows),
        aporteRebalance: computeAporteRebalance(subclassRows, totalPatrimony),
        tradeRebalance: computeTradeRebalance(subclassRows),
      },
      asset: {
        score: computeStrategyScore(assetRows),
        aporteRebalance: computeAporteRebalance(assetRows, totalPatrimony),
        tradeRebalance: computeTradeRebalance(assetRows),
      },
    };

    return {
      status: 'ok',
      data: {
        widget: {
          rootView: 'class-root',
          generatedAt: new Date().toISOString(),
          asOfDate,
          recalcPolicy: {
            basis: 'mark-to-market',
            refreshPerDay: 3,
            refreshIntervalHours: 8,
          },
          totalPatrimony: Number(totalPatrimony.toFixed(2)),
          kpis,
          nodes,
        },
      },
    };
  };

  const allocationMetricAliases = [
    'investments.allocation_vs_target',
    'investments.allocation_real_vs_plan',
    'investments.allocation_rebalance',
    'investments.alocacao_real_planejada',
  ];

  allocationMetricAliases.forEach((metricId) => {
    registerMetric({
      id: metricId,
      title: 'Alocação Real vs Planejada',
      description: 'Compara alocação real vs meta em níveis classe/subclasse/ativo com score de aderência e recomendações de rebalanceamento.',
      supportedFilters: ['currencies', 'assetClasses', 'statuses', 'accountIds', 'tags', 'asOf'],
      output: { kind: 'widget' },
      tags: ['investments', 'dashboard', 'alocacao', 'rebalanceamento'],
      handler: allocationMetricHandler,
    });
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

      const fixedIncomeAssetIds = Array.from(allAssetIds).filter((assetId) => {
        const assetClass = assetById.get(assetId)?.assetClass || positionByAsset.get(assetId)?.assetClass;
        return assetClass === 'fixed_income';
      });

      const fixedIncomeStartDate = fixedIncomeAssetIds.reduce((minDate, assetId) => {
        const txs = transactionsByAsset.get(assetId) || [];
        const firstDate = txs[0]?.referenceDate || positionByAsset.get(assetId)?.referenceDate || period.start;
        return !minDate || firstDate < minDate ? firstDate : minDate;
      }, null) || period.start;

      const fixedIncomeReferenceData = fixedIncomeAssetIds.length
        ? await buildFixedIncomeReferenceData(context, fixedIncomeStartDate, period.end)
        : null;

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

        const assetModelBase = {
          ...asset,
          position,
          assetClass: asset.assetClass,
          history,
          transactions: txs,
        };

        const pointsByDate = new Map();

        anchorDates.forEach((targetDate) => {
          const state = buildStateUntilDate(txs, targetDate);
          const snapshotAtDate = resolveAssetSnapshotAtDate({
            assetModel: assetModelBase,
            targetDate,
            stateAtDate: state,
            referenceData: fixedIncomeReferenceData,
            fallbackDate: period.start,
            fallbackQuantity: position?.quantity,
          });

          pointsByDate.set(targetDate, {
            date: targetDate,
            openValue: snapshotAtDate.openValue,
            realizedCash: snapshotAtDate.realizedCash,
            totalValue: snapshotAtDate.totalValue,
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

  const volatilityHandler = async ({ context, filters }) => {
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
    const scope = String(filters.volatilityScope || 'consolidated').toLowerCase() === 'classes'
      ? 'classes'
      : 'consolidated';
    const benchmarkId = String(filters.volatilityBenchmark || 'ibov').toLowerCase() === 'cdi'
      ? 'cdi'
      : 'ibov';

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
            rootView: scope === 'classes' ? 'classes-root' : 'total',
            period: { preset: 'origin', start: asOfDate, end: asOfDate, label: 'Origem' },
            scope,
            benchmark: benchmarkId,
            views: {
              total: {
                title: 'Volatilidade Anualizada',
                subtitle: 'Sem dados para o período selecionado',
                mainLabel: 'Volatilidade (Portfólio)',
                mainValue: '0,00%',
                mainSub: 'Desvio padrão anual.',
                secondaryLabel: 'Volatilidade (Benchmark)',
                secondaryValue: '0,00%',
                secondarySub: benchmarkId.toUpperCase(),
                drawdownValue: '0,00%',
                drawdownPill: 'Risco Baixo',
                sharpeValue: '0,00',
                sharpePill: 'Ruim',
                betaValue: '0,00',
                betaPill: 'Neutro',
                chartData: [],
                details: [],
              },
              'classes-root': {
                title: 'Volatilidade por Classes',
                subtitle: 'Sem dados para o período selecionado',
                mainLabel: 'Volatilidade (Classes)',
                mainValue: '0,00%',
                mainSub: 'Desvio padrão anual.',
                secondaryLabel: 'Volatilidade (Benchmark)',
                secondaryValue: '0,00%',
                secondarySub: benchmarkId.toUpperCase(),
                drawdownValue: '0,00%',
                drawdownPill: 'Risco Baixo',
                sharpeValue: '0,00',
                sharpePill: 'Ruim',
                betaValue: '0,00',
                betaPill: 'Neutro',
                chartData: [],
                details: [],
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

    const fixedIncomeAssetIds = Array.from(allAssetIds).filter((assetId) => {
      const assetClass = assetById.get(assetId)?.assetClass || positionByAsset.get(assetId)?.assetClass;
      return assetClass === 'fixed_income';
    });

    const fixedIncomeStartDate = fixedIncomeAssetIds.reduce((minDate, assetId) => {
      const txs = transactionsByAsset.get(assetId) || [];
      const firstDate = txs[0]?.referenceDate || positionByAsset.get(assetId)?.referenceDate || period.start;
      return !minDate || firstDate < minDate ? firstDate : minDate;
    }, null) || period.start;

    const fixedIncomeReferenceData = fixedIncomeAssetIds.length
      ? await buildFixedIncomeReferenceData(context, fixedIncomeStartDate, period.end)
      : null;

    const businessDates = buildBusinessDateRange(period.start, period.end);
    if (!businessDates.length) {
      return {
        status: 'empty',
        data: {
          widget: {
            rootView: scope === 'classes' ? 'classes-root' : 'total',
            period,
            scope,
            benchmark: benchmarkId,
            views: {
              total: {
                title: 'Volatilidade Anualizada',
                subtitle: `Período: ${period.label}`,
                mainLabel: 'Volatilidade (Portfólio)',
                mainValue: '0,00%',
                mainSub: 'Desvio padrão anual.',
                secondaryLabel: 'Volatilidade (Benchmark)',
                secondaryValue: '0,00%',
                secondarySub: benchmarkId.toUpperCase(),
                drawdownValue: '0,00%',
                drawdownPill: 'Risco Baixo',
                sharpeValue: '0,00',
                sharpePill: 'Ruim',
                betaValue: '0,00',
                betaPill: 'Neutro',
                chartData: [],
                details: [],
              },
            },
          },
        },
      };
    }

    const benchmarkDaily = await buildDailyBenchmarkSeries(benchmarkId, period.start, period.end);
    const cdiDaily = await buildDailyBenchmarkSeries('cdi', period.start, period.end);

    const benchmarkByDate = new Map(benchmarkDaily.map((item) => [item.date, item]));
    const cdiByDate = new Map(cdiDaily.map((item) => [item.date, item]));

    const benchmarkDailyReturns = businessDates.slice(1).map((date) => Number(benchmarkByDate.get(date)?.dailyReturn || 0));
    const benchmarkVolAnnualPct = standardDeviationSample(benchmarkDailyReturns) * Math.sqrt(252) * 100;
    const cdiPeriodReturn = Number(cdiByDate.get(businessDates[businessDates.length - 1])?.value || 0) / 100;

    const historyCache = new Map();
    const assetSeries = [];

    for (const assetId of allAssetIds) {
      const txs = (transactionsByAsset.get(assetId) || []).sort(sortByDateAndCreation);
      const position = positionByAsset.get(assetId) || null;
      const asset = assetById.get(assetId) || {
        assetId,
        name: assetId,
        assetClass: position?.assetClass || 'equity',
        category: position?.category || null,
        metadata: {},
      };

      const ticker = resolveTicker(asset);
      const canUseBrapi = !!ticker && ['equity', 'crypto', 'funds'].includes(asset.assetClass);
      const history = canUseBrapi
        ? await getTickerHistory(context, ticker, historyCache)
        : [];

      const assetModelBase = {
        ...asset,
        position,
        assetClass: asset.assetClass,
        history,
        transactions: txs,
      };

      const valuesByDate = new Map();

      businessDates.forEach((date) => {
        const state = buildStateUntilDate(txs, date);

        const snapshotAtDate = resolveAssetSnapshotAtDate({
          assetModel: assetModelBase,
          targetDate: date,
          stateAtDate: state,
          referenceData: fixedIncomeReferenceData,
          fallbackDate: period.start,
          fallbackQuantity: position?.quantity,
        });

        valuesByDate.set(date, snapshotAtDate.totalValue);
      });

      const values = businessDates.map((date) => Number(valuesByDate.get(date) || 0));
      const metrics = computeRiskMetrics({
        values,
        benchmarkDailyReturns,
        riskFreeCumulativeReturn: cdiPeriodReturn,
      });

      assetSeries.push({
        assetId,
        name: asset.name || assetId,
        ticker,
        classKey: classifyAssetGroup(asset.assetClass),
        classLabel: resolveClassLabel(asset.assetClass),
        valuesByDate,
        metrics,
      });
    }

    const portfolioValuesByDate = new Map();
    businessDates.forEach((date) => {
      const total = assetSeries.reduce((sum, assetItem) => sum + Number(assetItem.valuesByDate.get(date) || 0), 0);
      portfolioValuesByDate.set(date, total);
    });

    const portfolioValues = businessDates.map((date) => Number(portfolioValuesByDate.get(date) || 0));
    const portfolioMetrics = computeRiskMetrics({
      values: portfolioValues,
      benchmarkDailyReturns,
      riskFreeCumulativeReturn: cdiPeriodReturn,
    });

    const portfolioIndexByDate = new Map();
    const basePortfolio = Number(portfolioValues[0] || 0);
    businessDates.forEach((date) => {
      const value = Number(portfolioValuesByDate.get(date) || 0);
      const indexValue = basePortfolio > 0 ? (value / basePortfolio) * 100 : 100;
      portfolioIndexByDate.set(date, indexValue);
    });

    const benchmarkIndexByDate = new Map();
    businessDates.forEach((date) => {
      const benchmarkPct = Number(benchmarkByDate.get(date)?.value || 0);
      benchmarkIndexByDate.set(date, 100 * (1 + (benchmarkPct / 100)));
    });

    const rollingBandByDate = buildRollingBandMap(
      businessDates,
      portfolioMetrics.returns,
      portfolioIndexByDate
    );

    const chartAnchors = buildAdaptiveAnchorDates(period.start, period.end, 24);

    const classRowsByKey = new Map();
    assetSeries.forEach((assetItem) => {
      if (!classRowsByKey.has(assetItem.classKey)) {
        classRowsByKey.set(assetItem.classKey, {
          classKey: assetItem.classKey,
          classLabel: assetItem.classLabel,
          valuesByDate: new Map(),
          assets: [],
        });
      }

      const classEntry = classRowsByKey.get(assetItem.classKey);
      classEntry.assets.push(assetItem);

      businessDates.forEach((date) => {
        const previous = Number(classEntry.valuesByDate.get(date) || 0);
        classEntry.valuesByDate.set(date, previous + Number(assetItem.valuesByDate.get(date) || 0));
      });
    });

    const classViews = {};

    const classRootRows = Array.from(classRowsByKey.values())
      .map((classItem) => {
        const classValues = businessDates.map((date) => Number(classItem.valuesByDate.get(date) || 0));
        const classMetrics = computeRiskMetrics({
          values: classValues,
          benchmarkDailyReturns,
          riskFreeCumulativeReturn: cdiPeriodReturn,
        });

        const classIndexByDate = new Map();
        const classBase = Number(classValues[0] || 0);
        businessDates.forEach((date) => {
          const value = Number(classItem.valuesByDate.get(date) || 0);
          classIndexByDate.set(date, classBase > 0 ? (value / classBase) * 100 : 100);
        });

        const classBandByDate = buildRollingBandMap(
          businessDates,
          classMetrics.returns,
          classIndexByDate
        );

        const classViewId = `class-${classItem.classKey}`;
        classViews[classViewId] = {
          title: `Risco: ${classItem.classLabel}`,
          subtitle: `Volatilidade por classe · ${period.label}`,
          mainLabel: `Volatilidade (${classItem.classLabel})`,
          mainValue: formatPercentNoSignal(classMetrics.volatilityAnnualPct),
          mainSub: 'Desvio padrão anual.',
          secondaryLabel: 'Volatilidade (Benchmark)',
          secondaryValue: formatPercentNoSignal(benchmarkVolAnnualPct),
          secondarySub: benchmarkId.toUpperCase(),
          drawdownValue: formatPercentNoSignal(classMetrics.maxDrawdownPct),
          drawdownPill: classifyDrawdownLabel(classMetrics.maxDrawdownPct),
          sharpeValue: toFixedNumber(classMetrics.sharpe, 2).toFixed(2).replace('.', ','),
          sharpePill: classifySharpeLabel(classMetrics.sharpe),
          betaValue: toFixedNumber(classMetrics.beta, 2).toFixed(2).replace('.', ','),
          betaPill: classifyBetaLabel(classMetrics.beta),
          chartData: buildVolatilityChartPoints(chartAnchors, classIndexByDate, benchmarkIndexByDate, classBandByDate),
          details: classItem.assets
            .map((assetItem) => ({
              id: '',
              name: assetItem.name,
              meta: assetItem.ticker || classItem.classLabel,
              val: formatPercentNoSignal(assetItem.metrics.volatilityAnnualPct),
              sub: `Max DD: ${formatPercentNoSignal(assetItem.metrics.maxDrawdownPct)}`,
            }))
            .sort((a, b) => {
              const av = parsePercentValue(a.val) || 0;
              const bv = parsePercentValue(b.val) || 0;
              return bv - av;
            }),
        };

        return {
          id: classViewId,
          name: classItem.classLabel,
          meta: `Beta: ${toFixedNumber(classMetrics.beta, 2).toFixed(2).replace('.', ',')}`,
          val: formatPercentNoSignal(classMetrics.volatilityAnnualPct),
          sub: `Max DD: ${formatPercentNoSignal(classMetrics.maxDrawdownPct)}`,
          metrics: classMetrics,
        };
      })
      .sort((a, b) => (parsePercentValue(b.val) || 0) - (parsePercentValue(a.val) || 0));

    const rootViewId = scope === 'classes' ? 'classes-root' : 'total';

    const views = {
      total: {
        title: 'Volatilidade Anualizada',
        subtitle: `Oscilação e risco do portfólio (${period.label})`,
        mainLabel: 'Volatilidade (Portfólio)',
        mainValue: formatPercentNoSignal(portfolioMetrics.volatilityAnnualPct),
        mainSub: 'Desvio padrão anual.',
        secondaryLabel: 'Volatilidade (Benchmark)',
        secondaryValue: formatPercentNoSignal(benchmarkVolAnnualPct),
        secondarySub: benchmarkId.toUpperCase(),
        drawdownValue: formatPercentNoSignal(portfolioMetrics.maxDrawdownPct),
        drawdownPill: classifyDrawdownLabel(portfolioMetrics.maxDrawdownPct),
        sharpeValue: toFixedNumber(portfolioMetrics.sharpe, 2).toFixed(2).replace('.', ','),
        sharpePill: classifySharpeLabel(portfolioMetrics.sharpe),
        betaValue: toFixedNumber(portfolioMetrics.beta, 2).toFixed(2).replace('.', ','),
        betaPill: classifyBetaLabel(portfolioMetrics.beta),
        chartData: buildVolatilityChartPoints(chartAnchors, portfolioIndexByDate, benchmarkIndexByDate, rollingBandByDate),
        details: classRootRows.map((item) => ({
          id: item.id,
          name: item.name,
          meta: item.meta,
          val: item.val,
          sub: item.sub,
        })),
      },
      'classes-root': {
        title: 'Volatilidade por Classes',
        subtitle: `Comparativo de risco por classe (${period.label})`,
        mainLabel: 'Volatilidade (Classes)',
        mainValue: formatPercentNoSignal(portfolioMetrics.volatilityAnnualPct),
        mainSub: 'Desvio padrão anual.',
        secondaryLabel: 'Volatilidade (Benchmark)',
        secondaryValue: formatPercentNoSignal(benchmarkVolAnnualPct),
        secondarySub: benchmarkId.toUpperCase(),
        drawdownValue: formatPercentNoSignal(portfolioMetrics.maxDrawdownPct),
        drawdownPill: classifyDrawdownLabel(portfolioMetrics.maxDrawdownPct),
        sharpeValue: toFixedNumber(portfolioMetrics.sharpe, 2).toFixed(2).replace('.', ','),
        sharpePill: classifySharpeLabel(portfolioMetrics.sharpe),
        betaValue: toFixedNumber(portfolioMetrics.beta, 2).toFixed(2).replace('.', ','),
        betaPill: classifyBetaLabel(portfolioMetrics.beta),
        chartData: buildVolatilityChartPoints(chartAnchors, portfolioIndexByDate, benchmarkIndexByDate, rollingBandByDate),
        details: classRootRows.map((item) => ({
          id: item.id,
          name: item.name,
          meta: item.meta,
          val: item.val,
          sub: item.sub,
        })),
      },
      ...classViews,
    };

    return {
      status: 'ok',
      data: {
        widget: {
          rootView: rootViewId,
          period,
          scope,
          benchmark: benchmarkId,
          views,
        },
      },
    };
  };

  const volatilityMetricAliases = [
    'investments.volatility_annualized',
    'investments.volatility',
    'investments.volatilidade_anualizada',
    'investments.portfolio_volatility',
  ];

  volatilityMetricAliases.forEach((metricId) => {
    registerMetric({
      id: metricId,
      title: 'Volatilidade anualizada',
      description: 'Calcula volatilidade anualizada, máximo drawdown, Sharpe e beta da carteira com filtros por período, escopo e benchmark.',
      supportedFilters: ['currencies', 'assetClasses', 'statuses', 'accountIds', 'tags', 'periodPreset', 'volatilityScope', 'volatilityBenchmark', 'asOf'],
      output: { kind: 'widget' },
      tags: ['investments', 'dashboard', 'volatilidade', 'risco'],
      handler: volatilityHandler,
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

    const fixedIncomeAssetIds = Array.from(allAssetIds).filter((assetId) => {
      const assetClass = assetById.get(assetId)?.assetClass || positionByAsset.get(assetId)?.assetClass;
      return assetClass === 'fixed_income';
    });

    const fixedIncomeStartDate = fixedIncomeAssetIds.reduce((minDate, assetId) => {
      const txs = transactionsByAsset.get(assetId) || [];
      const firstDate = txs[0]?.referenceDate || positionByAsset.get(assetId)?.referenceDate || period.start;
      return !minDate || firstDate < minDate ? firstDate : minDate;
    }, null) || period.start;

    const fixedIncomeReferenceData = fixedIncomeAssetIds.length
      ? await buildFixedIncomeReferenceData(context, fixedIncomeStartDate, period.end)
      : null;

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

      const assetModelBase = {
        ...asset,
        position,
        assetClass: asset.assetClass,
        history,
        transactions: txs,
      };

      const snapshotStart = resolveAssetSnapshotAtDate({
        assetModel: assetModelBase,
        targetDate: period.start,
        stateAtDate: stateStart,
        referenceData: fixedIncomeReferenceData,
        fallbackDate: period.start,
        fallbackQuantity: position?.quantity,
      });

      const snapshotEnd = resolveAssetSnapshotAtDate({
        assetModel: assetModelBase,
        targetDate: period.end,
        stateAtDate: stateEnd,
        referenceData: fixedIncomeReferenceData,
        fallbackDate: period.start,
        fallbackQuantity: position?.quantity,
      });

      const openValueStart = snapshotStart.openValue;
      const openValueEnd = snapshotEnd.openValue;
      const openInvestedStart = snapshotStart.openInvested;
      const openInvestedEnd = snapshotEnd.openInvested;
      const quantityEnd = snapshotEnd.openQuantity;

      const unrealizedPnlStart = openValueStart - openInvestedStart;
      const unrealizedPnlEnd = openValueEnd - openInvestedEnd;
      const unrealizedResult = unrealizedPnlEnd - unrealizedPnlStart;
      const realizedResultRaw = snapshotEnd.realizedResult - snapshotStart.realizedResult;

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
            const snapshotAtDate = resolveAssetSnapshotAtDate({
              assetModel: assetModelBase,
              targetDate: entry.date,
              stateAtDate,
              referenceData: fixedIncomeReferenceData,
              fallbackDate: period.start,
              fallbackQuantity: position?.quantity,
            });
            if (snapshotAtDate.openQuantity > 0) {
              grossDividendsBrapi += snapshotAtDate.openQuantity * entry.amount;
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
        openInvestedEnd + (snapshotEnd.realizedCostBasis - snapshotStart.realizedCostBasis)
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

  const activitiesHistoryHandler = async ({ filters = {}, context = {} }) => {
    const activityPeriod = String(filters.activityPeriod || 'all').toLowerCase();
    const normalizedPeriod = ['30d', '90d', 'all'].includes(activityPeriod) ? activityPeriod : 'all';
    const limit = Number.isFinite(Number(filters.activityLimit)) ? Math.max(1, Number(filters.activityLimit)) : 50;
    const activityTypes = Array.isArray(filters.activityTypes)
      ? filters.activityTypes.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    const assetId = filters.activityAssetId ? String(filters.activityAssetId) : null;

    const dateRange = resolveActivityDateRange(normalizedPeriod);
    const rows = await context.repository.listActivityLog({
      userId: context.userId,
      start: dateRange.start,
      end: dateRange.end,
      limit,
      activityTypes,
      assetId,
    });

    const items = rows.map((row) => {
      const type = classifyActivityType(row);
      const quantity = safeNumber(row.quantity);
      const unitPrice = safeNumber(row.unitPrice || row.price);
      const totalValue = safeNumber(row.totalValue || row.grossAmount);

      return {
        id: row.activityId || row._id || `${row.assetId || 'na'}-${row.createdAt || row.referenceDate || ''}`,
        createdAt: row.createdAt || null,
        referenceDate: row.referenceDate || null,
        assetId: row.assetId || null,
        assetName: row.assetName || row.ticker || row.assetId || '—',
        ticker: row.ticker || null,
        activityType: type,
        activityLabel: labelActivityType(type),
        operation: row.operation || row.activityType || '',
        quantity,
        unitPrice,
        totalValue,
        currency: row.currency || 'BRL',
        metadata: row.metadata || {},
        impact: {
          value: 0,
          label: formatCurrencyBRL(0),
          className: formatActivityImpactClass(0),
          source: 'investments.financial_result',
        },
      };
    });

    return {
      status: 'ok',
      data: {
        items,
        paging: {
          limit,
          nextCursor: null,
          hasMore: items.length >= limit,
        },
        filters: {
          activityPeriod: normalizedPeriod,
          activityTypes,
          activityAssetId: assetId,
        },
      },
    };
  };

  registerMetric({
    id: 'investments.activities_history',
    title: 'Histórico de atividades de investimentos',
    description: 'Lista cronológica de movimentações registradas via lançamento manual, preparada para paginação e filtros.',
    supportedFilters: ['activityPeriod', 'activityTypes', 'activityAssetId', 'activityLimit'],
    output: { kind: 'table' },
    tags: ['investments', 'dashboard', 'activities', 'history'],
    handler: activitiesHistoryHandler,
  });

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
