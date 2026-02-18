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
        const template = document.getElementById('invest-dash-template-volatilidade-widget');
        return template ? template.innerHTML : '';
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

            chartSvg.replaceChildren();

            const createSvgElement = (tagName) => document.createElementNS('http://www.w3.org/2000/svg', tagName);

            const band = createSvgElement('path');
            band.setAttribute('class', 'band-path');
            band.setAttribute('d', bandPath);

            const benchmark = createSvgElement('path');
            benchmark.setAttribute('class', 'bench-path');
            benchmark.setAttribute('d', benchPath);

            const line = createSvgElement('path');
            line.setAttribute('class', 'line-path');
            line.setAttribute('d', linePath);

            const verticalLine = createSvgElement('line');
            verticalLine.setAttribute('x1', '0');
            verticalLine.setAttribute('y1', '0');
            verticalLine.setAttribute('x2', '0');
            verticalLine.setAttribute('y2', '200');
            verticalLine.setAttribute('class', 'interactive-line');
            verticalLine.setAttribute('id', 'vLine');

            const dot = createSvgElement('circle');
            dot.setAttribute('cx', '0');
            dot.setAttribute('cy', '0');
            dot.setAttribute('r', '4');
            dot.setAttribute('class', 'chart-dot');
            dot.setAttribute('id', 'chartDot');

            chartSvg.appendChild(band);
            chartSvg.appendChild(benchmark);
            chartSvg.appendChild(line);
            chartSvg.appendChild(verticalLine);
            chartSvg.appendChild(dot);
        }

        function renderDetails(viewData) {
            const details = Array.isArray(viewData.details) ? viewData.details : [];

            const fragment = document.createDocumentFragment();

            details.forEach((item) => {
                const row = document.createElement('div');
                row.className = 'asset-row';
                row.setAttribute('data-view', item.id || '');

                const info = document.createElement('div');
                info.className = 'asset-info';

                const name = document.createElement('span');
                name.className = 'asset-name';
                name.textContent = item.name || '—';
                info.appendChild(name);

                const meta = document.createElement('div');
                meta.className = 'asset-meta';

                const statusDot = document.createElement('span');
                statusDot.className = 'status-dot';
                meta.appendChild(statusDot);
                meta.appendChild(document.createTextNode(item.meta || ''));
                info.appendChild(meta);

                const valueWrap = document.createElement('div');
                valueWrap.className = 'asset-value';

                const valueMain = document.createElement('div');
                valueMain.className = 'val-main';
                valueMain.textContent = item.val || '—';
                valueWrap.appendChild(valueMain);

                const valueSub = document.createElement('div');
                valueSub.className = 'val-sub';
                valueSub.textContent = item.sub || '';
                valueWrap.appendChild(valueSub);

                row.appendChild(info);
                row.appendChild(valueWrap);
                fragment.appendChild(row);
            });

            detailsGrid.replaceChildren(fragment);

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

                const tooltipTitle = document.createElement('div');
                tooltipTitle.className = 'chart-tooltip-title';
                tooltipTitle.textContent = dataPoint.label || dataPoint.date || 'Período';

                const tooltipPortfolio = document.createElement('div');
                tooltipPortfolio.className = 'chart-tooltip-portfolio';
                tooltipPortfolio.textContent = `Portfólio: ${Number(dataPoint.val || 0).toFixed(2).replace('.', ',')}`;

                const tooltipBand = document.createElement('div');
                tooltipBand.className = 'chart-tooltip-band';
                tooltipBand.textContent = `Banda: ±${Number(dataPoint.dev || 0).toFixed(2).replace('.', ',')}`;

                const tooltipBenchmark = document.createElement('div');
                tooltipBenchmark.className = 'chart-tooltip-benchmark';
                tooltipBenchmark.textContent = `Benchmark: ${Number(dataPoint.bench || 0).toFixed(2).replace('.', ',')}`;

                chartTooltip.replaceChildren(tooltipTitle, tooltipPortfolio, tooltipBand, tooltipBenchmark);
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
