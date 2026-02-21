// ─── SIDEBAR ───
let sbOpen=false;
function toggleSidebar(){
  sbOpen=!sbOpen;
  document.getElementById('sidebar').classList.toggle('open',sbOpen);
  document.getElementById('main').classList.toggle('open',sbOpen);
  const t=document.getElementById('stoggle');
  t.classList.toggle('open',sbOpen);
  t.textContent=sbOpen?'›':'‹';
}
function switchTab(name,el){
  document.querySelectorAll('.stab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.spanel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('panel-'+name).classList.add('active');
}

// ─── NOTES ───
const notes={};
function openNote(btn){
  const cell=btn.closest('.metric-cell');
  const note=cell.querySelector('.mnote');
  note.classList.toggle('visible');
  if(note.classList.contains('visible')) note.querySelector('textarea').focus();
}
function saveNote(ta, label){
  const txt=ta.value.trim();
  if(txt){ notes[label]=txt; renderNotes(); }
}
function renderNotes(){
  const list=document.getElementById('notesList');
  const empty=document.getElementById('notesEmpty');
  const keys=Object.keys(notes);
  if(!keys.length){empty.style.display='';return;}
  empty.style.display='none';
  const existing=list.querySelectorAll('.note-card');
  existing.forEach(c=>c.remove());
  keys.forEach(k=>{
    const c=document.createElement('div');
    c.className='note-card';
    c.innerHTML=`<div class="note-origin">${k}</div><div class="note-text">${notes[k]}</div>`;
    list.appendChild(c);
  });
}
const sumPool=["P/L abaixo do setor (4,8x vs 7,2x) — desconto pode refletir risco político. Cruze com a tendência de queda no lucro líquido (-8,1% a.a.).","ROE em queda estrutural (31% → 28%) com alavancagem crescente. Verifique custo da dívida vs. retorno gerado.","Dividend Yield de 14,3% com payout elevado — analise se o fluxo de caixa livre sustenta a distribuição no médio prazo."];
function summarizeNotes(){
  const b=document.getElementById('aiSumBlock');
  document.getElementById('aiSumText').textContent=sumPool[Math.floor(Math.random()*sumPool.length)];
  b.classList.add('visible');
}

// ─── ANALYSIS ───
let lastLine=0, insIdx=0;
const insightPool=["Dividend Yield de 14,3% com lucro em queda — verifique payout ratio e sustentabilidade.","P/L 4,8x com ROE 28,4%: mercado precifica crescimento baixo. Consistente com sua tese?","Alavancagem crescendo com caixa robusto — cruze com cronograma de vencimento da dívida.","Margem EBITDA (54,8%) acima do setor: vantagem competitiva ou benefício regulatório temporário?","ROIC (18,7%) acima do custo de capital estimado (~12%): geração de valor ainda positiva."];
function onAnInput(ta){
  const text=ta.value;
  const lines=text.split('\n').filter(l=>l.trim()).length;
  const words=text.trim()?text.trim().split(/\s+/).length:0;
  const wc=document.getElementById('anWordCount');
  if(wc) wc.textContent=words+(words===1?' palavra':' palavras');
  const fill=document.getElementById('anProgressFill');
  if(fill){const prog=lines>0?Math.min(100,((lines-1)%5+1)/5*100):0;fill.style.width=prog+'%';}
  if(lines>0&&lines%5===0&&lines!==lastLine){lastLine=lines;showInsight();}
}
function showInsight(){
  const el=document.getElementById('aiInsight');
  document.getElementById('aiInsightText').textContent=insightPool[insIdx%insightPool.length];
  insIdx++;
  el.style.display='block';
}
const saves=[];
function saveAnalysis(){
  const name=document.querySelector('.an-name-inp').value||'Análise PETR4';
  const text=document.getElementById('anEditor').value;
  if(!text.trim()){alert('Escreva sua análise antes de salvar.');return;}
  saves.unshift({name,text,date:new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})});
  renderSaves();
  const btn=document.querySelector('.btn-save');
  btn.textContent='✓ Salvo';
  setTimeout(()=>{btn.textContent='Salvar análise';},2000);
  switchTab('saves',document.querySelectorAll('.stab')[2]);
}
function renderSaves(){
  const list=document.getElementById('savesList');
  list.innerHTML='';
  if(!saves.length){list.innerHTML='<div class="notes-empty"><div class="notes-empty-ico">📁</div><div>Nenhuma análise salva ainda.</div></div>';return;}
  saves.forEach((s,i)=>{
    const c=document.createElement('div');
    c.className='save-card';
    c.innerHTML=`<div class="save-card-name">${s.name}</div><div class="save-card-meta"><span>PETR4</span>${s.date}</div><div class="save-card-preview">${s.text}</div>`;
    c.onclick=()=>{
      document.querySelector('.an-name-inp').value=s.name;
      document.getElementById('anEditor').value=s.text;
      switchTab('analysis',document.querySelectorAll('.stab')[1]);
    };
    list.appendChild(c);
  });
}

