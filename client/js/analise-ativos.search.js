async function aaApi(path) {
  const res = await fetch(`${window.AA.apiBase}${path}`, {
    headers: window.AA.authHeaders,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Falha na requisição');
  }
  return data;
}

function setAssetHeader(payload) {
  const asset = payload?.asset || {};
  const ticker = payload?.ticker || asset.symbol || '—';

  const tickerEl = document.getElementById('assetTicker');
  const nameEl = document.getElementById('assetName');
  const sectorEl = document.getElementById('assetSector');
  const priceEl = document.getElementById('assetPrice');
  const chgEl = document.getElementById('assetChg');
  const dateEl = document.getElementById('assetDate');
  const bpSource = document.getElementById('bpSourceNote');
  const sidebarTicker = document.getElementById('sidebarTicker');
  const sidebarName = document.getElementById('sidebarAssetName');

  if (tickerEl) tickerEl.textContent = ticker;
  if (nameEl) nameEl.textContent = asset.longName || asset.shortName || ticker;
  if (sectorEl) sectorEl.textContent = asset.sector || asset.industry || '—';
  if (priceEl) priceEl.textContent = window.aaFmtCurrency(asset.regularMarketPrice);

  if (chgEl) {
    const pct = Number(asset.regularMarketChangePercent);
    const valid = Number.isFinite(pct);
    chgEl.classList.remove('up', 'dn');
    if (valid) {
      chgEl.classList.add(pct >= 0 ? 'up' : 'dn');
      chgEl.textContent = `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}% hoje`;
    } else {
      chgEl.textContent = '— hoje';
    }
  }

  if (dateEl) {
    const ts = payload?.meta?.cachedAt || asset.regularMarketTime;
    if (ts) {
      const dt = new Date(ts);
      dateEl.textContent = `Atualizado em ${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      dateEl.textContent = 'Atualização indisponível';
    }
  }

  if (bpSource) bpSource.textContent = `Fonte: Brapi · CVM · ${ticker}`;
  if (sidebarTicker) sidebarTicker.textContent = ticker;
  if (sidebarName) sidebarName.textContent = asset.longName || asset.shortName || ticker;
}

async function loadCoreTicker(ticker) {
  const normalized = String(ticker || '').trim().toUpperCase();
  if (!normalized) return;

  const data = await aaApi(`/api/analise-ativos/core/${normalized}`);
  window.AA.state.ticker = normalized;
  window.AA.state.core = data;

  setAssetHeader(data);

  const input = document.getElementById('navSearchInp');
  if (input) input.value = normalized;

  if (typeof saveLastSearch === 'function') {
    saveLastSearch(normalized).catch(() => {});
  }

  if (typeof window.aaResetBalanceCache === 'function') {
    window.aaResetBalanceCache();
  }

  if (typeof window.aaRenderAll === 'function') {
    window.aaRenderAll();
  }
}

// ─── NAV SEARCH ───
let navSearchDebounce = null;

function closeNavSearch() {
  const res = document.getElementById('navSearchResults');
  if (res) res.classList.remove('visible');
}

async function onNavSearch(value) {
  const query = String(value || '').trim();
  const res = document.getElementById('navSearchResults');
  if (!res) return;

  if (navSearchDebounce) clearTimeout(navSearchDebounce);

  if (query.length < 2) {
    res.classList.remove('visible');
    res.innerHTML = '';
    return;
  }

  navSearchDebounce = setTimeout(async () => {
    try {
      const payload = await aaApi(`/api/analise-ativos/search?query=${encodeURIComponent(query)}`);
      const items = Array.isArray(payload.results) ? payload.results.slice(0, 8) : [];

      if (!items.length) {
        res.innerHTML = '<div class="nav-search-item"><div><div class="nav-search-item-name">Nenhum ativo encontrado</div></div></div>';
        res.classList.add('visible');
        return;
      }

      res.innerHTML = items.map((item) => {
        const ticker = item.ticker || '—';
        const name = item.longName || item.shortName || ticker;
        const sector = item.sector || '—';
        return `
          <div class="nav-search-item" onmousedown="selectAsset('${ticker}')">
            <div>
              <div class="nav-search-item-ticker">${ticker}</div>
              <div class="nav-search-item-name">${name}</div>
            </div>
            <span class="tag tag-s" style="font-size:.6rem;padding:2px 8px">${sector}</span>
          </div>
        `;
      }).join('');

      res.classList.add('visible');
    } catch (err) {
      res.innerHTML = '<div class="nav-search-item"><div><div class="nav-search-item-name">Falha ao buscar ativos</div></div></div>';
      res.classList.add('visible');
    }
  }, 250);
}

async function selectAsset(ticker) {
  closeNavSearch();
  try {
    await loadCoreTicker(ticker);
  } catch (err) {
    alert(`Não foi possível carregar o ticker ${ticker}: ${err.message}`);
  }
}

// ─── COMPARE ───
function openCompare() {
  openModal('compare');
}

async function applyCompare() {
  const input = document.getElementById('compInput');
  const ticker = String(input?.value || '').trim().toUpperCase();
  if (!ticker) return;

  if (ticker === window.AA.state.ticker) {
    alert('Escolha um ticker diferente do ativo principal para comparar.');
    return;
  }

  try {
    const data = await aaApi(`/api/analise-ativos/core/${ticker}`);
    window.AA.state.compareTicker = ticker;
    window.AA.state.compareCore = data;

    const banner = document.getElementById('compareBanner');
    const badge = document.getElementById('compTickerBadge');
    const name = document.getElementById('compName');
    if (badge) badge.textContent = ticker;
    if (name) name.textContent = data?.asset?.longName || data?.asset?.shortName || ticker;
    if (banner) banner.classList.add('visible');

    closeModal('compare');

    if (typeof window.aaRenderAll === 'function') {
      window.aaRenderAll();
    }
  } catch (err) {
    alert(`Não foi possível comparar com ${ticker}: ${err.message}`);
  }
}

function removeCompare() {
  window.AA.state.compareTicker = null;
  window.AA.state.compareCore = null;
  window.AA.state.compareHistory = {};

  const banner = document.getElementById('compareBanner');
  if (banner) banner.classList.remove('visible');

  if (typeof window.aaRenderAll === 'function') {
    window.aaRenderAll();
  }
}

window.aaLoadCoreTicker = loadCoreTicker;
window.onNavSearch = onNavSearch;
window.closeNavSearch = closeNavSearch;
window.selectAsset = selectAsset;
window.openCompare = openCompare;
window.applyCompare = applyCompare;
window.removeCompare = removeCompare;

