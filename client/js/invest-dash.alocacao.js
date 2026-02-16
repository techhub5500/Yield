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
        return `
            <style>
                :host { all: initial; font-family: 'Inter', sans-serif; }

                .widget-card {
                    width: 880px;
                    height: 430px;
                    background: rgba(40, 35, 30, 0.4);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 230, 200, 0.08);
                    border-radius: 20px;
                    box-shadow: 0 15px 30px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.03);
                    color: #EAE5E0;
                    box-sizing: border-box;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    padding: 24px;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 16px;
                    gap: 10px;
                    align-items: flex-start;
                }

                h2 {
                    font-family: 'Playfair Display', serif;
                    margin: 0;
                    font-size: 1.2rem;
                    font-weight: 600;
                }

                .subtitle {
                    font-size: 0.75rem;
                    color: #9A908A;
                }

                #backNav {
                    display: none;
                    cursor: pointer;
                    color: #D4AF37;
                    font-size: 1.4rem;
                    margin-bottom: 4px;
                    width: fit-content;
                    transition: transform 0.2s ease;
                }

                #backNav:hover { transform: translateX(-4px); }

                .filters { display: flex; gap: 8px; margin-top: 8px; }

                .filter-btn {
                    background: rgba(0,0,0,0.2);
                    border: 1px solid rgba(255, 230, 200, 0.08);
                    color: #9A908A;
                    padding: 4px 10px;
                    border-radius: 8px;
                    font-size: 0.65rem;
                    cursor: pointer;
                    transition: 0.3s;
                    font-family: 'Inter', sans-serif;
                    font-weight: 600;
                }

                .filter-btn.active {
                    background: rgba(255,255,255,0.1);
                    color: #D4AF37;
                }

                .kpi-grid {
                    display: flex;
                    gap: 20px;
                    margin-bottom: 14px;
                    border-bottom: 1px solid rgba(255, 230, 200, 0.08);
                    padding-bottom: 14px;
                }

                .kpi-item { flex: 1; min-width: 0; }

                .kpi-label {
                    font-size: 0.65rem;
                    color: #9A908A;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .kpi-value {
                    font-size: 1.4rem;
                    font-weight: 300;
                    line-height: 1.2;
                }

                .trade-line {
                    display: flex;
                    gap: 8px;
                    margin-top: 4px;
                    font-size: 0.72rem;
                    color: #9A908A;
                }

                .trade-buy { color: #8BA888; }
                .trade-sell { color: #D97757; }

                .allocation-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    flex: 1;
                    overflow: auto;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(212, 175, 55, 0.35) transparent;
                }

                .allocation-list::-webkit-scrollbar { width: 4px; }
                .allocation-list::-webkit-scrollbar-thumb { background: rgba(212, 175, 55, 0.35); border-radius: 8px; }

                .alloc-row {
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 8px;
                    transition: background 0.2s;
                    border: 1px solid transparent;
                }

                .alloc-row.no-drill { cursor: default; }
                .alloc-row:hover { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.05); }

                .row-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 6px;
                    font-size: 0.85rem;
                    gap: 8px;
                    align-items: center;
                }

                .row-name-wrap {
                    display: inline-flex;
                    gap: 6px;
                    align-items: center;
                }

                .row-meta {
                    font-size: 0.75rem;
                    color: #9A908A;
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }

                .bar-container {
                    position: relative;
                    height: 8px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 4px;
                    overflow: hidden;
                    margin-top: 6px;
                }

                .bar-target-marker {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 2px;
                    background: rgba(255,255,255,0.5);
                    z-index: 2;
                }

                .bar-fill {
                    height: 100%;
                    border-radius: 4px;
                    transition: width 0.35s ease;
                }

                .on-track { background: #D4AF37; }
                .over { background: #D97757; }
                .under { background: #8BA888; }

                .diff-tag {
                    font-size: 0.7rem;
                    padding: 2px 6px;
                    border-radius: 4px;
                    background: rgba(0,0,0,0.3);
                    white-space: nowrap;
                }

                .diff-tag.over { color: #D97757; }
                .diff-tag.under { color: #8BA888; }
                .diff-tag.on-track { color: #D4AF37; }

                .rebalance-chip {
                    font-size: 0.66rem;
                    padding: 2px 6px;
                    border-radius: 4px;
                    background: rgba(255,255,255,0.06);
                    color: #EAE5E0;
                    white-space: nowrap;
                }

                .rebalance-chip.buy { color: #8BA888; }
                .rebalance-chip.sell { color: #D97757; }
                .rebalance-chip.hold { color: #D4AF37; }

                .result-chip {
                    font-size: 0.66rem;
                    padding: 2px 6px;
                    border-radius: 4px;
                    background: rgba(0,0,0,0.28);
                    white-space: nowrap;
                }

                .result-chip.positive { color: #8BA888; }
                .result-chip.negative { color: #D97757; }
                .result-chip.neutral { color: #9A908A; }

                .info-badge {
                    display: inline-flex;
                    width: 16px;
                    height: 16px;
                    border-radius: 999px;
                    border: 1px solid rgba(255,255,255,0.2);
                    align-items: center;
                    justify-content: center;
                    font-size: 0.65rem;
                    color: #D4AF37;
                    background: rgba(0,0,0,0.25);
                }

                .empty-state {
                    color: #9A908A;
                    font-size: 0.78rem;
                    padding: 10px 2px;
                }
            </style>

            <div class="widget-card">
                <div class="header">
                    <div>
                        <div id="backNav">←</div>
                        <h2 id="cardTitle">Alocação Real vs. Planejada</h2>
                        <div class="subtitle" id="cardSubtitle">Saúde estratégica da carteira</div>
                    </div>
                    <div class="filters">
                        <button class="filter-btn active" data-mode="class">Classe</button>
                        <button class="filter-btn" data-mode="subclass">Subclasse</button>
                        <button class="filter-btn" data-mode="asset">Ativo</button>
                    </div>
                </div>

                <div class="kpi-grid">
                    <div class="kpi-item">
                        <div class="kpi-label">Aderência (Score)</div>
                        <div class="kpi-value" id="scoreValue" style="color:#D4AF37;">100/100</div>
                    </div>
                    <div class="kpi-item">
                        <div class="kpi-label">Rebalanceamento por Aporte</div>
                        <div class="kpi-value" id="aporteValue">R$ 0,00</div>
                        <div class="subtitle" id="aporteHint" style="color:#8BA888;">Aporte recomendado</div>
                    </div>
                    <div class="kpi-item">
                        <div class="kpi-label">Rebalanceamento por Venda/Compra</div>
                        <div class="kpi-value" id="tradeNetValue">R$ 0,00</div>
                        <div class="trade-line">
                            <span class="trade-buy" id="tradeBuyValue">Comprar: R$ 0,00</span>
                            <span class="trade-sell" id="tradeSellValue">Vender: R$ 0,00</span>
                        </div>
                    </div>
                </div>

                <div class="allocation-list" id="allocList"></div>
            </div>
        `;
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
                allocList.innerHTML = '<div class="empty-state">Nenhum dado de alocação disponível para os filtros atuais.</div>';
                return;
            }

            const scaleMax = Math.max(
                60,
                ...rows.map((row) => Number(row.realPct || 0)),
                ...rows.map((row) => Number(row.targetPct || 0))
            );

            allocList.innerHTML = rows.map((item) => {
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

                return `
                    <div class="alloc-row ${hasChildren ? '' : 'no-drill'}" data-node-id="${item.id}" data-drill="${hasChildren ? '1' : '0'}" title="${item.infoMessage ? item.infoMessage.replaceAll('"', '&quot;') : ''}">
                        <div class="row-header">
                            <span class="row-name-wrap">
                                <span>${item.name}</span>
                                ${item.hasLossAlert ? '<span class="info-badge" aria-label="Alerta">i</span>' : ''}
                            </span>
                            <span>${item.currentValueText}</span>
                        </div>
                        <div class="bar-container">
                            <div class="bar-fill ${item.status}" style="width:${width}%"></div>
                            <div class="bar-target-marker" style="left:${targetPos}%" title="Meta: ${item.targetPctText}"></div>
                        </div>
                        <div class="row-header" style="margin-top:6px;">
                            <div class="row-meta">
                                <span>Real: ${formatSignedPercent(item.realPct, 2)}</span>
                                <span style="opacity:0.5">Meta: ${formatSignedPercent(item.targetPct, 2)}</span>
                                ${levelMeta ? `<span style="opacity:0.65">${levelMeta}</span>` : ''}
                            </div>
                            <div class="row-meta">
                                <span class="diff-tag ${item.status}">${item.actionLabel}</span>
                                <span class="rebalance-chip ${adjustmentDirection}">${adjustmentLabel}</span>
                                <span class="result-chip ${item.realizedResultClass}">Realizado: ${item.realizedResultText}</span>
                                <span class="result-chip ${item.unrealizedPnlClass}">Em aberto: ${item.unrealizedPnlText}</span>
                                <span class="result-chip ${item.financialResultClass}">Resultado: ${item.financialResultText}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

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
