// ─── NAV SEARCH ───
const assetDB=[
  {ticker:'PETR4',name:'Petróleo Brasileiro S.A. — Petrobras',sector:'Energia'},
  {ticker:'PETR3',name:'Petróleo Brasileiro (ON)',sector:'Energia'},
  {ticker:'VALE3',name:'Vale S.A.',sector:'Mineração'},
  {ticker:'ITUB4',name:'Itaú Unibanco Holding S.A.',sector:'Bancos'},
  {ticker:'BBDC4',name:'Banco Bradesco S.A.',sector:'Bancos'},
  {ticker:'ABEV3',name:'Ambev S.A.',sector:'Bebidas'},
  {ticker:'WEGE3',name:'WEG S.A.',sector:'Industrial'},
  {ticker:'RENT3',name:'Localiza Rent a Car S.A.',sector:'Aluguéis'},
  {ticker:'SUZB3',name:'Suzano S.A.',sector:'Papel e Celulose'},
  {ticker:'RDOR3',name:"Rede D'Or São Luiz S.A.",sector:'Saúde'},
  {ticker:'HAPV3',name:'Hapvida NotreDame Intermédica',sector:'Saúde'},
  {ticker:'MGLU3',name:'Magazine Luiza S.A.',sector:'Varejo'},
  {ticker:'BBAS3',name:'Banco do Brasil S.A.',sector:'Bancos'},
  {ticker:'LREN3',name:'Lojas Renner S.A.',sector:'Varejo'},
  {ticker:'COGN3',name:'Cogna Educação S.A.',sector:'Educação'},
  {ticker:'EGIE3',name:'Engie Brasil Energia',sector:'Energia Elétrica'},
  {ticker:'TAEE11',name:'Transmissão Paulista (TAEE)',sector:'Energia Elétrica'},
  {ticker:'CMIN3',name:'CSN Mineração S.A.',sector:'Mineração'},
  {ticker:'PRIO3',name:'PRIO S.A.',sector:'Petróleo e Gás'},
  {ticker:'CPLE6',name:'Copel S.A.',sector:'Energia Elétrica'},
];
function onNavSearch(val){
  const q=val.trim().toUpperCase();
  const res=document.getElementById('navSearchResults');
  if(!q){res.classList.remove('visible');return;}
  const matches=assetDB.filter(a=>a.ticker.startsWith(q)||a.name.toUpperCase().includes(q)).slice(0,6);
  if(!matches.length){res.classList.remove('visible');return;}
  res.innerHTML=matches.map(a=>`
    <div class="nav-search-item" onmousedown="selectAsset('${a.ticker}','${a.name.replace(/'/g,'\\u0027')}')">
      <div>
        <div class="nav-search-item-ticker">${a.ticker}</div>
        <div class="nav-search-item-name">${a.name}</div>
      </div>
      <span class="tag tag-s" style="font-size:.6rem;padding:2px 8px">${a.sector}</span>
    </div>
  `).join('');
  res.classList.add('visible');
}
function closeNavSearch(){
  const res=document.getElementById('navSearchResults');
  if(res) res.classList.remove('visible');
}
function selectAsset(ticker,name){
  const inp=document.getElementById('navSearchInp');
  if(inp) inp.value=ticker;
  closeNavSearch();
  // Pre-fill the compare input with the selected ticker for quick comparison
  const ci=document.getElementById('compInput');
  if(ci) ci.value=ticker;
}

