(function initResultadoModule() {

    const EMPTY_WIDGET_MODEL = {
        rootView: 'total',
        period: {
            preset: 'mtd',
            start: null,
            end: null,
            label: 'MTD',
        },
        resultType: 'both',
        taxes: {
            configured: false,
            warning: '',
        },
        chart: {
            kind: 'waterfall',
            points: [],
        },
        views: {
            total: {
                title: 'Resultado Financeiro',
                subtitle: 'Geração de valor no período',
                label: 'Resultado Bruto',
                value: 'R$ 0,00',
                valueClass: 'neutral',
                roiNominal: 'ROI Nominal: 0,00%',
                roiReal: 'ROI Real: 0,00%',
                netLabel: 'Resultado Líquido (Est.)',
                netValue: 'R$ 0,00',
                netDescription: 'Após impostos e taxas',
                warning: '',
                dividendsLabel: 'Proventos (Div/JCP)',
                dividendsValue: 'R$ 0,00',
                realizedLabel: 'Realizado (Caixa)',
                realizedValue: 'R$ 0,00',
                realizedShare: '0,0%',
                unrealizedLabel: 'Não Realizado (Papel)',
                unrealizedValue: 'R$ 0,00',
                unrealizedShare: '0,0%',
                chart: {
                    kind: 'waterfall',
                    points: [],
                },
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

    function normalizeView(view) {
        const fallback = EMPTY_WIDGET_MODEL.views.total;
        return {
            title: view?.title || fallback.title,
            subtitle: view?.subtitle || fallback.subtitle,
            label: view?.label || fallback.label,
            value: view?.value || fallback.value,
            valueClass: view?.valueClass || fallback.valueClass,
            roiNominal: view?.roiNominal || fallback.roiNominal,
            roiReal: view?.roiReal || fallback.roiReal,
            netLabel: view?.netLabel || fallback.netLabel,
            netValue: view?.netValue || fallback.netValue,
            netDescription: view?.netDescription || fallback.netDescription,
            warning: view?.warning || '',
            dividendsLabel: view?.dividendsLabel || fallback.dividendsLabel,
            dividendsValue: view?.dividendsValue || fallback.dividendsValue,
            realizedLabel: view?.realizedLabel || fallback.realizedLabel,
            realizedValue: view?.realizedValue || fallback.realizedValue,
            realizedShare: view?.realizedShare || fallback.realizedShare,
            unrealizedLabel: view?.unrealizedLabel || fallback.unrealizedLabel,
            unrealizedValue: view?.unrealizedValue || fallback.unrealizedValue,
            unrealizedShare: view?.unrealizedShare || fallback.unrealizedShare,
            chart: {
                kind: view?.chart?.kind || 'waterfall',
                points: Array.isArray(view?.chart?.points) ? view.chart.points : [],
            },
            details: normalizeDetails(view?.details),
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
            resultType: typeof rawModel.resultType === 'string' ? rawModel.resultType : base.resultType,
            taxes: {
                ...base.taxes,
                ...(rawModel.taxes || {}),
            },
            chart: {
                kind: rawModel.chart?.kind || base.chart.kind,
                points: Array.isArray(rawModel.chart?.points) ? rawModel.chart.points : [],
            },
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
        const targetCard = cards.find((card) => card.cardId === 'card-resultado-financeiro') || cards[0] || null;
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

    function buildResultadoWidgetTemplate() {
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
                    margin-bottom: 16px;
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
                    margin-bottom: 12px;
                }

                .kpi-row-secondary {
                    grid-column: 1 / -1;
                    display: flex;
                    gap: 16px;
                    margin-top: 2px;
                    padding-top: 12px;
                    border-top: 1px solid rgba(255, 230, 200, 0.08);
                }

                .kpi-mini {
                    flex: 1;
                }

                .label {
                    font-size: 0.65rem;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: #9A908A;
                    margin-bottom: 4px;
                }

                .main-value {
                    font-size: 1.75rem;
                    font-weight: 300;
                    color: #EAE5E0;
                    line-height: 1;
                }

                .main-value.positive,
                .val-main.positive {
                    color: #8BA888;
                }

                .main-value.negative,
                .val-main.negative {
                    color: #D97757;
                }

                .sub-value {
                    font-size: 1.2rem;
                    color: #EAE5E0;
                    font-weight: 400;
                }

                .net-extra-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    margin-top: 6px;
                }

                .proventos-chip {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255, 230, 200, 0.08);
                    border-radius: 8px;
                    padding: 5px 8px;
                }

                .proventos-label {
                    font-size: 0.58rem;
                    text-transform: uppercase;
                    color: #9A908A;
                    letter-spacing: 0.06em;
                    line-height: 1.1;
                }

                .proventos-value {
                    font-size: 0.8rem;
                    color: #D4AF37;
                    font-weight: 600;
                    margin-top: 2px;
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
                    background: rgba(255,255,255,0.06);
                    color: #9A908A;
                }

                .roi-line {
                    font-size: 0.72rem;
                    color: #9A908A;
                    margin-top: 4px;
                }

                .chart-container {
                    width: 100%;
                    height: 138px;
                    position: relative;
                    margin-top: 2px;
                    margin-bottom: 10px;
                }

                svg {
                    width: 100%;
                    height: 100%;
                    overflow: visible;
                }

                .bar-positive { fill: #8BA888; opacity: 0.85; }
                .bar-negative { fill: #D97757; opacity: 0.85; }
                .bar-total { fill: #D4AF37; opacity: 0.9; }

                .bar-positive:hover, .bar-negative:hover, .bar-total:hover { opacity: 1; cursor: pointer; }

                .connector-line {
                    stroke: rgba(255, 255, 255, 0.15);
                    stroke-width: 1;
                    stroke-dasharray: 2;
                }

                .axis-label {
                    font-size: 0.6rem;
                    fill: #9A908A;
                    text-anchor: middle;
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
                .asset-meta { font-size: 0.7rem; color: #9A908A; }

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

                @media (max-width: 840px) {
                    .kpi-section { grid-template-columns: 1fr; }
                    .kpi-row-secondary { flex-direction: column; gap: 12px; }
                }
            </style>

            <div class="widget-card">
                <div class="left-side">
                    <div class="header">
                        <div>
                            <div id="backNav">←</div>
                            <h2 id="cardTitle">Resultado Financeiro</h2>
                            <div class="subtitle" id="cardSubtitle">Geração de valor no período</div>
                        </div>

                        <div class="filters">
                            <div class="filter-group">
                                <button class="filter-btn active" data-period="mtd">MTD</button>
                                <button class="filter-btn" data-period="ytd">YTD</button>
                                <button class="filter-btn" data-period="12m">12M</button>
                                <button class="filter-btn" data-period="origin">Origem</button>
                            </div>
                            <div class="filter-group">
                                <button class="filter-btn active" data-result-type="both">Ambos</button>
                                <button class="filter-btn" data-result-type="realized">Realizado</button>
                                <button class="filter-btn" data-result-type="unrealized">Não Realizado</button>
                            </div>
                        </div>
                    </div>

                    <div class="kpi-section">
                        <div class="kpi-box">
                            <span class="label" id="mainLabel">Resultado Bruto</span>
                            <div class="main-value" id="mainValue">R$ 0,00</div>
                            <div class="roi-line" id="roiNominal">ROI Nominal: 0,00%</div>
                            <div class="roi-line" id="roiReal">ROI Real: 0,00%</div>
                        </div>
                        <div class="kpi-box" style="border-left: 1px solid rgba(255, 230, 200, 0.08); padding-left: 14px;">
                            <span class="label" id="netLabel">Resultado Líquido (Est.)</span>
                            <div class="sub-value" id="netValue">R$ 0,00</div>
                            <div class="net-extra-row">
                                <div class="subtitle" id="netDescription">Após impostos e taxas</div>
                                <div class="proventos-chip">
                                    <span class="proventos-label" id="dividendsLabel">Proventos (Div/JCP)</span>
                                    <span class="proventos-value" id="dividendsValue">R$ 0,00</span>
                                </div>
                            </div>
                        </div>

                        <div class="kpi-row-secondary">
                            <div class="kpi-mini">
                                <span class="label" id="realizedLabel">Realizado (Caixa)</span>
                                <div class="mini-value" id="realizedValue">R$ 0,00 <span class="variation-pill" id="realizedShare">0,0%</span></div>
                            </div>
                            <div class="kpi-mini">
                                <span class="label" id="unrealizedLabel">Não Realizado (Papel)</span>
                                <div class="mini-value" id="unrealizedValue">R$ 0,00 <span class="variation-pill" id="unrealizedShare">0,0%</span></div>
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

    function createResultadoCardController(slotElement) {
        if (!slotElement) return null;

        const BASE_WIDTH = 880;
        const BASE_HEIGHT = 430;
        const shell = document.createElement('div');
        shell.className = 'resultado-widget-shell';
        shell.style.width = `${BASE_WIDTH}px`;
        shell.style.height = `${BASE_HEIGHT}px`;

        slotElement.innerHTML = '';
        slotElement.appendChild(shell);

        const shadowRoot = shell.attachShadow({ mode: 'open' });
        shadowRoot.innerHTML = buildResultadoWidgetTemplate();

        const widgetCard = shadowRoot.querySelector('.widget-card');
        const backNav = shadowRoot.getElementById('backNav');
        const cardTitle = shadowRoot.getElementById('cardTitle');
        const cardSubtitle = shadowRoot.getElementById('cardSubtitle');
        const mainLabel = shadowRoot.getElementById('mainLabel');
        const mainValue = shadowRoot.getElementById('mainValue');
        const roiNominal = shadowRoot.getElementById('roiNominal');
        const roiReal = shadowRoot.getElementById('roiReal');
        const netLabel = shadowRoot.getElementById('netLabel');
        const netValue = shadowRoot.getElementById('netValue');
        const netDescription = shadowRoot.getElementById('netDescription');
        const dividendsLabel = shadowRoot.getElementById('dividendsLabel');
        const dividendsValue = shadowRoot.getElementById('dividendsValue');
        const realizedLabel = shadowRoot.getElementById('realizedLabel');
        const realizedValue = shadowRoot.getElementById('realizedValue');
        const realizedShare = shadowRoot.getElementById('realizedShare');
        const unrealizedLabel = shadowRoot.getElementById('unrealizedLabel');
        const unrealizedValue = shadowRoot.getElementById('unrealizedValue');
        const unrealizedShare = shadowRoot.getElementById('unrealizedShare');
        const detailsGrid = shadowRoot.getElementById('detailsGrid');
        const chartSvg = shadowRoot.getElementById('chartSvg');
        const chartContainer = shadowRoot.getElementById('chartContainer');
        const chartTooltip = shadowRoot.getElementById('chartTooltip');

        const state = {
            model: normalizeWidgetModel(null),
            currentView: 'total',
            navigationHistory: ['total'],
            activeFilters: {
                periodPreset: 'mtd',
                resultType: 'both',
                currencies: ['BRL'],
            },
            renderedBars: [],
        };

        function scaleToContainer() {
            const widthRatio = slotElement.clientWidth / BASE_WIDTH;
            const heightRatio = slotElement.clientHeight / BASE_HEIGHT;
            const scale = Math.max(0.7, Math.min(widthRatio, heightRatio));
            shell.style.transform = `scale(${scale})`;
        }

        function parseMoneyText(value) {
            const text = String(value || '').replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.');
            const parsed = Number(text);
            return Number.isFinite(parsed) ? parsed : 0;
        }

        function colorClassByValue(value) {
            if (value > 0) return 'positive';
            if (value < 0) return 'negative';
            return 'neutral';
        }

        function renderWaterfall(chartPoints = []) {
            const points = Array.isArray(chartPoints) ? chartPoints : [];
            chartSvg.innerHTML = '';
            state.renderedBars = [];

            const svgWidth = 800;
            const svgHeight = 200;
            const margin = { top: 24, bottom: 36, left: 18, right: 18 };
            const availableWidth = svgWidth - margin.left - margin.right;

            if (!points.length) {
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', '400');
                text.setAttribute('y', '100');
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', '#9A908A');
                text.setAttribute('font-size', '11');
                text.textContent = 'Sem dados para o período';
                chartSvg.appendChild(text);
                return;
            }

            const barCount = points.length + 1;
            const unit = availableWidth / barCount;
            const barWidth = Math.max(30, unit * 0.62);
            const gap = unit - barWidth;

            let running = 0;
            let max = 0;
            let min = 0;

            points.forEach((point) => {
                running += Number(point.value || 0);
                max = Math.max(max, running);
                min = Math.min(min, running);
            });

            max = Math.max(max, running, 0);
            min = Math.min(min, running, 0);
            const range = Math.max(1, max - min);
            const chartHeight = svgHeight - margin.top - margin.bottom;
            const zeroY = margin.top + ((max / range) * chartHeight);
            const scaleY = (value) => (Math.abs(value) / range) * chartHeight;

            const zeroLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            zeroLine.setAttribute('x1', '0');
            zeroLine.setAttribute('x2', String(svgWidth));
            zeroLine.setAttribute('y1', String(zeroY));
            zeroLine.setAttribute('y2', String(zeroY));
            zeroLine.setAttribute('stroke', 'rgba(255,255,255,0.1)');
            zeroLine.setAttribute('stroke-width', '1');
            chartSvg.appendChild(zeroLine);

            running = 0;
            let xPos = margin.left;

            const createLabel = (x, y, label) => {
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', String(x));
                text.setAttribute('y', String(y));
                text.setAttribute('class', 'axis-label');
                text.textContent = label;
                chartSvg.appendChild(text);
            };

            points.forEach((point, index) => {
                const value = Number(point.value || 0);
                const height = scaleY(value);
                const y = value >= 0
                    ? zeroY - ((running + value - min) / range) * chartHeight
                    : zeroY - ((running - min) / range) * chartHeight;

                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', String(xPos));
                rect.setAttribute('y', String(y));
                rect.setAttribute('width', String(barWidth));
                rect.setAttribute('height', String(height));
                rect.setAttribute('rx', '4');
                rect.setAttribute('class', value >= 0 ? 'bar-positive' : 'bar-negative');
                chartSvg.appendChild(rect);

                state.renderedBars.push({
                    x: xPos + (barWidth / 2),
                    y,
                    label: point.label || 'Item',
                    value,
                });

                if (index < points.length - 1) {
                    const connectorY = value >= 0 ? y : (y + height);
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', String(xPos + barWidth));
                    line.setAttribute('x2', String(xPos + barWidth + gap));
                    line.setAttribute('y1', String(connectorY));
                    line.setAttribute('y2', String(connectorY));
                    line.setAttribute('class', 'connector-line');
                    chartSvg.appendChild(line);
                }

                createLabel(xPos + (barWidth / 2), svgHeight - 12, point.label || 'Item');

                running += value;
                xPos += barWidth + gap;
            });

            const totalHeight = scaleY(running);
            const totalY = running >= 0 ? zeroY - totalHeight : zeroY;

            const totalRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            totalRect.setAttribute('x', String(xPos));
            totalRect.setAttribute('y', String(totalY));
            totalRect.setAttribute('width', String(barWidth));
            totalRect.setAttribute('height', String(totalHeight));
            totalRect.setAttribute('rx', '4');
            totalRect.setAttribute('class', 'bar-total');
            chartSvg.appendChild(totalRect);

            state.renderedBars.push({
                x: xPos + (barWidth / 2),
                y: totalY,
                label: 'Total',
                value: running,
            });

            createLabel(xPos + (barWidth / 2), svgHeight - 12, 'Total');
        }

        function showTooltip(label, value, x, y) {
            chartTooltip.style.display = 'block';
            chartTooltip.style.left = `${x}px`;
            chartTooltip.style.top = `${y}px`;
            chartTooltip.innerHTML = `
                <div style="color:#9A908A;font-size:0.68rem;">${label}</div>
                <div style="font-weight:700;color:${value >= 0 ? '#8BA888' : '#D97757'};">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}</div>
            `;
        }

        function hideTooltip() {
            chartTooltip.style.display = 'none';
        }

        function bindChartTooltip() {
            chartContainer.addEventListener('mousemove', (event) => {
                if (!state.renderedBars.length) return;

                const rect = chartContainer.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const svgX = (x / rect.width) * 800;

                let nearest = state.renderedBars[0];
                state.renderedBars.forEach((candidate) => {
                    if (Math.abs(candidate.x - svgX) < Math.abs(nearest.x - svgX)) {
                        nearest = candidate;
                    }
                });

                const y = (nearest.y / 200) * rect.height;
                showTooltip(nearest.label, nearest.value, x, y);
            });

            chartContainer.addEventListener('mouseleave', hideTooltip);
        }

        function renderDetails(viewData) {
            const details = normalizeDetails(viewData.details);
            const rows = [...details.left, ...details.right];

            detailsGrid.innerHTML = rows.map((row) => {
                const rawValue = parseMoneyText(row.value);
                const valueClass = colorClassByValue(rawValue);
                return `
                    <div class="asset-row" data-view="${row.id || ''}">
                        <div class="asset-info">
                            <span class="asset-name">${row.name || '—'}</span>
                            <span class="asset-meta">${row.meta || ''}</span>
                        </div>
                        <div class="asset-value">
                            <div class="val-main ${valueClass}">${row.value || '—'}</div>
                            <div class="val-sub">${row.varText || ''}</div>
                        </div>
                    </div>
                `;
            }).join('');
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
            mainValue.className = `main-value ${viewData.valueClass || colorClassByValue(parseMoneyText(viewData.value))}`;
            roiNominal.textContent = viewData.roiNominal;
            roiReal.textContent = viewData.roiReal;
            netLabel.textContent = viewData.netLabel;
            netValue.textContent = viewData.netValue;
            netDescription.textContent = viewData.netDescription;
            dividendsLabel.textContent = viewData.dividendsLabel;
            dividendsValue.textContent = viewData.dividendsValue;
            realizedLabel.textContent = viewData.realizedLabel;
            realizedValue.innerHTML = `${viewData.realizedValue} <span class="variation-pill">${viewData.realizedShare}</span>`;
            unrealizedLabel.textContent = viewData.unrealizedLabel;
            unrealizedValue.innerHTML = `${viewData.unrealizedValue} <span class="variation-pill">${viewData.unrealizedShare}</span>`;

            backNav.style.display = viewId === 'total' ? 'none' : 'flex';

            const chartPoints = Array.isArray(viewData.chart?.points) ? viewData.chart.points : [];
            renderWaterfall(chartPoints);
            renderDetails(viewData);
            attachRowListeners();

            widgetCard.style.opacity = '1';
            widgetCard.style.transform = 'translateY(0)';
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

                if (button.hasAttribute('data-result-type')) {
                    const resultType = button.getAttribute('data-result-type');
                    fetchAndRenderLiveData({ resultType }).catch(() => {});
                }
            });
        });

        bindChartTooltip();
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
                        cardId: 'card-resultado-financeiro',
                        title: 'Resultado Financeiro',
                        presentation: 'chart',
                        metricIds: ['investments.financial_result'],
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

    window.YieldInvestmentsResultado = {
        createResultadoCardController,
        normalizeWidgetModel,
    };
})();
