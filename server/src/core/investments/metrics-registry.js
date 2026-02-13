/**
 * @module core/investments/metrics-registry
 * @description Registro de métricas padrão da base de investimentos.
 */

const { registerMetric } = require('../metrics/registry');

let _initialized = false;

function formatCurrencyBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function classifyAssetGroup(assetClass) {
  if (assetClass === 'fixed_income' || assetClass === 'cash') return 'rf';
  return 'rv';
}

function buildChartPoints(periodWindows, positions) {
  if (!Array.isArray(periodWindows) || !periodWindows.length) {
    return [{ label: 'Atual', value: 0 }];
  }

  return periodWindows.map((window) => {
    const total = positions.reduce((acc, item) => {
      if (!item.referenceDate || item.referenceDate > window.end) return acc;
      return acc + Number(item.marketValue || 0);
    }, 0);

    return {
      label: window.label,
      value: total,
      currency: 'BRL',
    };
  });
}

function computeRealizedCashFromTransactions(transactions) {
  if (!Array.isArray(transactions) || !transactions.length) return 0;

  return transactions.reduce((acc, item) => {
    const operation = String(item.operation || '');
    const grossAmount = Number(item.grossAmount || 0);

    if (!Number.isFinite(grossAmount)) return acc;

    if (operation === 'manual_sale' || operation === 'manual_income') {
      return acc + grossAmount;
    }

    return acc;
  }, 0);
}

function buildWidgetModelFromPositions(positions, periodWindows, realizedCash = 0) {
  const totalMarketValue = positions.reduce((acc, item) => acc + Number(item.marketValue || 0), 0);
  const totalInvested = positions.reduce((acc, item) => acc + Number(item.investedAmount || 0), 0);
  const pnl = totalMarketValue - totalInvested;
  const pnlPct = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;

  const grouped = positions.reduce((acc, item) => {
    const group = classifyAssetGroup(item.assetClass);
    if (!acc[group]) {
      acc[group] = { total: 0, items: [] };
    }
    const value = Number(item.marketValue || 0);
    acc[group].total += value;
    acc[group].items.push(item);
    return acc;
  }, { rv: { total: 0, items: [] }, rf: { total: 0, items: [] } });

  const totalForPct = totalMarketValue || 1;

  const buildClassRows = (groupKey, label) => {
    const group = grouped[groupKey] || { total: 0, items: [] };
    const pct = (group.total / totalForPct) * 100;
    return {
      id: groupKey === 'rv' ? 'renda-variavel' : 'renda-fixa',
      name: label,
      meta: `${group.items.length} ativo(s)`,
      value: formatCurrencyBRL(group.total),
      varText: `${pct.toFixed(1)}%`,
    };
  };

  const buildAssetDetails = (groupKey) => {
    const group = grouped[groupKey] || { items: [] };
    return group.items
      .sort((a, b) => Number(b.marketValue || 0) - Number(a.marketValue || 0))
      .slice(0, 8)
      .map((item) => ({
        id: '',
        name: item.assetId,
        meta: item.assetClass,
        value: formatCurrencyBRL(Number(item.marketValue || 0)),
        varText: '',
      }));
  };

  const chartPoints = buildChartPoints(periodWindows, positions);

  return {
    rootView: 'total',
    chart: {
      currency: 'BRL',
      points: chartPoints,
    },
    views: {
      total: {
        title: 'Patrimônio Total',
        subtitle: 'Consolidado de posições abertas',
        label: 'Valor Atual',
        value: formatCurrencyBRL(totalMarketValue),
        variation: `${pnl >= 0 ? '+' : ''}${formatCurrencyBRL(pnl)} (${pnlPct.toFixed(2)}%)`,
        secondaryLabel: 'Capital investido',
        secondaryValue: formatCurrencyBRL(totalInvested),
        tertiaryLabel: 'Realizado (Em caixa)',
        tertiaryValue: formatCurrencyBRL(realizedCash),
        details: {
          left: [
            buildClassRows('rv', 'Renda Variável'),
            buildClassRows('rf', 'Renda Fixa'),
          ],
          right: [
            {
              id: '',
              name: 'Total de Ativos',
              meta: 'Posições em carteira',
              value: String(positions.length),
              varText: '',
            },
          ],
        },
      },
      'renda-variavel': {
        title: 'Renda Variável',
        subtitle: 'Ativos de maior risco e oscilação',
        label: 'Total em RV',
        value: formatCurrencyBRL(grouped.rv.total),
        variation: `${((grouped.rv.total / totalForPct) * 100).toFixed(1)}% da carteira`,
        secondaryLabel: 'Quantidade de ativos',
        secondaryValue: String(grouped.rv.items.length),
        details: {
          left: buildAssetDetails('rv'),
          right: [],
        },
      },
      'renda-fixa': {
        title: 'Renda Fixa',
        subtitle: 'Ativos de previsibilidade e caixa',
        label: 'Total em RF',
        value: formatCurrencyBRL(grouped.rf.total),
        variation: `${((grouped.rf.total / totalForPct) * 100).toFixed(1)}% da carteira`,
        secondaryLabel: 'Quantidade de ativos',
        secondaryValue: String(grouped.rf.items.length),
        details: {
          left: buildAssetDetails('rf'),
          right: [],
        },
      },
    },
  };
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
      const realizedCash = computeRealizedCashFromTransactions(transactions);

      if (!positions.length) {
        return {
          status: 'empty',
          data: {
            widget: buildWidgetModelFromPositions([], periodWindows, realizedCash),
          },
        };
      }

      return {
        status: 'ok',
        data: {
          widget: buildWidgetModelFromPositions(positions, periodWindows, realizedCash),
        },
      };
    },
  });

  _initialized = true;
}

module.exports = {
  ensureInvestmentsMetricsRegistered,
};
