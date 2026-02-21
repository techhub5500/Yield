// ─── DATA ───
const chartData = {};
const metrics = ['PL','PVP','EVEBITDA','DY','EV','PSR','ROE','ROIC','ROA','MEBITDA','ML','RL','LB','EBITDA','LL','CREC','CLL','LPA','PAYOUT','DB','DL','ALAV','DPL'];
const baseValues = {
  PL:[9.2,7.4,5.1,4.2,4.8,5.6,4.8],
  PVP:[2.1,1.8,1.3,1.0,1.2,1.4,1.2],
  EVEBITDA:[6.8,5.4,3.9,3.2,3.6,4.0,3.6],
  DY:[8.2,5.1,11.4,14.8,13.2,12.1,14.3],
  EV:[610,650,680,750,780,720,738],
  PSR:[1.3,1.2,1.0,0.9,1.1,1.0,1.1],
  ROE:[18.2,12.4,31.2,34.8,28.4,26.1,28.4],
  ROIC:[12.1,8.8,20.1,22.4,18.7,17.2,18.7],
  ROA:[6.2,4.1,10.5,11.8,9.2,8.6,9.2],
  MEBITDA:[44.2,38.8,52.4,56.1,54.8,51.2,54.8],
  ML:[23,19,26,29,25,23,25],
  RL:[380,320,460,510,512,498,512],
  LB:[210,175,255,290,286,272,286],
  EBITDA:[168,124,241,288,281,265,281],
  LL:[88,54,148,162,125,118,125],
  CREC:[12,6,14,16,9,5,9],
  CLL:[14,-1,16,19,7,-7,7],
  LPA:[9,7,13,15,12,11,12],
  PAYOUT:[42,47,52,57,44,42,44],
  DB:[290,310,285,298,312,308,312],
  DL:[182,208,168,185,198,192,198],
  ALAV:[1.09,1.68,0.70,0.64,0.71,0.73,0.71],
  DPL:[1.72,2.14,1.24,1.30,1.48,1.42,1.48]
};
const years = [2018,2019,2020,2021,2022,2023,2024,2025];
const quarters = {A:baseValues,1:null,2:null,3:null,4:null};
const metricState = {};
metrics.forEach(k => { metricState[k]={period:'A',year:2025,open:false}; generateQData(k); });
function generateQData(k){const b=baseValues[k];quarters[1]={};quarters[2]={};quarters[3]={};quarters[4]={};metrics.forEach(m=>{const bv=baseValues[m];[1,2,3,4].forEach(q=>{if(!quarters[q][m])quarters[q][m]=[];quarters[q][m]=bv.map((v,i)=>+(v*(0.88+Math.random()*.24)).toFixed(2));});});}

// YEAR SELECTS
metrics.forEach(k => {
  const sel = document.getElementById('ysel-'+k);
  if(!sel) return;
  for(let i=2025;i>=2018;i--){const o=document.createElement('option');o.value=i;o.textContent=i;sel.appendChild(o);}
});

function getChartVals(key, period, year){
  const yIdx = years.indexOf(parseInt(year));
  if(period==='A'){
    const end=yIdx<0?years.length:yIdx+1;
    return baseValues[key].slice(0,end).map((v,i)=>({v,label:String(years[i])}));
  }
  const q=parseInt(period.replace('T',''));
  const arr=quarters[q]&&quarters[q][key]?quarters[q][key]:baseValues[key];
  const end=yIdx<0?arr.length:yIdx+1;
  return arr.slice(0,end).map((v,i)=>({v,label:`${q}T/${String(years[i]).slice(2)}`}));
}

