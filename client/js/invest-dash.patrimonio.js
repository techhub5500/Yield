(function initPatrimonioModule() {
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

        timeFilterBtn.addEventListener('click', () => {
            timeModal.style.display = 'flex';
        });

        timeModal.addEventListener('click', (event) => {
            if (event.target === timeModal) timeModal.style.display = 'none';
        });

        periodOpts.forEach((opt) => {
            opt.addEventListener('click', () => {
                const months = parseInt(opt.getAttribute('data-months'), 10);
                timeModal.style.display = 'none';
                const periods = months > 0 ? [months] : [2, 3, 6, 12];
                fetchAndRenderLiveData({ periodsMonths: periods }).catch(() => {});
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

                if (button.hasAttribute('data-class')) {
                    const className = button.getAttribute('data-class');
                    if (className === 'all') {
                        updateView('total');
                        fetchAndRenderLiveData({ assetClasses: undefined }).catch(() => {});
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
                    fetchAndRenderLiveData({ currencies: [currency] }).catch(() => {});
                }
            });
        });

        bindChartInteraction();
        scaleToContainer();
        window.addEventListener('resize', scaleToContainer);

        function applyModel(widgetModel) {
            state.model = normalizeWidgetModel(widgetModel);
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

    window.YieldInvestmentsPatrimonio = {
        createPatrimonioCardController,
        normalizeWidgetModel,
    };
})();
