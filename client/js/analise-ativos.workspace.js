// ─── SIDEBAR ───
let sbOpen = false;
const workspaceState = {
  annotations: [],
  summaries: [],
  localAnalyses: [],
  lastTickerLoaded: null,
};

function aaWorkspaceApi(path, options = {}) {
  return fetch(`${window.AA.apiBase}${path}`, {
    headers: window.AA.authHeaders,
    ...options,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Falha na requisição');
    return data;
  });
}

function getCurrentTicker() {
  return String(window.AA?.state?.ticker || '').trim().toUpperCase();
}

function getCurrentUserId() {
  const user = JSON.parse(localStorage.getItem('yield_user') || '{}');
  return user._id || user.id || '';
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toggleSidebar() {
  sbOpen = !sbOpen;
  document.getElementById('sidebar').classList.toggle('open', sbOpen);
  document.getElementById('main').classList.toggle('open', sbOpen);
  const t = document.getElementById('stoggle');
  t.classList.toggle('open', sbOpen);
  t.textContent = sbOpen ? '›' : '‹';
}

function switchTab(name, el) {
  document.querySelectorAll('.stab').forEach((tab) => tab.classList.remove('active'));
  document.querySelectorAll('.spanel').forEach((panel) => panel.classList.remove('active'));
  el.classList.add('active');
  document.getElementById(`panel-${name}`).classList.add('active');

  if (name === 'notes') {
    loadAnnotations().catch(() => {});
  }
  if (name === 'saves') {
    loadSummaries().catch(() => {});
  }
}

// ─── NOTES (BACKEND) ───
function captureCardSnapshot(cell) {
  return {
    ticker: getCurrentTicker(),
    value: cell.querySelector('.mval')?.textContent?.trim() || '—',
    trend: cell.querySelector('.mtrend')?.textContent?.trim() || '—',
    yoy: cell.querySelector('.msub')?.textContent?.trim() || '—',
    capturedAt: new Date().toISOString(),
  };
}

function openNote(btn) {
  const cell = btn.closest('.metric-cell');
  if (!cell) return;
  const note = cell.querySelector('.mnote');
  if (!note) return;
  note.classList.toggle('visible');
  if (note.classList.contains('visible')) {
    note.querySelector('textarea')?.focus();
  }
}

async function saveNote(ta, label) {
  const annotationText = String(ta?.value || '').trim();
  if (!annotationText) return;

  const cell = ta.closest('.metric-cell');
  const cardId = cell?.dataset?.key || label;
  const userId = getCurrentUserId();
  const ticker = getCurrentTicker();
  if (!userId || !cardId) return;

  try {
    await aaWorkspaceApi('/api/analise-ativos/annotations', {
      method: 'POST',
      headers: window.AA.authHeaders,
      body: JSON.stringify({
        userId,
        ticker,
        cardId,
        cardLabel: label || cardId,
        annotationText,
        cardSnapshot: captureCardSnapshot(cell),
      }),
    });

    ta.value = '';
    ta.closest('.mnote')?.classList.remove('visible');
    await loadAnnotations();

    const aiSumBlock = document.getElementById('aiSumBlock');
    const aiSumText = document.getElementById('aiSumText');
    if (aiSumBlock && aiSumText) {
      aiSumBlock.classList.add('visible');
      aiSumText.textContent = 'Os dados do card no momento da anotação foram salvos.';
    }
  } catch (err) {
    alert(`Falha ao salvar anotação: ${err.message}`);
  }
}

async function deleteAnnotation(annotationId) {
  try {
    await aaWorkspaceApi(`/api/analise-ativos/annotations/${annotationId}`, {
      method: 'DELETE',
    });
    await loadAnnotations();
  } catch (err) {
    alert(`Falha ao excluir anotação: ${err.message}`);
  }
}

function renderNotes() {
  const list = document.getElementById('notesList');
  const empty = document.getElementById('notesEmpty');
  if (!list || !empty) return;

  list.querySelectorAll('.note-card').forEach((card) => card.remove());

  if (!workspaceState.annotations.length) {
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';
  workspaceState.annotations.forEach((item) => {
    const createdAt = item.timestamp ? new Date(item.timestamp) : null;
    const dateText = createdAt
      ? `${createdAt.toLocaleDateString('pt-BR')} ${createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      : 'data indisponível';

    const card = document.createElement('div');
    card.className = 'note-card';
    card.innerHTML = `
      <div class="note-origin" style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
        <span>${escapeHtml(item.cardLabel || item.cardId)}</span>
        <button class="btn" style="font-size:.62rem;padding:4px 8px" onclick="deleteAnnotation('${item._id}')">Excluir</button>
      </div>
      <div class="note-text">${escapeHtml(item.annotationText)}</div>
      <div class="save-card-meta"><span>${escapeHtml(item.ticker || '—')}</span>${dateText}</div>
    `;
    list.appendChild(card);
  });
}

async function loadAnnotations() {
  const userId = getCurrentUserId();
  if (!userId) return;

  const ticker = getCurrentTicker();
  const q = ticker ? `?ticker=${encodeURIComponent(ticker)}` : '';
  const payload = await aaWorkspaceApi(`/api/analise-ativos/annotations/${userId}${q}`);
  workspaceState.annotations = Array.isArray(payload.annotations) ? payload.annotations : [];
  renderNotes();
}

async function summarizeNotes() {
  const userId = getCurrentUserId();
  if (!userId) return;

  const ticker = getCurrentTicker();

  try {
    const payload = await aaWorkspaceApi('/api/analise-ativos/summarize', {
      method: 'POST',
      headers: window.AA.authHeaders,
      body: JSON.stringify({ userId, ticker }),
    });

    const content = payload?.summary?.content || 'Resumo gerado com sucesso.';
    const aiSumBlock = document.getElementById('aiSumBlock');
    const aiSumText = document.getElementById('aiSumText');
    if (aiSumBlock && aiSumText) {
      aiSumBlock.classList.add('visible');
      aiSumText.textContent = content;
    }

    await loadSummaries();
  } catch (err) {
    alert(`Falha ao gerar resumo: ${err.message}`);
  }
}

// ─── HISTÓRICO DE RESUMOS ───
async function deleteSummary(summaryId) {
  try {
    await aaWorkspaceApi(`/api/analise-ativos/summaries/${summaryId}`, {
      method: 'DELETE',
    });
    await loadSummaries();
  } catch (err) {
    alert(`Falha ao excluir resumo: ${err.message}`);
  }
}

function renderHistory() {
  const list = document.getElementById('savesList');
  if (!list) return;

  const summaries = workspaceState.summaries || [];
  const analyses = workspaceState.localAnalyses || [];

  list.innerHTML = '';
  if (!summaries.length && !analyses.length) {
    list.innerHTML = '<div class="notes-empty"><div class="notes-empty-ico">📁</div><div>Nenhum resumo salvo ainda.</div></div>';
    return;
  }

  summaries.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'save-card';

    const ts = item.timestamp ? new Date(item.timestamp) : null;
    const dateText = ts
      ? `${ts.toLocaleDateString('pt-BR')} ${ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      : 'data indisponível';

    card.innerHTML = `
      <div class="save-card-name" style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
        <span>Resumo IA</span>
        <button class="btn" style="font-size:.62rem;padding:4px 8px" onclick="deleteSummary('${item._id}')">Excluir</button>
      </div>
      <div class="save-card-meta"><span>${escapeHtml(item.ticker || '—')}</span>${dateText}</div>
      <div class="save-card-preview">${escapeHtml(item.content)}</div>
    `;
    list.appendChild(card);
  });

  analyses.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'save-card';
    card.innerHTML = `
      <div class="save-card-name">${escapeHtml(item.name)}</div>
      <div class="save-card-meta"><span>${escapeHtml(item.ticker || '—')}</span>${escapeHtml(item.date)}</div>
      <div class="save-card-preview">${escapeHtml(item.text)}</div>
    `;
    card.onclick = () => {
      document.querySelector('.an-name-inp').value = item.name;
      document.getElementById('anEditor').value = item.text;
      switchTab('analysis', document.querySelectorAll('.stab')[1]);
    };
    list.appendChild(card);
  });
}

async function loadSummaries() {
  const userId = getCurrentUserId();
  if (!userId) return;

  const payload = await aaWorkspaceApi(`/api/analise-ativos/summaries/${userId}`);
  workspaceState.summaries = Array.isArray(payload.summaries) ? payload.summaries : [];
  renderHistory();
}

async function aaRefreshWorkspace() {
  const ticker = getCurrentTicker();
  if (!ticker || workspaceState.lastTickerLoaded === ticker) return;
  workspaceState.lastTickerLoaded = ticker;
  await loadAnnotations();
}

// ─── ANALYSIS (local) ───
let lastLine = 0;
let insIdx = 0;
const insightPool = [
  'Dividend Yield alto exige validação de payout e geração de caixa.',
  'Cruze valuation com qualidade: ROE/ROIC sem alavancagem excessiva.',
  'Confronte tendência de margem com ciclo do setor para evitar viés de curto prazo.',
  'Teste tese com cenário adverso: juros, câmbio e commodity.',
  'A consistência dos últimos 5 anos tende a importar mais que um trimestre isolado.',
];

function onAnInput(ta) {
  const text = ta.value;
  const lines = text.split('\n').filter((l) => l.trim()).length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const wc = document.getElementById('anWordCount');
  if (wc) wc.textContent = `${words} ${words === 1 ? 'palavra' : 'palavras'}`;
  const fill = document.getElementById('anProgressFill');
  if (fill) {
    const prog = lines > 0 ? Math.min(100, (((lines - 1) % 5) + 1) / 5 * 100) : 0;
    fill.style.width = `${prog}%`;
  }
  if (lines > 0 && lines % 5 === 0 && lines !== lastLine) {
    lastLine = lines;
    showInsight();
  }
}

function showInsight() {
  const el = document.getElementById('aiInsight');
  document.getElementById('aiInsightText').textContent = insightPool[insIdx % insightPool.length];
  insIdx += 1;
  el.style.display = 'block';
}

function saveAnalysis() {
  const name = document.querySelector('.an-name-inp').value || 'Análise sem título';
  const text = document.getElementById('anEditor').value;
  if (!text.trim()) {
    alert('Escreva sua análise antes de salvar.');
    return;
  }

  workspaceState.localAnalyses.unshift({
    name,
    text,
    ticker: getCurrentTicker() || '—',
    date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
  });

  renderHistory();
  const btn = document.querySelector('.btn-save');
  btn.textContent = '✓ Salvo';
  setTimeout(() => { btn.textContent = 'Salvar análise'; }, 1800);
  switchTab('saves', document.querySelectorAll('.stab')[2]);
}

window.toggleSidebar = toggleSidebar;
window.switchTab = switchTab;
window.openNote = openNote;
window.saveNote = saveNote;
window.deleteAnnotation = deleteAnnotation;
window.summarizeNotes = summarizeNotes;
window.deleteSummary = deleteSummary;
window.onAnInput = onAnInput;
window.saveAnalysis = saveAnalysis;
window.aaRefreshWorkspace = aaRefreshWorkspace;

