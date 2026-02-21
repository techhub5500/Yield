let bpLoaded = false;
let bpDataCache = null;
let bpMode = 'Q';
let bpYear = new Date().getFullYear();

const BP_ROWS = [
  { type: 'group', label: 'Ativo Circulante' },
  { key: 'cash', label: 'Caixa e Equivalentes' },
  { key: 'shortTermInvestments', label: 'Aplicações Financeiras CP' },
  { key: 'netReceivables', label: 'Contas a Receber' },
  { key: 'inventory', label: 'Estoques' },
  { key: 'taxesToRecover', label: 'Impostos a Recuperar' },
  { key: 'otherCurrentAssets', label: 'Outros Ativos Circ.' },
  { key: 'totalCurrentAssets', label: 'Total Ativo Circulante', type: 'subtotal' },
  { type: 'group', label: 'Ativo Não Circulante' },
  { key: 'propertyPlantEquipment', label: 'Imobilizado' },
  { key: 'intangibleAssets', label: 'Intangíveis' },
  { key: 'longTermInvestments', label: 'Investimentos LP' },
  { key: 'longTermRealizableAssets', label: 'Realizável LP e Outros' },
  { key: 'totalAssets', label: 'TOTAL ATIVO', type: 'total' },
  { type: 'spacer' },
  { type: 'group', label: 'Passivo Circulante' },
  { key: 'accountsPayable', label: 'Fornecedores' },
  { key: 'shortLongTermDebt', label: 'Empréstimos e Financ. CP' },
  { key: 'currentLiabilities', label: 'Total Passivo Circ.', type: 'subtotal' },
  { type: 'group', label: 'Passivo Não Circulante' },
  { key: 'longTermDebt', label: 'Empréstimos e Financ. LP' },
  { key: 'nonCurrentLiabilities', label: 'Total Passivo Não Circ.', type: 'subtotal' },
  { type: 'group', label: 'Patrimônio Líquido' },
  { key: 'totalStockholderEquity', label: 'Total Patrimônio Líquido', type: 'subtotal' },
  { key: 'totalAssets', label: 'TOTAL PASSIVO + PL', type: 'total' },
];

function bpFmt(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return '—';
  if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(1).replace('.', ',')} B`;
  if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(1).replace('.', ',')} M`;
  return num.toLocaleString('pt-BR');
}

function bpHdrLabel(endDate, mode) {
  const dt = new Date(`${endDate}T00:00:00`);
  if (mode === 'A') return String(dt.getFullYear());
  const quarter = Math.ceil((dt.getMonth() + 1) / 3);
  return `${quarter}T/${String(dt.getFullYear()).slice(2)}`;
}

function bpCurrentTicker() {
  return window.AA.state.ticker || document.getElementById('assetTicker')?.textContent?.trim() || '';
}

function bpPeriods() {
  if (!bpDataCache) return [];
  const source = bpMode === 'Q' ? (bpDataCache.quarterly || []) : (bpDataCache.annual || []);
  const filtered = source.filter((row) => String(row.endDate || '').startsWith(String(bpYear)));
  return filtered.slice(0, 4).reverse();
}

function bpPopulateYears() {
  if (!bpDataCache) return;
  const source = bpMode === 'Q' ? (bpDataCache.quarterly || []) : (bpDataCache.annual || []);
  const years = [...new Set(source
    .map((row) => Number(String(row.endDate || '').slice(0, 4)))
    .filter((year) => Number.isFinite(year)))]
    .sort((a, b) => b - a);

  const sel = document.getElementById('bpYearSel');
  if (!sel) return;
  if (!years.length) {
    sel.innerHTML = '<option value="">—</option>';
    return;
  }

  if (!years.includes(bpYear)) bpYear = years[0];
  sel.innerHTML = years.map((year) => `<option value="${year}" ${year === bpYear ? 'selected' : ''}>${year}</option>`).join('');
}

