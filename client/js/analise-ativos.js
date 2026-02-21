/* ============================================================
 * analise-ativos.js — Orquestrador principal
 * ============================================================ */

// ─── AUTH GUARD (Tarefa 1.2.1) ─────────────────────────────
(function authGuard() {
  const token = localStorage.getItem('yield_token');
  const userRaw = localStorage.getItem('yield_user');

  if (!token || !userRaw) {
    window.location.href = '../html/login.html';
    return;
  }

  try {
    JSON.parse(userRaw);
  } catch (_) {
    localStorage.removeItem('yield_token');
    localStorage.removeItem('yield_user');
    window.location.href = '../html/login.html';
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

// Detectar URL base da API (mesmo padrão do login.js)
function getBaseUrl() {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = hostname === 'localhost' || hostname === '127.0.0.1' ? '3000' : window.location.port;
  return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
}
const API_BASE = getBaseUrl();

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
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.ticker) {
      // Preenche o campo de pesquisa e dispara o carregamento do ativo
      const searchInput = document.getElementById('search-input') || document.querySelector('[data-search-input]');
      if (searchInput) {
        searchInput.value = data.ticker;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      console.info(`[analise-ativos] Última pesquisa restaurada: ${data.ticker}`);
    }
  } catch (err) {
    console.warn('[analise-ativos] Não foi possível carregar última pesquisa:', err.message);
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
function toggleDossier() {
  const panel = document.getElementById('dossierPanel');
  const btn = document.getElementById('btn-dossier');
  
  const isOpening = panel.classList.toggle('visible');
  
  if (isOpening) {
    btn.style.background = 'var(--green)';
    btn.style.color = '#fff';
    btn.style.borderColor = 'var(--green)';
    btn.textContent = 'Ocultar Dossiê';
  } else {
    // Retorna ao estilo original do CSS (.tag-t)
    btn.style.background = '';
    btn.style.color = '';
    btn.style.borderColor = '';
    btn.textContent = 'Ver Dossiê';
  }
}

