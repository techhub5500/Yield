(function initRentabilidadeModule() {
    const EMPTY_WIDGET_MODEL = {
        rootView: 'total',
        period: {
            preset: 'origin',
            start: null,
            end: null,
            label: 'Origem',
        },
        chart: {
            currency: 'PERCENT',
            points: [],
        },
        views: {
            total: {
                title: 'Rentabilidade Consolidada',
                subtitle: 'Performance ponderada pelo tempo',
                label: 'Retorno do Período',
                value: '0,00%',
                variation: 'Alfa: +0,00 p.p.',
                benchmarks: [],
                details: { left: [], right: [] },
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
            period: {
                ...base.period,
                ...(rawModel.period || {}),
            },
            chart: {
                currency: rawModel.chart?.currency || base.chart.currency,
                points: Array.isArray(rawModel.chart?.points) ? rawModel.chart.points : [],
            },
            views: {},
        };

        const sourceViews = rawModel.views && typeof rawModel.views === 'object'
            ? rawModel.views
            : base.views;

        Object.entries(sourceViews).forEach(([viewId, view]) => {
            merged.views[viewId] = {
                title: view?.title || '—',
                subtitle: view?.subtitle || '—',
                label: view?.label || '—',
                value: view?.value || '—',
                variation: view?.variation || '—',
                benchmarks: Array.isArray(view?.benchmarks) ? view.benchmarks : [],
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
        const targetCard = cards.find((card) => card.cardId === 'card-rentabilidade-consolidada') || cards[0] || null;
        const metrics = Array.isArray(targetCard?.metrics) ? targetCard.metrics : [];
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

    function buildRentabilidadeWidgetTemplate() {
        return `
            <style>
                :host {
                    all: initial;
                    font-family: 'Inter', sans-serif;
                }

                .widget-card {
                    width: 880px;
                    height: 430px;
                    background: rgba(40, 35, 30, 0.4);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 230, 200, 0.08);
                    border-radius: 20px;
                    box-shadow: 0 15px 30px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.03);
                    position: relative;
                    overflow: hidden;
                    box-sizing: border-box;
                    color: #EAE5E0;
                    display: flex;
                    flex-direction: row;
                }

                .left-side {
                    flex: 1;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .right-side {
                    width: 280px;
                    border-left: 0.5px solid rgba(212, 175, 55, 0.12);
                    padding: 24px 20px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 20px;
                    flex-shrink: 0;
                    gap: 12px;
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

                .filters {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                }

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

                .kpi-box {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }

                .kpi-box.secondary {
                    border-left: 1px solid rgba(212, 175, 55, 0.4);
                    padding-left: 18px;
                }

                .label {
                    font-size: 0.65rem;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: #9A908A;
                    margin-bottom: 4px;
                }

                .main-value {
                    font-size: 1.85rem;
                    font-weight: 300;
                    color: #EAE5E0;
                    line-height: 1;
                }

                .variation {
                    display: inline-flex;
                    align-items: center;
                    font-size: 0.78rem;
                    font-weight: 600;
                    margin-top: 6px;
                    padding: 3px 8px;
                    border-radius: 6px;
                    background: rgba(139, 168, 136, 0.1);
                    color: #8BA888;
                    width: fit-content;
                }

                .variation.negative {
                    background: rgba(217, 119, 87, 0.1);
                    color: #D97757;
                }

                .benchmarks-summary {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    width: 100%;
                }

                .bench-item {
                    display: flex;
                    flex-direction: column;
                    border-left: 2px solid transparent;
                    padding-left: 8px;
                }

                .bench-item.cdi { border-color: rgba(255, 255, 255, 0.45); }
                .bench-item.selic { border-color: #8BA888; }
                .bench-item.ibov { border-color: #D4AF37; }
                .bench-item.ifix { border-color: #D97757; }

                .bench-label {
                    font-size: 0.58rem;
                    text-transform: uppercase;
                    color: #9A908A;
                }

                .bench-val {
                    font-size: 0.9rem;
                    color: #EAE5E0;
                    font-weight: 600;
                }

                .chart-container {
                    width: 100%;
                    height: 140px;
                    position: relative;
                    cursor: crosshair;
                    flex: 1;
                }

                svg {
                    width: 100%;
                    height: 100%;
                    overflow: visible;
                }

                .chart-area {
                    fill: url(#gradientGolden);
                    opacity: 0.3;
                }

                .chart-line {
                    fill: none;
                    stroke: #D4AF37;
                    stroke-width: 2;
                    stroke-linecap: round;
                    filter: drop-shadow(0 0 6px rgba(212,175,55,0.2));
                }

                .benchmark-line {
                    fill: none;
                    stroke-width: 1.15;
                    stroke-dasharray: 4, 3;
                    stroke-linecap: round;
                    opacity: 0;
                    transition: opacity 0.25s ease;
                }

                .benchmark-line.active { opacity: 1; }
                .bench-cdi { stroke: rgba(255, 255, 255, 0.45); }
                .bench-selic { stroke: #8BA888; }
                .bench-ibov { stroke: #D4AF37; }
                .bench-ifix { stroke: #D97757; }

                .interactive-line {
                    stroke: rgba(255,255,255,0.2);
                    stroke-width: 1;
                    stroke-dasharray: 4;
                    display: none;
                }

                .chart-dot {
                    fill: #D4AF37;
                    stroke: #12100E;
                    stroke-width: 2;
                    display: none;
                }

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
                    white-space: nowrap;
                }

                .details-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    flex: 1;
                    overflow-y: auto;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(212,175,55,0.4) transparent;
                }

                .asset-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .asset-row:hover { background: rgba(255,255,255,0.02); }
                .asset-info { display: flex; flex-direction: column; }
                .asset-name { font-size: 0.85rem; }
                .asset-meta { font-size: 0.7rem; color: #9A908A; }
                .asset-value { text-align: right; font-size: 0.9rem; font-feature-settings: 'tnum'; }

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
            </style>

            <div class="widget-card">
                <div class="left-side">
                    <div class="header">
                        <div>
                            <div id="backNav">←</div>
                            <h2 id="cardTitle">Rentabilidade Consolidada</h2>
                            <div class="subtitle" id="cardSubtitle">Performance ponderada pelo tempo</div>
                        </div>

                        <div class="filters">
                            <div class="filter-group">
                                <button class="filter-btn" data-period="mtd">MTD</button>
                                <button class="filter-btn" data-period="ytd">YTD</button>
                                <button class="filter-btn" data-period="12m">12M</button>
                                <button class="filter-btn active" data-period="origin">Origem</button>
                            </div>
                            <div class="filter-group">
                                <button class="filter-btn active" data-currency="BRL">R$</button>
                                <button class="filter-btn" data-currency="USD">US$</button>
                            </div>
                        </div>
                    </div>

                    <div class="kpi-section">
                        <div class="kpi-box">
                            <span class="label" id="mainLabel">Retorno do Período</span>
                            <div class="main-value" id="mainValue">0,00%</div>
                            <div class="variation" id="mainVariation">Alfa: +0,00 p.p.</div>
                        </div>

                        <div class="kpi-box secondary">
                            <span class="label">Benchmarks Comparativos</span>
                            <div class="benchmarks-summary" id="benchmarksSummary"></div>
                        </div>
                    </div>

                    <div class="chart-container" id="chartContainer">
                        <div class="chart-tooltip" id="chartTooltip"></div>
                        <svg viewBox="0 0 800 200" preserveAspectRatio="none" id="chartSvg">
                            <defs>
                                <linearGradient id="gradientGolden" x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="0%" stop-color="#D4AF37" stop-opacity="0.3"></stop>
                                    <stop offset="100%" stop-color="#D4AF37" stop-opacity="0"></stop>
                                </linearGradient>
                            </defs>

                            <path class="chart-area" id="chartArea"></path>
                            <path class="chart-line" id="chartLine"></path>

                            <path id="path-cdi" class="benchmark-line bench-cdi"></path>
                            <path id="path-selic" class="benchmark-line bench-selic"></path>
                            <path id="path-ibov" class="benchmark-line bench-ibov"></path>
                            <path id="path-ifix" class="benchmark-line bench-ifix"></path>

                            <line x1="0" y1="0" x2="0" y2="200" class="interactive-line" id="vLine"></line>
                            <circle cx="0" cy="0" r="4" class="chart-dot" id="chartDot"></circle>
                        </svg>
                    </div>
                </div>

                <div class="right-side">
                    <div class="details-grid" id="detailsGrid"></div>
                </div>
            </div>
        `;
    }

    function createRentabilidadeCardController(slotElement) {
        if (!slotElement) return null;

        const BASE_WIDTH = 880;
        const BASE_HEIGHT = 430;
        const shell = document.createElement('div');
        shell.className = 'rentabilidade-widget-shell';
        shell.style.width = `${BASE_WIDTH}px`;
        shell.style.height = `${BASE_HEIGHT}px`;

        slotElement.innerHTML = '';
        slotElement.appendChild(shell);

        const shadowRoot = shell.attachShadow({ mode: 'open' });
        shadowRoot.innerHTML = buildRentabilidadeWidgetTemplate();

        const widgetCard = shadowRoot.querySelector('.widget-card');
        const backNav = shadowRoot.getElementById('backNav');
        const cardTitle = shadowRoot.getElementById('cardTitle');
        const cardSubtitle = shadowRoot.getElementById('cardSubtitle');
        const mainLabel = shadowRoot.getElementById('mainLabel');
        const mainValue = shadowRoot.getElementById('mainValue');
        const mainVariation = shadowRoot.getElementById('mainVariation');
        const benchmarksSummary = shadowRoot.getElementById('benchmarksSummary');
        const detailsGrid = shadowRoot.getElementById('detailsGrid');
        const chartContainer = shadowRoot.getElementById('chartContainer');
        const chartTooltip = shadowRoot.getElementById('chartTooltip');
        const chartArea = shadowRoot.getElementById('chartArea');
        const chartLine = shadowRoot.getElementById('chartLine');
        const vLine = shadowRoot.getElementById('vLine');
        const chartDot = shadowRoot.getElementById('chartDot');

        const benchmarkPaths = {
            cdi: shadowRoot.getElementById('path-cdi'),
            selic: shadowRoot.getElementById('path-selic'),
            ibov: shadowRoot.getElementById('path-ibov'),
            ifix: shadowRoot.getElementById('path-ifix'),
        };

        const state = {
            model: normalizeWidgetModel(null),
            currentView: 'total',
            navigationHistory: ['total'],
            chartPoints: [],
            activeBenchmarkIds: ['cdi', 'selic', 'ibov', 'ifix'],
            activeFilters: {
                periodPreset: 'origin',
                currencies: ['BRL'],
            },
        };

        function scaleToContainer() {
            const widthRatio = slotElement.clientWidth / BASE_WIDTH;
            const heightRatio = slotElement.clientHeight / BASE_HEIGHT;
            const scale = Math.max(0.7, Math.min(widthRatio, heightRatio));
            shell.style.transform = `scale(${scale})`;
        }

        function parsePercentText(rawValue) {
            const normalized = String(rawValue || '0')
                .replace('%', '')
                .replace(',', '.');
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : 0;
        }

        function buildCurvePath(points) {
            if (!points.length) {
                return 'M0,200 L800,200';
            }

            if (points.length === 1) {
                return `M0,${points[0].y} L800,${points[0].y}`;
            }

            const path = [`M${points[0].x},${points[0].y}`];
            for (let index = 1; index < points.length; index += 1) {
                const previous = points[index - 1];
                const current = points[index];
                const controlX = (previous.x + current.x) / 2;
                path.push(`C${controlX},${previous.y} ${controlX},${current.y} ${current.x},${current.y}`);
            }
            return path.join(' ');
        }

        function setChartData() {
            const points = Array.isArray(state.model.chart?.points) ? state.model.chart.points : [];
            const allSeriesValues = [];

            points.forEach((point) => {
                allSeriesValues.push(Number(point.value || 0));
                state.activeBenchmarkIds.forEach((benchId) => {
                    allSeriesValues.push(Number(point.benchmarks?.[benchId] || 0));
                });
            });

            const max = allSeriesValues.length ? Math.max(...allSeriesValues) : 0;
            const min = allSeriesValues.length ? Math.min(...allSeriesValues) : 0;
            const spread = Math.max(1, max - min);

            state.chartPoints = points.map((point, index) => {
                const x = points.length <= 1 ? 400 : (index / (points.length - 1)) * 800;
                const y = 180 - (((Number(point.value || 0) - min) / spread) * 150);

                return {
                    x,
                    y,
                    date: point.date,
                    label: point.label || point.date || 'Período',
                    value: Number(point.value || 0),
                    benchmarks: {
                        cdi: Number(point.benchmarks?.cdi || 0),
                        selic: Number(point.benchmarks?.selic || 0),
                        ibov: Number(point.benchmarks?.ibov || 0),
                        ifix: Number(point.benchmarks?.ifix || 0),
                    },
                };
            });

            const lineD = buildCurvePath(state.chartPoints);
            chartLine.setAttribute('d', lineD);
            chartArea.setAttribute('d', `${lineD} L800,200 L0,200 Z`);

            Object.entries(benchmarkPaths).forEach(([benchId, pathElement]) => {
                const benchmarkPoints = state.chartPoints.map((point) => ({
                    x: point.x,
                    y: 180 - (((point.benchmarks[benchId] - min) / spread) * 150),
                }));

                pathElement.setAttribute('d', buildCurvePath(benchmarkPoints));
                if (state.activeBenchmarkIds.includes(benchId)) {
                    pathElement.classList.add('active');
                } else {
                    pathElement.classList.remove('active');
                }
            });
        }

        function renderBenchmarks(viewData) {
            const items = Array.isArray(viewData.benchmarks) ? viewData.benchmarks : [];
            benchmarksSummary.innerHTML = items.map((item) => `
                <div class="bench-item ${item.id}">
                    <span class="bench-label">${item.name}</span>
                    <span class="bench-val">${item.value}</span>
                </div>
            `).join('');

            state.activeBenchmarkIds = items.map((item) => item.id).filter(Boolean);
        }

        function renderDetails(viewData) {
            const details = normalizeDetails(viewData.details);
            const buildSection = (title, rows) => {
                if (!rows.length) return '';

                const htmlRows = rows.map((row) => `
                    <div class="asset-row" data-view="${row.id || ''}">
                        <div class="asset-info">
                            <span class="asset-name">${row.name || '—'}</span>
                            <span class="asset-meta">${row.meta || ''}</span>
                        </div>
                        <div class="asset-value">
                            <div>${row.value || '—'}</div>
                            <div style="font-size:0.7rem;color:#9A908A;">${row.varText || ''}</div>
                        </div>
                    </div>
                `).join('');

                return `<div><span class="label" style="opacity:0.7;display:block;margin-bottom:6px;">${title}</span>${htmlRows}</div>`;
            };

            const leftTitle = state.currentView === 'total' ? 'Renda Variável' : 'Ativos';
            const rightTitle = state.currentView === 'total' ? 'Renda Fixa' : 'Detalhes';
            detailsGrid.innerHTML = `${buildSection(leftTitle, details.left)}${buildSection(rightTitle, details.right)}`;
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
            mainVariation.classList.toggle('negative', parsePercentText(viewData.variation) < 0 || String(viewData.variation || '').includes('-'));
            backNav.style.display = viewId === 'total' ? 'none' : 'flex';

            renderBenchmarks(viewData);
            setChartData();
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

                let tooltipHtml = `<div style="font-weight:700;color:#D4AF37;margin-bottom:4px;">Portfólio (${nearest.label}): ${nearest.value.toFixed(2).replace('.', ',')}%</div>`;

                state.activeBenchmarkIds.forEach((benchmarkId) => {
                    const benchmarkValue = nearest.benchmarks[benchmarkId];
                    const colorMap = {
                        cdi: 'rgba(255,255,255,0.85)',
                        selic: '#8BA888',
                        ibov: '#D4AF37',
                        ifix: '#D97757',
                    };

                    const labelMap = {
                        cdi: 'CDI',
                        selic: 'Selic',
                        ibov: 'Ibovespa',
                        ifix: 'IFIX',
                    };

                    tooltipHtml += `<div style="font-size:0.7rem;color:${colorMap[benchmarkId]};opacity:0.95;">${labelMap[benchmarkId]}: ${benchmarkValue.toFixed(2).replace('.', ',')}%</div>`;
                });

                chartTooltip.innerHTML = tooltipHtml;
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
                const previousView = state.navigationHistory[state.navigationHistory.length - 1];
                updateView(previousView, true);
            }
        });

        shadowRoot.querySelectorAll('.filter-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const siblings = button.parentElement.querySelectorAll('.filter-btn');
                siblings.forEach((item) => item.classList.remove('active'));
                button.classList.add('active');

                if (button.hasAttribute('data-period')) {
                    const periodPreset = button.getAttribute('data-period');
                    fetchAndRenderLiveData({ periodPreset }).catch(() => {});
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
            updateView(root);
            scaleToContainer();
        }

        function applyCardResponse(cardResponse) {
            const widgetModel = extractWidgetModelFromCardResponse(cardResponse);
            applyModel(widgetModel);
            return widgetModel;
        }

        async function fetchAndRenderLiveData(filterOverrides = {}) {
            state.activeFilters = {
                ...state.activeFilters,
                ...filterOverrides,
            };

            const response = await window.YieldInvestments.api.queryCards(
                [
                    {
                        cardId: 'card-rentabilidade-consolidada',
                        title: 'Rentabilidade Consolidada',
                        presentation: 'chart',
                        metricIds: ['investments.profitability'],
                    },
                ],
                state.activeFilters
            );

            applyCardResponse(response);
            return response;
        }

        applyModel(normalizeWidgetModel(null));

        return {
            applyModel,
            applyCardResponse,
            fetchAndRenderLiveData,
            getCurrentModel() {
                return toDeepClone(state.model);
            },
        };
    }

    window.YieldInvestmentsRentabilidade = {
        createRentabilidadeCardController,
        normalizeWidgetModel,
    };
})();
