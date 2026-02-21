function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toPercent(value) {
  const num = toNumber(value);
  if (num === null) return null;
  return Math.abs(num) <= 1 ? num * 100 : num;
}

function safeDivide(a, b) {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na === null || nb === null || nb === 0) return null;
  return na / nb;
}

function sumDividendsLast12Months(dividendsData = [], now = new Date()) {
  if (!Array.isArray(dividendsData)) return 0;
  const ref = now.getTime();
  const yearMs = 365 * 24 * 60 * 60 * 1000;

  return dividendsData.reduce((acc, item) => {
    const paidAtRaw = item?.paymentDate || item?.date || item?.approvedOn;
    const paidAt = paidAtRaw ? new Date(paidAtRaw).getTime() : NaN;
    const rate = toNumber(item?.rate || item?.value || item?.amount);
    if (!Number.isFinite(paidAt) || rate === null) return acc;
    if (ref - paidAt <= yearMs && paidAt <= ref) return acc + rate;
    return acc;
  }, 0);
}

function sortByEndDateAsc(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && row.endDate)
    .slice()
    .sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
}

function latest(rows) {
  const sorted = sortByEndDateAsc(rows);
  return sorted.length ? sorted[sorted.length - 1] : null;
}

function latestAndYoy(rows) {
  const sorted = sortByEndDateAsc(rows);
  if (!sorted.length) return { current: null, yoy: null };
  const current = sorted[sorted.length - 1];
  const yoy = sorted.length >= 5 ? sorted[sorted.length - 5] : null;
  return { current, yoy };
}

function getLastClosedQuarterCutoff(now = new Date()) {
  const month = now.getMonth();
  const currentQuarter = Math.floor(month / 3) + 1;

  let closedQuarter = currentQuarter - 1;
  let year = now.getFullYear();

  if (closedQuarter === 0) {
    closedQuarter = 4;
    year -= 1;
  }

  const quarterEndMonth = [2, 5, 8, 11][closedQuarter - 1];
  return new Date(year, quarterEndMonth + 1, 0, 23, 59, 59, 999);
}

function onlyClosedQuarterRows(rows, now = new Date()) {
  const cutoff = getLastClosedQuarterCutoff(now).getTime();
  return sortByEndDateAsc(rows).filter((row) => {
    const t = row?.endDate ? new Date(row.endDate).getTime() : NaN;
    return Number.isFinite(t) && t <= cutoff;
  });
}

function classifySegment(summaryProfile = {}) {
  const sector = String(summaryProfile?.sector || '').toLowerCase();
  const industry = String(summaryProfile?.industry || '').toLowerCase();
  const text = `${sector} ${industry}`;

  if (text.includes('bank') || text.includes('banco') || text.includes('financial')) return 'banks';
  if (text.includes('insurance') || text.includes('segur')) return 'insurance';
  if (text.includes('oil') || text.includes('petrol') || text.includes('mining') || text.includes('minera')) return 'commodities';
  if (text.includes('retail') || text.includes('varejo')) return 'retail';
  if (text.includes('utility') || text.includes('energia') || text.includes('electric')) return 'utilities';
  return 'general';
}

