const AA_METRICS = ['PL','PVP','EVEBITDA','DY','EV','PSR','ROE','ROIC','ROA','MEBITDA','ML','RL','LB','EBITDA','LL','CREC','CLL','LPA','PAYOUT','DB','DL','ALAV','DPL'];
const aaMetricState = {};
AA_METRICS.forEach((k) => { aaMetricState[k] = { period: 'A', year: new Date().getFullYear(), open: false }; });

const aaMacroState = {
  mktcap: { filter: 'YTD' },
  receita: { period: 'A', year: new Date().getFullYear() },
  caixa: { period: 'A', year: new Date().getFullYear() },
};

const aaHistoryRangeMap = {
  MTD: { range: '1mo', interval: '1d' },
  YTD: { range: '1y', interval: '1d' },
  '12M': { range: '1y', interval: '1wk' },
  ORIGEM: { range: '5y', interval: '1mo' },
};

const AA_CHART_COLORS = {
  primary: 'rgba(196,154,108,0.95)',
  primaryFill: 'rgba(196,154,108,0.16)',
  compare: 'rgba(191,102,73,0.95)',
  compareFill: 'rgba(191,102,73,0.12)',
  ebitda: 'rgba(122,172,136,0.95)',
  ebitdaFill: 'rgba(122,172,136,0.14)',
  fcf: 'rgba(191,102,73,0.95)',
  fcfFill: 'rgba(191,102,73,0.12)',
};

function aaGetSeriesByPeriod(seriesObj, period, year) {
  if (!seriesObj) return [];
  if (period === 'A') {
    return (seriesObj.A || []).filter((row) => {
      const y = Number(String(row.label).replace(/\D/g, '').slice(0, 4));
      return !Number.isFinite(y) || y <= year;
    });
  }
  // Try direct key first (1T, 2T, etc. - used by macro series)
  let series = seriesObj[period];
  // Fall back to filtering Q array by quarter number (used by metric series)
  if ((!series || !series.length) && Array.isArray(seriesObj.Q) && seriesObj.Q.length) {
    const qNum = parseInt(period, 10);
    if (qNum >= 1 && qNum <= 4) {
      series = seriesObj.Q.filter((row) => row.quarter === qNum);
    }
  }
  return (series || []).filter((row) => {
    const p = String(row.label || '').split('/');
    if (p.length < 2) return true;
    const yy = Number(p[1]);
    return !Number.isFinite(yy) || yy <= Number(String(year).slice(2));
  });
}

function aaGetChartBounds(seriesList) {
  const values = (seriesList || [])
    .flatMap((series) => (series || []).map((row) => Number(row?.value)))
    .filter((value) => Number.isFinite(value));

  if (!values.length) return { min: 0, max: 1 };

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const delta = Math.abs(min || 1) * 0.1;
    return { min: min - delta, max: max + delta };
  }
  return { min, max };
}

