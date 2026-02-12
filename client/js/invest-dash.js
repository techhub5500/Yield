document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('wheel', () => {}, { passive: true });
    window.addEventListener('touchstart', () => {}, { passive: true });

    if (window.YieldAuth && !window.YieldAuth.isAuthenticated()) {
        return;
    }

    const InvestmentsApi = {
        _baseUrl: (() => {
            if (window.location.protocol === 'file:') return 'http://localhost:3000';
            const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
            if (isLocalHost && window.location.port && window.location.port !== '3000') {
                return 'http://localhost:3000';
            }
            return '';
        })(),

        async _request(path, options = {}) {
            const headers = options.headers || {};
            const token = window.YieldAuth?.getToken?.();
            if (token) headers.Authorization = `Bearer ${token}`;

            const response = await fetch(this._baseUrl + path, {
                ...options,
                headers,
            });

            if (response.status === 401) {
                window.YieldAuth?.clearToken?.();
                window.location.href = '/html/login.html';
                throw new Error('Sessão expirada');
            }

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => ({}));
                throw new Error(errorPayload.error || `HTTP ${response.status}`);
            }

            return response.json();
        },

        getManifest() {
            return this._request('/api/investments/manifest');
        },

        queryMetrics(metricIds = [], filters = {}) {
            return this._request('/api/investments/metrics/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ metricIds, filters }),
            });
        },

        queryCards(cards = [], filters = {}) {
            return this._request('/api/investments/cards/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cards, filters }),
            });
        },

        createManualAsset(payload = {}) {
            return this._request('/api/investments/assets/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        },

        searchAssets(query = '', limit = 20) {
            const params = new URLSearchParams({ q: query, limit: String(limit) });
            return this._request(`/api/investments/assets/search?${params.toString()}`);
        },

        editAsset(assetId, operation, payload = {}) {
            return this._request(`/api/investments/assets/${encodeURIComponent(assetId)}/edit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operation, payload }),
            });
        },

        deleteAsset(assetId) {
            return this._request(`/api/investments/assets/${encodeURIComponent(assetId)}`, {
                method: 'DELETE',
            });
        },
    };

    function collectSlots() {
        const mainCards = Array.from(document.querySelectorAll('.main-card-full'));
        const miniCards = Array.from(document.querySelectorAll('.mini-info-card'));

        return {
            main: mainCards.map((element, index) => ({ slotId: `main-${index + 1}`, element })),
            mini: miniCards.map((element, index) => ({ slotId: `mini-${index + 1}`, element })),
        };
    }

    const slots = collectSlots();

    window.YieldInvestments = {
        api: InvestmentsApi,
        slots,
        state: {
            manifest: null,
        },
        cards: {},
        async preloadManifest() {
            const data = await InvestmentsApi.getManifest();
            this.state.manifest = data;
            return data;
        },
    };

    const EMPTY_WIDGET_MODEL = {
        rootView: 'total',
        chart: {
            currency: 'BRL',
            points: [
                { label: 'M-3', value: 0 },
                { label: 'M-2', value: 0 },
                { label: 'M-1', value: 0 },
                { label: 'M0', value: 0 },
            ],
        },
        views: {
            total: {
                title: 'Patrimônio Total',
                subtitle: 'Posições ativas marcadas a mercado',
                label: 'Valor Atual',
                value: '—',
                variation: '—',
                secondaryLabel: 'Capital investido',
                secondaryValue: '—',
                details: {
                    left: [],
                    right: [],
                },
            },
        },
    };

    function toDeepClone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeDetails(details) {
        if (!details || typeof details !== 'object') {
            return { left: [], right: [] };
        }
        return {
            left: Array.isArray(details.left) ? details.left : [],
            right: Array.isArray(details.right) ? details.right : [],
        };
    }

    function normalizeWidgetModel(rawModel) {
        const base = toDeepClone(EMPTY_WIDGET_MODEL);
        if (!rawModel || typeof rawModel !== 'object') {
            return base;
        }

        const merged = {
            rootView: typeof rawModel.rootView === 'string' ? rawModel.rootView : base.rootView,
            chart: {
                currency: rawModel.chart?.currency || base.chart.currency,
                points: Array.isArray(rawModel.chart?.points) && rawModel.chart.points.length
                    ? rawModel.chart.points
                    : base.chart.points,
            },
            views: {},
        };

        const sourceViews = (rawModel.views && typeof rawModel.views === 'object')
            ? rawModel.views
            : base.views;

        Object.entries(sourceViews).forEach(([viewId, view]) => {
            merged.views[viewId] = {
                title: view?.title || '—',
                subtitle: view?.subtitle || '—',
                label: view?.label || '—',
                value: view?.value || '—',
                variation: view?.variation || '—',
                secondaryLabel: view?.secondaryLabel || '—',
                secondaryValue: view?.secondaryValue || '—',
                details: normalizeDetails(view?.details),
            };
        });

        if (!merged.views.total) {
            merged.views.total = toDeepClone(base.views.total);
        }

        return merged;
    }

    function extractWidgetModelFromCardResponse(responsePayload) {
        const cards = Array.isArray(responsePayload?.cards) ? responsePayload.cards : [];
        const targetCard = cards.find((card) => card.cardId === 'card-patrimonio-total-investido') || cards[0] || null;

        if (!targetCard) {
            return normalizeWidgetModel(null);
        }

        const metrics = Array.isArray(targetCard.metrics) ? targetCard.metrics : [];
        const metricWithData = metrics.find((metric) => metric?.status === 'ok' && metric?.data);
        const metricData = metricWithData?.data || null;

        if (!metricData) {
            return normalizeWidgetModel(null);
        }

        if (metricData.widget) {
            return normalizeWidgetModel(metricData.widget);
        }

        if (metricData.views || metricData.chart) {
            return normalizeWidgetModel(metricData);
        }

        return normalizeWidgetModel(null);
    }

    function buildPatrimonioWidgetTemplate() {
        return `
            <style>
                :host {
                    all: initial;
                    font-family: 'Inter', sans-serif;
                }

                .widget-card {
                    width: 640px;
                    height: 430px;
                    background: rgba(40, 35, 30, 0.4);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 230, 200, 0.08);
                    border-radius: 20px;
                    /* Sombra ajustada: 35% mais suave e harmônica */
                    box-shadow: 0 15px 30px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.03);
                    padding: 24px;
                    position: relative;
                    overflow: hidden;
                    box-sizing: border-box;
                    color: #EAE5E0;
                    display: flex;
                    flex-direction: column;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                    gap: 16px;
                    flex-shrink: 0;
                }

                h2 {
                    font-family: 'Playfair Display', serif;
                    font-weight: 600;
                    font-size: 1.2rem;
                    letter-spacing: 0.02em;
                    color: #EAE5E0;
                    margin: 0 0 2px;
                }

                .subtitle {
                    font-size: 0.75rem;
                    color: #9A908A;
                    font-weight: 400;
                }

                .filters { display: flex; gap: 8px; }
                .filter-group {
                    background: rgba(0,0,0,0.2);
                    padding: 2px;
                    border-radius: 10px;
                    display: flex;
                    border: 1px solid rgba(255, 230, 200, 0.08);
                }

                .filter-btn {
                    background: transparent;
                    border: none;
                    color: #9A908A;
                    padding: 4px 10px;
                    font-size: 0.65rem;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-family: 'Inter', sans-serif;
                    font-weight: 600;
                }

                .filter-btn.active {
                    background: rgba(255, 255, 255, 0.1);
                    color: #D4AF37;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                }

                .kpi-section {
                    display: grid;
                    grid-template-columns: 1.5fr 1fr;
                    gap: 16px;
                    margin-bottom: 20px;
                    flex-shrink: 0;
                }

                .kpi-box { display: flex; flex-direction: column; justify-content: center; }
                .kpi-box.secondary { border-left: 1px solid rgba(255, 230, 200, 0.08); padding-left: 20px; }

                .label {
                    font-size: 0.65rem;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: #9A908A;
                    margin-bottom: 4px;
                }

                .main-value { font-size: 1.85rem; font-weight: 300; color: #EAE5E0; line-height: 1; }
                .sub-value { font-size: 1.3rem; color: #EAE5E0; margin-top: 2px; }

                .variation {
                    display: inline-flex;
                    align-items: center;
                    font-size: 0.8rem;
                    font-weight: 600;
                    margin-top: 6px;
                    padding: 3px 8px;
                    border-radius: 6px;
                    background: rgba(139, 168, 136, 0.1);
                    color: #8BA888;
                    width: fit-content;
                }

                .chart-container {
                    width: 100%;
                    height: 110px;
                    position: relative;
                    margin-bottom: 20px;
                    cursor: crosshair;
                    flex-shrink: 0;
                }

                svg { width: 100%; height: 100%; overflow: visible; }
                .chart-area { fill: url(#gradientGolden); opacity: 0.4; }
                .chart-line {
                    fill: none;
                    stroke: #D4AF37;
                    stroke-width: 2;
                    stroke-linecap: round;
                    filter: drop-shadow(0 0 6px rgba(212, 175, 55, 0.2));
                }

                .interactive-line { stroke: rgba(255,255,255,0.2); stroke-width: 1; stroke-dasharray: 4; display: none; }
                .chart-dot { fill: #D4AF37; stroke: #12100E; stroke-width: 2; display: none; }

                .chart-tooltip {
                    position: absolute;
                    background: rgba(25, 20, 18, 0.95);
                    border: 1px solid rgba(255, 230, 200, 0.08);
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 0.75rem;
                    pointer-events: none;
                    display: none;
                    z-index: 100;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                    transform: translate(-50%, -100%);
                    margin-top: -10px;
                }

                .details-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    border-top: 1px solid rgba(255, 230, 200, 0.08);
                    padding-top: 15px;
                    flex: 1;
                    overflow-y: auto;
                    /* Scrollbar customizado para não quebrar o visual */
                    scrollbar-width: thin;
                    scrollbar-color: rgba(212, 175, 55, 0.3) transparent;
                }

                .details-grid::-webkit-scrollbar { width: 4px; }
                .details-grid::-webkit-scrollbar-track { background: transparent; }
                .details-grid::-webkit-scrollbar-thumb { background: rgba(212, 175, 55, 0.3); border-radius: 10px; }

                .asset-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                    font-weight: 400;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .asset-row:hover { background: rgba(255,255,255,0.02); }
                .asset-info { display: flex; flex-direction: column; }
                .asset-name { font-weight: 400; font-size: 0.85rem; }
                .asset-meta { font-size: 0.7rem; color: #9A908A; }
                .asset-value { text-align: right; font-weight: 400; font-size: 0.9rem; font-feature-settings: 'tnum'; }

                #backNav {
                    display: none;
                    cursor: pointer;
                    color: #D4AF37;
                    margin-bottom: 4px;
                    font-size: 1.4rem;
                    align-items: center;
                    font-weight: 300;
                    width: fit-content;
                    transition: transform 0.2s ease;
                }

                #backNav:hover { transform: translateX(-4px); }

                /* Modal de Período */
                .modal-overlay {
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.7);
                    backdrop-filter: blur(4px);
                    display: none;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    border-radius: 20px;
                }

                .modal-content {
                    background: #1A1614;
                    border: 1px solid rgba(255, 230, 200, 0.1);
                    padding: 24px;
                    border-radius: 16px;
                    width: 280px;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.6);
                }

                .modal-content h3 {
                    margin: 0 0 16px;
                    font-family: 'Playfair Display', serif;
                    font-size: 1.1rem;
                }

                .period-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                }

                .period-opt {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.05);
                    color: #EAE5E0;
                    padding: 10px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 0.8rem;
                    text-align: center;
                    transition: all 0.2s;
                }

                .period-opt:hover {
                    background: rgba(212, 175, 55, 0.15);
                    border-color: #D4AF37;
                    color: #D4AF37;
                }
            </style>

            <div class="widget-card">
                <div class="header">
                    <div>
                        <div id="backNav">←</div>
                        <h2 id="cardTitle">Patrimônio Total</h2>
                        <div class="subtitle" id="cardSubtitle">Posições ativas marcadas a mercado</div>
                    </div>

                    <div class="filters">
                        <div class="filter-group">
                            <button class="filter-btn active" data-currency="BRL">R$</button>
                            <button class="filter-btn" data-currency="USD">US$</button>
                        </div>
                        <div class="filter-group">
                            <button class="filter-btn active" data-class="all">Todas</button>
                            <button class="filter-btn" data-class="RV">RV</button>
                            <button class="filter-btn" data-class="RF">RF</button>
                        </div>
                        <div class="filter-group">
                            <button class="filter-btn" id="timeFilterBtn">Período</button>
                        </div>
                    </div>
                </div>

                <div class="kpi-section">
                    <div class="kpi-box">
                        <span class="label" id="mainLabel">Valor Atual</span>
                        <div class="main-value" id="mainValue">—</div>
                        <div class="variation" id="mainVariation">—</div>
                    </div>
                    <div class="kpi-box secondary">
                        <span class="label" id="secondaryLabel">Capital investido</span>
                        <div class="sub-value" id="secondaryValue">—</div>
                    </div>
                </div>

                <div class="chart-container" id="chartContainer">
                    <div class="chart-tooltip" id="chartTooltip"></div>
                    <svg viewBox="0 0 800 200" preserveAspectRatio="none" id="chartSvg">
                        <defs>
                            <linearGradient id="gradientGolden" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stop-color="#D4AF37" stop-opacity="0.4"></stop>
                                <stop offset="100%" stop-color="#D4AF37" stop-opacity="0"></stop>
                            </linearGradient>
                        </defs>

                        <path class="chart-area" id="chartArea"></path>
                        <path class="chart-line" id="chartLine"></path>
                        <line x1="0" y1="0" x2="0" y2="200" class="interactive-line" id="vLine"></line>
                        <circle cx="0" cy="0" r="4" class="chart-dot" id="chartDot"></circle>
                    </svg>
                </div>

                <div class="details-grid" id="detailsGrid">
                    <div><span class="label" style="opacity:0.7;">Ativos</span></div>
                    <div><span class="label" style="opacity:0.7;">Detalhes</span></div>
                </div>

                <!-- Modal de Período -->
                <div class="modal-overlay" id="timeModal">
                    <div class="modal-content">
                        <h3>Selecionar Período</h3>
                        <div class="period-grid">
                            <div class="period-opt" data-months="1">1 Mês</div>
                            <div class="period-opt" data-months="3">3 Meses</div>
                            <div class="period-opt" data-months="6">6 Meses</div>
                            <div class="period-opt" data-months="12">1 Ano</div>
                            <div class="period-opt" data-months="24">2 Anos</div>
                            <div class="period-opt" data-months="0">Tudo</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function createPatrimonioCardController(slotElement) {
        if (!slotElement) return null;

        const BASE_WIDTH = 640;
        const BASE_HEIGHT = 430;
        const shell = document.createElement('div');
        shell.className = 'patrimonio-widget-shell';
        shell.style.width = `${BASE_WIDTH}px`;
        shell.style.height = `${BASE_HEIGHT}px`;

        slotElement.innerHTML = '';
        slotElement.appendChild(shell);

        const shadowRoot = shell.attachShadow({ mode: 'open' });
        shadowRoot.innerHTML = buildPatrimonioWidgetTemplate();

        const widgetCard = shadowRoot.querySelector('.widget-card');
        const backNav = shadowRoot.getElementById('backNav');
        const cardTitle = shadowRoot.getElementById('cardTitle');
        const cardSubtitle = shadowRoot.getElementById('cardSubtitle');
        const mainLabel = shadowRoot.getElementById('mainLabel');
        const mainValue = shadowRoot.getElementById('mainValue');
        const mainVariation = shadowRoot.getElementById('mainVariation');
        const secondaryLabel = shadowRoot.getElementById('secondaryLabel');
        const secondaryValue = shadowRoot.getElementById('secondaryValue');
        const detailsGrid = shadowRoot.getElementById('detailsGrid');
        const chartContainer = shadowRoot.getElementById('chartContainer');
        const chartTooltip = shadowRoot.getElementById('chartTooltip');
        const chartLine = shadowRoot.getElementById('chartLine');
        const chartArea = shadowRoot.getElementById('chartArea');
        const vLine = shadowRoot.getElementById('vLine');
        const chartDot = shadowRoot.getElementById('chartDot');
        const timeFilterBtn = shadowRoot.getElementById('timeFilterBtn');
        const timeModal = shadowRoot.getElementById('timeModal');
        const periodOpts = shadowRoot.querySelectorAll('.period-opt');

        const state = {
            model: normalizeWidgetModel(null),
            currentView: 'total',
            navigationHistory: ['total'],
            chartPoints: [],
            previousLiveResponse: null,
            snapshotBeforeSimulation: null,
            activeFilters: {
                currencies: ['BRL'],
                periodsMonths: [2, 3, 6, 12],
                groupBy: 'month',
            },
        };

        // Modal de Período
        timeFilterBtn.addEventListener('click', () => {
            timeModal.style.display = 'flex';
        });

        timeModal.addEventListener('click', (e) => {
            if (e.target === timeModal) timeModal.style.display = 'none';
        });

        periodOpts.forEach((opt) => {
            opt.addEventListener('click', () => {
                const months = parseInt(opt.getAttribute('data-months'));
                timeModal.style.display = 'none';
                const periods = months > 0 ? [months] : [2, 3, 6, 12];
                fetchAndRenderLiveData({ periodsMonths: periods });
            });
        });

        function scaleToContainer() {
            const widthRatio = slotElement.clientWidth / BASE_WIDTH;
            const heightRatio = slotElement.clientHeight / BASE_HEIGHT;
            const scale = Math.max(0.7, Math.min(widthRatio, heightRatio));
            shell.style.transform = `scale(${scale})`;
        }

        function sanitizeNumber(value) {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : 0;
        }

        function buildPaths(points) {
            if (!points.length) {
                return { lineD: 'M0,200 L800,200', areaD: 'M0,200 L800,200 L800,200 L0,200 Z' };
            }

            if (points.length === 1) {
                return {
                    lineD: `M0,${points[0].y} L800,${points[0].y}`,
                    areaD: `M0,${points[0].y} L800,${points[0].y} L800,200 L0,200 Z`,
                };
            }

            const line = [`M${points[0].x},${points[0].y}`];
            for (let i = 1; i < points.length; i += 1) {
                const previous = points[i - 1];
                const current = points[i];
                const controlX = (previous.x + current.x) / 2;
                line.push(`C${controlX},${previous.y} ${controlX},${current.y} ${current.x},${current.y}`);
            }

            const lineD = line.join(' ');
            return {
                lineD,
                areaD: `${lineD} L800,200 L0,200 Z`,
            };
        }

        function setChartData(chartModel) {
            const sourcePoints = Array.isArray(chartModel?.points) ? chartModel.points : [];
            const values = sourcePoints.map((point) => sanitizeNumber(point.value));
            const max = values.length ? Math.max(...values) : 0;
            const min = values.length ? Math.min(...values) : 0;
            const spread = Math.max(1, max - min);

            state.chartPoints = sourcePoints.map((point, index) => {
                const x = sourcePoints.length === 1 ? 400 : (index / (sourcePoints.length - 1)) * 800;
                const normalized = (sanitizeNumber(point.value) - min) / spread;
                const y = 180 - (normalized * 150);
                return {
                    x,
                    y,
                    label: point.label || 'Período',
                    value: sanitizeNumber(point.value),
                    currency: point.currency || chartModel?.currency || 'BRL',
                };
            });

            const { lineD, areaD } = buildPaths(state.chartPoints);
            chartLine.setAttribute('d', lineD);
            chartArea.setAttribute('d', areaD);
        }

        function renderDetails(viewData) {
            const details = normalizeDetails(viewData.details);
            const buildColumn = (items, title) => {
                if (!items.length) {
                    return `<div><span class="label" style="opacity:0.7;">${title}</span></div>`;
                }
                const rows = items.map((item) => `
                    <div class="asset-row" data-view="${item.id || ''}">
                        <div class="asset-info">
                            <span class="asset-name">${item.name || '—'}</span>
                            <span class="asset-meta">${item.meta || ''}</span>
                        </div>
                        <div class="asset-value">
                            <div>${item.value || '—'}</div>
                            <div style="font-size:0.7rem;color:#8BA888;">${item.varText || ''}</div>
                        </div>
                    </div>
                `).join('');
                return `<div><span class="label" style="opacity:0.7;">${title}</span>${rows}</div>`;
            };

            detailsGrid.innerHTML = `${buildColumn(details.left, 'Ativos')}${buildColumn(details.right, 'Detalhes')}`;
        }

        function attachRowListeners() {
            shadowRoot.querySelectorAll('.asset-row').forEach((row) => {
                row.addEventListener('click', () => {
                    const viewId = row.getAttribute('data-view');
                    if (viewId && state.model.views[viewId]) {
                        updateView(viewId);
                    }
                });
            });
        }

        async function updateView(viewId, isBack = false) {
            const viewData = state.model.views[viewId];
            if (!viewData) return;

            widgetCard.style.opacity = '0';
            widgetCard.style.transform = 'translateY(8px)';
            await new Promise((resolve) => window.setTimeout(resolve, 120));

            if (!isBack && viewId !== 'total') {
                state.navigationHistory.push(viewId);
            }

            state.currentView = viewId;
            cardTitle.textContent = viewData.title;
            cardSubtitle.textContent = viewData.subtitle;
            mainLabel.textContent = viewData.label;
            mainValue.textContent = viewData.value;
            mainVariation.textContent = viewData.variation;
            secondaryLabel.textContent = viewData.secondaryLabel;
            secondaryValue.textContent = viewData.secondaryValue;
            backNav.style.display = viewId === 'total' ? 'none' : 'flex';

            renderDetails(viewData);
            attachRowListeners();

            widgetCard.style.opacity = '1';
            widgetCard.style.transform = 'translateY(0)';
        }

        function bindChartInteraction() {
            chartContainer.addEventListener('mousemove', (event) => {
                if (!state.chartPoints.length) return;

                const rect = chartContainer.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const svgX = (x / rect.width) * 800;

                let nearest = state.chartPoints[0];
                for (let index = 1; index < state.chartPoints.length; index += 1) {
                    const candidate = state.chartPoints[index];
                    if (Math.abs(candidate.x - svgX) < Math.abs(nearest.x - svgX)) {
                        nearest = candidate;
                    }
                }

                vLine.setAttribute('x1', nearest.x);
                vLine.setAttribute('x2', nearest.x);
                vLine.style.display = 'block';

                chartDot.setAttribute('cx', nearest.x);
                chartDot.setAttribute('cy', nearest.y);
                chartDot.style.display = 'block';

                chartTooltip.style.display = 'block';
                chartTooltip.style.left = `${x}px`;
                chartTooltip.style.top = `${(nearest.y / 200) * rect.height}px`;
                chartTooltip.innerHTML = `
                    <div style="color:#9A908A;font-size:0.65rem;">${nearest.label}</div>
                    <div style="color:#D4AF37;font-weight:700;">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: nearest.currency }).format(nearest.value)}</div>
                `;
            });

            chartContainer.addEventListener('mouseleave', () => {
                vLine.style.display = 'none';
                chartDot.style.display = 'none';
                chartTooltip.style.display = 'none';
            });
        }

        backNav.addEventListener('click', () => {
            if (state.navigationHistory.length > 1) {
                state.navigationHistory.pop();
                const previous = state.navigationHistory[state.navigationHistory.length - 1];
                updateView(previous, true);
            }
        });

        shadowRoot.querySelectorAll('.filter-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const siblings = button.parentElement.querySelectorAll('.filter-btn');
                siblings.forEach((item) => item.classList.remove('active'));
                button.classList.add('active');

                // Lógica de Filtro de Classe (RV, RF, Todas)
                if (button.hasAttribute('data-class')) {
                    const className = button.getAttribute('data-class');
                    if (className === 'all') {
                        updateView('total');
                        fetchAndRenderLiveData({ assetClasses: undefined });
                    } else {
                        const targetView = className === 'RV' ? 'renda-variavel' : 'renda-fixa';
                        const classFilter = className === 'RV'
                            ? ['equity', 'funds', 'crypto']
                            : ['fixed_income', 'cash'];

                        fetchAndRenderLiveData({ assetClasses: classFilter }).then(() => {
                            if (state.model.views[targetView]) {
                                updateView(targetView);
                            }
                        }).catch(() => {});

                        if (state.model.views[targetView]) {
                            updateView(targetView);
                        }
                    }
                }

                if (button.hasAttribute('data-currency')) {
                    const currency = button.getAttribute('data-currency');
                    fetchAndRenderLiveData({ currencies: [currency] });
                }
            });
        });

        bindChartInteraction();
        scaleToContainer();
        window.addEventListener('resize', scaleToContainer);

        function applyModel(widgetModel) {
            state.model = normalizeWidgetModel(widgetModel);
            // Preserva a navegação se possível ou reseta para o root
            const root = state.model.rootView || 'total';
            state.navigationHistory = [root];
            setChartData(state.model.chart);
            updateView(root);
            scaleToContainer();
        }

        function applyCardResponse(cardResponse, { simulated = false } = {}) {
            if (simulated && !state.snapshotBeforeSimulation) {
                state.snapshotBeforeSimulation = toDeepClone(state.previousLiveResponse);
            }

            if (!simulated) {
                state.previousLiveResponse = toDeepClone(cardResponse);
            }

            const widgetModel = extractWidgetModelFromCardResponse(cardResponse);
            applyModel(widgetModel);
            return widgetModel;
        }

        async function fetchAndRenderLiveData(filterOverrides = {}) {
            const mergedFilters = {
                ...state.activeFilters,
                ...filterOverrides,
            };

            if (!mergedFilters.assetClasses || mergedFilters.assetClasses.length === 0) {
                delete mergedFilters.assetClasses;
            }

            state.activeFilters = mergedFilters;

            const response = await window.YieldInvestments.api.queryCards(
                [
                    {
                        cardId: 'card-patrimonio-total-investido',
                        title: 'Patrimônio Total Investido',
                        presentation: 'chart',
                        metricIds: ['investments.net_worth'],
                    },
                ],
                mergedFilters
            );

            applyCardResponse(response, { simulated: false });
            return response;
        }

        function restoreOriginalState() {
            const snapshot = state.snapshotBeforeSimulation || state.previousLiveResponse;
            state.snapshotBeforeSimulation = null;
            if (snapshot) {
                applyCardResponse(snapshot, { simulated: false });
                return;
            }
            applyModel(normalizeWidgetModel(null));
        }

        applyModel(normalizeWidgetModel(null));

        return {
            applyModel,
            applyCardResponse,
            fetchAndRenderLiveData,
            restoreOriginalState,
            getCurrentModel() {
                return toDeepClone(state.model);
            },
        };
    }

    function createManualAssetModalController() {
        const trigger = document.getElementById('manual-asset-trigger');
        const overlay = document.getElementById('manual-asset-modal-overlay');
        const closeBtn = document.getElementById('manual-asset-close');
        const body = document.getElementById('manual-asset-modal-body');

        if (!trigger || !overlay || !closeBtn || !body) {
            return null;
        }

        const today = () => new Date().toISOString().slice(0, 10);

        const classOptions = [
            { id: 'equity', label: 'Renda Variável' },
            { id: 'fixed_income', label: 'Renda Fixa' },
            { id: 'funds', label: 'Fundos' },
            { id: 'crypto', label: 'Criptoativos' },
        ];

        const categoriesByClass = {
            equity: ['Ações', 'FIIs', 'ETFs', 'BDRs'],
            fixed_income: ['CDB', 'LCI', 'LCA', 'Tesouro', 'Debêntures'],
            funds: ['Multimercado', 'Ações', 'Cambial', 'Previdência'],
            crypto: ['Bitcoin', 'Ethereum', 'Altcoins', 'Stablecoins'],
        };

        const addFieldsByClass = {
            equity: [
                { id: 'ticker', label: 'Ticker (código)', placeholder: 'Ex.: PETR4, HGLG11', help: 'Código do ativo na corretora.', required: true },
                { id: 'operationType', label: 'Tipo de operação', type: 'select', options: ['Compra', 'Venda', 'Bonificação', 'Grupamento/Desdobramento'], help: 'Selecione o evento da nota de corretagem.', required: true },
                { id: 'operationDate', label: 'Data da operação', type: 'date', help: 'Data da nota de corretagem.', required: true },
                { id: 'quantity', label: 'Quantidade', type: 'number', min: '0', step: '0.0001', help: 'Quantidade de cotas/ações negociadas.', required: true },
                { id: 'unitPrice', label: 'Preço unitário', type: 'number', min: '0', step: '0.0001', help: 'Preço pago por unidade na operação.', required: true },
                { id: 'fees', label: 'Taxas (opcional)', type: 'number', min: '0', step: '0.0001', help: 'Corretagem e emolumentos para preço médio real.' },
                { id: 'broker', label: 'Corretora (opcional)', placeholder: 'Ex.: XP, NuInvest', help: 'Ajuda a lembrar onde o ativo está custodiado.' },
            ],
            fixed_income: [
                { id: 'name', label: 'Nome do ativo/emissor', placeholder: 'Ex.: CDB Banco Inter', help: 'Nome que identifica o título aplicado.', required: true },
                { id: 'appliedValue', label: 'Valor aplicado (R$)', type: 'number', min: '0', step: '0.01', help: 'Valor investido no dia da aplicação.', required: true },
                { id: 'indexer', label: 'Indexador', type: 'select', options: ['CDI', 'IPCA', 'Pré-fixado', 'SELIC'], help: 'Base usada para corrigir o rendimento.', required: true },
                { id: 'rate', label: 'Taxa do ativo', type: 'number', min: '0', step: '0.0001', help: 'Ex.: 110 (% do CDI) ou 6.5 (IPCA + %).', required: true },
                { id: 'applicationDate', label: 'Data de aplicação', type: 'date', help: 'Dia em que o dinheiro saiu da conta.', required: true },
                { id: 'maturityDate', label: 'Data de vencimento', type: 'date', help: 'Data em que o valor retorna para sua conta.', required: true },
                { id: 'liquidity', label: 'Liquidez', type: 'select', options: ['No Vencimento', 'Diária'], help: 'Informa se o resgate é livre ou só no vencimento.', required: true },
                { id: 'broker', label: 'Instituição (opcional)', placeholder: 'Ex.: Banco Inter', help: 'Onde o título foi contratado.' },
            ],
            funds: [
                { id: 'name', label: 'Nome do fundo / CNPJ', placeholder: 'Ex.: Fundo XP Ações', help: 'Identificação do fundo investido.', required: true },
                { id: 'transactionValue', label: 'Valor da transação (R$)', type: 'number', min: '0', step: '0.01', help: 'Valor bruto do aporte ou resgate.', required: true },
                { id: 'shares', label: 'Quantidade de cotas (opcional)', type: 'number', min: '0', step: '0.00000001', help: 'Se souber, melhora a precisão do histórico.' },
                { id: 'quotationDate', label: 'Data da cotização', type: 'date', help: 'Data em que o aporte/resgate foi processado.', required: true },
                { id: 'transactionType', label: 'Tipo', type: 'select', options: ['Aplicação', 'Resgate'], help: 'Selecione se entrou ou saiu dinheiro do fundo.', required: true },
            ],
            crypto: [
                { id: 'ticker', label: 'Ativo', placeholder: 'Ex.: BTC, ETH, SOL', help: 'Sigla da criptomoeda negociada.', required: true },
                { id: 'operationDate', label: 'Data da operação', type: 'date', help: 'Data da compra/venda na exchange.', required: true },
                { id: 'quantity', label: 'Quantidade', type: 'number', min: '0', step: '0.00000001', help: 'Aceita até 8 casas decimais.', required: true },
                { id: 'purchaseCurrency', label: 'Moeda de compra', type: 'select', options: ['BRL', 'USD'], help: 'Moeda usada na negociação.', required: true },
                { id: 'unitPrice', label: 'Preço unitário', type: 'number', min: '0', step: '0.00000001', help: 'Preço por unidade no momento da operação.', required: true },
                { id: 'exchangeFee', label: 'Taxa da exchange (opcional)', type: 'number', min: '0', step: '0.00000001', help: 'Custo cobrado pela corretora de cripto.' },
                { id: 'exchange', label: 'Exchange (opcional)', placeholder: 'Ex.: Binance', help: 'Onde a operação foi feita.' },
            ],
        };

        const movementCatalog = [
            {
                id: 'add_buy',
                label: 'Compra/Aporte',
                description: 'Aumenta posição e recalcula preço médio.',
            },
            {
                id: 'add_sell',
                label: 'Venda/Resgate',
                description: 'Reduz posição e registra resultado realizado.',
            },
            {
                id: 'add_income',
                label: 'Proventos (Dividendos/JCP)',
                description: 'Registra renda recebida sem mudar o preço médio.',
            },
            {
                id: 'update_balance',
                label: 'Atualizar Saldo Atual (Renda Fixa)',
                description: 'Atualiza saldo informado pelo banco e calcula rendimento.',
                onlyAssetClass: 'fixed_income',
            },
            {
                id: 'delete_asset',
                label: 'Apagar Ativo por Completo',
                description: 'Remove permanentemente o ativo, histórico e posições. Não pode ser desfeito.',
                danger: true,
            },
        ];

        const editFieldsByOperation = {
            add_buy: [
                { id: 'referenceDate', label: 'Data da movimentação', type: 'date', help: 'Data da compra/aporte.', required: true },
                { id: 'quantity', label: 'Quantidade', type: 'number', min: '0', step: '0.00000001', help: 'Quantidade adicionada à posição.', required: true },
                { id: 'price', label: 'Preço unitário', type: 'number', min: '0', step: '0.00000001', help: 'Valor por unidade nesta compra.', required: true },
                { id: 'fees', label: 'Taxas (opcional)', type: 'number', min: '0', step: '0.00000001', help: 'Custos operacionais da movimentação.' },
                { id: 'marketPrice', label: 'Preço atual (opcional)', type: 'number', min: '0', step: '0.00000001', help: 'Preço de mercado para atualizar o painel.' },
            ],
            add_sell: [
                { id: 'referenceDate', label: 'Data da movimentação', type: 'date', help: 'Data da venda/resgate.', required: true },
                { id: 'quantity', label: 'Quantidade vendida/resgatada', type: 'number', min: '0', step: '0.00000001', help: 'Quantidade que saiu da posição.', required: true },
                { id: 'price', label: 'Preço de venda', type: 'number', min: '0', step: '0.00000001', help: 'Preço efetivo da venda/resgate.', required: true },
                { id: 'fees', label: 'Taxas (opcional)', type: 'number', min: '0', step: '0.00000001', help: 'Custos cobrados nessa saída.' },
            ],
            add_income: [
                { id: 'referenceDate', label: 'Data do recebimento', type: 'date', help: 'Data em que o provento caiu na conta.', required: true },
                { id: 'incomeType', label: 'Tipo de provento', type: 'select', options: ['Dividendos', 'JCP'], help: 'Classificação para relatório de renda passiva.', required: true },
                { id: 'grossAmount', label: 'Valor recebido (R$)', type: 'number', min: '0', step: '0.01', help: 'Valor bruto do provento.', required: true },
            ],
            update_balance: [
                { id: 'referenceDate', label: 'Data da atualização', type: 'date', help: 'Data do saldo informado no app do banco.', required: true },
                { id: 'currentBalance', label: 'Saldo atual (R$)', type: 'number', min: '0', step: '0.01', help: 'Saldo atual mostrado pela instituição.', required: true },
            ],
            delete_asset: [
                { id: 'confirmation', label: 'Confirmação', placeholder: 'Escreva "APAGAR AGORA"', help: 'Para deletar permanentemente, digite a frase exigida.', required: true },
            ],
        };

        const state = {
            flow: null,
            step: 1,
            loading: false,
            error: '',
            success: '',
            addPayload: {
                assetClass: '',
                category: '',
                fields: {},
            },
            edit: {
                query: '',
                results: [],
                selectedAsset: null,
                operation: '',
                fields: {
                    referenceDate: today(),
                },
            },
        };

        function escapeHtml(value) {
            return String(value || '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;');
        }

        function parseNumber(rawValue) {
            if (rawValue === null || rawValue === undefined || rawValue === '') return null;
            const normalized = String(rawValue).replace(',', '.');
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : null;
        }

        function getAddFields() {
            return addFieldsByClass[state.addPayload.assetClass] || [];
        }

        function getAllowedMovements() {
            const assetClass = state.edit.selectedAsset?.assetClass || '';
            return movementCatalog.filter((item) => !item.onlyAssetClass || item.onlyAssetClass === assetClass);
        }

        function getEditFields() {
            return editFieldsByOperation[state.edit.operation] || [];
        }

        function openModal() {
            overlay.classList.add('open');
            overlay.setAttribute('aria-hidden', 'false');
            resetFlow();
            render();
        }

        function closeModal() {
            overlay.classList.remove('open');
            overlay.setAttribute('aria-hidden', 'true');
        }

        function resetFlow() {
            state.flow = null;
            state.step = 1;
            state.loading = false;
            state.error = '';
            state.success = '';
            state.addPayload = { assetClass: '', category: '', fields: {} };
            state.edit = {
                query: '',
                results: [],
                selectedAsset: null,
                operation: '',
                fields: { referenceDate: today() },
            };
        }

        function setError(message) {
            state.error = message || '';
            state.success = '';
        }

        function setSuccess(message) {
            state.success = message || '';
            state.error = '';
        }

        function renderFeedback() {
            if (state.error) return `<div class="manual-error-msg">${escapeHtml(state.error)}</div>`;
            if (state.success) return `<div class="manual-success-msg">${escapeHtml(state.success)}</div>`;
            return '';
        }

        function renderField(field, value, inputIdPrefix) {
            const inputId = `${inputIdPrefix}-${field.id}`;
            const requiredMark = field.required ? ' *' : '';
            const commonAttrs = [
                field.min !== undefined ? `min="${escapeHtml(field.min)}"` : '',
                field.step !== undefined ? `step="${escapeHtml(field.step)}"` : '',
                field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : '',
            ].filter(Boolean).join(' ');

            const inputHtml = field.type === 'select'
                ? `
                    <select id="${inputId}" data-field-id="${field.id}" ${field.required ? 'required' : ''}>
                        <option value="">Selecione</option>
                        ${(field.options || []).map((option) => `
                            <option value="${escapeHtml(option)}" ${String(value || '') === String(option) ? 'selected' : ''}>${escapeHtml(option)}</option>
                        `).join('')}
                    </select>
                `
                : `
                    <input
                        id="${inputId}"
                        data-field-id="${field.id}"
                        type="${field.type || 'text'}"
                        value="${escapeHtml(value || '')}"
                        ${commonAttrs}
                        ${field.required ? 'required' : ''}
                    />
                `;

            return `
                <label class="manual-field" for="${inputId}">
                    <span class="manual-field-label">${escapeHtml(field.label)}${requiredMark}</span>
                    ${inputHtml}
                    <span class="manual-field-help">${escapeHtml(field.help || '')}</span>
                </label>
            `;
        }

        function renderFlowChooser() {
            body.innerHTML = `
                <div class="manual-step-title">Primeira etapa</div>
                <div class="manual-action-grid">
                    <button class="manual-option-btn" data-action="go-add">Cadastrar Ativo</button>
                    <button class="manual-option-btn" data-action="go-edit">Nova Movimentação</button>
                </div>
                ${renderFeedback()}
            `;
        }

        function renderAddStep() {
            if (state.step === 1) {
                body.innerHTML = `
                    <div class="manual-step-title">Cadastro manual · Etapa 1/3</div>
                    <div class="manual-class-grid">
                        ${classOptions.map((item) => `
                            <button class="manual-option-btn ${state.addPayload.assetClass === item.id ? 'active' : ''}" data-action="select-class" data-class="${item.id}">
                                ${item.label}
                            </button>
                        `).join('')}
                    </div>
                    ${renderFeedback()}
                `;
                return;
            }

            if (state.step === 2) {
                const categories = categoriesByClass[state.addPayload.assetClass] || [];
                body.innerHTML = `
                    <div class="manual-step-title">Cadastro manual · Etapa 2/3</div>
                    <div class="manual-category-grid">
                        ${categories.map((item) => `
                            <button class="manual-option-btn ${state.addPayload.category === item ? 'active' : ''}" data-action="select-category" data-category="${escapeHtml(item)}">
                                ${item}
                            </button>
                        `).join('')}
                    </div>
                    <div class="manual-row-actions">
                        <button class="manual-back-btn" data-action="back">Voltar</button>
                    </div>
                    ${renderFeedback()}
                `;
                return;
            }

            const fields = getAddFields();
            body.innerHTML = `
                <div class="manual-step-title">Cadastro manual · Etapa 3/3</div>
                <div class="manual-form-grid">
                    ${fields.map((field) => renderField(field, state.addPayload.fields[field.id], 'manual-add')).join('')}
                </div>
                <div class="manual-row-actions">
                    <button class="manual-back-btn" data-action="back">Voltar</button>
                    <button class="manual-submit-btn" data-action="submit-add" ${state.loading ? 'disabled' : ''}>${state.loading ? 'Salvando...' : 'Salvar ativo'}</button>
                </div>
                ${renderFeedback()}
            `;
        }

        function renderEditStep() {
            if (state.step === 1) {
                body.innerHTML = `
                    <div class="manual-step-title">Nova movimentação · Etapa 1/3</div>
                    <div class="manual-form-grid" style="grid-template-columns: 1fr auto;">
                        <input id="manual-search-query" placeholder="Digite o nome do ativo" value="${escapeHtml(state.edit.query)}" />
                        <button class="manual-submit-btn" data-action="search-assets" ${state.loading ? 'disabled' : ''}>Buscar</button>
                    </div>
                    <div class="manual-category-grid">
                        ${state.edit.results.map((asset) => `
                            <button class="manual-option-btn ${state.edit.selectedAsset?.assetId === asset.assetId ? 'active' : ''}" data-action="select-asset" data-asset-id="${escapeHtml(asset.assetId)}">
                                <div>${escapeHtml(asset.name)}</div>
                                <div class="manual-option-desc">${escapeHtml(asset.assetClass)} · ${escapeHtml(asset.category || 'sem subtipo')}</div>
                            </button>
                        `).join('')}
                    </div>
                    <div class="manual-row-actions">
                        <button class="manual-back-btn" data-action="back">Voltar</button>
                        <button class="manual-submit-btn" data-action="next-edit" ${state.edit.selectedAsset ? '' : 'disabled'}>Continuar</button>
                    </div>
                    ${renderFeedback()}
                `;
                return;
            }

            if (state.step === 2) {
                const options = getAllowedMovements();
                body.innerHTML = `
                    <div class="manual-step-title">Nova movimentação · Etapa 2/3</div>
                    <div class="manual-edit-action-grid">
                        ${options.map((item) => `
                            <button class="manual-option-btn ${state.edit.operation === item.id ? 'active' : ''}" data-action="select-edit-operation" data-operation="${item.id}">
                                <div>${item.label}</div>
                                <div class="manual-option-desc">${item.description}</div>
                            </button>
                        `).join('')}
                    </div>
                    <div class="manual-row-actions">
                        <button class="manual-back-btn" data-action="back">Voltar</button>
                        <button class="manual-submit-btn" data-action="next-edit" ${state.edit.operation ? '' : 'disabled'}>Continuar</button>
                    </div>
                    ${renderFeedback()}
                `;
                return;
            }

            const fields = getEditFields();
            const isDelete = state.edit.operation === 'delete_asset';

            body.innerHTML = `
                <div class="manual-step-title">Nova movimentação · Etapa 3/3</div>
                <div class="manual-form-grid">
                    ${fields.map((field) => renderField(field, state.edit.fields[field.id], 'manual-edit')).join('')}
                </div>
                <div class="manual-row-actions">
                    <button class="manual-back-btn" data-action="back">Voltar</button>
                    <button class="manual-submit-btn ${isDelete ? 'danger' : ''}" data-action="submit-edit" ${state.loading ? 'disabled' : ''}>
                        ${state.loading ? 'Processando...' : (isDelete ? 'Apagar definitivamente' : 'Registrar movimentação')}
                    </button>
                </div>
                ${renderFeedback()}
            `;
        }

        function render() {
            if (!state.flow) {
                renderFlowChooser();
                return;
            }

            if (state.flow === 'add') {
                renderAddStep();
                return;
            }

            renderEditStep();
        }

        async function refreshPatrimonioCard() {
            const card = window.YieldInvestments?.cards?.patrimonio;
            if (card?.fetchAndRenderLiveData) {
                await card.fetchAndRenderLiveData();
            }
        }

        function collectFormValues(fieldDefs, prefix, target) {
            const output = { ...target };
            fieldDefs.forEach((field) => {
                const element = body.querySelector(`#${prefix}-${field.id}`);
                output[field.id] = element?.value?.trim?.() ?? element?.value ?? '';
            });
            return output;
        }

        function validateRequiredFields(fieldDefs, values) {
            const missing = fieldDefs.find((field) => field.required && !String(values[field.id] || '').trim());
            if (missing) {
                throw new Error(`Preencha o campo obrigatório: ${missing.label}`);
            }
        }

        function buildAddPayload() {
            const assetClass = state.addPayload.assetClass;
            const category = state.addPayload.category;
            const fields = state.addPayload.fields;

            if (!assetClass) throw new Error('Selecione a classe do ativo.');
            if (!category) throw new Error('Selecione o tipo/subtipo do ativo.');

            if (assetClass === 'equity') {
                const quantity = parseNumber(fields.quantity);
                const unitPrice = parseNumber(fields.unitPrice);
                const fees = parseNumber(fields.fees) || 0;
                if (!quantity || quantity <= 0) throw new Error('Quantidade inválida para renda variável.');
                if (unitPrice === null || unitPrice < 0) throw new Error('Preço unitário inválido para renda variável.');

                return {
                    assetClass,
                    category,
                    name: String(fields.ticker || '').toUpperCase(),
                    quantity,
                    avgPrice: unitPrice + (fees / quantity),
                    referenceDate: fields.operationDate,
                    currency: 'BRL',
                    status: 'open',
                    metadata: {
                        operationType: fields.operationType,
                        unitPrice,
                        fees,
                        broker: fields.broker || null,
                    },
                };
            }

            if (assetClass === 'fixed_income') {
                const appliedValue = parseNumber(fields.appliedValue);
                const rate = parseNumber(fields.rate);
                if (appliedValue === null || appliedValue <= 0) throw new Error('Valor aplicado inválido na renda fixa.');
                if (rate === null || rate < 0) throw new Error('Taxa do ativo inválida na renda fixa.');

                return {
                    assetClass,
                    category,
                    name: fields.name,
                    quantity: 1,
                    avgPrice: appliedValue,
                    referenceDate: fields.applicationDate,
                    currency: 'BRL',
                    status: 'open',
                    metadata: {
                        indexer: fields.indexer,
                        rate,
                        maturityDate: fields.maturityDate,
                        liquidity: fields.liquidity,
                        broker: fields.broker || null,
                    },
                };
            }

            if (assetClass === 'funds') {
                const transactionValue = parseNumber(fields.transactionValue);
                const shares = parseNumber(fields.shares);
                if (transactionValue === null || transactionValue <= 0) throw new Error('Valor da transação inválido para fundo.');

                const quantity = shares && shares > 0 ? shares : 1;
                const avgPrice = quantity > 0 ? transactionValue / quantity : transactionValue;

                return {
                    assetClass,
                    category,
                    name: fields.name,
                    quantity,
                    avgPrice,
                    referenceDate: fields.quotationDate,
                    currency: 'BRL',
                    status: 'open',
                    metadata: {
                        transactionType: fields.transactionType,
                        transactionValue,
                        shares: shares || null,
                    },
                };
            }

            if (assetClass === 'crypto') {
                const quantity = parseNumber(fields.quantity);
                const unitPrice = parseNumber(fields.unitPrice);
                const exchangeFee = parseNumber(fields.exchangeFee) || 0;
                if (!quantity || quantity <= 0) throw new Error('Quantidade inválida para criptoativo.');
                if (unitPrice === null || unitPrice < 0) throw new Error('Preço unitário inválido para criptoativo.');

                return {
                    assetClass,
                    category,
                    name: String(fields.ticker || '').toUpperCase(),
                    quantity,
                    avgPrice: unitPrice + (exchangeFee / quantity),
                    referenceDate: fields.operationDate,
                    currency: fields.purchaseCurrency || 'BRL',
                    status: 'open',
                    metadata: {
                        unitPrice,
                        exchangeFee,
                        exchange: fields.exchange || null,
                    },
                };
            }

            throw new Error('Classe de ativo não suportada no formulário manual.');
        }

        function buildEditPayload() {
            const values = state.edit.fields;
            const payload = {
                referenceDate: values.referenceDate || today(),
            };

            if (state.edit.operation === 'add_buy') {
                payload.quantity = parseNumber(values.quantity);
                payload.price = parseNumber(values.price);
                payload.fees = parseNumber(values.fees) || 0;
                payload.marketPrice = parseNumber(values.marketPrice);
            }

            if (state.edit.operation === 'add_sell') {
                payload.quantity = parseNumber(values.quantity);
                payload.price = parseNumber(values.price);
                payload.fees = parseNumber(values.fees) || 0;
            }

            if (state.edit.operation === 'add_income') {
                payload.incomeType = values.incomeType;
                payload.grossAmount = parseNumber(values.grossAmount);
            }

            if (state.edit.operation === 'update_balance') {
                payload.currentBalance = parseNumber(values.currentBalance);
            }

            return payload;
        }

        async function handleSearchAssets() {
            try {
                state.loading = true;
                setError('');
                render();

                const result = await window.YieldInvestments.api.searchAssets(state.edit.query, 20);
                state.edit.results = Array.isArray(result.assets) ? result.assets : [];
                if (!state.edit.results.length) {
                    setError('Nenhum ativo encontrado para o usuário atual.');
                }
            } catch (error) {
                setError(error.message || 'Falha ao buscar ativos');
            } finally {
                state.loading = false;
                render();
            }
        }

        async function handleSubmitAdd() {
            try {
                const fields = getAddFields();
                state.addPayload.fields = collectFormValues(fields, 'manual-add', state.addPayload.fields);
                validateRequiredFields(fields, state.addPayload.fields);
                const requestPayload = buildAddPayload();

                state.loading = true;
                setError('');
                render();

                await window.YieldInvestments.api.createManualAsset(requestPayload);

                await refreshPatrimonioCard();
                setSuccess('Ativo salvo com sucesso e patrimônio atualizado.');
            } catch (error) {
                setError(error.message || 'Falha ao salvar ativo');
            } finally {
                state.loading = false;
                render();
            }
        }

        async function handleSubmitEdit() {
            try {
                const fields = getEditFields();
                state.edit.fields = collectFormValues(fields, 'manual-edit', state.edit.fields);
                validateRequiredFields(fields, state.edit.fields);

                if (state.edit.operation === 'delete_asset') {
                    if (state.edit.fields.confirmation !== 'APAGAR AGORA') {
                        throw new Error('Você deve escrever exatamente "APAGAR AGORA" para confirmar.');
                    }

                    state.loading = true;
                    setError('');
                    render();

                    await window.YieldInvestments.api.deleteAsset(state.edit.selectedAsset.assetId);

                    await refreshPatrimonioCard();
                    setSuccess('Ativo removido com sucesso.');
                    setTimeout(() => {
                        resetFlow();
                        render();
                    }, 1500);
                    return;
                }

                const payload = buildEditPayload();

                state.loading = true;
                setError('');
                render();

                await window.YieldInvestments.api.editAsset(
                    state.edit.selectedAsset.assetId,
                    state.edit.operation,
                    payload
                );

                await refreshPatrimonioCard();
                setSuccess('Movimentação registrada com sucesso e patrimônio recalculado.');
            } catch (error) {
                setError(error.message || 'Falha ao registrar movimentação');
            } finally {
                state.loading = false;
                render();
            }
        }

        body.addEventListener('click', (event) => {
            const target = event.target.closest('[data-action]');
            if (!target) return;

            const action = target.getAttribute('data-action');

            if (action === 'go-add') {
                state.flow = 'add';
                state.step = 1;
                setError('');
                render();
                return;
            }

            if (action === 'go-edit') {
                state.flow = 'edit';
                state.step = 1;
                setError('');
                render();
                return;
            }

            if (action === 'back') {
                if (state.step > 1) {
                    state.step -= 1;
                    setError('');
                    setSuccess('');
                    render();
                } else {
                    resetFlow();
                    render();
                }
                return;
            }

            if (action === 'select-class') {
                state.addPayload.assetClass = target.getAttribute('data-class') || '';
                state.addPayload.category = '';
                state.addPayload.fields = { operationDate: today(), applicationDate: today(), quotationDate: today() };
                state.step = 2;
                setError('');
                render();
                return;
            }

            if (action === 'select-category') {
                state.addPayload.category = target.getAttribute('data-category') || '';
                state.step = 3;
                setError('');
                render();
                return;
            }

            if (action === 'submit-add') {
                handleSubmitAdd();
                return;
            }

            if (action === 'search-assets') {
                state.edit.query = body.querySelector('#manual-search-query')?.value?.trim() || '';
                handleSearchAssets();
                return;
            }

            if (action === 'select-asset') {
                const assetId = target.getAttribute('data-asset-id');
                state.edit.selectedAsset = state.edit.results.find((item) => item.assetId === assetId) || null;
                state.edit.operation = '';
                state.edit.fields = { referenceDate: today() };
                render();
                return;
            }

            if (action === 'select-edit-operation') {
                state.edit.operation = target.getAttribute('data-operation') || '';
                state.edit.fields = { referenceDate: today() };
                render();
                return;
            }

            if (action === 'next-edit') {
                if (state.flow === 'edit' && state.step < 3) {
                    state.step += 1;
                    setError('');
                    render();
                }
                return;
            }

            if (action === 'submit-edit') {
                handleSubmitEdit();
            }
        });

        trigger.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) closeModal();
        });

        return { openModal, closeModal };
    }

    const patrimonioSlot = document.getElementById('patrimonio-card-slot');
    const patrimonioCard = createPatrimonioCardController(patrimonioSlot);
    createManualAssetModalController();
    if (patrimonioCard) {
        window.YieldInvestments.cards.patrimonio = patrimonioCard;
        patrimonioCard.fetchAndRenderLiveData().catch(() => {
            patrimonioCard.applyModel(normalizeWidgetModel(null));
        });
    }

    window.YieldInvestments.preloadManifest().catch(() => {});

    const mainOptBtns = document.querySelectorAll('.main-opt-btn');
    const optionContents = document.querySelectorAll('.option-content');
    mainOptBtns.forEach((button) => {
        button.addEventListener('click', () => {
            const target = button.getAttribute('data-target');
            mainOptBtns.forEach((item) => item.classList.remove('active'));
            button.classList.add('active');

            optionContents.forEach((content) => {
                content.classList.remove('active');
                if (content.id === target) content.classList.add('active');
            });
        });
    });

    const cardOptions = document.querySelectorAll('.card-opt');
    cardOptions.forEach((option) => {
        option.addEventListener('click', () => {
            const parent = option.parentElement;
            parent.querySelectorAll('.card-opt').forEach((item) => item.classList.remove('active'));
            option.classList.add('active');
        });
    });

    const bottomMenu = document.getElementById('bottom-menu');
    const toggleBtn = document.getElementById('toggle-bottom-menu');
    const menuIcon = document.getElementById('menu-icon');

    if (toggleBtn && bottomMenu) {
        toggleBtn.addEventListener('click', () => {
            bottomMenu.classList.toggle('expanded');
            bottomMenu.classList.toggle('collapsed');

            if (bottomMenu.classList.contains('collapsed')) {
                menuIcon.classList.replace('fa-times', 'fa-bars');
            }
        });
    }

    const navOpts = document.querySelectorAll('.nav-opt');
    navOpts.forEach((option) => {
        option.addEventListener('click', () => {
            navOpts.forEach((item) => item.classList.remove('active'));
            option.classList.add('active');
        });
    });
});