const SEGMENT_CONFIG = {
  general: {
    hiddenMetrics: [],
    unavailable: [
      { key: 'segment_op_1', name: 'Indicadores Operacionais Específicos', note: 'Este setor possui métricas operacionais que não são expostas pela Brapi.' },
    ],
  },
  banks: {
    hiddenMetrics: ['EVEBITDA', 'MEBITDA', 'EBITDA', 'ALAV', 'DB', 'DL'],
    unavailable: [
      { key: 'basileia', name: 'Índice de Basileia', note: 'Indicador regulatório do BACEN não retornado pela Brapi.' },
      { key: 'nim', name: 'NIM (Net Interest Margin)', note: 'Métrica operacional bancária sem campo direto na API.' },
      { key: 'npl', name: 'NPL (Inadimplência)', note: 'Exige dados de carteira de crédito não disponíveis no endpoint.' },
      { key: 'cobertura', name: 'Índice de Cobertura', note: 'Provisões e inadimplência detalhadas não são expostas.' },
    ],
  },
  insurance: {
    hiddenMetrics: ['EVEBITDA', 'MEBITDA', 'EBITDA', 'ALAV'],
    unavailable: [
      { key: 'combined', name: 'Índice Combinado', note: 'Dado técnico de seguradoras não disponível na Brapi.' },
      { key: 'sinistralidade', name: 'Sinistralidade', note: 'Métrica operacional de seguros não exposta.' },
      { key: 'premios', name: 'Prêmios Emitidos/Ganhos', note: 'Informação operacional não estruturada no endpoint.' },
    ],
  },
  commodities: {
    hiddenMetrics: [],
    unavailable: [
      { key: 'ev_reservas', name: 'EV/Reservas (P/NAV)', note: 'Reservas provadas não são retornadas pela Brapi.' },
      { key: 'lifting_cost', name: 'Lifting Cost', note: 'Custo de extração é dado operacional do RI.' },
      { key: 'breakeven', name: 'Breakeven Price', note: 'Não há campo público padronizado na API.' },
      { key: 'reserves', name: 'Reservas Provadas (1P/2P/3P)', note: 'Dado geológico fora do escopo da Brapi.' },
      { key: 'replacement_ratio', name: 'Índice de Reposição de Reservas', note: 'Indicador operacional não disponível.' },
    ],
  },
  retail: {
    hiddenMetrics: [],
    unavailable: [
      { key: 'sss', name: 'Same-Store Sales (SSS)', note: 'Métrica operacional não retornada pela API.' },
      { key: 'ticket', name: 'Ticket Médio', note: 'Dado operacional de vendas não disponível.' },
      { key: 'gmv', name: 'GMV/Take Rate', note: 'Brapi não expõe essas métricas operacionais.' },
    ],
  },
  utilities: {
    hiddenMetrics: [],
    unavailable: [
      { key: 'rab', name: 'RAB (Regulatory Asset Base)', note: 'Indicador regulatório não fornecido pela API.' },
      { key: 'wacc_reg', name: 'WACC Regulatório', note: 'Dado do regulador não disponível no endpoint.' },
      { key: 'dec_fec', name: 'DEC/FEC', note: 'Indicadores regulatórios de qualidade não expostos.' },
    ],
  },
};

