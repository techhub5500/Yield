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
                tertiaryLabel: 'Realizado (Em caixa)',
                tertiaryValue: '—',
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
                hidden: Boolean(rawModel.chart?.hidden),
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
                tertiaryLabel: view?.tertiaryLabel || '—',
                tertiaryValue: view?.tertiaryValue || '—',
                chart: {
                    currency: view?.chart?.currency || rawModel.chart?.currency || base.chart.currency,
                    hidden: Boolean(view?.chart?.hidden),
                    points: Array.isArray(view?.chart?.points) && view.chart.points.length
                        ? view.chart.points
                        : (Array.isArray(rawModel.chart?.points) && rawModel.chart.points.length
                            ? rawModel.chart.points
                            : base.chart.points),
                },
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
        const template = document.getElementById('invest-dash-template-patrimonio-widget');
        return template ? template.innerHTML : '';
    }

    function createPatrimonioCardController(slotElement) {
        if (!slotElement) return null;

        const BASE_WIDTH = 880;
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
        const tertiaryLabel = shadowRoot.getElementById('tertiaryLabel');
        const tertiaryValue = shadowRoot.getElementById('tertiaryValue');
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
                if (months > 0) {
                    fetchAndRenderLiveData({ periodsMonths: [months] }).catch(() => {});
                    return;
                }

                fetchAndRenderLiveData({ periodsMonths: undefined }).catch(() => {});
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
            const shouldHideChart = Boolean(chartModel?.hidden);
            chartContainer.style.display = shouldHideChart ? 'none' : 'block';
            if (shouldHideChart) {
                state.chartPoints = [];
                chartTooltip.style.display = 'none';
                vLine.style.display = 'none';
                chartDot.style.display = 'none';
                return;
            }

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
            const fragment = document.createDocumentFragment();

            const appendSection = (items, title) => {
                if (!items.length) return;

                const section = document.createElement('div');
                section.className = 'detail-section';

                const sectionTitle = document.createElement('span');
                sectionTitle.className = 'label detail-section-title';
                sectionTitle.textContent = title;
                section.appendChild(sectionTitle);

                items.forEach((item) => {
                    const row = document.createElement('div');
                    row.className = 'asset-row';
                    row.setAttribute('data-view', item.id || '');

                    const info = document.createElement('div');
                    info.className = 'asset-info';

                    const name = document.createElement('span');
                    name.className = 'asset-name';
                    name.textContent = item.name || '—';
                    info.appendChild(name);

                    const meta = document.createElement('span');
                    meta.className = 'asset-meta';
                    meta.textContent = item.meta || '';
                    info.appendChild(meta);

                    const valueWrap = document.createElement('div');
                    valueWrap.className = 'asset-value';

                    const valueMain = document.createElement('div');
                    valueMain.textContent = item.value || '—';
                    valueWrap.appendChild(valueMain);

                    const valueSub = document.createElement('div');
                    valueSub.className = 'asset-value-sub';
                    valueSub.textContent = item.varText || '';
                    valueWrap.appendChild(valueSub);

                    row.appendChild(info);
                    row.appendChild(valueWrap);
                    section.appendChild(row);
                });

                fragment.appendChild(section);
            };

            appendSection(details.left, 'Ativos');
            appendSection(details.right, 'Detalhes');
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
            secondaryLabel.textContent = viewData.secondaryLabel;
            secondaryValue.textContent = viewData.secondaryValue;
            tertiaryLabel.textContent = viewData.tertiaryLabel;
            tertiaryValue.textContent = viewData.tertiaryValue;
            backNav.style.display = viewId === 'total' ? 'none' : 'flex';

            setChartData(viewData.chart || state.model.chart);

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
                const tooltipLabel = document.createElement('div');
                tooltipLabel.className = 'chart-tooltip-label';
                tooltipLabel.textContent = nearest.label;

                const tooltipValue = document.createElement('div');
                tooltipValue.className = 'chart-tooltip-value';
                tooltipValue.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: nearest.currency }).format(nearest.value);

                chartTooltip.replaceChildren(tooltipLabel, tooltipValue);
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

            if (!mergedFilters.periodsMonths || mergedFilters.periodsMonths.length === 0) {
                delete mergedFilters.periodsMonths;
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