// ─── COMPARE DATA + HELPERS ───
let compareBaseValues={};
const sectionsDef=[
  {title:'Valuation',summary:'Múltiplos de preço vs. fundamentos',health:'a',healthLbl:'vs. setor',
    metrics:[
      {key:'PL',lbl:'P/L',featured:true},
      {key:'PVP',lbl:'P/VP',featured:false},
      {key:'EVEBITDA',lbl:'EV/EBITDA',featured:false},
      {key:'DY',lbl:'Dividend Yield',featured:true},
      {key:'EV',lbl:'EV (Enterprise Value)',featured:false},
      {key:'PSR',lbl:'P/Receita (PSR)',featured:false}
    ]},
  {title:'Rentabilidade',summary:'Eficiência na geração de retorno',health:'g',healthLbl:'ROE · ROIC',
    metrics:[
      {key:'ROE',lbl:'ROE',featured:true},
      {key:'ROIC',lbl:'ROIC',featured:false},
      {key:'ROA',lbl:'ROA',featured:false},
      {key:'MEBITDA',lbl:'Margem EBITDA',featured:true},
      {key:'ML',lbl:'Margem Líquida',featured:false}
    ]},
  {title:'Resultado',summary:'Demonstração de resultados — R$ Bilhões',health:'a',healthLbl:'Resultado',
    metrics:[
      {key:'RL',lbl:'Receita Líquida',featured:false},
      {key:'LB',lbl:'Lucro Bruto',featured:false},
      {key:'EBITDA',lbl:'EBITDA',featured:false},
      {key:'LL',lbl:'Lucro Líquido',featured:true},
      {key:'CREC',lbl:'Cresc. Receita (YoY)',featured:false},
      {key:'CLL',lbl:'Cresc. Lucro (YoY)',featured:false},
      {key:'LPA',lbl:'LPA',featured:false},
      {key:'PAYOUT',lbl:'Payout',featured:false}
    ]},
  {title:'Endividamento',summary:'Estrutura de capital e risco financeiro',health:'g',healthLbl:'Endividamento',
    metrics:[{key:'DB',lbl:'Dívida Bruta',featured:false},{key:'DL',lbl:'Dívida Líquida',featured:false},{key:'ALAV',lbl:'Alavancagem DL/EBITDA',featured:true},{key:'DPL',lbl:'Dívida / PL',featured:false}]}
];

function formatCmpVal(key,v){
  if(['DY','ROE','ROIC','ROA','MEBITDA','ML','CREC','CLL','PAYOUT'].includes(key)) return v.toFixed(1)+'%';
  if(['PL','PVP','EVEBITDA','ALAV','DPL','PSR'].includes(key)) return v.toFixed(2)+'x';
  if(key==='LPA') return 'R$ '+v.toFixed(2);
  return 'R$ '+v.toFixed(0)+'B';
}

function generateCompareData(){
  compareBaseValues={};
  metrics.forEach(m=>{
    compareBaseValues[m]=baseValues[m].map(v=>+(v*(0.55+Math.random()*0.9)).toFixed(2));
  });
}

function getCompareChartVals(key,period,year){
  const bv=compareBaseValues[key]||baseValues[key];
  const yIdx=years.indexOf(parseInt(year));
  if(period==='A'){
    const end=yIdx<0?years.length:yIdx+1;
    return bv.slice(0,end).map((v,i)=>({v,label:String(years[i])}));
  }
  const q=parseInt(period.replace('T',''));
  const arr=bv.map(v=>+(v*(0.88+Math.random()*.24)).toFixed(2));
  const end=yIdx<0?arr.length:yIdx+1;
  return arr.slice(0,end).map((v,i)=>({v,label:`${q}T/${String(years[i]).slice(2)}`}));
}