function buildSeries(raw = {}) {
  const incomeA = sortByEndDateAsc(raw.incomeStatementHistory || []);
  const incomeQ = onlyClosedQuarterRows(raw.incomeStatementHistoryQuarterly || []);
  const financialQ = onlyClosedQuarterRows(raw.financialDataHistoryQuarterly || []);
  const balanceA = sortByEndDateAsc(raw.balanceSheetHistory || []);
  const balanceQ = onlyClosedQuarterRows(raw.balanceSheetHistoryQuarterly || []);
  const cashA = sortByEndDateAsc(raw.cashFlowStatementHistory || []);
  const cashQ = onlyClosedQuarterRows(raw.cashFlowStatementHistoryQuarterly || []);

  const annualReceita = incomeA.map((row) => ({
    label: String(new Date(row.endDate).getFullYear()),
    value: toNumber(row.totalRevenue),
  })).filter((row) => row.value !== null);

  const quarterReceita = incomeQ.map((row) => {
    const d = new Date(row.endDate);
    const quarter = Math.ceil((d.getMonth() + 1) / 3);
    return {
      label: `${quarter}T/${String(d.getFullYear()).slice(2)}`,
      quarter,
      value: toNumber(row.totalRevenue),
    };
  }).filter((row) => row.value !== null);

  const annualCaixa = incomeA.map((row) => {
    const year = String(new Date(row.endDate).getFullYear());
    const cashRow = cashA.find((c) => String(new Date(c.endDate).getFullYear()) === year);
    const finRow = financialQ.find((f) => String(new Date(f.endDate).getFullYear()) === year);
    const fcl = toNumber(cashRow?.freeCashFlow)
      ?? toNumber(finRow?.freeCashflow)
      ?? toNumber(finRow?.operatingCashflow)
      ?? toNumber(cashRow?.operatingCashFlow)
      ?? toNumber(cashRow?.totalCashFromOperatingActivities)
      ?? toNumber(row.netIncome);
    return {
      label: year,
      ebitda: toNumber(finRow?.ebitda) ?? toNumber(row.ebitda),
      fcl,
    };
  }).filter((row) => row.ebitda !== null || row.fcl !== null);

  const quarterCaixa = incomeQ.map((row) => {
    const d = new Date(row.endDate);
    const quarter = Math.ceil((d.getMonth() + 1) / 3);
    const yy = String(d.getFullYear()).slice(2);
    const key = `${d.getFullYear()}-${quarter}`;
    const cashRow = cashQ.find((c) => {
      const dc = new Date(c.endDate);
      const qc = Math.ceil((dc.getMonth() + 1) / 3);
      return `${dc.getFullYear()}-${qc}` === key;
    });
    const finRow = financialQ.find((f) => {
      const df = new Date(f.endDate);
      const qf = Math.ceil((df.getMonth() + 1) / 3);
      return `${df.getFullYear()}-${qf}` === key;
    });

    const fcl = toNumber(cashRow?.freeCashFlow)
      ?? toNumber(finRow?.freeCashflow)
      ?? toNumber(finRow?.operatingCashflow)
      ?? toNumber(cashRow?.operatingCashFlow)
      ?? toNumber(cashRow?.totalCashFromOperatingActivities)
      ?? toNumber(row.netIncome);

    return {
      label: `${quarter}T/${yy}`,
      quarter,
      ebitda: toNumber(finRow?.ebitda) ?? toNumber(row.ebitda),
      fcl,
    };
  }).filter((row) => row.ebitda !== null || row.fcl !== null);

  // ─── Helper: build annual series from financialDataHistoryQuarterly ───
  // financialQ has trailing-twelve-month ratios per quarter; group by year (take latest quarter per year)
  const financialA = (() => {
    const byYear = {};
    for (const row of financialQ) {
      const y = String(new Date(row.endDate).getFullYear());
      byYear[y] = row; // last quarter of the year wins (financialQ is sorted asc)
    }
    return Object.entries(byYear)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([year, row]) => ({ year, row }));
  })();

  // Helper: generic series from financialDataHistoryQuarterly using a transform fn
  function finSeriesFromField(extractFn) {
    const annual = financialA
      .map(({ year, row }) => ({ label: year, value: extractFn(row) }))
      .filter((r) => r.value !== null);
    const quarterly = financialQ.map((row) => {
      const d = new Date(row.endDate);
      const q = Math.ceil((d.getMonth() + 1) / 3);
      return { label: `${q}T/${String(d.getFullYear()).slice(2)}`, quarter: q, value: extractFn(row) };
    }).filter((r) => r.value !== null);
    return { A: annual, Q: quarterly };
  }

  // Helper: compute shares outstanding (constant approximation)
  const sharesOutstanding = toNumber(raw.defaultKeyStatistics?.sharesOutstanding);

  function metricSeries(key) {
    if (key === 'RL') return { A: annualReceita, Q: quarterReceita };
    if (key === 'LB') {
      return {
        A: incomeA.map((row) => ({ label: String(new Date(row.endDate).getFullYear()), value: toNumber(row.grossProfit) })).filter((r) => r.value !== null),
        Q: incomeQ.map((row) => {
          const d = new Date(row.endDate); const q = Math.ceil((d.getMonth() + 1) / 3);
          return { label: `${q}T/${String(d.getFullYear()).slice(2)}`, quarter: q, value: toNumber(row.grossProfit) };
        }).filter((r) => r.value !== null),
      };
    }
    if (key === 'EBITDA') {
      return {
        A: incomeA.map((row) => {
          const year = String(new Date(row.endDate).getFullYear());
          const finRow = financialQ.find((f) => String(new Date(f.endDate).getFullYear()) === year);
          return { label: year, value: toNumber(finRow?.ebitda) ?? toNumber(row.ebitda) };
        }).filter((r) => r.value !== null),
        Q: incomeQ.map((row) => {
          const d = new Date(row.endDate);
          const q = Math.ceil((d.getMonth() + 1) / 3);
          const keyQ = `${d.getFullYear()}-${q}`;
          const finRow = financialQ.find((f) => {
            const df = new Date(f.endDate);
            const qf = Math.ceil((df.getMonth() + 1) / 3);
            return `${df.getFullYear()}-${qf}` === keyQ;
          });
          return { label: `${q}T/${String(d.getFullYear()).slice(2)}`, quarter: q, value: toNumber(finRow?.ebitda) ?? toNumber(row.ebitda) };
        }).filter((r) => r.value !== null),
      };
    }
    if (key === 'LL') {
      return {
        A: incomeA.map((row) => ({ label: String(new Date(row.endDate).getFullYear()), value: toNumber(row.netIncome) })).filter((r) => r.value !== null),
        Q: incomeQ.map((row) => {
          const d = new Date(row.endDate); const q = Math.ceil((d.getMonth() + 1) / 3);
          return { label: `${q}T/${String(d.getFullYear()).slice(2)}`, quarter: q, value: toNumber(row.netIncome) };
        }).filter((r) => r.value !== null),
      };
    }
    if (key === 'DB') {
      // Prefer financialDataHistoryQuarterly.totalDebt (available even when balance sheet debt is 0)
      const fdqDebt = finSeriesFromField((row) => toNumber(row.totalDebt));
      if (fdqDebt.A.length || fdqDebt.Q.length) return fdqDebt;
      const mapDebt = (row) => toNumber(row.totalDebt) ?? (toNumber(row.shortLongTermDebt) || 0) + (toNumber(row.longTermDebt) || 0);
      return {
        A: balanceA.map((row) => ({ label: String(new Date(row.endDate).getFullYear()), value: mapDebt(row) })).filter((r) => r.value !== null),
        Q: balanceQ.map((row) => {
          const d = new Date(row.endDate); const q = Math.ceil((d.getMonth() + 1) / 3);
          return { label: `${q}T/${String(d.getFullYear()).slice(2)}`, quarter: q, value: mapDebt(row) };
        }).filter((r) => r.value !== null),
      };
    }

    // ─── ROE: returnOnEquity (trailing) from financialDataHistoryQuarterly ───
    if (key === 'ROE') {
      return finSeriesFromField((row) => toPercent(row.returnOnEquity));
    }
    // ─── ROA: returnOnAssets from financialDataHistoryQuarterly ───
    if (key === 'ROA' || key === 'ROIC') {
      return finSeriesFromField((row) => toPercent(row.returnOnAssets));
    }
    // ─── MEBITDA: ebitdaMargins from financialDataHistoryQuarterly ───
    if (key === 'MEBITDA') {
      return finSeriesFromField((row) => toPercent(row.ebitdaMargins));
    }
    // ─── ML: profitMargins from financialDataHistoryQuarterly ───
    if (key === 'ML') {
      return finSeriesFromField((row) => toPercent(row.profitMargins));
    }
    // ─── CREC: revenueGrowth from financialDataHistoryQuarterly ───
    if (key === 'CREC') {
      return finSeriesFromField((row) => toPercent(row.revenueGrowth));
    }
    // ─── CLL: earningsGrowth from financialDataHistoryQuarterly ───
    if (key === 'CLL') {
      return finSeriesFromField((row) => toPercent(row.earningsGrowth));
    }
    // ─── LPA: netIncome / sharesOutstanding ───
    if (key === 'LPA') {
      if (!sharesOutstanding) return { A: [], Q: [] };
      return {
        A: incomeA.map((row) => {
          const ni = toNumber(row.netIncome);
          return { label: String(new Date(row.endDate).getFullYear()), value: ni !== null ? ni / sharesOutstanding : null };
        }).filter((r) => r.value !== null),
        Q: incomeQ.map((row) => {
          const d = new Date(row.endDate); const q = Math.ceil((d.getMonth() + 1) / 3);
          const ni = toNumber(row.netIncome);
          return { label: `${q}T/${String(d.getFullYear()).slice(2)}`, quarter: q, value: ni !== null ? ni / sharesOutstanding : null };
        }).filter((r) => r.value !== null),
      };
    }
    // ─── PAYOUT: dividends / netIncome (annual approximation) ───
    if (key === 'PAYOUT') {
      const dividends = raw.dividendsData?.cashDividends || [];
      if (!dividends.length) return { A: [], Q: [] };
      // Group dividends by year
      const divByYear = {};
      for (const div of dividends) {
        const dateRaw = div.paymentDate || div.approvedOn || div.date;
        if (!dateRaw) continue;
        const y = String(new Date(dateRaw).getFullYear());
        const rate = toNumber(div.rate || div.value || div.amount);
        if (rate === null) continue;
        divByYear[y] = (divByYear[y] || 0) + rate;
      }
      const annual = incomeA.map((row) => {
        const y = String(new Date(row.endDate).getFullYear());
        const ni = toNumber(row.netIncome);
        const totalDiv = divByYear[y];
        if (!totalDiv || !ni || ni === 0 || !sharesOutstanding) return { label: y, value: null };
        const niPerShare = ni / sharesOutstanding;
        if (niPerShare === 0) return { label: y, value: null };
        return { label: y, value: (totalDiv / niPerShare) * 100 };
      }).filter((r) => r.value !== null && Number.isFinite(r.value));
      return { A: annual, Q: [] };
    }
    // ─── DL: dívida líquida = totalDebt - totalCash ───
    if (key === 'DL') {
      return finSeriesFromField((row) => {
        const debt = toNumber(row.totalDebt);
        const cash = toNumber(row.totalCash);
        if (debt === null && cash === null) return null;
        return (debt ?? 0) - (cash ?? 0);
      });
    }
    // ─── ALAV: dívida líquida / EBITDA ───
    if (key === 'ALAV') {
      return finSeriesFromField((row) => {
        const debt = toNumber(row.totalDebt);
        const cash = toNumber(row.totalCash);
        const ebitdaVal = toNumber(row.ebitda);
        if (ebitdaVal === null || ebitdaVal === 0) return null;
        return ((debt ?? 0) - (cash ?? 0)) / ebitdaVal;
      });
    }
    // ─── DPL: debtToEquity from financialDataHistoryQuarterly ───
    if (key === 'DPL') {
      return finSeriesFromField((row) => toNumber(row.debtToEquity));
    }
    // ─── EV: enterpriseValue approximation from totalDebt - totalCash + marketCap ───
    // No historical price data, so cannot compute reliable series
    // ─── PL, PVP, EVEBITDA, DY, PSR: require historical price ───
    return { A: [], Q: [] };
  }

  return {
    macro: {
      receita: {
        A: annualReceita,
        '1T': quarterReceita.filter((row) => row.quarter === 1).map(({ label, value }) => ({ label, value })),
        '2T': quarterReceita.filter((row) => row.quarter === 2).map(({ label, value }) => ({ label, value })),
        '3T': quarterReceita.filter((row) => row.quarter === 3).map(({ label, value }) => ({ label, value })),
        '4T': quarterReceita.filter((row) => row.quarter === 4).map(({ label, value }) => ({ label, value })),
      },
      caixa: {
        A: annualCaixa,
        '1T': quarterCaixa.filter((row) => row.quarter === 1).map(({ label, ebitda, fcl }) => ({ label, ebitda, fcl })),
        '2T': quarterCaixa.filter((row) => row.quarter === 2).map(({ label, ebitda, fcl }) => ({ label, ebitda, fcl })),
        '3T': quarterCaixa.filter((row) => row.quarter === 3).map(({ label, ebitda, fcl }) => ({ label, ebitda, fcl })),
        '4T': quarterCaixa.filter((row) => row.quarter === 4).map(({ label, ebitda, fcl }) => ({ label, ebitda, fcl })),
      },
    },
    metrics: {
      PL: metricSeries('PL'),
      PVP: metricSeries('PVP'),
      EVEBITDA: metricSeries('EVEBITDA'),
      DY: metricSeries('DY'),
      EV: metricSeries('EV'),
      PSR: metricSeries('PSR'),
      ROE: metricSeries('ROE'),
      ROIC: metricSeries('ROIC'),
      ROA: metricSeries('ROA'),
      MEBITDA: metricSeries('MEBITDA'),
      ML: metricSeries('ML'),
      RL: metricSeries('RL'),
      LB: metricSeries('LB'),
      EBITDA: metricSeries('EBITDA'),
      LL: metricSeries('LL'),
      CREC: metricSeries('CREC'),
      CLL: metricSeries('CLL'),
      LPA: metricSeries('LPA'),
      PAYOUT: metricSeries('PAYOUT'),
      DB: metricSeries('DB'),
      DL: metricSeries('DL'),
      ALAV: metricSeries('ALAV'),
      DPL: metricSeries('DPL'),
    },
  };
}

