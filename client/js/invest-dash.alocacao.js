(function initAlocacaoModule() {
    const STORAGE_KEYS = {
        priorityMode: 'yield.alocacao.priorityMode',
    };

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

    function formatPercent(value, digits = 2, withSign = false) {
        const parsed = Number(value || 0);
        const sign = withSign && parsed > 0 ? '+' : '';
        return `${sign}${parsed.toFixed(digits).replace('.', ',')}%`;
    }

    function parsePercentText(rawValue) {
        const match = String(rawValue || '').replace(',', '.').match(/-?\d+(\.\d+)?/);
        if (!match) return 0;
        const parsed = Number(match[0]);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
    }

    function roundCents(value) {
        return Math.round(Number(value || 0) * 100) / 100;
    }

    function getStoredValue(key, fallbackValue) {
        try {
            const stored = window.sessionStorage.getItem(key);
            return stored || fallbackValue;
        } catch (_) {
            return fallbackValue;
        }
    }

    function setStoredValue(key, value) {
        try {
            window.sessionStorage.setItem(key, String(value));
        } catch (_) {
            // noop
        }
    }

    function normalizeNode(node) {
        const quantity = Number(
            node?.quantity
            ?? node?.qty
            ?? node?.positionQty
            ?? node?.units
            ?? node?.shares
            ?? 0
        );

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
            actionLabel: String(node?.actionLabel || 'Manter'),
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
            quantity,
            estimatedUnitPrice: Number(node?.currentPrice || node?.lastPrice || node?.marketPrice || 0),
        };

        if (!normalized.estimatedUnitPrice && quantity > 0) {
            normalized.estimatedUnitPrice = normalized.currentValue / quantity;
        }

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

        const allocList = shadowRoot.getElementById('allocList');
        const scoreValue = shadowRoot.getElementById('scoreValue');
        const aporteValue = shadowRoot.getElementById('aporteValue');
        const aporteHint = shadowRoot.getElementById('aporteHint');
        const tradeNetValue = shadowRoot.getElementById('tradeNetValue');
        const tradeBuyValue = shadowRoot.getElementById('tradeBuyValue');
        const tradeSellValue = shadowRoot.getElementById('tradeSellValue');
        const tradeHint = shadowRoot.getElementById('tradeHint');
        const cardTitle = shadowRoot.getElementById('cardTitle');
        const cardSubtitle = shadowRoot.getElementById('cardSubtitle');
        const backNav = shadowRoot.getElementById('backNav');

        const settingsWrap = shadowRoot.getElementById('allocationSettingsWrap');
        const settingsBtn = shadowRoot.getElementById('settingsBtn');
        const settingsMenu = shadowRoot.getElementById('settingsMenu');
        const rebalanceGuardMessage = shadowRoot.getElementById('rebalanceGuardMessage');

        const expandAporteDetailsBtn = shadowRoot.getElementById('expandAporteDetailsBtn');
        const aportePlanPanel = shadowRoot.getElementById('aportePlanPanel');
        const aportePlanAporteTotal = shadowRoot.getElementById('aportePlanAporteTotal');
        const aportePlanEstimatedTotal = shadowRoot.getElementById('aportePlanEstimatedTotal');
        const aporteInheritedHint = shadowRoot.getElementById('aporteInheritedHint');
        const aportePlanTableBody = shadowRoot.getElementById('aportePlanTableBody');

        const expandTradeDetailsBtn = shadowRoot.getElementById('expandTradeDetailsBtn');
        const tradePlanPanel = shadowRoot.getElementById('tradePlanPanel');
        const tradePlanSellTotal = shadowRoot.getElementById('tradePlanSellTotal');
        const tradePlanBuyTotal = shadowRoot.getElementById('tradePlanBuyTotal');
        const tradePlanTaxAlert = shadowRoot.getElementById('tradePlanTaxAlert');
        const tradePlanTableBody = shadowRoot.getElementById('tradePlanTableBody');

        const state = {
            model: normalizeWidgetModel(null),
            activeFilters: { currencies: ['BRL'] },
            mode: 'class',
            priorityMode: getStoredValue(STORAGE_KEYS.priorityMode, 'deviation'),
            expandedPanels: {
                aporte: false,
                trade: false,
            },
            nodesById: new Map(),
            childrenByParent: new Map(),
            absoluteTargetCache: new Map(),
            stack: [{ key: 'class-root', inheritedAporte: 0 }],
            currentPlans: {
                aporte: null,
                trade: null,
            },
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
            host.style.width = '880px';
            host.style.height = '430px';
            parent.style.minHeight = `${430 * scale}px`;
        }

        function rebuildIndexes() {
            state.nodesById = new Map();
            state.childrenByParent = new Map();
            state.absoluteTargetCache = new Map();

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

        function getCurrentFrame() {
            return state.stack[state.stack.length - 1] || { key: getRootForMode(state.mode), inheritedAporte: 0 };
        }

        function getRowsForKey(key) {
            if (state.childrenByParent.has(key)) {
                return state.childrenByParent.get(key) || [];
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

            return state.childrenByParent.get(getRootForMode(state.mode)) || [];
        }

        function collectDescendantAssets(nodeId) {
            const node = state.nodesById.get(nodeId);
            if (!node) return [];
            if (node.level === 'asset') return [node];

            const directChildren = state.childrenByParent.get(node.id) || [];
            if (!directChildren.length) return [];

            return directChildren.flatMap((child) => collectDescendantAssets(child.id));
        }

        function resolveAbsoluteTargetPct(node) {
            if (!node || !node.id) return 0;
            if (state.absoluteTargetCache.has(node.id)) {
                return state.absoluteTargetCache.get(node.id);
            }

            if (node.level === 'asset') {
                const direct = Number(node.targetPct || 0);
                state.absoluteTargetCache.set(node.id, direct);
                return direct;
            }

            const descendants = collectDescendantAssets(node.id);
            const descendantsTarget = descendants.reduce((sum, asset) => sum + Number(asset.targetPct || 0), 0);
            const resolved = descendantsTarget > 0 ? descendantsTarget : Number(node.targetPct || 0);

            state.absoluteTargetCache.set(node.id, resolved);
            return resolved;
        }

        function resolveViewText() {
            const current = getCurrentFrame().key;
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

        function extractSignalsMap() {
            const result = new Map();

            const upsertSignal = (key, type, value) => {
                if (!key) return;
                if (!result.has(key)) {
                    result.set(key, { profitability: null, volatility: null });
                }
                const target = result.get(key);
                if (type === 'profitability' && Number.isFinite(value)) {
                    target.profitability = value;
                }
                if (type === 'volatility' && Number.isFinite(value)) {
                    target.volatility = value;
                }
            };

            const cards = window.YieldInvestments?.cards || {};
            const rentModel = cards.rentabilidade?.getCurrentModel?.();
            const volModel = cards.volatilidade?.getCurrentModel?.();

            if (rentModel?.views && typeof rentModel.views === 'object') {
                Object.values(rentModel.views).forEach((view) => {
                    const left = Array.isArray(view?.details?.left) ? view.details.left : [];
                    const right = Array.isArray(view?.details?.right) ? view.details.right : [];

                    [...left, ...right].forEach((row) => {
                        const pctValue = parsePercentText(row?.varText || row?.value || row?.meta || '0');
                        [row?.id, row?.name].forEach((candidate) => {
                            const key = normalizeText(candidate);
                            if (key) upsertSignal(key, 'profitability', pctValue);
                        });
                    });
                });
            }

            if (volModel?.views && typeof volModel.views === 'object') {
                Object.values(volModel.views).forEach((view) => {
                    const details = Array.isArray(view?.details) ? view.details : [];

                    details.forEach((row) => {
                        const volValue = parsePercentText(row?.val || row?.sub || row?.meta || '0');
                        [row?.id, row?.name].forEach((candidate) => {
                            const key = normalizeText(candidate);
                            if (key) upsertSignal(key, 'volatility', volValue);
                        });
                    });
                });
            }

            return result;
        }

        function buildPriorityGetter(signalsMap, direction) {
            const getSignal = (row) => {
                const keys = [row.id, row.ticker, row.name].map(normalizeText).filter(Boolean);
                for (const key of keys) {
                    const signal = signalsMap.get(key);
                    if (signal) return signal;
                }
                return { profitability: null, volatility: null };
            };

            if (state.priorityMode === 'profitability') {
                return (row) => {
                    const profitability = Number(getSignal(row).profitability ?? 0);
                    if (direction === 'sell') {
                        return 1 / (1 + Math.max(0, profitability));
                    }
                    return Math.max(0.01, profitability + 1);
                };
            }

            if (state.priorityMode === 'volatility') {
                return (row) => {
                    const volatility = Number(getSignal(row).volatility ?? 0);
                    if (direction === 'sell') {
                        return Math.max(0.01, volatility + 1);
                    }
                    return 1 / (1 + Math.max(0, volatility));
                };
            }

            return (row) => {
                if (direction === 'sell') {
                    return Math.max(0.01, row.currentValue - row.desiredValue);
                }
                return Math.max(0.01, row.desiredValue - row.currentValue);
            };
        }

        function distributeAmount(totalAmount, recipients, getWeight) {
            const allocations = new Map();
            const amount = roundCents(Math.max(0, Number(totalAmount || 0)));
            if (!amount || !recipients.length) return allocations;

            const weights = recipients.map((row) => ({
                row,
                weight: Math.max(0.0001, Number(getWeight(row) || 0.0001)),
            }));

            const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
            let distributed = 0;

            weights.forEach((entry, index) => {
                const isLast = index === weights.length - 1;
                const raw = isLast
                    ? amount - distributed
                    : (amount * entry.weight) / totalWeight;
                const value = roundCents(raw);
                allocations.set(entry.row.id, value);
                distributed = roundCents(distributed + value);
            });

            const diff = roundCents(amount - distributed);
            if (diff !== 0) {
                const targetRow = weights[0]?.row;
                if (targetRow) {
                    allocations.set(targetRow.id, roundCents((allocations.get(targetRow.id) || 0) + diff));
                }
            }

            return allocations;
        }

        function distributeWithCaps(totalAmount, rows, getCap, getWeight) {
            const allocations = new Map();
            const amount = roundCents(Math.max(0, Number(totalAmount || 0)));
            if (!amount || !rows.length) return allocations;

            let remaining = amount;
            let active = rows
                .map((row) => ({
                    row,
                    cap: roundCents(Math.max(0, Number(getCap(row) || 0))),
                    weight: Math.max(0.0001, Number(getWeight(row) || 0.0001)),
                }))
                .filter((entry) => entry.cap > 0);

            active.forEach((entry) => allocations.set(entry.row.id, 0));

            while (remaining > 0.0001 && active.length) {
                const totalWeight = active.reduce((sum, entry) => sum + entry.weight, 0);
                let consumed = 0;

                active.forEach((entry) => {
                    const current = roundCents(allocations.get(entry.row.id) || 0);
                    const room = roundCents(entry.cap - current);
                    if (room <= 0) return;

                    const share = totalWeight > 0 ? (remaining * entry.weight) / totalWeight : 0;
                    const applied = roundCents(Math.min(room, share));

                    if (applied > 0) {
                        allocations.set(entry.row.id, roundCents(current + applied));
                        consumed = roundCents(consumed + applied);
                    }
                });

                if (consumed <= 0.0001) {
                    const fallback = active[0];
                    if (!fallback) break;

                    const current = roundCents(allocations.get(fallback.row.id) || 0);
                    const room = roundCents(fallback.cap - current);
                    if (room <= 0) break;

                    const applied = roundCents(Math.min(room, remaining));
                    allocations.set(fallback.row.id, roundCents(current + applied));
                    consumed = applied;
                }

                remaining = roundCents(Math.max(0, remaining - consumed));
                active = active.filter((entry) => {
                    const current = roundCents(allocations.get(entry.row.id) || 0);
                    return roundCents(entry.cap - current) > 0;
                });
            }

            const distributed = roundCents(Array.from(allocations.values()).reduce((sum, value) => sum + value, 0));
            const diff = roundCents(amount - distributed);
            if (diff !== 0 && allocations.size) {
                const target = active[0]?.row || rows[0];
                if (target) {
                    allocations.set(target.id, roundCents((allocations.get(target.id) || 0) + diff));
                }
            }

            return allocations;
        }

        function buildViewRows(frame, rawRows) {
            const isRootView = frame.key.endsWith('-root');
            const isClassRoot = frame.key === 'class-root';

            const portfolioTotal = Number(state.model.totalPatrimony || 0)
                || roundCents((state.childrenByParent.get('class-root') || []).reduce((sum, row) => sum + Number(row.currentValue || 0), 0));

            const groupTotal = roundCents(rawRows.reduce((sum, row) => sum + Number(row.currentValue || 0), 0));
            const absoluteTargets = rawRows.map((row) => resolveAbsoluteTargetPct(row));
            const groupAbsoluteTargetSum = roundCents(absoluteTargets.reduce((sum, value) => sum + Number(value || 0), 0));

            const useInternalScale = !isRootView;
            const baseTotal = useInternalScale ? groupTotal : portfolioTotal;

            const rows = rawRows.map((row, index) => {
                const absTargetPct = Number(absoluteTargets[index] || 0);
                const targetPct = useInternalScale
                    ? (groupAbsoluteTargetSum > 0 ? (absTargetPct / groupAbsoluteTargetSum) * 100 : 0)
                    : absTargetPct;

                const currentValue = Number(row.currentValue || 0);
                const realPct = baseTotal > 0 ? (currentValue / baseTotal) * 100 : 0;
                const marginPct = Number(row.marginPct || 0);
                const desiredValue = roundCents((targetPct / 100) * baseTotal);
                const deltaToTarget = roundCents(desiredValue - currentValue);

                let status = 'on-track';
                if (realPct > (targetPct + marginPct)) status = 'over';
                if (realPct < (targetPct - marginPct)) status = 'under';

                return {
                    ...row,
                    absTargetPct,
                    targetPct,
                    realPct,
                    marginPct,
                    baseTotal,
                    desiredValue,
                    deltaToTarget,
                    upperBandPct: targetPct + marginPct,
                    lowerBandPct: Math.max(0, targetPct - marginPct),
                    status,
                };
            });

            const metaMissing = isClassRoot && groupAbsoluteTargetSum <= 0;

            return {
                rows,
                isRootView,
                isClassRoot,
                useInternalScale,
                baseTotal,
                groupAbsoluteTargetSum,
                metaMissing,
            };
        }

        function buildAportePlan(viewData, frame, signalsMap) {
            const { rows, baseTotal, useInternalScale, isClassRoot } = viewData;

            if (rows.length <= 1) {
                return {
                    id: 'aporte',
                    blocked: true,
                    reason: 'Adicione mais ativos para habilitar o rebalanceamento',
                    inherited: false,
                    sourceHint: '',
                    rows,
                    actions: new Map(),
                    total: 0,
                    newTotal: baseTotal,
                    buyTotal: 0,
                    sellTotal: 0,
                };
            }

            if (viewData.metaMissing) {
                return {
                    id: 'aporte',
                    blocked: false,
                    reason: 'Configure as metas dos ativos para habilitar o cálculo por classe',
                    inherited: false,
                    sourceHint: '',
                    rows,
                    actions: new Map(),
                    total: 0,
                    newTotal: baseTotal,
                    buyTotal: 0,
                    sellTotal: 0,
                };
            }

            const actions = new Map();
            const priority = buildPriorityGetter(signalsMap, 'buy');

            const inheritedAporte = roundCents(Math.max(0, Number(frame.inheritedAporte || 0)));
            if (inheritedAporte > 0) {
                const inheritedNewTotal = roundCents(baseTotal + inheritedAporte);
                const recipients = rows
                    .map((row) => {
                        const targetAtNewTotal = roundCents((row.targetPct / 100) * inheritedNewTotal);
                        const capToTarget = roundCents(Math.max(0, targetAtNewTotal - row.currentValue));
                        return {
                            ...row,
                            targetAtNewTotal,
                            capToTarget,
                        };
                    })
                    .filter((row) => row.capToTarget > 0);

                if (!recipients.length) {
                    return {
                        id: 'aporte',
                        blocked: false,
                        reason: 'Sem desvio detectado',
                        inherited: true,
                        sourceHint: 'Distribuição do aporte sugerido no nível superior',
                        rows,
                        actions,
                        total: 0,
                        newTotal: roundCents(baseTotal),
                        buyTotal: 0,
                        sellTotal: 0,
                    };
                }

                const inheritedWeight = (row) => {
                    const gap = Math.max(0, row.targetPct - row.realPct);
                    if (gap > 0) return 1000 + gap;
                    return Math.max(0.0001, priority(row));
                };

                const allocations = distributeWithCaps(
                    inheritedAporte,
                    recipients,
                    (row) => row.capToTarget,
                    inheritedWeight
                );

                rows.forEach((row) => {
                    actions.set(row.id, roundCents(allocations.get(row.id) || 0));
                });

                const distributed = roundCents(Array.from(actions.values()).reduce((sum, value) => sum + Math.max(0, value), 0));

                return {
                    id: 'aporte',
                    blocked: false,
                    reason: distributed > 0 ? '' : 'Sem desvio detectado',
                    inherited: true,
                    sourceHint: 'Distribuição do aporte sugerido no nível superior',
                    rows,
                    actions,
                    total: distributed,
                    newTotal: roundCents(baseTotal + distributed),
                    buyTotal: distributed,
                    sellTotal: 0,
                };
            }

            const overBand = rows
                .filter((row) => row.realPct > row.upperBandPct)
                .sort((a, b) => (b.realPct - b.upperBandPct) - (a.realPct - a.upperBandPct));

            if (!overBand.length) {
                return {
                    id: 'aporte',
                    blocked: false,
                    reason: 'Sem desvio detectado',
                    inherited: false,
                    sourceHint: '',
                    rows,
                    actions,
                    total: 0,
                    newTotal: baseTotal,
                    buyTotal: 0,
                    sellTotal: 0,
                };
            }

            const basis = overBand[0];
            const upperRatio = basis.upperBandPct / 100;
            if (!(upperRatio > 0)) {
                return {
                    id: 'aporte',
                    blocked: false,
                    reason: 'Sem desvio detectado',
                    inherited: false,
                    sourceHint: '',
                    rows,
                    actions,
                    total: 0,
                    newTotal: baseTotal,
                    buyTotal: 0,
                    sellTotal: 0,
                };
            }

            const newTotal = roundCents(Math.max(baseTotal, basis.currentValue / upperRatio));
            const aporteTotal = roundCents(Math.max(0, newTotal - baseTotal));
            const recipients = rows.filter((row) => row.realPct < row.targetPct);

            if (!recipients.length || aporteTotal <= 0) {
                return {
                    id: 'aporte',
                    blocked: false,
                    reason: 'Sem desvio detectado',
                    inherited: false,
                    sourceHint: '',
                    rows,
                    actions,
                    total: 0,
                    newTotal: baseTotal,
                    buyTotal: 0,
                    sellTotal: 0,
                };
            }

            const allocations = distributeAmount(aporteTotal, recipients, priority);

            rows.forEach((row) => {
                let amount = roundCents(allocations.get(row.id) || 0);
                if (useInternalScale && amount > 0) {
                    const maxInternal = roundCents(Math.max(0, row.desiredValue - row.currentValue));
                    if (maxInternal > 0) {
                        amount = Math.min(amount, maxInternal);
                    }
                }
                actions.set(row.id, roundCents(amount));
            });

            let distributed = roundCents(Array.from(actions.values()).reduce((sum, value) => sum + Math.max(0, value), 0));
            let remainder = roundCents(aporteTotal - distributed);

            if (remainder > 0) {
                const ranked = [...recipients].sort((a, b) => priority(b) - priority(a));
                ranked.forEach((row, index) => {
                    if (remainder <= 0) return;
                    const current = roundCents(actions.get(row.id) || 0);
                    let add = roundCents(index === ranked.length - 1 ? remainder : remainder / (ranked.length - index));
                    if (useInternalScale) {
                        const cap = roundCents(Math.max(0, row.desiredValue - row.currentValue - current));
                        if (cap > 0) {
                            add = Math.min(add, cap);
                        }
                    }
                    if (add > 0) {
                        actions.set(row.id, roundCents(current + add));
                        remainder = roundCents(remainder - add);
                    }
                });

                if (remainder > 0 && isClassRoot) {
                    const target = ranked[0];
                    if (target) {
                        actions.set(target.id, roundCents((actions.get(target.id) || 0) + remainder));
                        remainder = 0;
                    }
                }
            }

            distributed = roundCents(Array.from(actions.values()).reduce((sum, value) => sum + Math.max(0, value), 0));

            return {
                id: 'aporte',
                blocked: false,
                reason: distributed > 0 ? '' : 'Sem desvio detectado',
                inherited: false,
                sourceHint: '',
                rows,
                actions,
                total: distributed,
                newTotal: roundCents(baseTotal + distributed),
                buyTotal: distributed,
                sellTotal: 0,
            };
        }

        function buildTradePlan(viewData, signalsMap) {
            const { rows, baseTotal, isClassRoot } = viewData;

            if (rows.length <= 1) {
                return {
                    id: 'trade',
                    blocked: true,
                    reason: 'Adicione mais ativos para habilitar o rebalanceamento',
                    rows,
                    actions: new Map(),
                    total: 0,
                    buyTotal: 0,
                    sellTotal: 0,
                    newTotal: baseTotal,
                    hasTaxWarning: false,
                };
            }

            if (viewData.metaMissing) {
                return {
                    id: 'trade',
                    blocked: false,
                    reason: 'Configure as metas dos ativos para habilitar o cálculo por classe',
                    rows,
                    actions: new Map(),
                    total: 0,
                    buyTotal: 0,
                    sellTotal: 0,
                    newTotal: baseTotal,
                    hasTaxWarning: false,
                };
            }

            const actions = new Map();

            const sellers = rows
                .filter((row) => row.realPct > row.upperBandPct)
                .map((row) => ({
                    ...row,
                    sellToTarget: roundCents(Math.max(0, row.currentValue - row.desiredValue)),
                }))
                .filter((row) => row.sellToTarget > 0);

            const sellTotal = roundCents(sellers.reduce((sum, row) => sum + row.sellToTarget, 0));
            if (sellTotal <= 0) {
                return {
                    id: 'trade',
                    blocked: false,
                    reason: 'Sem desvio detectado',
                    rows,
                    actions,
                    total: 0,
                    buyTotal: 0,
                    sellTotal: 0,
                    newTotal: baseTotal,
                    hasTaxWarning: false,
                };
            }

            const buyers = rows.filter((row) => row.realPct < row.lowerBandPct);
            if (!buyers.length) {
                return {
                    id: 'trade',
                    blocked: false,
                    reason: 'Sem desvio detectado',
                    rows,
                    actions,
                    total: 0,
                    buyTotal: 0,
                    sellTotal: 0,
                    newTotal: baseTotal,
                    hasTaxWarning: false,
                };
            }

            const buyPriority = buildPriorityGetter(signalsMap, 'buy');
            const sellPriority = buildPriorityGetter(signalsMap, 'sell');

            const buyAllocations = distributeAmount(sellTotal, buyers, buyPriority);
            const sellerAllocations = distributeAmount(sellTotal, sellers, sellPriority);

            rows.forEach((row) => {
                let buy = roundCents(buyAllocations.get(row.id) || 0);
                if (!isClassRoot) {
                    const cap = roundCents(Math.max(0, row.desiredValue - row.currentValue));
                    if (cap > 0) buy = Math.min(buy, cap);
                }

                const sell = roundCents(sellerAllocations.get(row.id) || 0);
                actions.set(row.id, roundCents(buy - sell));
            });

            let buyTotal = roundCents(Array.from(actions.values()).reduce((sum, value) => sum + (value > 0 ? value : 0), 0));
            let sellFinal = roundCents(Array.from(actions.values()).reduce((sum, value) => sum + (value < 0 ? Math.abs(value) : 0), 0));

            if (buyTotal < sellFinal && isClassRoot) {
                const diff = roundCents(sellFinal - buyTotal);
                const receiver = buyers.sort((a, b) => buyPriority(b) - buyPriority(a))[0];
                if (receiver) {
                    const current = roundCents(actions.get(receiver.id) || 0);
                    actions.set(receiver.id, roundCents(current + diff));
                }
                buyTotal = roundCents(Array.from(actions.values()).reduce((sum, value) => sum + (value > 0 ? value : 0), 0));
            }

            sellFinal = roundCents(Array.from(actions.values()).reduce((sum, value) => sum + (value < 0 ? Math.abs(value) : 0), 0));

            return {
                id: 'trade',
                blocked: false,
                reason: sellFinal > 0 ? '' : 'Sem desvio detectado',
                rows,
                actions,
                total: sellFinal,
                buyTotal,
                sellTotal: sellFinal,
                newTotal: baseTotal,
                hasTaxWarning: sellFinal > 0,
            };
        }

        function computePlans() {
            const frame = getCurrentFrame();
            const rawRows = getRowsForKey(frame.key);
            const viewData = buildViewRows(frame, rawRows);
            const signalsMap = extractSignalsMap();

            const aportePlan = buildAportePlan(viewData, frame, signalsMap);
            const tradePlan = buildTradePlan(viewData, signalsMap);

            state.currentPlans = {
                aporte: aportePlan,
                trade: tradePlan,
            };

            return { viewData, aportePlan, tradePlan };
        }

        function buildEstimatedUnitsText(row, actionValue) {
            if (row.level !== 'asset' || !actionValue) return '';

            const inferredPrice = Number(row.estimatedUnitPrice || 0);
            if (!(inferredPrice > 0)) return '';

            const quantity = Math.abs(actionValue) / inferredPrice;
            if (!Number.isFinite(quantity) || quantity <= 0) return '';

            return ` (~${quantity.toFixed(4).replace('.', ',')} un.)`;
        }

        function buildListActionText(row) {
            if (row.status === 'over') {
                return {
                    label: `Vender ${formatCurrency(Math.abs(row.deltaToTarget))}`,
                    cssClass: 'sell',
                };
            }

            if (row.status === 'under') {
                return {
                    label: `Alocar ${formatCurrency(Math.abs(row.deltaToTarget))}`,
                    cssClass: 'buy',
                };
            }

            return {
                label: 'Manter',
                cssClass: 'hold',
            };
        }

        function syncControls() {
            shadowRoot.querySelectorAll('[data-mode]').forEach((button) => {
                button.classList.toggle('active', button.getAttribute('data-mode') === state.mode);
            });

            shadowRoot.querySelectorAll('[data-priority-mode]').forEach((button) => {
                button.classList.toggle('active', button.getAttribute('data-priority-mode') === state.priorityMode);
            });
        }

        function renderScore() {
            const kpiScore = Number(state.model.kpis?.[state.mode]?.score ?? 100);
            scoreValue.textContent = `${kpiScore.toFixed(1).replace('.', ',')}/100`;
        }

        function renderScenarioHeaders(aportePlan, tradePlan) {
            aporteValue.textContent = formatCurrency(aportePlan.total || 0);
            aporteHint.textContent = aportePlan.reason || (aportePlan.total > 0 ? 'Aporte recomendado' : 'Sem desvio detectado');
            aporteHint.style.color = aportePlan.total > 0 ? '#8BA888' : '#9A908A';

            tradeNetValue.textContent = formatCurrency(tradePlan.sellTotal || 0);
            tradeBuyValue.textContent = `Comprar: ${formatCurrency(tradePlan.buyTotal || 0)}`;
            tradeSellValue.textContent = `Vender: ${formatCurrency(tradePlan.sellTotal || 0)}`;
            tradeHint.textContent = tradePlan.reason || (tradePlan.sellTotal > 0 ? 'Ajuste com patrimônio atual' : 'Sem desvio detectado');

            const blocked = Boolean(aportePlan.blocked || tradePlan.blocked);
            rebalanceGuardMessage.textContent = blocked ? 'Adicione mais ativos para habilitar o rebalanceamento' : '';
            expandAporteDetailsBtn.disabled = Boolean(aportePlan.blocked);
            expandTradeDetailsBtn.disabled = Boolean(tradePlan.blocked);
        }

        function renderRows(viewRows) {
            if (!viewRows.length) {
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.textContent = 'Nenhum dado de alocação disponível para os filtros atuais.';
                allocList.replaceChildren(emptyState);
                return;
            }

            const scaleMax = Math.max(
                60,
                ...viewRows.map((row) => Number(row.realPct || 0)),
                ...viewRows.map((row) => Number(row.targetPct || 0))
            );

            const fragment = document.createDocumentFragment();

            viewRows.forEach((rowData) => {
                const hasChildren = (state.childrenByParent.get(rowData.id) || []).length > 0;
                const action = buildListActionText(rowData);

                const width = Math.max(0, Math.min(100, (Number(rowData.realPct || 0) / scaleMax) * 100));
                const targetPos = Math.max(0, Math.min(100, (Number(rowData.targetPct || 0) / scaleMax) * 100));

                const row = document.createElement('div');
                row.className = `alloc-row ${hasChildren ? '' : 'no-drill'}`.trim();
                row.setAttribute('data-node-id', rowData.id || '');
                row.setAttribute('data-drill', hasChildren ? '1' : '0');

                const lineTop = document.createElement('div');
                lineTop.className = 'row-header';

                const name = document.createElement('span');
                name.className = 'row-title';
                name.textContent = rowData.name || '—';

                const current = document.createElement('span');
                current.className = 'row-current';
                current.textContent = formatCurrency(rowData.currentValue);

                lineTop.appendChild(name);
                lineTop.appendChild(current);

                const barAction = document.createElement('div');
                barAction.className = 'bar-action-line';

                const barContainer = document.createElement('div');
                barContainer.className = 'bar-container';

                const barFill = document.createElement('div');
                barFill.className = `bar-fill ${rowData.status}`;
                barFill.style.width = `${width}%`;

                const targetMarker = document.createElement('div');
                targetMarker.className = 'bar-target-marker';
                targetMarker.style.left = `${targetPos}%`;
                targetMarker.setAttribute('title', `Meta: ${formatPercent(rowData.targetPct, 2)}`);

                barContainer.appendChild(barFill);
                barContainer.appendChild(targetMarker);

                const rowAction = document.createElement('span');
                rowAction.className = `row-action ${action.cssClass}`;
                rowAction.textContent = action.label;

                barAction.appendChild(barContainer);
                barAction.appendChild(rowAction);

                const lineBottom = document.createElement('div');
                lineBottom.className = 'row-header';
                lineBottom.style.marginTop = '6px';

                const leftMeta = document.createElement('div');
                leftMeta.className = 'row-meta';
                leftMeta.textContent = `${formatPercent(rowData.realPct, 2)} vs ${formatPercent(rowData.targetPct, 2)}`;

                const rightMeta = document.createElement('div');
                rightMeta.className = 'row-meta';

                const result = document.createElement('span');
                result.className = `row-result ${rowData.financialResultClass || 'neutral'}`;
                result.textContent = `Resultado: ${rowData.financialResultText || formatCurrency(rowData.financialResult || 0)}`;

                rightMeta.appendChild(result);
                lineBottom.appendChild(leftMeta);
                lineBottom.appendChild(rightMeta);

                row.appendChild(lineTop);
                row.appendChild(barAction);
                row.appendChild(lineBottom);
                fragment.appendChild(row);
            });

            allocList.replaceChildren(fragment);

            allocList.querySelectorAll('.alloc-row').forEach((row) => {
                row.addEventListener('click', () => {
                    const canDrill = row.getAttribute('data-drill') === '1';
                    if (!canDrill) return;

                    const nodeId = row.getAttribute('data-node-id');
                    if (!nodeId) return;

                    const inherited = roundCents(Math.max(0, Number(state.currentPlans.aporte?.actions?.get(nodeId) || 0)));
                    state.stack.push({ key: nodeId, inheritedAporte: inherited });
                    renderCurrentView();
                });
            });
        }

        function renderPlanTable(plan, targetBody) {
            targetBody.replaceChildren();
            const fragment = document.createDocumentFragment();

            plan.rows.forEach((rowData) => {
                const actionValue = Number(plan.actions.get(rowData.id) || 0);
                const postValue = roundCents(rowData.currentValue + actionValue);
                const postTotal = Number(plan.newTotal || rowData.baseTotal || 0);
                const postPct = postTotal > 0 ? (postValue / postTotal) * 100 : 0;

                const tr = document.createElement('tr');

                let actionText = 'Manter';
                if (actionValue > 0) {
                    actionText = plan.id === 'aporte' ? `Alocar ${formatCurrency(actionValue)}` : `Comprar ${formatCurrency(actionValue)}`;
                }
                if (actionValue < 0) {
                    actionText = `Vender ${formatCurrency(Math.abs(actionValue))}`;
                }

                const unitsText = buildEstimatedUnitsText(rowData, actionValue);

                tr.innerHTML = [
                    `<td>${rowData.name || '—'}</td>`,
                    `<td>${formatPercent(rowData.realPct, 2)}</td>`,
                    `<td>${actionText}${unitsText}</td>`,
                    `<td>${formatCurrency(Math.abs(actionValue))}</td>`,
                    `<td>${formatPercent(postPct, 2)}</td>`,
                ].join('');

                fragment.appendChild(tr);
            });

            targetBody.appendChild(fragment);
        }

        function renderAportePanel(aportePlan) {
            aportePlanAporteTotal.textContent = formatCurrency(aportePlan.total || 0);
            aportePlanEstimatedTotal.textContent = formatCurrency(aportePlan.newTotal || 0);
            aporteInheritedHint.textContent = aportePlan.sourceHint || '';

            renderPlanTable(aportePlan, aportePlanTableBody);

            aportePlanPanel.hidden = !state.expandedPanels.aporte;
            aportePlanPanel.classList.toggle('is-open', state.expandedPanels.aporte);
            expandAporteDetailsBtn.textContent = state.expandedPanels.aporte ? 'Ocultar' : 'Ver Detalhes';
        }

        function renderTradePanel(tradePlan) {
            tradePlanSellTotal.textContent = formatCurrency(tradePlan.sellTotal || 0);
            tradePlanBuyTotal.textContent = formatCurrency(tradePlan.buyTotal || 0);
            tradePlanTaxAlert.hidden = !tradePlan.hasTaxWarning;

            renderPlanTable(tradePlan, tradePlanTableBody);

            tradePlanPanel.hidden = !state.expandedPanels.trade;
            tradePlanPanel.classList.toggle('is-open', state.expandedPanels.trade);
            expandTradeDetailsBtn.textContent = state.expandedPanels.trade ? 'Ocultar' : 'Ver Detalhes';
        }

        function renderCurrentView() {
            backNav.style.display = state.stack.length > 1 ? 'block' : 'none';
            resolveViewText();
            syncControls();
            renderScore();

            const { viewData, aportePlan, tradePlan } = computePlans();
            renderScenarioHeaders(aportePlan, tradePlan);
            renderRows(viewData.rows);
            renderAportePanel(aportePlan);
            renderTradePanel(tradePlan);
        }

        function setMode(mode) {
            state.mode = mode;
            state.stack = [{ key: getRootForMode(mode), inheritedAporte: 0 }];
            renderCurrentView();
        }

        function setPriorityMode(mode) {
            state.priorityMode = mode;
            setStoredValue(STORAGE_KEYS.priorityMode, mode);
            renderCurrentView();
        }

        backNav.addEventListener('click', () => {
            if (state.stack.length > 1) {
                state.stack.pop();
                renderCurrentView();
            }
        });

        shadowRoot.querySelectorAll('[data-mode]').forEach((button) => {
            button.addEventListener('click', () => {
                const mode = button.getAttribute('data-mode') || 'class';
                setMode(mode);
            });
        });

        shadowRoot.querySelectorAll('[data-priority-mode]').forEach((button) => {
            button.addEventListener('click', () => {
                const mode = button.getAttribute('data-priority-mode') || 'deviation';
                setPriorityMode(mode);
                settingsMenu.classList.remove('open');
                settingsMenu.setAttribute('aria-hidden', 'true');
            });
        });

        settingsBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            const willOpen = !settingsMenu.classList.contains('open');
            settingsMenu.classList.toggle('open', willOpen);
            settingsMenu.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
        });

        shadowRoot.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (settingsWrap && !settingsWrap.contains(target)) {
                settingsMenu.classList.remove('open');
                settingsMenu.setAttribute('aria-hidden', 'true');
            }
        });

        expandAporteDetailsBtn?.addEventListener('click', () => {
            if (expandAporteDetailsBtn.disabled) return;
            state.expandedPanels.aporte = !state.expandedPanels.aporte;
            renderCurrentView();
        });

        expandTradeDetailsBtn?.addEventListener('click', () => {
            if (expandTradeDetailsBtn.disabled) return;
            state.expandedPanels.trade = !state.expandedPanels.trade;
            renderCurrentView();
        });

        window.addEventListener('resize', scaleToContainer);
        scaleToContainer();

        function applyModel(widgetModel) {
            state.model = normalizeWidgetModel(widgetModel);
            rebuildIndexes();

            if (!['class', 'subclass', 'asset'].includes(state.mode)) {
                state.mode = 'class';
            }

            state.stack = [{ key: getRootForMode(state.mode), inheritedAporte: 0 }];
            renderCurrentView();
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