function buildColB(ticker,assetName,price,chg,chgCls){
  const el=document.getElementById('compare-col-b');
  if(!el) return;
  let html=`
    <div class="col-label-hd">
      <span class="col-label-pill b"><span class="col-hd-dot b"></span>${ticker}</span>
      <button class="btn-end-compare" onclick="removeCompare()">✕ Encerrar comparação</button>
    </div>
    <div class="asset-hd">
      <div class="asset-left">
        <div class="ticker" style="color:var(--green)">${ticker}</div>
        <div class="asset-name">${assetName}</div>
        <div class="tags"><span class="tag tag-t">Comparação Ativa</span></div>
      </div>
      <div class="asset-right">
        <div class="price">${price}</div>
        <div class="chg ${chgCls}">${chg}</div>
      </div>
    </div>
    <div class="asset-health-strip">
      <div class="ahs-chip"><span class="cdot a"></span>Valuation — <strong>vs. setor</strong></div>
      <div class="ahs-chip"><span class="cdot g"></span>Rentabilidade — <strong>Positiva</strong></div>
      <div class="ahs-chip"><span class="cdot a"></span>Resultado — <strong>Em análise</strong></div>
      <div class="ahs-chip"><span class="cdot g"></span>Endividamento — <strong>Monitorar</strong></div>
    </div>
    <div class="macro-charts" id="macroChartsStripB" style="grid-template-columns:1fr">
      <div class="macro-chart-card">
        <div class="macro-chart-hd">
          <div class="macro-chart-info">
            <div class="macro-chart-title">Valor de Mercado</div>
            <div class="macro-chart-val" id="mktcap-val-b">—</div>
            <div class="macro-chart-chg" id="mktcap-chg-b"></div>
          </div>
          <div class="macro-chart-filters" id="mktcap-filters-b">
            <button class="mf-btn" onclick="setMktcapFilterB(this,'MTD')">MTD</button>
            <button class="mf-btn active" onclick="setMktcapFilterB(this,'YTD')">YTD</button>
            <button class="mf-btn" onclick="setMktcapFilterB(this,'12M')">12M</button>
            <button class="mf-btn" onclick="setMktcapFilterB(this,'ORIGEM')">Origem</button>
          </div>
        </div>
        <div class="macro-chart-body">
          <div class="macro-chart-svg-wrap">
            <svg class="macro-chart-svg" id="svg-mktcap-b"></svg>
            <div class="macro-chart-tooltip" id="tip-mktcap-b"></div>
          </div>
        </div>
      </div>
      <div class="macro-chart-card">
        <div class="macro-chart-hd">
          <div class="macro-chart-info">
            <div class="macro-chart-title">Receita Líquida</div>
            <div class="macro-chart-val" id="receita-val-b">—</div>
            <div class="macro-chart-chg" id="receita-chg-b"></div>
          </div>
          <div class="macro-chart-filters" id="receita-filters-b">
            <button class="mf-btn active mf-btn-blue" onclick="setReceitaPeriodB(this,'A')">Anual</button>
            <button class="mf-btn mf-btn-blue" onclick="setReceitaPeriodB(this,'1T')">1T</button>
            <button class="mf-btn mf-btn-blue" onclick="setReceitaPeriodB(this,'2T')">2T</button>
            <button class="mf-btn mf-btn-blue" onclick="setReceitaPeriodB(this,'3T')">3T</button>
            <button class="mf-btn mf-btn-blue" onclick="setReceitaPeriodB(this,'4T')">4T</button>
            <select class="year-sel" id="ysel-macro-receita-b" onchange="setReceitaYearB(this)"></select>
          </div>
        </div>
        <div class="macro-chart-body">
          <div class="macro-chart-svg-wrap">
            <svg class="macro-chart-svg" id="svg-receita-b"></svg>
            <div class="macro-chart-tooltip" id="tip-receita-b"></div>
          </div>
        </div>
      </div>
      <div class="macro-chart-card">
        <div class="macro-chart-hd">
          <div class="macro-chart-info">
            <div class="macro-chart-title">Caixa — EBITDA &amp; FCL</div>
            <div class="macro-chart-val" id="caixa-val-b">—</div>
            <div class="macro-chart-chg" id="caixa-chg-b"></div>
          </div>
          <div class="macro-chart-filters" id="caixa-filters-b">
            <button class="mf-btn active" onclick="setCaixaPeriodB(this,'A')">Anual</button>
            <button class="mf-btn" onclick="setCaixaPeriodB(this,'1T')">1T</button>
            <button class="mf-btn" onclick="setCaixaPeriodB(this,'2T')">2T</button>
            <button class="mf-btn" onclick="setCaixaPeriodB(this,'3T')">3T</button>
            <button class="mf-btn" onclick="setCaixaPeriodB(this,'4T')">4T</button>
            <select class="year-sel" id="ysel-macro-caixa-b" onchange="setCaixaYearB(this)"></select>
          </div>
        </div>
        <div class="macro-chart-body">
          <div class="macro-legend">
            <span class="macro-legend-item"><span class="macro-legend-dot" style="background:rgba(122,172,136,0.85)"></span>EBITDA</span>
            <span class="macro-legend-item"><span class="macro-legend-dot" style="background:rgba(191,102,73,0.85);border-radius:0"></span>Geração de Caixa</span>
          </div>
          <div class="macro-chart-svg-wrap">
            <svg class="macro-chart-svg" id="svg-caixa-b"></svg>
            <div class="macro-chart-tooltip" id="tip-caixa-b"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  sectionsDef.forEach(sec=>{
    html+=`
      <div class="section">
        <div class="sec-hd" onclick="toggleSec(this)">
          <div class="sec-hd-left">
            <span class="sec-title">${sec.title}</span>
            <span class="sec-summary">${sec.summary}</span>
          </div>
          <div class="sec-hd-right">
            <div class="sec-health"><div class="health-dot ${sec.health}"></div><span class="sec-health-lbl">${sec.healthLbl}</span></div>
            <span class="sec-arr open">▼</span>
          </div>
        </div>
        <div class="sec-body">
          <div class="mgrid">
            ${sec.metrics.map(m=>{
              const last=compareBaseValues[m.key]?compareBaseValues[m.key][compareBaseValues[m.key].length-1]:null;
              const v=last!==null?formatCmpVal(m.key,last):'—';
              return `
                <div class="metric-cell${m.featured?' featured':''}" data-key="${m.key}">
                  <div class="mlbl">${m.lbl} <span class="minfo" onclick="showInfo('${m.key}',event)">ⓘ</span></div>
                  <div class="mval">${v}</div>
                  <div class="msub">—</div>
                  <div class="mann" onclick="openNote(this)">✎</div>
                  <div class="mnote"><textarea placeholder="Sua anotação..." rows="2" onblur="saveNote(this,'${m.lbl}')"></textarea></div>
                  <div class="chart-toggle-row">
                    <button class="chart-toggle-btn" onclick="toggleChartSync(this,'${m.key}')">Mostrar gráfico</button>
                    <div class="chart-period-sel" id="psel-${m.key}-b">
                      <button class="period-btn active" onclick="setPeriod(this,'${m.key}','A')">Anual</button>
                      <button class="period-btn" onclick="setPeriod(this,'${m.key}','1T')">1T</button>
                      <button class="period-btn" onclick="setPeriod(this,'${m.key}','2T')">2T</button>
                      <button class="period-btn" onclick="setPeriod(this,'${m.key}','3T')">3T</button>
                      <button class="period-btn" onclick="setPeriod(this,'${m.key}','4T')">4T</button>
                      <span class="period-sep">|</span>
                      <select class="year-sel" onchange="setYear(this,'${m.key}')" id="ysel-${m.key}-b"></select>
                    </div>
                  </div>
                  <div class="chart-area" id="chart-${m.key}-b"><div class="chart-wrap"><svg class="chart-svg" id="svg-${m.key}-b"></svg><div class="chart-tooltip" id="tip-${m.key}-b"></div></div></div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  });
  el.innerHTML=html;
  // Init year selects for B column
  metrics.forEach(k=>{
    const sel=document.getElementById('ysel-'+k+'-b');
    if(!sel) return;
    for(let i=2025;i>=2018;i--){const o=document.createElement('option');o.value=i;o.textContent=i;sel.appendChild(o);}
  });
  // Add col-A label pill
  const colA=document.getElementById('content');
  if(colA && !colA.querySelector('.col-label-hd')){
    const lbl=document.createElement('div');
    lbl.className='col-label-hd';
    lbl.innerHTML='<span class="col-label-pill a"><span class="col-hd-dot a"></span>PETR4</span>';
    colA.insertBefore(lbl,colA.firstChild);
  }
  // Init B macro charts
  setTimeout(()=>initMacroChartsB(), 40);
}

// ─── COMPARE MACRO CHARTS (col B) ───
const macroChartStateB = { mktcap:{filter:'YTD'}, receita:{period:'A',year:2025}, caixa:{period:'A',year:2025} };

function generateCompareMacroData(ticker){
  // Per-ticker multiplier creates distinct but realistic data
  const mult={VALE3:0.78,ITUB4:0.41,BBDC4:0.28,ABEV3:0.32,WEGE3:0.38};
  const m=mult[ticker]||0.55;
  const jitter=()=>0.88+Math.random()*.24;
  const scale=(arr,f)=>arr.map(d=>{
    const n={...d};
    if('v' in n){n.v=Math.round(n.v*f*jitter()); if('idx' in n) n.idx=+(n.idx*(0.9+Math.random()*.2)).toFixed(2);}
    if('ebitda' in n){n.ebitda=Math.round(n.ebitda*f*jitter()); n.fcl=Math.round(n.fcl*f*jitter());}
    return n;
  });
  return {
    mktcap:{ MTD:scale(macroData.mktcap.MTD,m), YTD:scale(macroData.mktcap.YTD,m), '12M':scale(macroData.mktcap['12M'],m), ORIGEM:scale(macroData.mktcap.ORIGEM,m) },
    receita:{ A:scale(macroData.receita.A,m*1.1), '1T':scale(macroData.receita['1T'],m*1.1), '2T':scale(macroData.receita['2T'],m*1.1), '3T':scale(macroData.receita['3T'],m*1.1), '4T':scale(macroData.receita['4T'],m*1.1) },
    caixa:{ A:scale(macroData.caixa.A,m*1.05), '1T':scale(macroData.caixa['1T'],m*1.05), '2T':scale(macroData.caixa['2T'],m*1.05), '3T':scale(macroData.caixa['3T'],m*1.05), '4T':scale(macroData.caixa['4T'],m*1.05) }
  };
}

let compareMacroData = null;

function renderMacroChartB(svgId, tipId, data, colorStroke, colorGrad, valElId, chgElId, isMktcap){
  const svg=document.getElementById(svgId);
  const tip=document.getElementById(tipId);
  if(!svg||!data||!data.length) return;
  const W=svg.parentElement.offsetWidth||300, H=188;
  const vals=data.map(d=>'v' in d?d.v:d.ebitda);
  const mn=Math.min(...vals), mx=Math.max(...vals);
  const pad={t:14,b:26,l:8,r:8};
  const xS=i=>(W-pad.l-pad.r)/(Math.max(data.length-1,1))*i+pad.l;
  const yS=v=>H-pad.b-(mx===mn?0.5:(v-mn)/(mx-mn))*(H-pad.t-pad.b);
  const pts=data.map((d,i)=>`${xS(i)},${yS('v' in d?d.v:d.ebitda)}`).join(' ');
  const fill=`${pad.l},${H-pad.b} `+pts+` ${xS(data.length-1)},${H-pad.b}`;
  const step=Math.max(1,Math.floor(data.length/6));
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const uid=svgId;
  svg.innerHTML=`
    <defs>
      <linearGradient id="lg-${uid}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${colorGrad}"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
      </linearGradient>
    </defs>
    <polygon points="${fill}" fill="url(#lg-${uid})"/>
    <polyline points="${pts}" fill="none" stroke="${colorStroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${data.map((d,i)=>`<circle cx="${xS(i)}" cy="${yS('v' in d?d.v:d.ebitda)}" r="3.5" fill="var(--bg-card)" stroke="${colorStroke}" stroke-width="1.5" class="dot-b-mc" data-i="${i}" data-l="${d.label}" data-v="${'v' in d?d.v:d.ebitda}" ${isMktcap&&d.idx!==undefined?`data-idx="${d.idx}"`:''}/>`).join('')}
    ${data.map((d,i)=>i%step===0||i===data.length-1?`<text x="${xS(i)}" y="${H-6}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.22)" font-family="DM Mono,monospace">${d.label}</text>`:'').join('')}
  `;
  svg.querySelectorAll('.dot-b-mc').forEach(dot=>{
    dot.addEventListener('mouseenter',()=>{
      const i=parseInt(dot.dataset.i),v=parseFloat(dot.dataset.v),lbl=dot.dataset.l;
      const prev=i>0?vals[i-1]:null;
      const chg=prev!==null?((v-prev)/Math.abs(prev)*100).toFixed(1):null;
      let ch=''; if(chg!==null){const cl=parseFloat(chg)>=0?'pos':'neg';ch=`<div class="mct-chg ${cl}">${parseFloat(chg)>=0?'▲':'▼'} ${Math.abs(chg)}% vs anterior</div>`;}
      const extra=isMktcap&&dot.dataset.idx?`<div class="mct-idx">P/VPA: ${parseFloat(dot.dataset.idx).toFixed(2)}x</div>`:`<div class="mct-idx">Margem: —</div>`;
      tip.style.display='block';
      tip.innerHTML=`<div class="mct-date">${lbl} · <span style="color:var(--green)">${compareTicker}</span></div><div class="mct-val">${fmtRi(v)}</div>${extra}${ch}`;
      const r=svg.getBoundingClientRect(),cx=parseFloat(dot.getAttribute('cx')),cy=parseFloat(dot.getAttribute('cy')),sx=r.width/W;
      let l=cx*sx+12,t=cy-54; if(l+175>r.width)l=cx*sx-188; if(t<0)t=cy+16;
      tip.style.left=l+'px'; tip.style.top=t+'px';
    });
    dot.addEventListener('mouseleave',()=>{ tip.style.display='none'; });
  });
  const last=data[data.length-1], prev2=data.length>1?data[data.length-2]:null;
  const lastV='v' in last?last.v:last.ebitda;
  const prevV=prev2?('v' in prev2?prev2.v:prev2.ebitda):null;
  if(valElId){ const el=document.getElementById(valElId); if(el) el.textContent=fmtRi(lastV); }
  if(chgElId&&prevV!==null){
    const chg=((lastV-prevV)/Math.abs(prevV)*100).toFixed(1);
    const el=document.getElementById(chgElId);
    if(el){el.textContent=(parseFloat(chg)>=0?'▲ +':'▼ ')+Math.abs(chg)+'% vs anterior'; el.className='macro-chart-chg '+(parseFloat(chg)>=0?'up':'dn');}
  }
}

function renderCaixaChartB(period, year){
  if(!compareMacroData) return;
  const raw=compareMacroData.caixa[period]||compareMacroData.caixa.A;
  const data=period==='A'?raw.filter(d=>parseInt(d.label)<=year):
    raw.filter(d=>{ const p=d.label.split('/'); return p.length>1&&parseInt(p[1])<=parseInt(String(year).slice(2)); });
  if(!data||!data.length) return;
  const svg=document.getElementById('svg-caixa-b');
  const tip=document.getElementById('tip-caixa-b');
  if(!svg) return;
  const W=svg.parentElement.offsetWidth||300, H=188;
  const allV=[...data.map(d=>d.ebitda),...data.map(d=>d.fcl)];
  const mn=Math.min(...allV), mx=Math.max(...allV);
  const pad={t:14,b:26,l:8,r:8};
  const xS=i=>(W-pad.l-pad.r)/(Math.max(data.length-1,1))*i+pad.l;
  const yS=v=>H-pad.b-(mx===mn?0.5:(v-mn)/(mx-mn))*(H-pad.t-pad.b);
  const ptsE=data.map((d,i)=>`${xS(i)},${yS(d.ebitda)}`).join(' ');
  const ptsF=data.map((d,i)=>`${xS(i)},${yS(d.fcl)}`).join(' ');
  const step=Math.max(1,Math.floor(data.length/6));
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svg.innerHTML=`
    <defs>
      <linearGradient id="lg-cxe-b" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="rgba(122,172,136,0.18)"/><stop offset="100%" stop-color="rgba(122,172,136,0)"/>
      </linearGradient>
      <linearGradient id="lg-cxf-b" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="rgba(191,102,73,0.12)"/><stop offset="100%" stop-color="rgba(191,102,73,0)"/>
      </linearGradient>
    </defs>
    <polygon points="${pad.l},${H-pad.b} ${ptsE} ${xS(data.length-1)},${H-pad.b}" fill="url(#lg-cxe-b)"/>
    <polygon points="${pad.l},${H-pad.b} ${ptsF} ${xS(data.length-1)},${H-pad.b}" fill="url(#lg-cxf-b)"/>
    <polyline points="${ptsE}" fill="none" stroke="rgba(122,172,136,0.88)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <polyline points="${ptsF}" fill="none" stroke="rgba(191,102,73,0.88)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="6,3"/>
    ${data.map((d,i)=>`<circle cx="${xS(i)}" cy="${yS(d.ebitda)}" r="3.5" fill="var(--bg-card)" stroke="rgba(122,172,136,0.9)" stroke-width="1.5" class="mceb" data-i="${i}" data-l="${d.label}" data-e="${d.ebitda}" data-f="${d.fcl}"/>`).join('')}
    ${data.map((d,i)=>`<circle cx="${xS(i)}" cy="${yS(d.fcl)}" r="3.5" fill="var(--bg-card)" stroke="rgba(191,102,73,0.88)" stroke-width="1.5" class="mcfb" data-i="${i}" data-l="${d.label}" data-e="${d.ebitda}" data-f="${d.fcl}"/>`).join('')}
    ${data.map((d,i)=>i%step===0||i===data.length-1?`<text x="${xS(i)}" y="${H-6}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.22)" font-family="DM Mono,monospace">${d.label}</text>`:'').join('')}
  `;
  const bindB=(cls,isE)=>{
    svg.querySelectorAll('.'+cls).forEach(dot=>{
      dot.addEventListener('mouseenter',()=>{
        const i=parseInt(dot.dataset.i),e=parseFloat(dot.dataset.e),f=parseFloat(dot.dataset.f),lbl=dot.dataset.l;
        const series=isE?data.map(d=>d.ebitda):data.map(d=>d.fcl);
        const curr=isE?e:f; const prev=i>0?series[i-1]:null;
        const chg=prev!==null?((curr-prev)/Math.abs(prev)*100).toFixed(1):null;
        const conv=(f/e*100).toFixed(1);
        let ch=''; if(chg!==null){const cl=parseFloat(chg)>=0?'pos':'neg';ch=`<div class="mct-chg ${cl}">${parseFloat(chg)>=0?'▲':'▼'} ${Math.abs(chg)}% vs anterior</div>`;}
        const serieLabel=isE?`<span style="color:var(--green)">EBITDA</span>`:`<span style="color:var(--terra)">Geração de Caixa</span>`;
        tip.style.display='block';
        tip.innerHTML=`<div class="mct-date">${lbl} · ${serieLabel} · <span style="color:var(--green)">${compareTicker}</span></div><div class="mct-val">${fmtRi(curr)}</div><div class="mct-idx">Conversão FCL: ${conv}%</div>${ch}`;
        const r=svg.getBoundingClientRect(),cx=parseFloat(dot.getAttribute('cx')),cy=parseFloat(dot.getAttribute('cy')),sx=r.width/W;
        let l=cx*sx+12,t=cy-54; if(l+180>r.width)l=cx*sx-192; if(t<0)t=cy+16;
        tip.style.left=l+'px'; tip.style.top=t+'px';
      });
      dot.addEventListener('mouseleave',()=>{ tip.style.display='none'; });
    });
  };
  bindB('mceb',true); bindB('mcfb',false);
  const last=data[data.length-1], prev3=data.length>1?data[data.length-2]:null;
  const valEl=document.getElementById('caixa-val-b'); if(valEl) valEl.textContent=`EBITDA ${fmtRi(last.ebitda)}`;
  if(prev3){
    const chg=((last.ebitda-prev3.ebitda)/Math.abs(prev3.ebitda)*100).toFixed(1);
    const el=document.getElementById('caixa-chg-b');
    if(el){el.textContent=(parseFloat(chg)>=0?'▲ +':'▼ ')+Math.abs(chg)+'% vs anterior'; el.className='macro-chart-chg '+(parseFloat(chg)>=0?'up':'dn');}
  }
}

function initMacroChartsB(){
  if(!compareTicker) return;
  compareMacroData=generateCompareMacroData(compareTicker);
  // Populate year selects
  ['receita-b','caixa-b'].forEach(id=>{
    const sel=document.getElementById('ysel-macro-'+id);
    if(!sel||sel.options.length>0) return;
    for(let i=2025;i>=2018;i--){const o=document.createElement('option');o.value=i;o.textContent=i;sel.appendChild(o);}
  });
  // Render all three B charts
  const md=compareMacroData;
  renderMacroChartB('svg-mktcap-b','tip-mktcap-b',md.mktcap.YTD,'rgba(196,154,108,0.88)','rgba(196,154,108,0.24)','mktcap-val-b','mktcap-chg-b',true);
  const rd=getReceitaDataB('A',2025); renderMacroChartB('svg-receita-b','tip-receita-b',rd,'rgba(106,141,172,0.88)','rgba(106,141,172,0.24)','receita-val-b','receita-chg-b',false);
  renderCaixaChartB('A',2025);
}

function getReceitaDataB(period, year){
  if(!compareMacroData) return [];
  const raw=compareMacroData.receita[period]||compareMacroData.receita.A;
  if(period==='A') return raw.filter(d=>parseInt(d.label)<=year);
  const yShort=String(year).slice(2);
  return raw.filter(d=>{ const p=d.label.split('/'); return p.length>1&&parseInt(p[1])<=parseInt(yShort); });
}

function setMktcapFilterB(btn, filter){
  document.querySelectorAll('#mktcap-filters-b .mf-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  macroChartStateB.mktcap.filter=filter;
  if(!compareMacroData) return;
  renderMacroChartB('svg-mktcap-b','tip-mktcap-b',compareMacroData.mktcap[filter]||compareMacroData.mktcap.YTD,'rgba(196,154,108,0.88)','rgba(196,154,108,0.24)','mktcap-val-b','mktcap-chg-b',true);
}
function setReceitaPeriodB(btn, p){
  document.querySelectorAll('#receita-filters-b .mf-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  macroChartStateB.receita.period=p;
  const rd=getReceitaDataB(p, macroChartStateB.receita.year);
  renderMacroChartB('svg-receita-b','tip-receita-b',rd,'rgba(106,141,172,0.88)','rgba(106,141,172,0.24)','receita-val-b','receita-chg-b',false);
}
function setReceitaYearB(sel){
  macroChartStateB.receita.year=parseInt(sel.value);
  const rd=getReceitaDataB(macroChartStateB.receita.period, macroChartStateB.receita.year);
  renderMacroChartB('svg-receita-b','tip-receita-b',rd,'rgba(106,141,172,0.88)','rgba(106,141,172,0.24)','receita-val-b','receita-chg-b',false);
}
function setCaixaPeriodB(btn, p){
  document.querySelectorAll('#caixa-filters-b .mf-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  macroChartStateB.caixa.period=p;
  renderCaixaChartB(p, macroChartStateB.caixa.year);
}
function setCaixaYearB(sel){
  macroChartStateB.caixa.year=parseInt(sel.value);
  renderCaixaChartB(macroChartStateB.caixa.period, macroChartStateB.caixa.year);
}

// ─── COMPARE ───
let compareActive=false, compareTicker='';
const compareNames={VALE3:'Vale S.A.',ITUB4:'Itaú Unibanco',BBDC4:'Bradesco',ABEV3:'Ambev S.A.',WEGE3:'WEG S.A.'};
function openCompare(){ openModal('compare'); }
function applyCompare(){
  compareTicker=document.getElementById('compInput').value.trim().toUpperCase();
  if(!compareTicker) return;
  compareActive=true;
  generateCompareData();
  const name=compareNames[compareTicker]||compareTicker;
  // Mock price data for B company
  const mockPrices={VALE3:'R$ 62,18',ITUB4:'R$ 34,55',BBDC4:'R$ 14,82',ABEV3:'R$ 12,44',WEGE3:'R$ 48,90'};
  const mockChgs={VALE3:'▼ −0,42% hoje',ITUB4:'▲ +0,88% hoje',BBDC4:'▼ −0,31% hoje',ABEV3:'▲ +0,14% hoje',WEGE3:'▲ +1,02% hoje'};
  const mockChgCls={VALE3:'dn',ITUB4:'up',BBDC4:'dn',ABEV3:'up',WEGE3:'up'};
  buildColB(compareTicker, name, mockPrices[compareTicker]||'R$ —,——', mockChgs[compareTicker]||'—', mockChgCls[compareTicker]||'');
  document.getElementById('main').classList.add('compare-active');
  document.getElementById('compareBanner').classList.remove('visible');
  closeModal('compare');
  // Re-render col-A macro charts after layout shift to 50%
  setTimeout(()=>{
    renderMktcapChart(macroChartState.mktcap.filter);
    renderReceitaChart(macroChartState.receita.period, macroChartState.receita.year);
    renderCaixaChart(macroChartState.caixa.period, macroChartState.caixa.year);
  }, 60);
}
function removeCompare(){
  compareActive=false;
  compareTicker='';
  compareBaseValues={};
  document.getElementById('main').classList.remove('compare-active');
  document.getElementById('compare-col-b').innerHTML='';
  // Remove col-A label pill
  const colA=document.getElementById('content');
  const lbl=colA?colA.querySelector('.col-label-hd'):null;
  if(lbl) lbl.remove();
  // Re-render open charts in single-line mode
  metrics.forEach(k=>{ if(metricState[k]&&metricState[k].open) renderChart(k); });
  // Re-render col-A macro charts back to full width
  setTimeout(()=>{
    renderMktcapChart(macroChartState.mktcap.filter);
    renderReceitaChart(macroChartState.receita.period, macroChartState.receita.year);
    renderCaixaChart(macroChartState.caixa.period, macroChartState.caixa.year);
  }, 60);
}

