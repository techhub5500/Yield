(function initAlocacaoModule() {
    const EMPTY_WIDGET_MODEL = {
        rootView: 'class-root',
        totalPatrimony: 0,
        kpis: {
            class: {
                score: 100,
                aporteRebalance: { amount: 0, basisId: null, basisName: null },
                tradeRebalance: { buyAmount: 0, sellAmount: 0, netAmount: 0 },
            },
            subclass: {
                score: 100,
                aporteRebalance: { amount: 0, basisId: null, basisName: null },
                tradeRebalance: { buyAmount: 0, sellAmount: 0, netAmount: 0 },
            },
            asset: {
                score: 100,
                aporteRebalance: { amount: 0, basisId: null, basisName: null },
                tradeRebalance: { buyAmount: 0, sellAmount: 0, netAmount: 0 },
            },
        },
        nodes: [],
    };

    function toDeepClone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(Number(value || 0));
    }

    function formatSignedPercent(value, digits = 1) {
        const parsed = Number(value || 0);
        const sign = parsed > 0 ? '+' : '';
        return `${sign}${parsed.toFixed(digits).replace('.', ',')}%`;
    }

    function normalizeNode(node) {
        const normalized = {
            id: String(node?.id || ''),
            parentId: node?.parentId || null,
            level: String(node?.level || 'asset'),
            name: String(node?.name || '—'),
            classLabel: String(node?.classLabel || ''),
            subclassLabel: String(node?.subclassLabel || ''),
            ticker: String(node?.ticker || ''),
            currentValue: Number(node?.currentValue || 0),
            targetPct: Number(node?.targetPct || 0),
            marginPct: Number(node?.marginPct || 0),
            realPct: Number(node?.realPct || 0),
            diffPct: Number(node?.diffPct || 0),
            status: String(node?.status || 'on-track'),
            actionLabel: String(node?.actionLabel || 'Manter (0,0%)'),
            adjustmentValue: Number(node?.adjustmentValue || 0),
            hasLossAlert: Boolean(node?.hasLossAlert),
            infoMessage: String(node?.infoMessage || ''),
            realizedResult: Number(node?.realizedResult || 0),
            unrealizedPnl: Number(node?.unrealizedPnl || 0),
            financialResult: Number(node?.financialResult || 0),
            realizedResultClass: String(node?.realizedResultClass || 'neutral'),
            unrealizedPnlClass: String(node?.unrealizedPnlClass || 'neutral'),
            financialResultClass: String(node?.financialResultClass || 'neutral'),
            realizedResultText: String(node?.realizedResultText || formatCurrency(node?.realizedResult || 0)),
            unrealizedPnlText: String(node?.unrealizedPnlText || formatCurrency(node?.unrealizedPnl || 0)),
            financialResultText: String(node?.financialResultText || formatCurrency(node?.financialResult || 0)),
            currentValueText: node?.currentValueText || formatCurrency(node?.currentValue || 0),
            targetPctText: node?.targetPctText || formatSignedPercent(node?.targetPct || 0, 2),
            diffPctText: node?.diffPctText || formatSignedPercent(node?.diffPct || 0, 2),
        };

        return normalized;
    }

    function normalizeWidgetModel(rawModel) {
        const base = toDeepClone(EMPTY_WIDGET_MODEL);
        if (!rawModel || typeof rawModel !== 'object') {
            return base;
        }

        const nodes = Array.isArray(rawModel.nodes)
            ? rawModel.nodes.map(normalizeNode)
            : [];

        const normalizeKpi = (kpi) => ({
            score: Number(kpi?.score ?? 100),
            aporteRebalance: {
                amount: Number(kpi?.aporteRebalance?.amount || 0),
                basisId: kpi?.aporteRebalance?.basisId || null,
                basisName: kpi?.aporteRebalance?.basisName || null,
            },
            tradeRebalance: {
                buyAmount: Number(kpi?.tradeRebalance?.buyAmount || 0),
                sellAmount: Number(kpi?.tradeRebalance?.sellAmount || 0),
                netAmount: Number(kpi?.tradeRebalance?.netAmount || 0),
            },
        });

        return {
            rootView: typeof rawModel.rootView === 'string' ? rawModel.rootView : base.rootView,
            totalPatrimony: Number(rawModel.totalPatrimony || 0),
            kpis: {
                class: normalizeKpi(rawModel.kpis?.class),
                subclass: normalizeKpi(rawModel.kpis?.subclass),
                asset: normalizeKpi(rawModel.kpis?.asset),
            },
            nodes,
        };
    }

    function extractWidgetModelFromCardResponse(responsePayload) {
        const cards = Array.isArray(responsePayload?.cards) ? responsePayload.cards : [];
        const targetCard = cards.find((card) => card.cardId === 'card-alocacao-real-planejada') || cards[0] || null;
        const metrics = Array.isArray(targetCard?.metrics) ? targetCard.metrics : [];
        const metricWithData = metrics.find((metric) => metric?.status === 'ok' && metric?.data);
        const metricData = metricWithData?.data || null;

        if (!metricData) {
            return normalizeWidgetModel(null);
        }

        if (metricData.widget) {
            return normalizeWidgetModel(metricData.widget);
        }

        if (metricData.nodes || metricData.kpis) {
            return normalizeWidgetModel(metricData);
        }

        return normalizeWidgetModel(null);
    }

    function buildAlocacaoWidgetTemplate() {
        const template = document.getElementById('invest-dash-template-alocacao-widget');
        return template ? template.innerHTML : '';
    }

    function createAlocacaoCardController(containerElement) {
        if (!containerElement) return null;

        const host = document.createElement('div');
        containerElement.innerHTML = '';
        containerElement.appendChild(host);

        const shadowRoot = host.attachShadow({ mode: 'open' });
        shadowRoot.innerHTML = buildAlocacaoWidgetTemplate();

        const widgetCard = shadowRoot.querySelector('.widget-card');
        const allocList = shadowRoot.getElementById('allocList');
        const scoreValue = shadowRoot.getElementById('scoreValue');
        const aporteValue = shadowRoot.getElementById('aporteValue');
        const aporteHint = shadowRoot.getElementById('aporteHint');
        const tradeNetValue = shadowRoot.getElementById('tradeNetValue');
        const tradeBuyValue = shadowRoot.getElementById('tradeBuyValue');
        const tradeSellValue = shadowRoot.getElementById('tradeSellValue');
        const cardTitle = shadowRoot.getElementById('cardTitle');
        const cardSubtitle = shadowRoot.getElementById('cardSubtitle');
        const backNav = shadowRoot.getElementById('backNav');

        const state = {
            model: normalizeWidgetModel(null),
            activeFilters: { currencies: ['BRL'] },
            mode: 'class',
            nodesById: new Map(),
            childrenByParent: new Map(),
            stack: ['class-root'],
        };

        function scaleToContainer() {
            const parent = containerElement;
            if (!parent) return;
            const parentWidth = parent.clientWidth || 880;
            const parentHeight = parent.clientHeight || 430;
            const scaleX = parentWidth / 880;
            const scaleY = parentHeight / 430;
            const scale = Math.min(scaleX, scaleY, 1);

            host.style.transformOrigin = 'top left';
            host.style.transform = `scale(${scale})`;
            host.style.width = `${880}px`;
            host.style.height = `${430}px`;
            parent.style.minHeight = `${430 * scale}px`;
        }

        function rebuildIndexes() {
            state.nodesById = new Map();
            state.childrenByParent = new Map();

            state.model.nodes.forEach((node) => {
                state.nodesById.set(node.id, node);

                const key = node.parentId || `${node.level}-root`;
                if (!state.childrenByParent.has(key)) {
                    state.childrenByParent.set(key, []);
                }
                state.childrenByParent.get(key).push(node);
            });

            state.childrenByParent.forEach((rows) => {
                rows.sort((a, b) => Number(b.currentValue || 0) - Number(a.currentValue || 0));
            });
        }

        function getRootForMode(mode) {
            if (mode === 'subclass') return 'subclass-root';
            if (mode === 'asset') return 'asset-root';
            return 'class-root';
        }

        function getCurrentParentKey() {
            const current = state.stack[state.stack.length - 1] || getRootForMode(state.mode);
            if (current.endsWith('-root')) return current;
            return current;
        }

        function getRowsForCurrentView() {
            const key = getCurrentParentKey();
            if (state.childrenByParent.has(key)) {
                return state.childrenByParent.get(key);
            }

            if (key === 'subclass-root') {
                return state.model.nodes
                    .filter((node) => node.level === 'subclass')
                    .sort((a, b) => Number(b.currentValue || 0) - Number(a.currentValue || 0));
            }

            if (key === 'asset-root') {
                return state.model.nodes
                    .filter((node) => node.level === 'asset')
                    .sort((a, b) => Number(b.currentValue || 0) - Number(a.currentValue || 0));
            }

            const root = getRootForMode(state.mode);
            return state.childrenByParent.get(root) || [];
        }

        function resolveViewText() {
            const current = state.stack[state.stack.length - 1] || getRootForMode(state.mode);
            const node = state.nodesById.get(current);

            if (!node) {
                cardTitle.textContent = 'Alocação Real vs. Planejada';
                cardSubtitle.textContent = 'Saúde estratégica da carteira';
                return;
            }

            if (node.level === 'class') {
                cardTitle.textContent = node.name;
                cardSubtitle.textContent = 'Detalhamento por subclasse';
                return;
            }

            if (node.level === 'subclass') {
                cardTitle.textContent = node.name;
                cardSubtitle.textContent = 'Detalhamento por ativo';
                return;
            }

            cardTitle.textContent = 'Alocação Real vs. Planejada';
            cardSubtitle.textContent = 'Saúde estratégica da carteira';
        }

        function renderKpis() {
            const modeKpis = state.model.kpis?.[state.mode] || {
                score: 100,
                aporteRebalance: { amount: 0, basisName: null },
                tradeRebalance: { buyAmount: 0, sellAmount: 0, netAmount: 0 },
            };
            const score = Number(modeKpis.score || 0);
            const aporte = Number(modeKpis.aporteRebalance?.amount || 0);
            const basisName = modeKpis.aporteRebalance?.basisName || '';
            const buyAmount = Number(modeKpis.tradeRebalance?.buyAmount || 0);
            const sellAmount = Number(modeKpis.tradeRebalance?.sellAmount || 0);
            const netAmount = Number(modeKpis.tradeRebalance?.netAmount || 0);

            scoreValue.textContent = `${score.toFixed(1).replace('.', ',')}/100`;
            aporteValue.textContent = formatCurrency(aporte);
            aporteHint.textContent = aporte > 0
                ? (basisName ? `Aporte recomendado em ${basisName}` : 'Aporte recomendado')
                : 'Sem aporte necessário';
            aporteHint.style.color = aporte > 0 ? '#8BA888' : '#9A908A';

            tradeNetValue.textContent = formatCurrency(Math.abs(netAmount));
            tradeNetValue.style.color = netAmount > 0 ? '#8BA888' : netAmount < 0 ? '#D97757' : '#EAE5E0';
            tradeBuyValue.textContent = `Comprar: ${formatCurrency(buyAmount)}`;
            tradeSellValue.textContent = `Vender: ${formatCurrency(sellAmount)}`;
        }

        function renderRows() {
            const rows = getRowsForCurrentView();

            if (!rows.length) {
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.textContent = 'Nenhum dado de alocação disponível para os filtros atuais.';
                allocList.replaceChildren(emptyState);
                return;
            }

            const scaleMax = Math.max(
                60,
                ...rows.map((row) => Number(row.realPct || 0)),
                ...rows.map((row) => Number(row.targetPct || 0))
            );

            const fragment = document.createDocumentFragment();

            rows.forEach((item) => {
                const width = Math.max(0, Math.min(100, (Number(item.realPct || 0) / scaleMax) * 100));
                const targetPos = Math.max(0, Math.min(100, (Number(item.targetPct || 0) / scaleMax) * 100));
                const hasChildren = (state.childrenByParent.get(item.id) || []).length > 0;
                const levelMeta = item.level === 'asset'
                    ? `${item.classLabel || ''}${item.subclassLabel ? ` · ${item.subclassLabel}` : ''}${item.ticker ? ` · ${item.ticker}` : ''}`
                    : (item.classLabel && item.classLabel !== item.name ? item.classLabel : '');

                const adjustmentDirection = Number(item.adjustmentValue || 0) > 0
                    ? 'buy'
                    : Number(item.adjustmentValue || 0) < 0
                        ? 'sell'
                        : 'hold';

                const adjustmentLabel = Number(item.adjustmentValue || 0) > 0
                    ? `Comprar ${formatCurrency(Math.abs(item.adjustmentValue || 0))}`
                    : Number(item.adjustmentValue || 0) < 0
                        ? `Vender ${formatCurrency(Math.abs(item.adjustmentValue || 0))}`
                        : 'Manter posição';

                const row = document.createElement('div');
                row.className = `alloc-row ${hasChildren ? '' : 'no-drill'}`.trim();
                row.setAttribute('data-node-id', item.id || '');
                row.setAttribute('data-drill', hasChildren ? '1' : '0');
                row.setAttribute('title', item.infoMessage || '');

                const headerTop = document.createElement('div');
                headerTop.className = 'row-header';

                const nameWrap = document.createElement('span');
                nameWrap.className = 'row-name-wrap';

                const nameText = document.createElement('span');
                nameText.textContent = item.name || '—';
                nameWrap.appendChild(nameText);

                if (item.hasLossAlert) {
                    const infoBadge = document.createElement('span');
                    infoBadge.className = 'info-badge';
                    infoBadge.setAttribute('aria-label', 'Alerta');
                    infoBadge.textContent = 'i';
                    nameWrap.appendChild(infoBadge);
                }

                const currentValue = document.createElement('span');
                currentValue.textContent = item.currentValueText || '—';

                headerTop.appendChild(nameWrap);
                headerTop.appendChild(currentValue);

                const barContainer = document.createElement('div');
                barContainer.className = 'bar-container';

                const barFill = document.createElement('div');
                barFill.className = `bar-fill ${item.status || ''}`.trim();
                barFill.style.width = `${width}%`;

                const targetMarker = document.createElement('div');
                targetMarker.className = 'bar-target-marker';
                targetMarker.style.left = `${targetPos}%`;
                targetMarker.setAttribute('title', `Meta: ${item.targetPctText}`);

                barContainer.appendChild(barFill);
                barContainer.appendChild(targetMarker);

                const headerBottom = document.createElement('div');
                headerBottom.className = 'row-header';
                headerBottom.style.marginTop = '6px';

                const metaLeft = document.createElement('div');
                metaLeft.className = 'row-meta';

                const realPct = document.createElement('span');
                realPct.textContent = `Real: ${formatSignedPercent(item.realPct, 2)}`;
                metaLeft.appendChild(realPct);

                const targetPct = document.createElement('span');
                targetPct.style.opacity = '0.5';
                targetPct.textContent = `Meta: ${formatSignedPercent(item.targetPct, 2)}`;
                metaLeft.appendChild(targetPct);

                if (levelMeta) {
                    const levelMetaNode = document.createElement('span');
                    levelMetaNode.style.opacity = '0.65';
                    levelMetaNode.textContent = levelMeta;
                    metaLeft.appendChild(levelMetaNode);
                }

                const metaRight = document.createElement('div');
                metaRight.className = 'row-meta';

                const diffTag = document.createElement('span');
                diffTag.className = `diff-tag ${item.status || ''}`.trim();
                diffTag.textContent = item.actionLabel || '';
                metaRight.appendChild(diffTag);

                const rebalanceChip = document.createElement('span');
                rebalanceChip.className = `rebalance-chip ${adjustmentDirection}`;
                rebalanceChip.textContent = adjustmentLabel;
                metaRight.appendChild(rebalanceChip);

                const realizedChip = document.createElement('span');
                realizedChip.className = `result-chip ${item.realizedResultClass || ''}`.trim();
                realizedChip.textContent = `Realizado: ${item.realizedResultText}`;
                metaRight.appendChild(realizedChip);

                const unrealizedChip = document.createElement('span');
                unrealizedChip.className = `result-chip ${item.unrealizedPnlClass || ''}`.trim();
                unrealizedChip.textContent = `Em aberto: ${item.unrealizedPnlText}`;
                metaRight.appendChild(unrealizedChip);

                const financialChip = document.createElement('span');
                financialChip.className = `result-chip ${item.financialResultClass || ''}`.trim();
                financialChip.textContent = `Resultado: ${item.financialResultText}`;
                metaRight.appendChild(financialChip);

                headerBottom.appendChild(metaLeft);
                headerBottom.appendChild(metaRight);

                row.appendChild(headerTop);
                row.appendChild(barContainer);
                row.appendChild(headerBottom);
                fragment.appendChild(row);
            });

            allocList.replaceChildren(fragment);

            allocList.querySelectorAll('.alloc-row').forEach((row) => {
                row.addEventListener('click', () => {
                    const canDrill = row.getAttribute('data-drill') === '1';
                    if (!canDrill) return;

                    const nodeId = row.getAttribute('data-node-id');
                    if (!nodeId) return;
                    state.stack.push(nodeId);
                    renderCurrentView();
                });
            });
        }

        function renderCurrentView() {
            backNav.style.display = state.stack.length > 1 ? 'block' : 'none';
            resolveViewText();
            renderKpis();
            renderRows();
        }

        function setMode(mode) {
            state.mode = mode;
            state.stack = [getRootForMode(mode)];

            shadowRoot.querySelectorAll('.filter-btn').forEach((button) => {
                button.classList.toggle('active', button.getAttribute('data-mode') === mode);
            });

            renderCurrentView();
        }

        backNav.addEventListener('click', () => {
            if (state.stack.length > 1) {
                state.stack.pop();
                renderCurrentView();
            }
        });

        shadowRoot.querySelectorAll('.filter-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const mode = button.getAttribute('data-mode') || 'class';
                setMode(mode);
            });
        });

        window.addEventListener('resize', scaleToContainer);
        scaleToContainer();

        function applyModel(widgetModel) {
            state.model = normalizeWidgetModel(widgetModel);
            rebuildIndexes();

            setMode(state.mode || 'class');
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
                        cardId: 'card-alocacao-real-planejada',
                        title: 'Alocação Real vs Planejada',
                        presentation: 'table',
                        metricIds: ['investments.allocation_vs_target'],
                    },
                ],
                state.activeFilters
            );

            applyCardResponse(response);
            return response;
        }

        applyModel(normalizeWidgetModel(null));

        const timerMs = 8 * 60 * 60 * 1000;
        const refreshTimerId = window.setInterval(() => {
            fetchAndRenderLiveData().catch(() => {});
        }, timerMs);

        return {
            applyModel,
            applyCardResponse,
            fetchAndRenderLiveData,
            getCurrentModel() {
                return toDeepClone(state.model);
            },
            destroy() {
                window.clearInterval(refreshTimerId);
            },
        };
    }

    window.YieldInvestmentsAlocacao = {
        createAlocacaoCardController,
        normalizeWidgetModel,
    };
})();
