(function initVolatilidadeModule() {
    const EMPTY_WIDGET_MODEL = {
        rootView: 'total',
        period: {
            preset: 'origin',
            start: null,
            end: null,
            label: 'Origem',
        },
        scope: 'consolidated',
        benchmark: 'ibov',
        views: {
            total: {
                title: 'Volatilidade Anualizada',
                subtitle: 'Oscilação e risco do portfólio',
                mainLabel: 'Volatilidade (Portfólio)',
                mainValue: '0,00%',
                mainSub: 'Desvio padrão anual.',
                secondaryLabel: 'Volatilidade (Benchmark)',
                secondaryValue: '0,00%',
                secondarySub: 'IBOV',
                drawdownValue: '0,00%',
                drawdownPill: 'Risco Baixo',
                sharpeValue: '0,00',
                sharpePill: 'Ruim',
                betaValue: '0,00',
                betaPill: 'Neutro',
                chartData: [],
                details: [],
            },
        },
    };

    function toDeepClone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeView(view) {
        const fallback = EMPTY_WIDGET_MODEL.views.total;
        const details = Array.isArray(view?.details) ? view.details : [];
        const chartData = Array.isArray(view?.chartData) ? view.chartData : [];

        return {
            title: view?.title || fallback.title,
            subtitle: view?.subtitle || fallback.subtitle,
            mainLabel: view?.mainLabel || fallback.mainLabel,
            mainValue: view?.mainValue || fallback.mainValue,
            mainSub: view?.mainSub || fallback.mainSub,
            secondaryLabel: view?.secondaryLabel || fallback.secondaryLabel,
            secondaryValue: view?.secondaryValue || fallback.secondaryValue,
            secondarySub: view?.secondarySub || fallback.secondarySub,
            drawdownValue: view?.drawdownValue || fallback.drawdownValue,
            drawdownPill: view?.drawdownPill || fallback.drawdownPill,
            sharpeValue: view?.sharpeValue || fallback.sharpeValue,
            sharpePill: view?.sharpePill || fallback.sharpePill,
            betaValue: view?.betaValue || fallback.betaValue,
            betaPill: view?.betaPill || fallback.betaPill,
            chartData,
            details,
        };
    }

    function normalizeWidgetModel(rawModel) {
        const base = toDeepClone(EMPTY_WIDGET_MODEL);
        if (!rawModel || typeof rawModel !== 'object') return base;

        const merged = {
            rootView: typeof rawModel.rootView === 'string' ? rawModel.rootView : base.rootView,
            period: {
                ...base.period,
                ...(rawModel.period || {}),
            },
            scope: String(rawModel.scope || base.scope),
            benchmark: String(rawModel.benchmark || base.benchmark),
            views: {},
        };

        const sourceViews = rawModel.views && typeof rawModel.views === 'object'
            ? rawModel.views
            : base.views;

        Object.entries(sourceViews).forEach(([viewId, view]) => {
            merged.views[viewId] = normalizeView(view);
        });

        if (!merged.views.total) {
            merged.views.total = normalizeView(base.views.total);
        }

        return merged;
    }

    function extractWidgetModelFromCardResponse(responsePayload) {
        const cards = Array.isArray(responsePayload?.cards) ? responsePayload.cards : [];
        const targetCard = cards.find((card) => card.cardId === 'card-volatilidade-anualizada') || cards[0] || null;
        const metrics = Array.isArray(targetCard?.metrics) ? targetCard.metrics : [];
        const metricWithData = metrics.find((metric) => metric?.status === 'ok' && metric?.data);
        const metricData = metricWithData?.data || null;

        if (!metricData) return normalizeWidgetModel(null);
        if (metricData.widget) return normalizeWidgetModel(metricData.widget);
        if (metricData.views) return normalizeWidgetModel(metricData);

        return normalizeWidgetModel(null);
    }

    function buildVolatilidadeWidgetTemplate() {
        return `
            <style>
                :host {
                    all: initial;
                    font-family: 'Inter', sans-serif;
                }

                .widget-card {
                    display: flex;
                    flex-direction: row;
                    width: 880px;
                    height: 430px;
                    background: rgba(40, 35, 30, 0.4);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 230, 200, 0.08);
                    border-radius: 20px;
                    box-shadow: 0 15px 30px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.03);
                    overflow: hidden;
                    color: #EAE5E0;
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
                    border-left: 0.5px solid rgba(212, 175, 55, 0.11);
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
                    gap: 12px;
                    flex-wrap: wrap;
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
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    margin-bottom: 16px;
                }

                .kpi-row-secondary {
                    grid-column: 1 / -1;
                    display: flex;
                    gap: 16px;
                    margin-top: 4px;
                    padding-top: 12px;
                    border-top: 1px solid rgba(255, 230, 200, 0.08);
                }

                .kpi-mini { flex: 1; }

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

                .sub-value {
                    font-size: 1.2rem;
                    color: #EAE5E0;
                    font-weight: 400;
                }

                .mini-value {
                    font-size: 0.95rem;
                    color: #EAE5E0;
                    font-weight: 600;
                }

                .variation-pill {
                    display: inline-flex;
                    font-size: 0.7rem;
                    padding: 2px 6px;
                    border-radius: 4px;
                    margin-left: 6px;
                    background: rgba(255,255,255,0.05);
                    color: #9A908A;
                }

                .variation-pill.negative {
                    background: rgba(217, 119, 87, 0.12);
                    color: #D97757;
                }

                .variation-pill.positive {
                    background: rgba(139, 168, 136, 0.12);
                    color: #8BA888;
                }

                .chart-container {
                    width: 100%;
                    height: 160px;
                    position: relative;
                    margin-bottom: 12px;
                    cursor: crosshair;
                    flex: 1;
                    min-height: 130px;
                }

                svg {
                    width: 100%;
                    height: 100%;
                    overflow: visible;
                }

                .band-path {
                    fill: rgba(212, 175, 55, 0.12);
                }

                .line-path {
                    fill: none;
                    stroke: #D4AF37;
                    stroke-width: 2;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                    filter: drop-shadow(0 0 4px rgba(212, 175, 55, 0.22));
                }

                .bench-path {
                    fill: none;
                    stroke: rgba(255, 255, 255, 0.30);
                    stroke-width: 1.5;
                    stroke-dasharray: 4, 4;
                    stroke-linecap: round;
                }

                .interactive-line {
                    stroke: rgba(255, 255, 255, 0.2);
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
                    gap: 10px;
                    flex: 1;
                    overflow-y: auto;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(212,175,55,0.4) transparent;
                }

                .asset-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 12px;
                    background: rgba(255, 255, 255, 0.02);
                    border-radius: 8px;
                    border: 1px solid transparent;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .asset-row:hover {
                    background: rgba(255, 255, 255, 0.04);
                    border-color: rgba(255, 230, 200, 0.08);
                }

                .asset-info { display: flex; flex-direction: column; }
                .asset-name { font-weight: 600; font-size: 0.85rem; color: #EAE5E0; }
                .asset-meta { font-size: 0.7rem; color: #9A908A; display: flex; align-items: center; gap: 6px; }

                .status-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    display: inline-block;
                    background-color: #D4AF37;
                }

                .asset-value { text-align: right; }
                .val-main { font-size: 0.9rem; font-weight: 600; color: #EAE5E0; }
                .val-sub { font-size: 0.7rem; color: #9A908A; }

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
                            <h2 id="cardTitle">Volatilidade Anualizada</h2>
                            <div class="subtitle" id="cardSubtitle">Oscilação e risco do portfólio</div>
                        </div>

                        <div class="filters">
                            <div class="filter-group">
                                <button class="filter-btn" data-period="mtd">MTD</button>
                                <button class="filter-btn" data-period="ytd">YTD</button>
                                <button class="filter-btn" data-period="12m">12M</button>
                                <button class="filter-btn active" data-period="origin">Origem</button>
                            </div>
                            <div class="filter-group">
                                <button class="filter-btn active" data-scope="consolidated">Consol.</button>
                                <button class="filter-btn" data-scope="classes">Classes</button>
                            </div>
                            <div class="filter-group">
                                <button class="filter-btn active" data-benchmark="ibov">vs IBOV</button>
                                <button class="filter-btn" data-benchmark="cdi">vs CDI</button>
                            </div>
                        </div>
                    </div>

                    <div class="kpi-section">
                        <div class="kpi-box">
                            <span class="label" id="mainLabel">Volatilidade (Portfólio)</span>
                            <div class="main-value" id="mainValue">0,00%</div>
                            <div class="subtitle" id="mainSub">Desvio padrão anual.</div>
                        </div>
                        <div class="kpi-box" style="border-left: 1px solid rgba(255, 230, 200, 0.08); padding-left: 20px;">
                            <span class="label" id="secondaryLabel">Volatilidade (Benchmark)</span>
                            <div class="sub-value" id="benchValue">0,00%</div>
                            <div class="subtitle" id="benchSub">IBOV</div>
                        </div>

                        <div class="kpi-row-secondary">
                            <div class="kpi-mini">
                                <span class="label">Máximo Drawdown</span>
                                <div class="mini-value" id="drawdownValue">0,00% <span class="variation-pill" id="drawdownPill">Risco Baixo</span></div>
                            </div>
                            <div class="kpi-mini">
                                <span class="label">Índice Sharpe</span>
                                <div class="mini-value" id="sharpeValue">0,00 <span class="variation-pill" id="sharpePill">Ruim</span></div>
                            </div>
                            <div class="kpi-mini">
                                <span class="label">Beta</span>
                                <div class="mini-value" id="betaValue">0,00 <span class="variation-pill" id="betaPill">Neutro</span></div>
                            </div>
                        </div>
                    </div>

                    <div class="chart-container" id="chartContainer">
                        <div class="chart-tooltip" id="chartTooltip"></div>
                        <svg viewBox="0 0 800 200" preserveAspectRatio="none" id="chartSvg"></svg>
                    </div>
                </div>

                <div class="right-side">
                    <div class="details-grid" id="detailsGrid"></div>
                </div>
            </div>
        `;
    }

    function createVolatilidadeCardController(slotElement) {
        if (!slotElement) return null;

        const BASE_WIDTH = 880;
        const BASE_HEIGHT = 430;

        const shell = document.createElement('div');
        shell.className = 'volatilidade-widget-shell';
        shell.style.width = `${BASE_WIDTH}px`;
        shell.style.height = `${BASE_HEIGHT}px`;

        slotElement.innerHTML = '';
        slotElement.appendChild(shell);

        const shadowRoot = shell.attachShadow({ mode: 'open' });
        shadowRoot.innerHTML = buildVolatilidadeWidgetTemplate();

        const widgetCard = shadowRoot.querySelector('.widget-card');
        const backNav = shadowRoot.getElementById('backNav');
        const cardTitle = shadowRoot.getElementById('cardTitle');
        const cardSubtitle = shadowRoot.getElementById('cardSubtitle');
        const mainLabel = shadowRoot.getElementById('mainLabel');
        const mainValue = shadowRoot.getElementById('mainValue');
        const mainSub = shadowRoot.getElementById('mainSub');
        const secondaryLabel = shadowRoot.getElementById('secondaryLabel');
        const benchValue = shadowRoot.getElementById('benchValue');
        const benchSub = shadowRoot.getElementById('benchSub');
        const drawdownValue = shadowRoot.getElementById('drawdownValue');
        const drawdownPill = shadowRoot.getElementById('drawdownPill');
        const sharpeValue = shadowRoot.getElementById('sharpeValue');
        const sharpePill = shadowRoot.getElementById('sharpePill');
        const betaValue = shadowRoot.getElementById('betaValue');
        const betaPill = shadowRoot.getElementById('betaPill');
        const detailsGrid = shadowRoot.getElementById('detailsGrid');
        const chartSvg = shadowRoot.getElementById('chartSvg');
        const chartContainer = shadowRoot.getElementById('chartContainer');
        const chartTooltip = shadowRoot.getElementById('chartTooltip');

        const state = {
            model: normalizeWidgetModel(null),
            currentView: 'total',
            navigationHistory: ['total'],
            currentChartData: [],
            activeFilters: {
                periodPreset: 'origin',
                volatilityScope: 'consolidated',
                volatilityBenchmark: 'ibov',
                currencies: ['BRL'],
            },
        };

        function scaleToContainer() {
            const widthRatio = slotElement.clientWidth / BASE_WIDTH;
            const heightRatio = slotElement.clientHeight / BASE_HEIGHT;
            const scale = Math.max(0.7, Math.min(widthRatio, heightRatio));
            shell.style.transform = `scale(${scale})`;
        }

        function setPillStyle(pillElement, text) {
            const normalized = String(text || '').toLowerCase();
            pillElement.classList.remove('positive', 'negative');

            if (normalized.includes('alto') || normalized.includes('ruim') || normalized.includes('agressivo')) {
                pillElement.classList.add('negative');
                return;
            }

            if (normalized.includes('baixo') || normalized.includes('excelente') || normalized.includes('defensivo')) {
                pillElement.classList.add('positive');
            }
        }

        function buildPath(points) {
            if (!points.length) return '';
            if (points.length === 1) return `M0,${points[0].y} L800,${points[0].y}`;

            const path = [`M${points[0].x},${points[0].y}`];
            for (let index = 1; index < points.length; index += 1) {
                const previous = points[index - 1];
                const current = points[index];
                const controlX = (previous.x + current.x) / 2;
                path.push(`C${controlX},${previous.y} ${controlX},${current.y} ${current.x},${current.y}`);
            }
            return path.join(' ');
        }

        function renderVolatilityChart(chartData = []) {
            const data = Array.isArray(chartData) ? chartData : [];
            state.currentChartData = data;

            if (!data.length) {
                chartSvg.innerHTML = '';
                return;
            }

            const maxValue = Math.max(...data.map((item) => Math.max(Number(item.val || 0) + Number(item.dev || 0), Number(item.bench || 0))));
            const minValue = Math.min(...data.map((item) => Math.min(Number(item.val || 0) - Number(item.dev || 0), Number(item.bench || 0))));
            const spread = Math.max(1, maxValue - minValue);
            const paddedMin = minValue - (spread * 0.1);
            const paddedMax = maxValue + (spread * 0.1);
            const finalSpread = Math.max(1, paddedMax - paddedMin);

            const stepX = data.length <= 1 ? 0 : 800 / (data.length - 1);
            const toY = (value) => 200 - (((Number(value || 0) - paddedMin) / finalSpread) * 200);

            const topPoints = data.map((item, index) => ({ x: index * stepX, y: toY(Number(item.val || 0) + Number(item.dev || 0)) }));
            const bottomPoints = data
                .map((item, index) => ({ x: index * stepX, y: toY(Number(item.val || 0) - Number(item.dev || 0)) }))
                .reverse();
            const linePoints = data.map((item, index) => ({ x: index * stepX, y: toY(item.val) }));
            const benchPoints = data.map((item, index) => ({ x: index * stepX, y: toY(item.bench) }));

            const bandPath = `${buildPath(topPoints)} L${bottomPoints.map((point) => `${point.x},${point.y}`).join(' L')} Z`;
            const linePath = buildPath(linePoints);
            const benchPath = buildPath(benchPoints);

            chartSvg.innerHTML = `
                <path class="band-path" d="${bandPath}"></path>
                <path class="bench-path" d="${benchPath}"></path>
                <path class="line-path" d="${linePath}"></path>
                <line x1="0" y1="0" x2="0" y2="200" class="interactive-line" id="vLine" />
                <circle cx="0" cy="0" r="4" class="chart-dot" id="chartDot" />
            `;
        }

        function renderDetails(viewData) {
            const details = Array.isArray(viewData.details) ? viewData.details : [];

            detailsGrid.innerHTML = details.map((item) => `
                <div class="asset-row" data-view="${item.id || ''}">
                    <div class="asset-info">
                        <span class="asset-name">${item.name || '—'}</span>
                        <div class="asset-meta">
                            <span class="status-dot"></span>
                            ${item.meta || ''}
                        </div>
                    </div>
                    <div class="asset-value">
                        <div class="val-main">${item.val || '—'}</div>
                        <div class="val-sub">${item.sub || ''}</div>
                    </div>
                </div>
            `).join('');

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

            if (!isBack && viewId !== state.navigationHistory[state.navigationHistory.length - 1]) {
                state.navigationHistory.push(viewId);
            }

            state.currentView = viewId;

            cardTitle.textContent = viewData.title;
            cardSubtitle.textContent = viewData.subtitle;
            mainLabel.textContent = viewData.mainLabel;
            mainValue.textContent = viewData.mainValue;
            mainSub.textContent = viewData.mainSub;
            secondaryLabel.textContent = viewData.secondaryLabel;
            benchValue.textContent = viewData.secondaryValue;
            benchSub.textContent = viewData.secondarySub;

            drawdownValue.childNodes[0].nodeValue = `${viewData.drawdownValue} `;
            drawdownPill.textContent = viewData.drawdownPill;
            setPillStyle(drawdownPill, viewData.drawdownPill);

            sharpeValue.childNodes[0].nodeValue = `${viewData.sharpeValue} `;
            sharpePill.textContent = viewData.sharpePill;
            setPillStyle(sharpePill, viewData.sharpePill);

            betaValue.childNodes[0].nodeValue = `${viewData.betaValue} `;
            betaPill.textContent = viewData.betaPill;
            setPillStyle(betaPill, viewData.betaPill);

            backNav.style.display = (viewId === state.model.rootView || viewId === 'total' || viewId === 'classes-root')
                ? 'none'
                : 'flex';

            renderVolatilityChart(viewData.chartData);
            renderDetails(viewData);

            widgetCard.style.opacity = '1';
            widgetCard.style.transform = 'translateY(0)';
        }

        function bindChartInteraction() {
            chartContainer.addEventListener('mousemove', (event) => {
                if (!state.currentChartData.length) return;

                const rect = chartContainer.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const step = rect.width / Math.max(1, state.currentChartData.length - 1);
                let hoverIndex = Math.round(x / step);
                hoverIndex = Math.max(0, Math.min(state.currentChartData.length - 1, hoverIndex));

                const dataPoint = state.currentChartData[hoverIndex];
                const svgX = (hoverIndex / Math.max(1, state.currentChartData.length - 1)) * 800;

                const maxValue = Math.max(...state.currentChartData.map((item) => Math.max(Number(item.val || 0) + Number(item.dev || 0), Number(item.bench || 0))));
                const minValue = Math.min(...state.currentChartData.map((item) => Math.min(Number(item.val || 0) - Number(item.dev || 0), Number(item.bench || 0))));
                const spread = Math.max(1, maxValue - minValue);
                const paddedMin = minValue - (spread * 0.1);
                const finalSpread = Math.max(1, (maxValue + (spread * 0.1)) - paddedMin);
                const svgY = 200 - (((Number(dataPoint.val || 0) - paddedMin) / finalSpread) * 200);

                const vLine = shadowRoot.getElementById('vLine');
                const dot = shadowRoot.getElementById('chartDot');
                if (!vLine || !dot) return;

                vLine.setAttribute('x1', String(svgX));
                vLine.setAttribute('x2', String(svgX));
                vLine.style.display = 'block';

                dot.setAttribute('cx', String(svgX));
                dot.setAttribute('cy', String(svgY));
                dot.style.display = 'block';

                chartTooltip.style.display = 'block';
                chartTooltip.style.left = `${x}px`;
                chartTooltip.style.top = `${(svgY / 200) * rect.height}px`;
                chartTooltip.innerHTML = `
                    <div style="font-size:0.65rem;color:#9A908A;margin-bottom:4px;">${dataPoint.label || dataPoint.date || 'Período'}</div>
                    <div style="font-weight:700;color:#D4AF37;">Portfólio: ${Number(dataPoint.val || 0).toFixed(2).replace('.', ',')}</div>
                    <div style="font-size:0.7rem;color:#9A908A;">Banda: ±${Number(dataPoint.dev || 0).toFixed(2).replace('.', ',')}</div>
                    <div style="font-size:0.7rem;color:rgba(255,255,255,0.6);margin-top:2px;">Benchmark: ${Number(dataPoint.bench || 0).toFixed(2).replace('.', ',')}</div>
                `;
            });

            chartContainer.addEventListener('mouseleave', () => {
                const vLine = shadowRoot.getElementById('vLine');
                const dot = shadowRoot.getElementById('chartDot');
                if (vLine) vLine.style.display = 'none';
                if (dot) dot.style.display = 'none';
                chartTooltip.style.display = 'none';
            });
        }

        function syncFilterButtonsWithModel() {
            shadowRoot.querySelectorAll('[data-period]').forEach((button) => {
                button.classList.toggle('active', button.getAttribute('data-period') === state.activeFilters.periodPreset);
            });

            shadowRoot.querySelectorAll('[data-scope]').forEach((button) => {
                button.classList.toggle('active', button.getAttribute('data-scope') === state.activeFilters.volatilityScope);
            });

            shadowRoot.querySelectorAll('[data-benchmark]').forEach((button) => {
                button.classList.toggle('active', button.getAttribute('data-benchmark') === state.activeFilters.volatilityBenchmark);
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
                if (button.hasAttribute('data-period')) {
                    state.activeFilters.periodPreset = button.getAttribute('data-period') || 'origin';
                }

                if (button.hasAttribute('data-scope')) {
                    state.activeFilters.volatilityScope = button.getAttribute('data-scope') || 'consolidated';
                }

                if (button.hasAttribute('data-benchmark')) {
                    state.activeFilters.volatilityBenchmark = button.getAttribute('data-benchmark') || 'ibov';
                }

                syncFilterButtonsWithModel();
                fetchAndRenderLiveData().catch(() => {});
            });
        });

        bindChartInteraction();
        scaleToContainer();
        window.addEventListener('resize', scaleToContainer);

        function applyModel(widgetModel) {
            state.model = normalizeWidgetModel(widgetModel);
            const root = state.model.rootView || 'total';
            state.navigationHistory = [root];

            if (state.model.scope === 'classes') {
                state.activeFilters.volatilityScope = 'classes';
            }

            if (state.model.benchmark === 'cdi') {
                state.activeFilters.volatilityBenchmark = 'cdi';
            }

            syncFilterButtonsWithModel();
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
                        cardId: 'card-volatilidade-anualizada',
                        title: 'Volatilidade Anualizada',
                        presentation: 'chart',
                        metricIds: ['investments.volatility_annualized'],
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

    window.YieldInvestmentsVolatilidade = {
        createVolatilidadeCardController,
        normalizeWidgetModel,
    };
})();
