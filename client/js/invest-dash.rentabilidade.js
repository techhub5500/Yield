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
        const template = document.getElementById('invest-dash-template-rentabilidade-widget');
        return template ? template.innerHTML : '';
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
            const fragment = document.createDocumentFragment();

            items.forEach((item) => {
                const benchItem = document.createElement('div');
                benchItem.className = `bench-item ${item.id || ''}`.trim();

                const benchLabel = document.createElement('span');
                benchLabel.className = 'bench-label';
                benchLabel.textContent = item.name || 'Benchmark';

                const benchValue = document.createElement('span');
                benchValue.className = 'bench-val';
                benchValue.textContent = item.value || '—';

                benchItem.appendChild(benchLabel);
                benchItem.appendChild(benchValue);
                fragment.appendChild(benchItem);
            });

            benchmarksSummary.replaceChildren(fragment);

            state.activeBenchmarkIds = items.map((item) => item.id).filter(Boolean);
        }

        function renderDetails(viewData) {
            const details = normalizeDetails(viewData.details);
            const fragment = document.createDocumentFragment();

            const appendSection = (title, rows) => {
                if (!rows.length) return;

                const section = document.createElement('div');

                const titleNode = document.createElement('span');
                titleNode.className = 'label detail-section-title';
                titleNode.textContent = title;
                section.appendChild(titleNode);

                rows.forEach((row) => {
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

                    const mainValue = document.createElement('div');
                    mainValue.textContent = row.value || '—';
                    valueWrap.appendChild(mainValue);

                    const subValue = document.createElement('div');
                    subValue.className = 'asset-value-sub';
                    subValue.textContent = row.varText || '';
                    valueWrap.appendChild(subValue);

                    rowNode.appendChild(info);
                    rowNode.appendChild(valueWrap);
                    section.appendChild(rowNode);
                });

                fragment.appendChild(section);
            };

            const leftTitle = state.currentView === 'total' ? 'Renda Variável' : 'Ativos';
            const rightTitle = state.currentView === 'total' ? 'Renda Fixa' : 'Detalhes';
            appendSection(leftTitle, details.left);
            appendSection(rightTitle, details.right);
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

                const tooltipFragment = document.createDocumentFragment();
                const portfolioLine = document.createElement('div');
                portfolioLine.className = 'tooltip-portfolio-line';
                portfolioLine.textContent = `Portfólio (${nearest.label}): ${nearest.value.toFixed(2).replace('.', ',')}%`;
                tooltipFragment.appendChild(portfolioLine);

                state.activeBenchmarkIds.forEach((benchmarkId) => {
                    const benchmarkValue = nearest.benchmarks[benchmarkId];
                    const labelMap = {
                        cdi: 'CDI',
                        selic: 'Selic',
                        ibov: 'Ibovespa',
                        ifix: 'IFIX',
                    };

                    const benchmarkLine = document.createElement('div');
                    benchmarkLine.className = `tooltip-benchmark-line benchmark-${benchmarkId}`;
                    benchmarkLine.textContent = `${labelMap[benchmarkId]}: ${benchmarkValue.toFixed(2).replace('.', ',')}%`;
                    tooltipFragment.appendChild(benchmarkLine);
                });

                chartTooltip.replaceChildren(tooltipFragment);
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