function aaBuildPathGeometry(data, width, height, min, max) {
  if (!Array.isArray(data) || !data.length) return { points: [], linePath: '', areaPath: '' };

  const padX = 10;
  const padY = 14;
  const drawW = width - padX * 2;
  const drawH = height - padY * 2;

  const points = data.map((item, index) => {
    const x = padX + (drawW * (data.length === 1 ? 0.5 : index / (data.length - 1)));
    const val = Number(item?.value);
    const y = padY + (max === min ? drawH / 2 : drawH - ((val - min) / (max - min)) * drawH);
    return {
      x,
      y,
      value: val,
      label: String(item?.label || ''),
    };
  });

  const linePath = points.map((p, index) => `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const baseY = padY + drawH;
  const areaPath = `${linePath} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;

  return { points, linePath, areaPath };
}

function aaFmtTooltipValue(value, fmt) {
  if (!Number.isFinite(Number(value))) return '—';
  if (typeof fmt === 'function') return fmt(Number(value));
  return window.aaFmtCompactCurrency(Number(value));
}

function aaFmtByType(type) {
  if (type === 'percent') return (v) => `${Number(v).toFixed(2)}%`;
  if (type === 'multiple') return (v) => `${Number(v).toFixed(2)}x`;
  if (type === 'currency_per_share') return (v) => `R$ ${Number(v).toFixed(2)}`;
  return (v) => window.aaFmtCompactCurrency(Number(v));
}

function aaTooltipHtml(label, rows) {
  const lines = rows.map((row) => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <span style="display:inline-flex;align-items:center;gap:6px;color:var(--tx2);font-size:.7rem;">
        <span style="width:8px;height:8px;border-radius:50%;background:${row.color};display:inline-block;"></span>${row.name}
      </span>
      <span style="font-family:'DM Mono',monospace;color:var(--tx);font-size:.8rem;">${aaFmtTooltipValue(row.value, row.fmt)}</span>
    </div>
  `).join('');

  return `<div class="mct-date">${label || 'Período'}</div>${lines}`;
}

function aaRenderLineChart({ svgId, tipId, datasets = [], height = 188 }) {
  const svg = document.getElementById(svgId);
  if (!svg) return;

  const validDatasets = (datasets || []).filter((dataset) => Array.isArray(dataset.data) && dataset.data.length);
  const wrap = svg.parentElement;
  const width = wrap?.clientWidth || 320;

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  if (!validDatasets.length) {
    svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="var(--tx2,#888)" font-size="11" font-family="inherit" opacity="0.6">Sem dados históricos</text>';
    const tip = tipId ? document.getElementById(tipId) : null;
    if (tip) tip.style.display = 'none';
    return;
  }

  const bounds = aaGetChartBounds(validDatasets.map((d) => d.data));
  const prepared = validDatasets.map((dataset) => {
    const geom = aaBuildPathGeometry(dataset.data, width, height, bounds.min, bounds.max);
    return { ...dataset, ...geom };
  });

  // Single-point rendering: show value centered with a horizontal indicator line
  const isSinglePoint = validDatasets.every((d) => d.data.length === 1);

  if (isSinglePoint) {
    const midY = height / 2;
    const lineY = midY + 18;
    const perItem = Math.floor(width / prepared.length);

    svg.innerHTML = prepared.map((dataset, i) => {
      const val = dataset.data[0]?.value ?? 0;
      const cx = perItem * i + perItem / 2;
      const fmtFn = dataset.fmt || ((v) => window.aaFmtCompactCurrency ? window.aaFmtCompactCurrency(v) : String(v));
      const fmtVal = fmtFn(val);
      const ticker = dataset.name || '';
      const period = dataset.data[0]?.label || '';
      return `
        <line x1="${cx - perItem * 0.35}" y1="${lineY}" x2="${cx + perItem * 0.35}" y2="${lineY}"
              stroke="${dataset.color}" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.45"></line>
        <circle cx="${cx}" cy="${midY - 4}" r="5" fill="${dataset.color}" opacity="0.85"></circle>
        <text x="${cx}" y="${midY - 16}" text-anchor="middle" fill="${dataset.color}"
              font-size="13" font-family="'DM Mono',monospace" font-weight="600">${fmtVal}</text>
        ${ticker ? `<text x="${cx}" y="${lineY + 13}" text-anchor="middle" fill="var(--tx2,#888)" font-size="9" font-family="inherit" opacity="0.75">${ticker}</text>` : ''}
        ${period ? `<text x="${cx}" y="${lineY + 23}" text-anchor="middle" fill="var(--tx2,#888)" font-size="8" font-family="inherit" opacity="0.55">${period}</text>` : ''}
      `;
    }).join('');

    const tip = tipId ? document.getElementById(tipId) : null;
    if (tip) {
      const moveHandler = (evt) => {
        const rows = prepared.map((dataset) => ({
          name: dataset.name || 'Série',
          value: dataset.data[0]?.value,
          color: dataset.color,
          fmt: dataset.fmt,
        }));
        tip.innerHTML = aaTooltipHtml(prepared[0]?.data[0]?.label || 'Atual', rows);
        tip.style.display = 'block';
        const wrapRect = wrap.getBoundingClientRect();
        tip.style.left = `${Math.min(Math.max(evt.clientX - wrapRect.left + 12, 8), Math.max(wrapRect.width - 190, 8))}px`;
        tip.style.top = `${Math.min(Math.max(evt.clientY - wrapRect.top - 12, 8), Math.max(wrapRect.height - 90, 8))}px`;
      };
      svg.onmousemove = moveHandler;
      svg.onmouseenter = moveHandler;
      svg.onmouseleave = () => { tip.style.display = 'none'; };
    }
    return;
  }

  svg.innerHTML = prepared.map((dataset) => `
    ${dataset.areaPath ? `<path d="${dataset.areaPath}" fill="${dataset.fill || 'transparent'}"></path>` : ''}
    ${dataset.linePath ? `<path d="${dataset.linePath}" fill="none" stroke="${dataset.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${dataset.dashed ? 'stroke-dasharray="5 4"' : ''}></path>` : ''}
    ${dataset.points?.length === 1 ? `<circle cx="${dataset.points[0].x}" cy="${dataset.points[0].y}" r="3" fill="${dataset.color}"></circle>` : ''}
  `).join('');

  const tip = tipId ? document.getElementById(tipId) : null;
  const primary = prepared[0];

  if (!tip || !wrap || !primary?.points?.length) return;

  const moveHandler = (evt) => {
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;

    const xSvg = ((evt.clientX - rect.left) / rect.width) * width;
    let idx = 0;
    let best = Infinity;

    primary.points.forEach((point, index) => {
      const dist = Math.abs(point.x - xSvg);
      if (dist < best) {
        best = dist;
        idx = index;
      }
    });

    const rows = prepared.map((dataset) => {
      const points = dataset.points || [];
      const mappedIndex = points.length <= 1
        ? 0
        : Math.round((idx / Math.max(primary.points.length - 1, 1)) * (points.length - 1));
      const point = points[Math.max(0, Math.min(points.length - 1, mappedIndex))];
      return {
        name: dataset.name || 'Série',
        value: point?.value,
        color: dataset.color,
        fmt: dataset.fmt,
      };
    });

    const primaryPoint = primary.points[Math.max(0, Math.min(primary.points.length - 1, idx))];
    tip.innerHTML = aaTooltipHtml(primaryPoint?.label, rows);
    tip.style.display = 'block';

    const wrapRect = wrap.getBoundingClientRect();
    const left = Math.min(Math.max(evt.clientX - wrapRect.left + 12, 8), Math.max(wrapRect.width - 190, 8));
    const top = Math.min(Math.max(evt.clientY - wrapRect.top - 12, 8), Math.max(wrapRect.height - 90, 8));

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };

  const leaveHandler = () => {
    tip.style.display = 'none';
  };

  svg.onmousemove = moveHandler;
  svg.onmouseenter = moveHandler;
  svg.onmouseleave = leaveHandler;
}

function aaRenderLine(svgId, primaryData, compareData, tipId) {
  aaRenderLineChart({
    svgId,
    tipId,
    datasets: [
      { name: window.AA.state.ticker || 'Principal', data: primaryData || [], color: AA_CHART_COLORS.primary, fill: AA_CHART_COLORS.primaryFill },
      { name: window.AA.state.compareTicker || 'Comparado', data: compareData || [], color: AA_CHART_COLORS.compare, fill: AA_CHART_COLORS.compareFill, dashed: true },
    ].filter((dataset) => Array.isArray(dataset.data) && dataset.data.length),
  });
}

async function aaFetchHistory(ticker, filter) {
  if (!ticker) return [];
  const map = aaHistoryRangeMap[filter] || aaHistoryRangeMap.YTD;
  const key = `${ticker}:${map.range}:${map.interval}`;
  if (window.AA.state.history[key]) return window.AA.state.history[key];

  const res = await fetch(`${window.AA.apiBase}/api/analise-ativos/history/${ticker}?range=${map.range}&interval=${map.interval}`, {
    headers: window.AA.authHeaders,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return [];

  const history = Array.isArray(data.history) ? data.history : [];
  window.AA.state.history[key] = history;
  return history;
}

function aaEstimateMktCapPoints(history, core) {
  if (!Array.isArray(history) || !history.length) return [];
  const currentPrice = Number(core?.asset?.regularMarketPrice);
  const currentMktCap = Number(core?.asset?.marketCap);
  const ratio = Number.isFinite(currentPrice) && currentPrice > 0 && Number.isFinite(currentMktCap)
    ? currentMktCap / currentPrice
    : null;

  return history.map((h) => {
    const close = Number(h.close);
    const ts = h.date ? new Date(h.date) : (h.date || h.timestamp ? new Date((h.date || h.timestamp) * 1000) : null);
    const label = ts && !Number.isNaN(ts.getTime())
      ? ts.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
      : String(h.date || h.timestamp || '');

    const value = Number.isFinite(close) && Number.isFinite(ratio) ? close * ratio : null;
    return { label, value };
  }).filter((p) => Number.isFinite(Number(p.value)));
}

async function aaRenderMktCap() {
  const core = window.AA.state.core;
  if (!core) return;

  const filter = aaMacroState.mktcap.filter;
  const historyMain = await aaFetchHistory(window.AA.state.ticker, filter);
  const dataMain = aaEstimateMktCapPoints(historyMain, core);

  let dataCompare = [];
  if (window.AA.state.compareTicker && window.AA.state.compareCore) {
    const historyCompare = await aaFetchHistory(window.AA.state.compareTicker, filter);
    dataCompare = aaEstimateMktCapPoints(historyCompare, window.AA.state.compareCore);
  }

  aaRenderLine('svg-mktcap', dataMain, dataCompare, 'tip-mktcap');

  const last = dataMain[dataMain.length - 1];
  const prev = dataMain[dataMain.length - 2];
  const valEl = document.getElementById('mktcap-val');
  const chgEl = document.getElementById('mktcap-chg');

  if (valEl) valEl.textContent = window.aaFmtCompactCurrency(last?.value);
  if (chgEl && last && prev && prev.value) {
    const pct = ((last.value - prev.value) / Math.abs(prev.value)) * 100;
    chgEl.className = `macro-chart-chg ${pct >= 0 ? 'up' : 'dn'}`;
    chgEl.textContent = `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}% no período`;
  }
}

function aaMapMacroSeries(seriesObj, period, year, valueKey = 'value') {
  const series = aaGetSeriesByPeriod(seriesObj, period, year);
  return series.map((row) => ({ label: row.label, value: Number(row[valueKey]) })).filter((r) => Number.isFinite(r.value));
}

function aaRenderReceita() {
  const core = window.AA.state.core;
  if (!core) return;

  const period = aaMacroState.receita.period;
  const year = aaMacroState.receita.year;

  const mainObj = core.series?.macro?.receita || {};
  const dataMain = aaMapMacroSeries(mainObj, period, year, 'value');

  let dataCompare = [];
  if (window.AA.state.compareCore) {
    const compareObj = window.AA.state.compareCore.series?.macro?.receita || {};
    dataCompare = aaMapMacroSeries(compareObj, period, year, 'value');
  }

  aaRenderLine('svg-receita', dataMain, dataCompare, 'tip-receita');

  const last = dataMain[dataMain.length - 1];
  const prev = dataMain[dataMain.length - 2];
  const valEl = document.getElementById('receita-val');
  const chgEl = document.getElementById('receita-chg');
  if (valEl) valEl.textContent = window.aaFmtCompactCurrency(last?.value);
  if (chgEl && last && prev && prev.value) {
    const pct = ((last.value - prev.value) / Math.abs(prev.value)) * 100;
    chgEl.className = `macro-chart-chg ${pct >= 0 ? 'up' : 'dn'}`;
    chgEl.textContent = `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}% vs anterior`;
  }
}

function aaRenderCaixa() {
  const core = window.AA.state.core;
  if (!core) return;

  const period = aaMacroState.caixa.period;
  const year = aaMacroState.caixa.year;

  const rows = aaGetSeriesByPeriod(core.series?.macro?.caixa || {}, period, year);
  let ebitdaSeries = rows
    .map((row) => ({ label: row.label, value: Number(row.ebitda) }))
    .filter((r) => Number.isFinite(r.value));

  let fcfSeries = rows
    .map((row) => ({ label: row.label, value: Number(row.fcl) }))
    .filter((r) => Number.isFinite(r.value));

  if (!ebitdaSeries.length || !fcfSeries.length) {
    const fallbackLabel = String(year);
    const fallbackEbitda = Number(core?.indices?.EBITDA?.value);
    const fallbackFcf = Number(
      core?.raw?.cashFlowStatementHistoryQuarterly?.[0]?.freeCashFlow
      ?? core?.raw?.cashFlowStatementHistoryQuarterly?.[0]?.operatingCashFlow
      ?? core?.raw?.cashFlowStatementHistory?.[0]?.freeCashFlow
      ?? core?.raw?.cashFlowStatementHistory?.[0]?.operatingCashFlow
    );

    if (!ebitdaSeries.length && Number.isFinite(fallbackEbitda)) {
      ebitdaSeries = [{ label: fallbackLabel, value: fallbackEbitda }];
    }
    if (!fcfSeries.length && Number.isFinite(fallbackFcf)) {
      fcfSeries = [{ label: fallbackLabel, value: fallbackFcf }];
    }
  }

  aaRenderLineChart({
    svgId: 'svg-caixa',
    tipId: 'tip-caixa',
    datasets: [
      { name: 'EBITDA', data: ebitdaSeries, color: AA_CHART_COLORS.ebitda, fill: AA_CHART_COLORS.ebitdaFill },
      { name: 'Geração de Caixa', data: fcfSeries, color: AA_CHART_COLORS.fcf, fill: AA_CHART_COLORS.fcfFill },
    ],
  });

  const last = ebitdaSeries[ebitdaSeries.length - 1];
  const prev = ebitdaSeries[ebitdaSeries.length - 2];
  const lastFcf = fcfSeries[fcfSeries.length - 1];
  const valEl = document.getElementById('caixa-val');
  const chgEl = document.getElementById('caixa-chg');

  if (valEl) {
    valEl.textContent = `EBITDA ${window.aaFmtCompactCurrency(last?.value)} · FCL ${window.aaFmtCompactCurrency(lastFcf?.value)}`;
  }
  if (chgEl && last && prev && prev.value) {
    const pct = ((last.value - prev.value) / Math.abs(prev.value)) * 100;
    chgEl.className = `macro-chart-chg ${pct >= 0 ? 'up' : 'dn'}`;
    chgEl.textContent = `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}% vs anterior`;
  }
}

function aaMetricSeries(core, key, period, year) {
  const chartSeries = core?.series?.metrics?.[key];
  const fromBackend = aaGetSeriesByPeriod(chartSeries || {}, period, year)
    .map((row) => ({ label: row.label, value: Number(row.value) }))
    .filter((row) => Number.isFinite(row.value));

  if (fromBackend.length) return fromBackend;

  const idx = core?.indices?.[key];
  if (!idx || idx.value === null || idx.value === undefined) return [];
  return [{ label: String(year), value: Number(idx.value) }].filter((row) => Number.isFinite(row.value));
}

function renderChart(key) {
  const core = window.AA.state.core;
  if (!core) return;
  const state = aaMetricState[key];
  if (!state) return;

  const metricType = core.indices?.[key]?.type || 'currency';
  const fmt = aaFmtByType(metricType);

  const main = aaMetricSeries(core, key, state.period, state.year);
  const compare = window.AA.state.compareCore
    ? aaMetricSeries(window.AA.state.compareCore, key, state.period, state.year)
    : [];

  aaRenderLineChart({
    svgId: `svg-${key}`,
    tipId: `tip-${key}`,
    valueFmt: fmt,
    datasets: [
      { name: window.AA.state.ticker || 'Principal', data: main || [], color: AA_CHART_COLORS.primary, fill: AA_CHART_COLORS.primaryFill, fmt },
      { name: window.AA.state.compareTicker || 'Comparado', data: compare || [], color: AA_CHART_COLORS.compare, fill: AA_CHART_COLORS.compareFill, dashed: true, fmt },
    ].filter((dataset) => Array.isArray(dataset.data) && dataset.data.length),
  });
}

function toggleChart(btn, key) {
  if (!aaMetricState[key]) return;
  const area = document.getElementById(`chart-${key}`);
  const psel = document.getElementById(`psel-${key}`);
  if (!area) return;

  const open = area.classList.toggle('visible');
  if (psel) psel.classList.toggle('visible', open);
  btn.textContent = open ? 'Esconder gráfico' : 'Mostrar gráfico';
  btn.classList.toggle('active', open);
  aaMetricState[key].open = open;

  if (open) {
    renderChart(key);
  }
}

function setPeriod(btn, key, period) {
  aaMetricState[key].period = period;
  const parent = btn.parentElement;
  if (parent) {
    parent.querySelectorAll('.period-btn').forEach((el) => el.classList.remove('active'));
    btn.classList.add('active');
  }
  if (aaMetricState[key].open) renderChart(key);
}

function setYear(sel, key) {
  aaMetricState[key].year = Number(sel.value);
  if (aaMetricState[key].open) renderChart(key);
}

function setMktcapFilter(btn, filter) {
  document.querySelectorAll('#mktcap-filters .mf-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  aaMacroState.mktcap.filter = filter;
  aaRenderMktCap();
}

function setReceitaPeriod(btn, period) {
  document.querySelectorAll('#receita-filters .mf-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  aaMacroState.receita.period = period;
  aaRenderReceita();
}

function setReceitaYear(sel) {
  aaMacroState.receita.year = Number(sel.value);
  aaRenderReceita();
}

function setCaixaPeriod(btn, period) {
  document.querySelectorAll('#caixa-filters .mf-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  aaMacroState.caixa.period = period;
  aaRenderCaixa();
}

function setCaixaYear(sel) {
  aaMacroState.caixa.year = Number(sel.value);
  aaRenderCaixa();
}

function aaFillYearSelect(id, years = []) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const values = years.length ? years : [new Date().getFullYear()];
  sel.innerHTML = values.map((year, index) => `<option value="${year}" ${index === 0 ? 'selected' : ''}>${year}</option>`).join('');
}

function aaBuildYearsFromCore(core) {
  const annual = core?.series?.macro?.receita?.A || [];
  const years = annual
    .map((row) => Number(String(row.label).replace(/\D/g, '').slice(0, 4)))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => b - a);
  return [...new Set(years)];
}

function aaRenderCharts() {
  const core = window.AA.state.core;
  if (!core) return;

  const years = aaBuildYearsFromCore(core);
  const maxYear = years[0] || new Date().getFullYear();

  AA_METRICS.forEach((key) => {
    if (!aaMetricState[key].year) aaMetricState[key].year = maxYear;
    aaFillYearSelect(`ysel-${key}`, years);
    const sel = document.getElementById(`ysel-${key}`);
    if (sel) sel.value = String(aaMetricState[key].year);
    if (aaMetricState[key].open) renderChart(key);
  });

  aaFillYearSelect('ysel-macro-receita', years);
  aaFillYearSelect('ysel-macro-caixa', years);
  aaMacroState.receita.year = Number(document.getElementById('ysel-macro-receita')?.value || maxYear);
  aaMacroState.caixa.year = Number(document.getElementById('ysel-macro-caixa')?.value || maxYear);

  aaRenderMktCap();
  aaRenderReceita();
  aaRenderCaixa();
}

function aaRenderAll() {
  if (typeof window.aaRenderIndices === 'function') window.aaRenderIndices();
  aaRenderCharts();
  if (typeof window.aaRefreshBalanceIfOpen === 'function') window.aaRefreshBalanceIfOpen();
  if (typeof window.aaRefreshWorkspace === 'function') window.aaRefreshWorkspace().catch(() => {});
}

window.renderChart = renderChart;
window.toggleChart = toggleChart;
window.setPeriod = setPeriod;
window.setYear = setYear;
window.setMktcapFilter = setMktcapFilter;
window.setReceitaPeriod = setReceitaPeriod;
window.setReceitaYear = setReceitaYear;
window.setCaixaPeriod = setCaixaPeriod;
window.setCaixaYear = setCaixaYear;
window.aaRenderCharts = aaRenderCharts;
window.aaRenderAll = aaRenderAll;

window.addEventListener('resize', () => {
  aaRenderCharts();
  AA_METRICS.forEach((key) => {
    if (aaMetricState[key].open) renderChart(key);
  });
});