// CHART RENDER
function renderChart(key){
  const state=metricState[key];
  const dataA=getChartVals(key,state.period,state.year);
  if(!dataA.length)return;
  const svgA=document.getElementById('svg-'+key);
  const tipA=document.getElementById('tip-'+key);
  if(!svgA)return;
  const W=svgA.parentElement.offsetWidth||300, H=120;

  if(compareActive && Object.keys(compareBaseValues).length){
    // ── DUAL-LINE MODE ──
    const dataB=getCompareChartVals(key,state.period,state.year);
    const valsA=dataA.map(d=>d.v), valsB=dataB.map(d=>d.v);
    const allVals=[...valsA,...valsB];
    const mn=Math.min(...allVals), mx=Math.max(...allVals);

    const buildDual=(svg,tip)=>{
      if(!svg)return;
      svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
      const pad={t:22,b:22,l:8,r:8};
      const xSA=i=>(W-pad.l-pad.r)/(Math.max(dataA.length-1,1))*i+pad.l;
      const xSB=i=>(W-pad.l-pad.r)/(Math.max(dataB.length-1,1))*i+pad.l;
      const yS=v=>H-pad.b-(mx===mn?0.5:(v-mn)/(mx-mn))*(H-pad.t-pad.b);
      const ptsA=dataA.map((d,i)=>`${xSA(i)},${yS(d.v)}`).join(' ');
      const ptsB=dataB.length>1?dataB.map((d,i)=>`${xSB(i)},${yS(d.v)}`).join(' '):'';
      const fillA=`${pad.l},${H-pad.b} `+ptsA+` ${xSA(dataA.length-1)},${H-pad.b}`;
      const uid=key+svg.id.slice(-1);
      svg.innerHTML=`
        <defs>
          <linearGradient id="lg-${uid}" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="rgba(196,154,108,0.18)"/>
            <stop offset="100%" stop-color="rgba(196,154,108,0)"/>
          </linearGradient>
        </defs>
        <polygon points="${fillA}" fill="url(#lg-${uid})"/>
        <polyline points="${ptsA}" fill="none" stroke="rgba(196,154,108,0.85)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
        ${ptsB?`<polyline points="${ptsB}" fill="none" stroke="rgba(122,172,136,0.85)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`:''}
        ${dataA.map((d,i)=>`<circle cx="${xSA(i)}" cy="${yS(d.v)}" r="3" fill="var(--bg-card)" stroke="rgba(196,154,108,0.85)" stroke-width="1.5" class="dot dot-a" data-i="${i}" data-v="${d.v}" data-l="${d.label}"/>`).join('')}
        ${dataB.map((d,i)=>`<circle cx="${xSB(i)}" cy="${yS(d.v)}" r="3" fill="var(--bg-card)" stroke="rgba(122,172,136,0.85)" stroke-width="1.5" class="dot dot-b" data-i="${i}" data-v="${d.v}" data-l="${d.label}"/>`).join('')}
        ${dataA.map((d,i)=>`<text x="${xSA(i)}" y="${H-4}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.2)" font-family="DM Mono,monospace">${d.label}</text>`).join('')}
      `;
      if(tip){
        svg.querySelectorAll('.dot-a').forEach(dot=>{
          dot.addEventListener('mouseenter',()=>{
            const i=parseInt(dot.dataset.i),v=parseFloat(dot.dataset.v),lbl=dot.dataset.l;
            const prev=i>0?valsA[i-1]:null,chg=prev!==null?((v-prev)/Math.abs(prev)*100).toFixed(1):null;
            let ch='';if(chg!==null){const cl=parseFloat(chg)>=0?'pos':'neg';ch=`<div class="ct-chg ${cl}">${parseFloat(chg)>=0?'▲':'▼'} ${Math.abs(chg)}% vs anterior</div>`;}
            tip.style.display='block';
            tip.innerHTML=`<div class="ct-date">${lbl} · <span style="color:var(--gold)">PETR4</span></div><div class="ct-val">${v}</div>${ch}`;
            const r=svg.getBoundingClientRect(),cx=parseFloat(dot.getAttribute('cx')),cy=parseFloat(dot.getAttribute('cy')),sx=r.width/W;
            let l=cx*sx+10,t=cy-40;if(l+150>r.width)l=cx*sx-160;
            tip.style.left=l+'px';tip.style.top=t+'px';
          });
          dot.addEventListener('mouseleave',()=>{tip.style.display='none';});
        });
        svg.querySelectorAll('.dot-b').forEach(dot=>{
          dot.addEventListener('mouseenter',()=>{
            const i=parseInt(dot.dataset.i),v=parseFloat(dot.dataset.v),lbl=dot.dataset.l;
            const prev=i>0?valsB[i-1]:null,chg=prev!==null?((v-prev)/Math.abs(prev)*100).toFixed(1):null;
            let ch='';if(chg!==null){const cl=parseFloat(chg)>=0?'pos':'neg';ch=`<div class="ct-chg ${cl}">${parseFloat(chg)>=0?'▲':'▼'} ${Math.abs(chg)}% vs anterior</div>`;}
            tip.style.display='block';
            tip.innerHTML=`<div class="ct-date">${lbl} · <span style="color:var(--green)">${compareTicker}</span></div><div class="ct-val">${v}</div>${ch}`;
            const r=svg.getBoundingClientRect(),cx=parseFloat(dot.getAttribute('cx')),cy=parseFloat(dot.getAttribute('cy')),sx=r.width/W;
            let l=cx*sx+10,t=cy-40;if(l+150>r.width)l=cx*sx-160;
            tip.style.left=l+'px';tip.style.top=t+'px';
          });
          dot.addEventListener('mouseleave',()=>{tip.style.display='none';});
        });
      }
      // Legend
      const wrap=svg.parentElement;
      let legend=wrap.querySelector('.chart-legend');
      if(!legend){legend=document.createElement('div');legend.className='chart-legend';wrap.appendChild(legend);}
      legend.innerHTML=`<span class="chart-legend-item"><span class="chart-legend-dot a"></span>PETR4</span><span class="chart-legend-item"><span class="chart-legend-dot b"></span>${compareTicker}</span>`;
    };

    buildDual(svgA,tipA);
    buildDual(document.getElementById('svg-'+key+'-b'),document.getElementById('tip-'+key+'-b'));

  } else {
    // ── SINGLE-LINE MODE ──
    svgA.setAttribute('viewBox',`0 0 ${W} ${H}`);
    const vals=dataA.map(d=>d.v);
    const mn=Math.min(...vals), mx=Math.max(...vals);
    const pad={t:14,b:22,l:8,r:8};
    const xScale=i=>(W-pad.l-pad.r)/(dataA.length-1)*i+pad.l;
    const yScale=v=>H-pad.b-(mx===mn?0.5:(v-mn)/(mx-mn))*(H-pad.t-pad.b);
    const pts=dataA.map((d,i)=>`${xScale(i)},${yScale(d.v)}`).join(' ');
    const fillPts=`${pad.l},${H-pad.b} `+pts+` ${xScale(dataA.length-1)},${H-pad.b}`;
    svgA.innerHTML=`
      <defs>
        <linearGradient id="lg-${key}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(196,154,108,0.3)"/>
          <stop offset="100%" stop-color="rgba(196,154,108,0)"/>
        </linearGradient>
      </defs>
      <polygon points="${fillPts}" fill="url(#lg-${key})"/>
      <polyline points="${pts}" fill="none" stroke="rgba(196,154,108,0.7)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dataA.map((d,i)=>`
        <circle cx="${xScale(i)}" cy="${yScale(d.v)}" r="3.5" fill="var(--bg-card)" stroke="rgba(196,154,108,0.8)" stroke-width="1.5" class="dot"
          data-i="${i}" data-v="${d.v}" data-l="${d.label}"/>
      `).join('')}
      ${dataA.map((d,i)=>`
        <text x="${xScale(i)}" y="${H-4}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.22)" font-family="DM Mono,monospace">${d.label}</text>
      `).join('')}
    `;
    svgA.querySelectorAll('.dot').forEach(dot=>{
      dot.addEventListener('mouseenter',e=>{
        const i=parseInt(dot.dataset.i),v=parseFloat(dot.dataset.v),lbl=dot.dataset.l;
        const prev=i>0?vals[i-1]:null;
        const chg=prev!==null?((v-prev)/Math.abs(prev)*100).toFixed(1):null;
        let chgHtml='';
        if(chg!==null){const cls=parseFloat(chg)>=0?'pos':'neg';chgHtml=`<div class="ct-chg ${cls}">${parseFloat(chg)>=0?'▲':'▼'} ${Math.abs(chg)}% vs anterior</div>`;}
        tipA.style.display='block';
        tipA.innerHTML=`<div class="ct-date">${lbl}</div><div class="ct-val">${v}</div>${chgHtml}`;
        const svgRect=svgA.getBoundingClientRect();
        const cx=parseFloat(dot.getAttribute('cx')),cy=parseFloat(dot.getAttribute('cy'));
        const scaleX=svgRect.width/W;
        let left=cx*scaleX+10, top=cy-40;
        if(left+150>svgRect.width)left=cx*scaleX-160;
        tipA.style.left=left+'px'; tipA.style.top=top+'px';
      });
      dot.addEventListener('mouseleave',()=>{ tipA.style.display='none'; });
    });
  }
}

// TOGGLE CHART (with compare-column sync)
function toggleChart(btn, key){
  const area=document.getElementById('chart-'+key);
  const psel=document.getElementById('psel-'+key);
  const open=area.classList.toggle('visible');
  psel.classList.toggle('visible',open);
  btn.textContent=open?'Esconder gráfico':'Mostrar gráfico';
  btn.classList.toggle('active',open);
  metricState[key].open=open;
  // Sync B column
  if(compareActive){
    const areaB=document.getElementById('chart-'+key+'-b');
    const pselB=document.getElementById('psel-'+key+'-b');
    if(areaB){ areaB.classList.toggle('visible',open); if(pselB) pselB.classList.toggle('visible',open); }
    const colB=document.getElementById('compare-col-b');
    if(colB){ const cell=colB.querySelector(`.metric-cell[data-key="${key}"]`); if(cell){ const b=cell.querySelector('.chart-toggle-btn'); if(b){b.textContent=open?'Esconder gráfico':'Mostrar gráfico';b.classList.toggle('active',open);} } }
  }
  if(open) setTimeout(()=>renderChart(key),20);
}

// TOGGLE CHART from B column (mirrors toggleChart, syncs A)
function toggleChartSync(btn, key){
  const areaB=document.getElementById('chart-'+key+'-b');
  const pselB=document.getElementById('psel-'+key+'-b');
  const open=areaB.classList.toggle('visible');
  if(pselB) pselB.classList.toggle('visible',open);
  btn.textContent=open?'Esconder gráfico':'Mostrar gráfico';
  btn.classList.toggle('active',open);
  // Sync A column
  const areaA=document.getElementById('chart-'+key);
  const pselA=document.getElementById('psel-'+key);
  if(areaA){ areaA.classList.toggle('visible',open); if(pselA) pselA.classList.toggle('visible',open); }
  const content=document.getElementById('content');
  if(content){ const cell=content.querySelector(`.metric-cell[data-key="${key}"]`); if(cell){ const b=cell.querySelector('.chart-toggle-btn'); if(b){b.textContent=open?'Esconder gráfico':'Mostrar gráfico';b.classList.toggle('active',open);} } }
  metricState[key].open=open;
  if(open) setTimeout(()=>renderChart(key),20);
}

function setPeriod(btn, key, p){
  // Clear active on both column period selectors
  document.querySelectorAll(`#psel-${key} .period-btn, #psel-${key}-b .period-btn`).forEach(b=>b.classList.remove('active'));
  // Mark active on the matching button in both columns
  const idx=Array.from(btn.parentElement.querySelectorAll('.period-btn')).indexOf(btn);
  [document.getElementById('psel-'+key), document.getElementById('psel-'+key+'-b')].forEach(ps=>{
    if(ps){ const btns=ps.querySelectorAll('.period-btn'); if(btns[idx]) btns[idx].classList.add('active'); }
  });
  metricState[key].period=p;
  if(metricState[key].open) renderChart(key);
}

function setYear(sel, key){
  metricState[key].year=parseInt(sel.value);
  // Sync the other column's year select
  if(compareActive){
    const isB=sel.id&&sel.id.endsWith('-b');
    const syncSel=document.getElementById(isB?`ysel-${key}`:`ysel-${key}-b`);
    if(syncSel&&syncSel!==sel) syncSel.value=sel.value;
  }
  if(metricState[key].open) renderChart(key);
}

// ─── MACRO CHARTS ───
const macroChartState = { mktcap:{filter:'YTD'}, receita:{period:'A',year:2025}, caixa:{period:'A',year:2025} };

const macroData = {
  mktcap: {
    MTD: [
      {label:'01/02',v:456200,idx:3.18},{label:'03/02',v:461800,idx:3.22},{label:'04/02',v:458300,idx:3.19},
      {label:'05/02',v:470100,idx:3.27},{label:'06/02',v:467500,idx:3.25},{label:'07/02',v:472200,idx:3.29},
      {label:'10/02',v:468800,idx:3.26},{label:'11/02',v:465100,idx:3.24},{label:'12/02',v:471900,idx:3.28},
      {label:'13/02',v:474300,idx:3.30},{label:'14/02',v:469200,idx:3.27},{label:'17/02',v:475800,idx:3.31}
    ],
    YTD: [
      {label:'Jan/26',v:441200,idx:3.07},{label:'Fev/26',v:475800,idx:3.31}
    ],
    '12M': [
      {label:'Mar/25',v:398400,idx:2.87},{label:'Abr/25',v:408200,idx:2.94},{label:'Mai/25',v:412600,idx:2.97},
      {label:'Jun/25',v:428800,idx:3.08},{label:'Jul/25',v:418300,idx:3.01},{label:'Ago/25',v:435100,idx:3.13},
      {label:'Set/25',v:430600,idx:3.10},{label:'Out/25',v:448200,idx:3.22},{label:'Nov/25',v:442700,idx:3.18},
      {label:'Dez/25',v:438100,idx:3.15},{label:'Jan/26',v:441200,idx:3.17},{label:'Fev/26',v:475800,idx:3.31}
    ],
    ORIGEM: [
      {label:'2016',v:124300,idx:1.19},{label:'2017',v:148600,idx:1.38},{label:'2018',v:182400,idx:1.62},
      {label:'2019',v:268100,idx:2.08},{label:'2020',v:212800,idx:1.81},{label:'2021',v:324600,idx:2.46},
      {label:'2022',v:518200,idx:3.64},{label:'2023',v:412400,idx:3.03},{label:'2024',v:438100,idx:3.15},
      {label:'2025',v:441200,idx:3.17},{label:'2026p',v:475800,idx:3.31}
    ]
  },
  receita: {
    A: [
      {label:'2018',v:304810},{label:'2019',v:302800},{label:'2020',v:272100},
      {label:'2021',v:452600},{label:'2022',v:591200},{label:'2023',v:512100},
      {label:'2024',v:498300},{label:'2025',v:512000}
    ],
    '1T': [
      {label:'1T/18',v:72100},{label:'1T/19',v:74800},{label:'1T/20',v:58400},{label:'1T/21',v:98700},
      {label:'1T/22',v:142600},{label:'1T/23',v:124300},{label:'1T/24',v:118400},{label:'1T/25',v:124800}
    ],
    '2T': [
      {label:'2T/18',v:78200},{label:'2T/19',v:76100},{label:'2T/20',v:52100},{label:'2T/21',v:106800},
      {label:'2T/22',v:152100},{label:'2T/23',v:128400},{label:'2T/24',v:126100},{label:'2T/25',v:128200}
    ],
    '3T': [
      {label:'3T/18',v:76400},{label:'3T/19',v:78400},{label:'3T/20',v:74800},{label:'3T/21',v:118400},
      {label:'3T/22',v:144800},{label:'3T/23',v:129800},{label:'3T/24',v:124600},{label:'3T/25',v:128700}
    ],
    '4T': [
      {label:'4T/18',v:78110},{label:'4T/19',v:73500},{label:'4T/20',v:86800},{label:'4T/21',v:128700},
      {label:'4T/22',v:151700},{label:'4T/23',v:129600},{label:'4T/24',v:129200}
    ]
  },
  caixa: {
    A: [
      {label:'2018',ebitda:140200,fcl:68400},{label:'2019',ebitda:128400,fcl:54200},
      {label:'2020',ebitda:162800,fcl:82100},{label:'2021',ebitda:238400,fcl:128600},
      {label:'2022',ebitda:288100,fcl:158200},{label:'2023',ebitda:280600,fcl:142800},
      {label:'2024',ebitda:265400,fcl:132100},{label:'2025',ebitda:281200,fcl:148600}
    ],
    '1T': [
      {label:'1T/18',ebitda:32400,fcl:14200},{label:'1T/19',ebitda:30100,fcl:12800},
      {label:'1T/20',ebitda:34800,fcl:16100},{label:'1T/21',ebitda:58200,fcl:28400},
      {label:'1T/22',ebitda:72100,fcl:38600},{label:'1T/23',ebitda:68400,fcl:34800},
      {label:'1T/24',ebitda:64100,fcl:31200},{label:'1T/25',ebitda:68800,fcl:35100}
    ],
    '2T': [
      {label:'2T/18',ebitda:34200,fcl:15800},{label:'2T/19',ebitda:31400,fcl:13600},
      {label:'2T/20',ebitda:28100,fcl:10400},{label:'2T/21',ebitda:61800,fcl:30200},
      {label:'2T/22',ebitda:74800,fcl:40100},{label:'2T/23',ebitda:70100,fcl:36400},
      {label:'2T/24',ebitda:66800,fcl:33600},{label:'2T/25',ebitda:70400,fcl:36800}
    ],
    '3T': [
      {label:'3T/18',ebitda:36100,fcl:16800},{label:'3T/19',ebitda:32800,fcl:14200},
      {label:'3T/20',ebitda:38400,fcl:18600},{label:'3T/21',ebitda:62400,fcl:31800},
      {label:'3T/22',ebitda:70200,fcl:38400},{label:'3T/23',ebitda:72400,fcl:38100},
      {label:'3T/24',ebitda:68100,fcl:34200},{label:'3T/25',ebitda:71800,fcl:38200}
    ],
    '4T': [
      {label:'4T/18',ebitda:37500,fcl:21400},{label:'4T/19',ebitda:34100,fcl:13600},
      {label:'4T/20',ebitda:61500,fcl:36900},{label:'4T/21',ebitda:56000,fcl:28200},
      {label:'4T/22',ebitda:71000,fcl:41100},{label:'4T/23',ebitda:69700,fcl:33500},
      {label:'4T/24',ebitda:67200,fcl:33100}
    ]
  }
};

function fmtBi(v){ return v>=1000000?`R$ ${(v/1000000).toFixed(2)}T`:`R$ ${(v/1000).toFixed(1)}B`; }
function fmtRi(v){ return `R$ ${(v/1000).toFixed(0)}B`; }

function getMktcapData(filter){ return macroData.mktcap[filter]||macroData.mktcap.YTD; }

function getReceitaData(period, year){
  const raw = macroData.receita[period]||macroData.receita.A;
  if(period==='A') return raw.filter(d=>parseInt(d.label)<=year);
  const yShort = String(year).slice(2);
  return raw.filter(d=>{ const p=d.label.split('/'); return p.length>1&&parseInt(p[1])<=parseInt(yShort); });
}

function getCaixaData(period, year){
  const raw = macroData.caixa[period]||macroData.caixa.A;
  if(period==='A') return raw.filter(d=>parseInt(d.label)<=year);
  const yShort = String(year).slice(2);
  return raw.filter(d=>{ const p=d.label.split('/'); return p.length>1&&parseInt(p[1])<=parseInt(yShort); });
}

function renderMktcapChart(filter){
  const data=getMktcapData(filter);
  if(!data||!data.length)return;
  const svg=document.getElementById('svg-mktcap');
  const tip=document.getElementById('tip-mktcap');
  if(!svg)return;
  const W=svg.parentElement.offsetWidth||320, H=188;
  const vals=data.map(d=>d.v);
  const mn=Math.min(...vals), mx=Math.max(...vals);
  const pad={t:14,b:26,l:8,r:8};
  const xS=i=>(W-pad.l-pad.r)/(Math.max(data.length-1,1))*i+pad.l;
  const yS=v=>H-pad.b-(mx===mn?0.5:(v-mn)/(mx-mn))*(H-pad.t-pad.b);
  const pts=data.map((d,i)=>`${xS(i)},${yS(d.v)}`).join(' ');
  const fill=`${pad.l},${H-pad.b} `+pts+` ${xS(data.length-1)},${H-pad.b}`;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const step=Math.max(1,Math.floor(data.length/6));
  svg.innerHTML=`
    <defs>
      <linearGradient id="lg-mc" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="rgba(196,154,108,0.28)"/>
        <stop offset="100%" stop-color="rgba(196,154,108,0)"/>
      </linearGradient>
    </defs>
    <polygon points="${fill}" fill="url(#lg-mc)"/>
    <polyline points="${pts}" fill="none" stroke="rgba(196,154,108,0.88)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${data.map((d,i)=>`<circle cx="${xS(i)}" cy="${yS(d.v)}" r="3.5" fill="var(--bg-card)" stroke="rgba(196,154,108,0.9)" stroke-width="1.5" class="mmc" data-i="${i}" data-v="${d.v}" data-l="${d.label}" data-idx="${d.idx}"/>`).join('')}
    ${data.map((d,i)=>i%step===0||i===data.length-1?`<text x="${xS(i)}" y="${H-6}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.22)" font-family="DM Mono,monospace">${d.label}</text>`:'').join('')}
  `;
  svg.querySelectorAll('.mmc').forEach(dot=>{
    dot.addEventListener('mouseenter',()=>{
      const i=parseInt(dot.dataset.i),v=parseFloat(dot.dataset.v),lbl=dot.dataset.l,idx=dot.dataset.idx;
      const prev=i>0?vals[i-1]:null;
      const chg=prev!==null?((v-prev)/Math.abs(prev)*100).toFixed(1):null;
      let ch=''; if(chg!==null){const cl=parseFloat(chg)>=0?'pos':'neg';ch=`<div class="mct-chg ${cl}">${parseFloat(chg)>=0?'▲':'▼'} ${Math.abs(chg)}% vs anterior</div>`;}
      tip.style.display='block';
      tip.innerHTML=`<div class="mct-date">${lbl}</div><div class="mct-val">${fmtBi(v)}</div><div class="mct-idx">P/VPA: ${parseFloat(idx).toFixed(2)}x</div>${ch}`;
      const r=svg.getBoundingClientRect(),cx=parseFloat(dot.getAttribute('cx')),cy=parseFloat(dot.getAttribute('cy')),sx=r.width/W;
      let l=cx*sx+12,t=cy-54; if(l+172>r.width)l=cx*sx-185; if(t<0)t=cy+16;
      tip.style.left=l+'px'; tip.style.top=t+'px';
    });
    dot.addEventListener('mouseleave',()=>{ tip.style.display='none'; });
  });
  const last=data[data.length-1], prev=data.length>1?data[data.length-2]:null;
  document.getElementById('mktcap-val').textContent=fmtBi(last.v);
  if(prev){
    const chg=((last.v-prev.v)/Math.abs(prev.v)*100).toFixed(1);
    const el=document.getElementById('mktcap-chg');
    el.textContent=(parseFloat(chg)>=0?'▲ +':'▼ ')+Math.abs(chg)+'% no período';
    el.className='macro-chart-chg '+(parseFloat(chg)>=0?'up':'dn');
  }
}

function renderReceitaChart(period, year){
  const data=getReceitaData(period,year);
  if(!data||!data.length)return;
  const svg=document.getElementById('svg-receita');
  const tip=document.getElementById('tip-receita');
  if(!svg)return;
  const W=svg.parentElement.offsetWidth||320, H=188;
  const vals=data.map(d=>d.v);
  const mn=Math.min(...vals), mx=Math.max(...vals);
  const pad={t:14,b:26,l:8,r:8};
  const xS=i=>(W-pad.l-pad.r)/(Math.max(data.length-1,1))*i+pad.l;
  const yS=v=>H-pad.b-(mx===mn?0.5:(v-mn)/(mx-mn))*(H-pad.t-pad.b);
  const pts=data.map((d,i)=>`${xS(i)},${yS(d.v)}`).join(' ');
  const fill=`${pad.l},${H-pad.b} `+pts+` ${xS(data.length-1)},${H-pad.b}`;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const step=Math.max(1,Math.floor(data.length/6));
  svg.innerHTML=`
    <defs>
      <linearGradient id="lg-rc" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="rgba(106,141,172,0.28)"/>
        <stop offset="100%" stop-color="rgba(106,141,172,0)"/>
      </linearGradient>
    </defs>
    <polygon points="${fill}" fill="url(#lg-rc)"/>
    <polyline points="${pts}" fill="none" stroke="rgba(106,141,172,0.88)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${data.map((d,i)=>`<circle cx="${xS(i)}" cy="${yS(d.v)}" r="3.5" fill="var(--bg-card)" stroke="rgba(106,141,172,0.9)" stroke-width="1.5" class="mrc" data-i="${i}" data-v="${d.v}" data-l="${d.label}"/>`).join('')}
    ${data.map((d,i)=>i%step===0||i===data.length-1?`<text x="${xS(i)}" y="${H-6}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.22)" font-family="DM Mono,monospace">${d.label}</text>`:'').join('')}
  `;
  svg.querySelectorAll('.mrc').forEach(dot=>{
    dot.addEventListener('mouseenter',()=>{
      const i=parseInt(dot.dataset.i),v=parseFloat(dot.dataset.v),lbl=dot.dataset.l;
      const prev=i>0?vals[i-1]:null;
      const chg=prev!==null?((v-prev)/Math.abs(prev)*100).toFixed(1):null;
      const margem=period==='A'?'55,9%':period==='1T'?'54,2%':period==='2T'?'56,1%':period==='3T'?'55,4%':'57,2%';
      let ch=''; if(chg!==null){const cl=parseFloat(chg)>=0?'pos':'neg';ch=`<div class="mct-chg ${cl}">${parseFloat(chg)>=0?'▲':'▼'} ${Math.abs(chg)}% vs anterior</div>`;}
      tip.style.display='block';
      tip.innerHTML=`<div class="mct-date">${lbl}</div><div class="mct-val">${fmtRi(v)}</div><div class="mct-idx">Margem Bruta: ${margem}</div>${ch}`;
      const r=svg.getBoundingClientRect(),cx=parseFloat(dot.getAttribute('cx')),cy=parseFloat(dot.getAttribute('cy')),sx=r.width/W;
      let l=cx*sx+12,t=cy-54; if(l+172>r.width)l=cx*sx-185; if(t<0)t=cy+16;
      tip.style.left=l+'px'; tip.style.top=t+'px';
    });
    dot.addEventListener('mouseleave',()=>{ tip.style.display='none'; });
  });
  const last=data[data.length-1], prev2=data.length>1?data[data.length-2]:null;
  document.getElementById('receita-val').textContent=fmtRi(last.v);
  if(prev2){
    const chg=((last.v-prev2.v)/Math.abs(prev2.v)*100).toFixed(1);
    const el=document.getElementById('receita-chg');
    el.textContent=(parseFloat(chg)>=0?'▲ +':'▼ ')+Math.abs(chg)+'% vs anterior';
    el.className='macro-chart-chg '+(parseFloat(chg)>=0?'up':'dn');
  }
}

function renderCaixaChart(period, year){
  const data=getCaixaData(period,year);
  if(!data||!data.length)return;
  const svg=document.getElementById('svg-caixa');
  const tip=document.getElementById('tip-caixa');
  if(!svg)return;
  const W=svg.parentElement.offsetWidth||320, H=188;
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
      <linearGradient id="lg-cxe" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="rgba(122,172,136,0.2)"/>
        <stop offset="100%" stop-color="rgba(122,172,136,0)"/>
      </linearGradient>
      <linearGradient id="lg-cxf" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="rgba(191,102,73,0.15)"/>
        <stop offset="100%" stop-color="rgba(191,102,73,0)"/>
      </linearGradient>
    </defs>
    <polygon points="${pad.l},${H-pad.b} ${ptsE} ${xS(data.length-1)},${H-pad.b}" fill="url(#lg-cxe)"/>
    <polygon points="${pad.l},${H-pad.b} ${ptsF} ${xS(data.length-1)},${H-pad.b}" fill="url(#lg-cxf)"/>
    <polyline points="${ptsE}" fill="none" stroke="rgba(122,172,136,0.88)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <polyline points="${ptsF}" fill="none" stroke="rgba(191,102,73,0.88)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="6,3"/>
    ${data.map((d,i)=>`<circle cx="${xS(i)}" cy="${yS(d.ebitda)}" r="3.5" fill="var(--bg-card)" stroke="rgba(122,172,136,0.9)" stroke-width="1.5" class="mce" data-i="${i}" data-l="${d.label}" data-e="${d.ebitda}" data-f="${d.fcl}"/>`).join('')}
    ${data.map((d,i)=>`<circle cx="${xS(i)}" cy="${yS(d.fcl)}" r="3.5" fill="var(--bg-card)" stroke="rgba(191,102,73,0.88)" stroke-width="1.5" class="mcf" data-i="${i}" data-l="${d.label}" data-e="${d.ebitda}" data-f="${d.fcl}"/>`).join('')}
    ${data.map((d,i)=>i%step===0||i===data.length-1?`<text x="${xS(i)}" y="${H-6}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.22)" font-family="DM Mono,monospace">${d.label}</text>`:'').join('')}
  `;
  const bindCaixaTip=(cls,isE)=>{
    svg.querySelectorAll('.'+cls).forEach(dot=>{
      dot.addEventListener('mouseenter',()=>{
        const i=parseInt(dot.dataset.i),e=parseFloat(dot.dataset.e),f=parseFloat(dot.dataset.f),lbl=dot.dataset.l;
        const series=isE?data.map(d=>d.ebitda):data.map(d=>d.fcl);
        const curr=isE?e:f;
        const prev=i>0?series[i-1]:null;
        const chg=prev!==null?((curr-prev)/Math.abs(prev)*100).toFixed(1):null;
        const conv=(f/e*100).toFixed(1);
        let ch=''; if(chg!==null){const cl=parseFloat(chg)>=0?'pos':'neg';ch=`<div class="mct-chg ${cl}">${parseFloat(chg)>=0?'▲':'▼'} ${Math.abs(chg)}% vs anterior</div>`;}
        const serieLabel=isE?`<span style="color:var(--green)">EBITDA</span>`:`<span style="color:var(--terra)">Geração de Caixa</span>`;
        tip.style.display='block';
        tip.innerHTML=`<div class="mct-date">${lbl} · ${serieLabel}</div><div class="mct-val">${fmtRi(curr)}</div><div class="mct-idx">Conversão FCL: ${conv}%</div>${ch}`;
        const r=svg.getBoundingClientRect(),cx=parseFloat(dot.getAttribute('cx')),cy=parseFloat(dot.getAttribute('cy')),sx=r.width/W;
        let l=cx*sx+12,t=cy-54; if(l+175>r.width)l=cx*sx-188; if(t<0)t=cy+16;
        tip.style.left=l+'px'; tip.style.top=t+'px';
      });
      dot.addEventListener('mouseleave',()=>{ tip.style.display='none'; });
    });
  };
  bindCaixaTip('mce',true);
  bindCaixaTip('mcf',false);
  const last=data[data.length-1], prev3=data.length>1?data[data.length-2]:null;
  document.getElementById('caixa-val').textContent=`EBITDA ${fmtRi(last.ebitda)}`;
  if(prev3){
    const chg=((last.ebitda-prev3.ebitda)/Math.abs(prev3.ebitda)*100).toFixed(1);
    const el=document.getElementById('caixa-chg');
    el.textContent=(parseFloat(chg)>=0?'▲ +':'▼ ')+Math.abs(chg)+'% vs anterior';
    el.className='macro-chart-chg '+(parseFloat(chg)>=0?'up':'dn');
  }
}

function setMktcapFilter(btn, filter){
  document.querySelectorAll('#mktcap-filters .mf-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  macroChartState.mktcap.filter=filter;
  renderMktcapChart(filter);
}
function setReceitaPeriod(btn, p){
  document.querySelectorAll('#receita-filters .mf-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  macroChartState.receita.period=p;
  renderReceitaChart(p, macroChartState.receita.year);
}
function setReceitaYear(sel){
  macroChartState.receita.year=parseInt(sel.value);
  renderReceitaChart(macroChartState.receita.period, macroChartState.receita.year);
}
function setCaixaPeriod(btn, p){
  document.querySelectorAll('#caixa-filters .mf-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  macroChartState.caixa.period=p;
  renderCaixaChart(p, macroChartState.caixa.year);
}
function setCaixaYear(sel){
  macroChartState.caixa.year=parseInt(sel.value);
  renderCaixaChart(macroChartState.caixa.period, macroChartState.caixa.year);
}

// Populate macro year selects
['receita','caixa'].forEach(id=>{
  const sel=document.getElementById('ysel-macro-'+id);
  if(!sel)return;
  for(let i=2025;i>=2018;i--){const o=document.createElement('option');o.value=i;o.textContent=i;sel.appendChild(o);}
});

// Init macro charts
window.addEventListener('load',()=>{
  renderMktcapChart('YTD');
  renderReceitaChart('A',2025);
  renderCaixaChart('A',2025);
});

window.addEventListener('resize',()=>{
  metrics.forEach(k=>{ if(metricState[k]&&metricState[k].open) renderChart(k); });
  renderMktcapChart(macroChartState.mktcap.filter);
  renderReceitaChart(macroChartState.receita.period, macroChartState.receita.year);
  renderCaixaChart(macroChartState.caixa.period, macroChartState.caixa.year);
});
