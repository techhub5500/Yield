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
        const template = document.getElementById('invest-dash-template-resultado-widget');
        return template ? template.innerHTML : '';
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

            const tooltipLabel = document.createElement('div');
            tooltipLabel.className = 'chart-tooltip-label';
            tooltipLabel.textContent = label;

            const tooltipValue = document.createElement('div');
            tooltipValue.className = `chart-tooltip-value ${value >= 0 ? 'positive' : 'negative'}`;
            tooltipValue.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

            chartTooltip.replaceChildren(tooltipLabel, tooltipValue);
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

            const fragment = document.createDocumentFragment();

            rows.forEach((row) => {
                const rawValue = parseMoneyText(row.value);
                const valueClass = colorClassByValue(rawValue);

                const rowNode = document.createElement('div');
                rowNode.className = 'asset-row';
                rowNode.setAttribute('data-view', row.id || '');

                const info = document.createElement('div');
                info.className = 'asset-info';

                const name = document.createElement('span');
                name.className = 'asset-name';
                name.textContent = row.name || '—';
                info.appendChild(name);

                const meta = document.createElement('span');
                meta.className = 'asset-meta';
                meta.textContent = row.meta || '';
                info.appendChild(meta);

                const valueWrap = document.createElement('div');
                valueWrap.className = 'asset-value';

                const valueMain = document.createElement('div');
                valueMain.className = `val-main ${valueClass}`;
                valueMain.textContent = row.value || '—';
                valueWrap.appendChild(valueMain);

                const valueSub = document.createElement('div');
                valueSub.className = 'val-sub';
                valueSub.textContent = row.varText || '';
                valueWrap.appendChild(valueSub);

                rowNode.appendChild(info);
                rowNode.appendChild(valueWrap);
                fragment.appendChild(rowNode);
            });

            detailsGrid.replaceChildren(fragment);
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

            const realizedAmount = document.createElement('span');
            realizedAmount.textContent = viewData.realizedValue || '—';
            const realizedShare = document.createElement('span');
            realizedShare.className = 'variation-pill';
            realizedShare.textContent = viewData.realizedShare || '';
            realizedValue.replaceChildren(realizedAmount, document.createTextNode(' '), realizedShare);

            unrealizedLabel.textContent = viewData.unrealizedLabel;

            const unrealizedAmount = document.createElement('span');
            unrealizedAmount.textContent = viewData.unrealizedValue || '—';
            const unrealizedShare = document.createElement('span');
            unrealizedShare.className = 'variation-pill';
            unrealizedShare.textContent = viewData.unrealizedShare || '';
            unrealizedValue.replaceChildren(unrealizedAmount, document.createTextNode(' '), unrealizedShare);

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
