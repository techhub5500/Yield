/* ============================================================
 * analise-ativos.js — Orquestrador principal
 * ============================================================ */

// ─── URL BASE (deve ser definida antes do authGuard) ────────
function getBaseUrl() {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = hostname === 'localhost' || hostname === '127.0.0.1' ? '3000' : window.location.port;
  return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
}

// ─── AUTH GUARD (Tarefa 1.2.1) ─────────────────────────────
(function authGuard() {
  const token = localStorage.getItem('yield_token');
  const userRaw = localStorage.getItem('yield_user');

  if (!token || !userRaw) {
    window.location.href = getBaseUrl() + '/html/login.html';
    return;
  }

  try {
    JSON.parse(userRaw);
  } catch (_) {
    localStorage.removeItem('yield_token');
    localStorage.removeItem('yield_user');
    window.location.href = getBaseUrl() + '/html/login.html';
  }
})();

/**
 * Token JWT e cabeçalhos de autenticação reutilizáveis por todos os módulos.
 * Exportados como constantes globais para que os demais arquivos JS da página
 * possam acessá-los sem repetir a leitura do localStorage.
 */
const YIELD_TOKEN   = localStorage.getItem('yield_token');
const YIELD_USER    = JSON.parse(localStorage.getItem('yield_user') || '{}');
const YIELD_USER_ID = YIELD_USER._id || YIELD_USER.id || '';
const AUTH_HEADERS  = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${YIELD_TOKEN}`,
};

const API_BASE = getBaseUrl();

window.AA = {
  apiBase: API_BASE,
  authHeaders: AUTH_HEADERS,
  state: {
    ticker: null,
    compareTicker: null,
    core: null,
    compareCore: null,
    history: {},
    compareHistory: {},
  },
};

function aaFmtCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const num = Number(value);
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
}

function aaFmtCompactCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const num = Number(value);
  if (Math.abs(num) >= 1e12) return `R$ ${(num / 1e12).toFixed(2)}T`;
  if (Math.abs(num) >= 1e9) return `R$ ${(num / 1e9).toFixed(1)}B`;
  if (Math.abs(num) >= 1e6) return `R$ ${(num / 1e6).toFixed(1)}M`;
  return aaFmtCurrency(num);
}

window.aaFmtCurrency = aaFmtCurrency;
window.aaFmtCompactCurrency = aaFmtCompactCurrency;

// ─── ÚLTIMA PESQUISA (Tarefa 1.2.2) ───────────────────────

/**
 * Salva o último ticker pesquisado pelo usuário na collection aa_user_searches.
 * @param {string} ticker - Símbolo do ativo (ex.: "PETR4")
 */
async function saveLastSearch(ticker) {
  if (!YIELD_USER_ID || !ticker) return;
  try {
    await fetch(`${API_BASE}/api/analise-ativos/last-search`, {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ userId: YIELD_USER_ID, ticker }),
    });
  } catch (err) {
    console.warn('[analise-ativos] Não foi possível salvar última pesquisa:', err.message);
  }
}

/**
 * Recupera o último ticker pesquisado pelo usuário e o carrega automaticamente.
 * Chamado no DOMContentLoaded para evitar página vazia.
 */
async function loadLastSearch() {
  if (!YIELD_USER_ID) return;
  try {
    const res = await fetch(`${API_BASE}/api/analise-ativos/last-search/${YIELD_USER_ID}`, {
      headers: AUTH_HEADERS,
    });
    if (!res.ok) {
      if (typeof window.selectAsset === 'function') window.selectAsset('PETR4');
      return;
    }
    const data = await res.json();
    if (data && data.ticker) {
      const searchInput = document.getElementById('navSearchInp');
      if (searchInput) {
        searchInput.value = data.ticker;
      }
      if (typeof window.selectAsset === 'function') window.selectAsset(data.ticker);
      console.info(`[analise-ativos] Última pesquisa restaurada: ${data.ticker}`);
      return;
    }
    if (typeof window.selectAsset === 'function') window.selectAsset('PETR4');
  } catch (err) {
    console.warn('[analise-ativos] Não foi possível carregar última pesquisa:', err.message);
    if (typeof window.selectAsset === 'function') window.selectAsset('PETR4');
  }
}

// Carregar última pesquisa ao inicializar a página
document.addEventListener('DOMContentLoaded', () => {
  loadLastSearch();
});

// ─── SECTION COLLAPSE ───
function toggleSec(hd){
  const body=hd.nextElementSibling;
  const arr=hd.querySelector('.sec-arr');
  const hidden=body.style.display==='none';
  body.style.display=hidden?'':'none';
  arr.classList.toggle('open',hidden);
  hd.classList.toggle('collapsed',!hidden);
}

// ─── MODALS ───
function openModal(name){ document.getElementById('modal-'+name).classList.add('open'); }
function closeModal(name){ document.getElementById('modal-'+name).classList.remove('open'); }
document.querySelectorAll('.modal-ov').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('open');}));

// ─── CALCS ───
function switchCalc(name, el){
  document.querySelectorAll('.ctab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.calc-section').forEach(s=>s.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('cs-'+name).classList.add('active');
}
function calcGraham(){
  const lpa=parseFloat(document.getElementById('g-lpa').value);
  const vpa=parseFloat(document.getElementById('g-vpa').value);
  const res=document.getElementById('g-res');
  const sub=document.getElementById('g-sub');
  if(lpa>0&&vpa>0){const pj=Math.sqrt(22.5*lpa*vpa);res.textContent='R$ '+pj.toFixed(2);sub.textContent='Preço atual: R$ 38,42 — '+(38.42<=pj?'potencial de valorização de '+((pj/38.42-1)*100).toFixed(1)+'%':'acima do preço justo');}
  else{res.textContent='—';sub.textContent='';}
}
function calcPeg(){
  const pl=parseFloat(document.getElementById('peg-pl').value);
  const g=parseFloat(document.getElementById('peg-g').value);
  const res=document.getElementById('peg-res');
  if(pl>0&&g>0){const peg=pl/g;res.textContent=peg.toFixed(2)+'x';document.getElementById('peg-sub').textContent=peg<1?'Potencialmente subvalorizado (PEG < 1)':peg<2?'Avaliação razoável (PEG entre 1 e 2)':'Potencialmente sobrevalorizado (PEG > 2)';}
  else{res.textContent='—';}
}
function calcDiv(){
  const d=parseFloat(document.getElementById('div-atual').value);
  const g=parseFloat(document.getElementById('div-g').value)/100;
  const n=parseInt(document.getElementById('div-anos').value);
  const p=parseFloat(document.getElementById('div-preco').value);
  const res=document.getElementById('div-res');
  const sub=document.getElementById('div-sub');
  if(d>0&&!isNaN(g)&&n>0){
    const df=d*Math.pow(1+g,n);
    res.textContent='R$ '+df.toFixed(2)+'/ação';
    if(p>0){const yoc=df/p*100;sub.textContent='Yield on Cost no ano '+n+': '+yoc.toFixed(1)+'%';}
  } else {res.textContent='—';sub.textContent='';}
}

// CUSTO MÉDIO
let cmRows=[];
function addCmRow(){
  const idx=cmRows.length;
  cmRows.push({qtd:0,preco:0});
  const cont=document.getElementById('cm-rows');
  const row=document.createElement('div');
  row.className='crow';
  row.innerHTML=`<div class="cfield"><label>Qtd. de ações</label><input type="number" placeholder="ex: 100" oninput="updateCm(${idx},'qtd',this.value)"></div><div class="cfield"><label>Preço pago (R$)</label><input type="number" placeholder="ex: 35.20" oninput="updateCm(${idx},'preco',this.value)"></div>`;
  cont.appendChild(row);
  calcCm();
}
function updateCm(i,field,v){cmRows[i][field]=parseFloat(v)||0;calcCm();}
function calcCm(){
  const totalQtd=cmRows.reduce((a,r)=>a+r.qtd,0);
  const totalVal=cmRows.reduce((a,r)=>a+r.qtd*r.preco,0);
  const res=document.getElementById('cm-res');
  const sub=document.getElementById('cm-sub');
  if(totalQtd>0){
    const cm=totalVal/totalQtd;
    res.textContent='R$ '+cm.toFixed(2);
    sub.textContent=totalQtd+' ações — Total: R$ '+totalVal.toFixed(2);
  } else {res.textContent='—';sub.textContent='';}
}
// init cm row
addCmRow();

// VALUATION MODELS
const valModels={
  bazin:{desc:'O método de Bazin define o preço justo como aquele em que o Dividend Yield alcança pelo menos 6% ao ano. Funciona bem para empresas pagadoras consistentes.',inputs:[{id:'baz-div',label:'Dividendo anual esperado (R$)',ph:'ex: 5.49'}],calc:()=>{const d=parseFloat(document.getElementById('baz-div').value);return d>0?{val:(d/0.06).toFixed(2),lbl:'Preço Justo Bazin (DY = 6%)'}:{};} },
  gordon:{desc:'O Modelo de Gordon calcula o valor presente de dividendos crescendo perpetuamente. Adequado para empresas maduras com dividendos estáveis.',inputs:[{id:'gor-d',label:'Dividendo por ação (R$)',ph:'ex: 5.49'},{id:'gor-k',label:'Taxa de desconto (%) — Custo do capital',ph:'ex: 12'},{id:'gor-g',label:'Crescimento perpétuo (%)',ph:'ex: 4'}],calc:()=>{const d=parseFloat(document.getElementById('gor-d').value),k=parseFloat(document.getElementById('gor-k').value)/100,g=parseFloat(document.getElementById('gor-g').value)/100;return(d&&k&&g&&k>g)?{val:(d/(k-g)).toFixed(2),lbl:'Preço Justo Gordon Growth'}:{};}},
  lynch:{desc:'Peter Lynch sugere que uma empresa bem precificada tem P/L igual à sua taxa de crescimento. P/L justo = taxa de crescimento esperada do lucro.',inputs:[{id:'ly-g',label:'Crescimento do Lucro esperado (%)',ph:'ex: 8'},{id:'ly-lpa',label:'LPA (Lucro por Ação)',ph:'ex: 8.00'}],calc:()=>{const g=parseFloat(document.getElementById('ly-g').value),lpa=parseFloat(document.getElementById('ly-lpa').value);return(g&&lpa)?{val:(g*lpa).toFixed(2),lbl:'Preço Justo Peter Lynch'}:{};}},
  greenblatt:{desc:'A Magic Formula de Greenblatt seleciona empresas com alto ROIC e alto Earnings Yield. O preço justo é estimado pelo EV implícito com ROIC alvo.',inputs:[{id:'gbl-ebit',label:'EBIT anual (R$)',ph:'ex: 280'},{id:'gbl-cic',label:'Capital Investido (R$)',ph:'ex: 500'},{id:'gbl-acoes',label:'Número de ações (milhões)',ph:'ex: 13000'}],calc:()=>{const ebit=parseFloat(document.getElementById('gbl-ebit').value),cic=parseFloat(document.getElementById('gbl-cic').value),acoes=parseFloat(document.getElementById('gbl-acoes').value);if(ebit&&cic&&acoes){const ev=ebit/0.15,pj=(ev/acoes).toFixed(2);return{val:pj,lbl:'Preço Justo Magic Formula (ROIC alvo 15%)'};}return{};}},
};
function switchValModel(){
  const sel=document.getElementById('val-modelo').value;
  const desc=document.getElementById('val-desc');
  const inp=document.getElementById('val-inputs');
  const res=document.getElementById('val-result');
  if(!sel){desc.style.display='none';inp.innerHTML='';res.style.display='none';return;}
  const m=valModels[sel];
  desc.style.display='block'; desc.textContent=m.desc;
  inp.innerHTML=m.inputs.map(f=>`<div class="cfield"><label>${f.label}</label><input type="number" id="${f.id}" placeholder="${f.ph}" oninput="calcValuation()"></div>`).join('');
  res.style.display='block';
  document.getElementById('val-res').textContent='—';
}
function calcValuation(){
  const sel=document.getElementById('val-modelo').value;
  if(!sel)return;
  const r=valModels[sel].calc();
  if(r.val){
    document.getElementById('val-res').textContent='R$ '+r.val;
    document.getElementById('val-res-lbl').textContent=r.lbl||'Preço Justo';
    const pj=parseFloat(r.val);
    document.getElementById('val-sub').textContent=pj>0?'Preço atual: R$ 38,42 — '+(38.42<=pj?'upside de '+((pj/38.42-1)*100).toFixed(1)+'%':'acima do preço justo'):'';
  }
}

// METRIC CELL class
document.querySelectorAll('.metric-cell').forEach(c=>c.classList.add('mcell'));

// ─── DOSSIÊ TOGGLE ───
function mdToHtml(md) {
  const safe = String(md || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

  return safe
    .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>')
    .replace(/^\-\s+(.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

function renderDossie(content, meta = {}) {
  const panel = document.getElementById('dossierPanel');
  if (!panel) return;

  const subtitle = panel.querySelector('.dossier-subtitle');
  if (subtitle) {
    const date = meta.cachedAt ? new Date(meta.cachedAt) : new Date();
    subtitle.textContent = `Atualizado em ${date.toLocaleDateString('pt-BR')} · Fonte: ${meta.source || 'Tavily + GPT-5-mini'}`;
  }

  const grid = panel.querySelector('.dossier-grid');
  if (!grid) return;

  grid.innerHTML = `
    <div class="dossier-block" style="grid-column:1/-1">
      <div class="dossier-block-title">Dossiê consolidado</div>
      <div class="d-val">${mdToHtml(content)}</div>
    </div>
  `;
}

async function loadDossie() {
  const ticker = window.AA?.state?.ticker;
  if (!ticker) return;

  const panel = document.getElementById('dossierPanel');
  const grid = panel?.querySelector('.dossier-grid');
  if (grid) {
    grid.innerHTML = '<div class="dossier-block" style="grid-column:1/-1"><div class="dossier-block-title">Dossiê consolidado</div><div class="d-val">Carregando dossiê...</div></div>';
  }

  const res = await fetch(`${window.AA.apiBase}/api/analise-ativos/dossie`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({ ticker }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Falha ao carregar dossiê');

  renderDossie(data?.dossie?.content || 'Dossiê indisponível.', {
    source: data?.dossie?.source,
    cachedAt: data?.dossie?.cachedAt,
  });
}

async function toggleDossier() {
  const panel = document.getElementById('dossierPanel');
  const btn = document.getElementById('btn-dossier');

  const isOpening = panel.classList.toggle('visible');

  if (isOpening) {
    btn.style.background = 'var(--green)';
    btn.style.color = '#fff';
    btn.style.borderColor = 'var(--green)';
    btn.textContent = 'Ocultar Dossiê';
    try {
      await loadDossie();
    } catch (err) {
      const grid = panel?.querySelector('.dossier-grid');
      if (grid) {
        grid.innerHTML = `<div class="dossier-block" style="grid-column:1/-1"><div class="dossier-block-title">Dossiê consolidado</div><div class="d-val">Falha ao carregar dossiê: ${err.message}</div></div>`;
      }
    }
  } else {
    btn.style.background = '';
    btn.style.color = '';
    btn.style.borderColor = '';
    btn.textContent = 'Ver Dossiê';
  }
}