function bpRender() {
  const periods = bpPeriods();

  [1, 2, 3, 4].forEach((index) => {
    const el = document.getElementById(`bpH${index}`);
    if (!el) return;
    const row = periods[index - 1];
    el.textContent = row ? bpHdrLabel(row.endDate, bpMode) : '—';
  });

  const tbody = document.getElementById('bpTbody');
  if (!tbody) return;

  const html = [];
  BP_ROWS.forEach((row) => {
    if (row.type === 'spacer') {
      html.push('<tr class="bp-spacer"><td colspan="5"></td></tr>');
      return;
    }

    if (row.type === 'group') {
      html.push(`<tr class="bp-group-hd"><td colspan="5">${row.label}</td></tr>`);
      return;
    }

    const values = periods.map((period) => Number(period?.[row.key]));
    const hasAnyValue = values.some((val) => Number.isFinite(val) && val !== 0);
    if (!hasAnyValue) return;

    const cls = row.type === 'total' ? 'bp-total' : row.type === 'subtotal' ? 'bp-subtotal' : 'bp-row';

    const cells = values.map((val) => {
      const negative = Number.isFinite(val) && val < 0;
      return `<td${negative ? ' class="bp-neg"' : ''}>${bpFmt(val)}</td>`;
    }).join('');

    html.push(`<tr class="${cls}"><td>${row.label}</td>${cells}</tr>`);
  });

  tbody.innerHTML = html.join('');
}

async function bpLoad() {
  const ticker = bpCurrentTicker();
  if (!ticker) return;

  const msg = document.getElementById('bpLoadMsg');
  if (msg) {
    msg.style.display = '';
    msg.textContent = 'Carregando dados de balanço...';
  }

  try {
    const res = await fetch(`${window.AA.apiBase}/api/analise-ativos/balance/${ticker}`, {
      headers: window.AA.authHeaders,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Falha ao carregar balanço');
    }

    bpDataCache = {
      ticker,
      quarterly: Array.isArray(data.quarterly) ? data.quarterly : [],
      annual: Array.isArray(data.annual) ? data.annual : [],
    };

    bpLoaded = true;
    bpMode = 'Q';
    const latestAnnual = bpDataCache.annual[0];
    if (latestAnnual?.endDate) bpYear = Number(String(latestAnnual.endDate).slice(0, 4));

    bpPopulateYears();
    bpRender();

    const wrap = document.getElementById('bpTableWrap');
    if (wrap) wrap.style.display = '';
    if (msg) msg.style.display = 'none';
  } catch (err) {
    if (msg) {
      msg.style.display = '';
      msg.textContent = `Erro ao carregar balanço: ${err.message}`;
    }
  }
}

function bpSetMode(mode) {
  bpMode = mode;
  const btnQ = document.getElementById('bpBtnQ');
  const btnA = document.getElementById('bpBtnA');
  if (btnQ) btnQ.classList.toggle('active', mode === 'Q');
  if (btnA) btnA.classList.toggle('active', mode === 'A');

  if (!bpLoaded) return;
  bpPopulateYears();
  bpRender();
}

function bpSetYear(year) {
  bpYear = Number(year);
  if (bpLoaded) bpRender();
}

function aaResetBalanceCache() {
  bpLoaded = false;
  bpDataCache = null;

  const wrap = document.getElementById('bpTableWrap');
  if (wrap) wrap.style.display = 'none';

  const msg = document.getElementById('bpLoadMsg');
  if (msg) {
    msg.style.display = '';
    msg.textContent = 'Abra a seção para carregar os dados.';
  }
}

function aaRefreshBalanceIfOpen() {
  const sec = document.querySelector('#sec-balanco .sec-body');
  if (!sec) return;
  const isOpen = sec.style.display !== 'none';
  if (isOpen && !bpLoaded) bpLoad();
}

window.bpLoad = bpLoad;
window.bpSetMode = bpSetMode;
window.bpSetYear = bpSetYear;
window.aaResetBalanceCache = aaResetBalanceCache;
window.aaRefreshBalanceIfOpen = aaRefreshBalanceIfOpen;