function buildIndices(raw = {}) {
  const keyStats = raw.defaultKeyStatistics || {};
  const financial = raw.financialData || {};
  const incomeQ = onlyClosedQuarterRows(raw.incomeStatementHistoryQuarterly || []);
  const incomeA = raw.incomeStatementHistory || [];
  const balanceQ = onlyClosedQuarterRows(raw.balanceSheetHistoryQuarterly || []);

  const latestQ = latest(incomeQ);
  const latestBQ = latest(balanceQ);
  const { current: currentQ, yoy: yoyQ } = latestAndYoy(incomeQ);

  const cashDividends = raw.dividendsData?.cashDividends || [];
  const totalDivs12m = sumDividendsLast12Months(cashDividends);
  const price = toNumber(raw.regularMarketPrice);

  const dy = safeDivide(totalDivs12m, price);
  const lpa = toNumber(keyStats.trailingEps);
  const payout = safeDivide(totalDivs12m, lpa);

  const totalDebt = toNumber(financial.totalDebt) ?? toNumber(latestBQ?.totalDebt);
  const totalCash = toNumber(financial.totalCash);
  const ebitda = toNumber(financial.ebitda) ?? toNumber(latestQ?.ebitda);
  const equity = toNumber(latestBQ?.totalStockholderEquity) ?? toNumber(latestBQ?.stockholdersEquity);
  const totalLiabilities = toNumber(latestBQ?.totalLiab)
    ?? toNumber(latestBQ?.totalLiabilitiesNetMinorityInterest)
    ?? toNumber(latestBQ?.totalLiabilities);

  const dl = (totalDebt ?? 0) - (totalCash ?? 0);
  const dpl = (totalLiabilities === null || equity === null || equity === 0)
    ? null
    : totalLiabilities / equity;

  function yoyPercent(curr, prev) {
    const c = toNumber(curr);
    const p = toNumber(prev);
    if (c === null || p === null || p === 0) return null;
    return ((c - p) / Math.abs(p)) * 100;
  }

  return {
    PL: { value: toNumber(keyStats.trailingPE), type: 'multiple', yoy: null },
    PVP: { value: toNumber(keyStats.priceToBook), type: 'multiple', yoy: null },
    EVEBITDA: { value: toNumber(keyStats.enterpriseToEbitda), type: 'multiple', yoy: null },
    DY: { value: dy === null ? null : dy * 100, type: 'percent', yoy: null },
    EV: { value: toNumber(keyStats.enterpriseValue), type: 'currency', yoy: null },
    PSR: { value: toNumber(keyStats.enterpriseToRevenue), type: 'multiple', yoy: null },
    ROE: { value: toPercent(financial.returnOnEquity), type: 'percent', yoy: null },
    ROIC: { value: toPercent(financial.returnOnAssets), type: 'percent', yoy: null },
    ROA: { value: toPercent(financial.returnOnAssets), type: 'percent', yoy: null },
    MEBITDA: { value: toPercent(financial.ebitdaMargins), type: 'percent', yoy: null },
    ML: { value: toPercent(financial.profitMargins), type: 'percent', yoy: null },
    RL: { value: toNumber(currentQ?.totalRevenue) ?? toNumber(financial.totalRevenue), type: 'currency', yoy: yoyPercent(currentQ?.totalRevenue, yoyQ?.totalRevenue) },
    LB: { value: toNumber(currentQ?.grossProfit) ?? toNumber(financial.grossProfits), type: 'currency', yoy: yoyPercent(currentQ?.grossProfit, yoyQ?.grossProfit) },
    EBITDA: { value: toNumber(currentQ?.ebitda) ?? toNumber(financial.ebitda), type: 'currency', yoy: yoyPercent(currentQ?.ebitda, yoyQ?.ebitda) },
    LL: { value: toNumber(currentQ?.netIncome) ?? toNumber(latest(incomeA)?.netIncome), type: 'currency', yoy: yoyPercent(currentQ?.netIncome, yoyQ?.netIncome) },
    CREC: { value: toPercent(financial.revenueGrowth), type: 'percent', yoy: null },
    CLL: { value: toPercent(financial.earningsGrowth), type: 'percent', yoy: null },
    LPA: { value: lpa, type: 'currency_per_share', yoy: null },
    PAYOUT: { value: payout === null ? null : payout * 100, type: 'percent', yoy: null },
    DB: { value: totalDebt, type: 'currency', yoy: null },
    DL: { value: totalDebt === null && totalCash === null ? null : dl, type: 'currency', yoy: null },
    ALAV: { value: safeDivide(dl, ebitda), type: 'multiple', yoy: null },
    DPL: { value: dpl, type: 'multiple', yoy: null },
  };
}

function buildIndicesPayload(raw = {}) {
  const summaryProfile = raw.summaryProfile || {};
  const segment = classifySegment(summaryProfile);
  const segmentConfig = SEGMENT_CONFIG[segment] || SEGMENT_CONFIG.general;

  return {
    segment,
    segmentLabel: summaryProfile.sector || 'Geral',
    segmentConfig,
    indices: buildIndices(raw),
    series: buildSeries(raw),
  };
}

module.exports = {
  buildIndicesPayload,
};
