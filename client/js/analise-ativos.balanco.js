// ─── BALANÇO PATRIMONIAL ───
const BP_TOKEN = '6V6hGyg5UsB4hz3Kr74XBR';
const BP_TICKER = 'PETR4';
let bpLoaded = false;
let bpDataCache = null;
let bpMode = 'Q';
let bpYear = 2024;

const BP_ROWS = [
  { type:'group', label:'Ativo Circulante' },
  { key:'cash', label:'Caixa e Equivalentes' },
  { key:'shortTermInvestments', label:'Aplicações Financeiras CP' },
  { key:'netReceivables', label:'Contas a Receber' },
  { key:'inventory', label:'Estoques' },
  { key:'taxesToRecover', label:'Impostos a Recuperar' },
  { key:'otherCurrentAssets', label:'Outros Ativos Circ.' },
  { key:'totalCurrentAssets', label:'Total Ativo Circulante', type:'subtotal' },
  { type:'group', label:'Ativo Não Circulante' },
  { key:'propertyPlantEquipment', label:'Imobilizado' },
  { key:'intangibleAssets', label:'Intangíveis' },
  { key:'longTermInvestments', label:'Investimentos LP' },
  { key:'longTermRealizableAssets', label:'Realizável LP e Outros' },
  { key:'longTermAssets', label:'Total Ativo Não Circ.', type:'subtotal' },
  { key:'totalAssets', label:'TOTAL ATIVO', type:'total' },
  { type:'spacer' },
  { type:'group', label:'Passivo Circulante' },
  { key:'providers', label:'Fornecedores' },
  { key:'loansAndFinancing', label:'Empréstimos e Financ. CP' },
  { key:'leaseFinancing', label:'Arrendamentos CP' },
  { key:'taxObligations', label:'Obrigações Fiscais' },
  { key:'socialAndLaborObligations', label:'Obrigações Trabalhistas' },
  { key:'otherObligations', label:'Outras Obrig. Circ.' },
  { key:'currentLiabilities', label:'Total Passivo Circ.', type:'subtotal' },
  { type:'group', label:'Passivo Não Circulante' },
  { key:'longTermLoansAndFinancing', label:'Empréstimos e Financ. LP' },
  { key:'longTermLeaseFinancing', label:'Arrendamentos LP' },
  { key:'longTermProvisions', label:'Provisões LP' },
  { key:'otherLongTermObligations', label:'Outras Obrig. Não Circ.' },
  { key:'nonCurrentLiabilities', label:'Total Passivo Não Circ.', type:'subtotal' },
  { type:'group', label:'Patrimônio Líquido' },
  { key:'realizedShareCapital', label:'Capital Social' },
  { key:'capitalReserves', label:'Reservas de Capital' },
  { key:'profitReserves', label:'Reservas de Lucro' },
  { key:'otherComprehensiveResults', label:'Outros Result. Abrang.' },
  { key:'retainedEarnings', label:'Lucros Retidos / Prej.' },
  { key:'shareholdersEquity', label:'Total Patrimônio Líquido', type:'subtotal' },
  { key:'totalAssets', label:'TOTAL PASSIVO + PL', type:'total' },
];

function bpFmt(v) {
  if (v === null || v === undefined || v === 0) return '—';
  const b = v / 1e9;
  if (Math.abs(b) >= 1) return b.toFixed(1).replace('.', ',') + ' B';
  const m = v / 1e6;
  return m.toFixed(0).replace('.', ',') + ' M';
}

function bpHdrLabel(d) {
  const dt = new Date(d.endDate + 'T00:00:00');
  const y = String(dt.getFullYear()).slice(2);
  if (bpMode === 'A') return String(dt.getFullYear());
  const q = Math.ceil((dt.getMonth() + 1) / 3);
  return 'Q' + q + '/' + y;
}

function bpGetPeriods() {
  if (!bpDataCache) return [];
  const src = bpMode === 'Q' ? bpDataCache.quarterly : bpDataCache.annual;
  const yearStr = String(bpYear);
  const filtered = src.filter(d => d.endDate.startsWith(yearStr));
  return filtered.slice(0, 4).reverse();
}

function bpRender() {
  const periods = bpGetPeriods();
  // Headers
  [1,2,3,4].forEach(i => {
    const el = document.getElementById('bpH' + i);
    if (el) el.textContent = periods[i-1] ? bpHdrLabel(periods[i-1]) : '—';
  });
  // Rows
  let html = '';
  BP_ROWS.forEach(row => {
    if (row.type === 'spacer') { html += '<tr class="bp-spacer"><td colspan="5"></td></tr>'; return; }
    if (row.type === 'group') { html += '<tr class="bp-group-hd"><td colspan="5">' + row.label + '</td></tr>'; return; }
    const cls = row.type === 'total' ? 'bp-total' : row.type === 'subtotal' ? 'bp-subtotal' : 'bp-row';
    const lbl = (row.type === 'subtotal' ? '▸ ' : '') + row.label;
    let cells = '';
    for (let i = 0; i < 4; i++) {
      const p = periods[i];
      const v = p ? p[row.key] : null;
      const neg = (v !== null && v !== undefined && v < 0);
      cells += '<td' + (neg ? ' class="bp-neg"' : '') + '>' + bpFmt(v) + '</td>';
    }
    html += '<tr class="' + cls + '"><td>' + lbl + '</td>' + cells + '</tr>';
  });
  document.getElementById('bpTbody').innerHTML = html;
}

function bpPopulateYears() {
  if (!bpDataCache) return;
  const src = bpMode === 'Q' ? bpDataCache.quarterly : bpDataCache.annual;
  const years = [...new Set(src.map(d => d.endDate.substring(0, 4)))].sort((a,b) => b-a);
  const sel = document.getElementById('bpYearSel');
  const cur = sel.value || String(bpYear);
  sel.innerHTML = years.map(y => '<option value="' + y + '"' + (y === cur ? ' selected' : '') + '>' + y + '</option>').join('');
  if (years.length > 0 && !years.includes(cur)) { bpYear = parseInt(years[1] || years[0]); sel.value = String(bpYear); }
}

async function bpLoad() {
  if (bpLoaded) return;
  const msg = document.getElementById('bpLoadMsg');
  if (msg) msg.textContent = 'Carregando dados...';
  try {
    const url = 'https://brapi.dev/api/quote/' + BP_TICKER + '?modules=balanceSheetHistoryQuarterly,balanceSheetHistory&token=' + BP_TOKEN;
    const res = await fetch(url);
    const json = await res.json();
    const r = json.results[0];
    bpDataCache = { quarterly: r.balanceSheetHistoryQuarterly || [], annual: r.balanceSheetHistory || [] };
    bpLoaded = true;
    // Default: last complete year (most recent annual entry)
    if (bpDataCache.annual.length > 0) { bpYear = parseInt(bpDataCache.annual[0].endDate.substring(0, 4)); }
    bpPopulateYears();
    if (msg) msg.style.display = 'none';
    const wrap = document.getElementById('bpTableWrap');
    if (wrap) wrap.style.display = '';
    bpRender();
  } catch(e) {
    if (msg) msg.textContent = 'Erro ao carregar dados do balanço.';
  }
}

function bpSetMode(mode) {
  bpMode = mode;
  document.getElementById('bpBtnQ').classList.toggle('active', mode === 'Q');
  document.getElementById('bpBtnA').classList.toggle('active', mode === 'A');
  if (bpLoaded) { bpPopulateYears(); bpRender(); }
}

function bpSetYear(y) {
  bpYear = parseInt(y);
  if (bpLoaded) bpRender();
}

// init
