(function initPainelAtividadesModule() {
    function parseMoneyText(value) {
        const normalized = String(value || '')
            .replace(/\s/g, '')
            .replace('R$', '')
            .replace(/\./g, '')
            .replace(',', '.');
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function formatCurrency(value, currency = 'BRL') {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: currency || 'BRL',
        }).format(Number(value || 0));
    }

    function formatDate(isoDate) {
        if (!isoDate) return '—';
        const [year, month, day] = String(isoDate).split('-');
        if (!year || !month || !day) return isoDate;
        return `${day}/${month}/${year}`;
    }

    function resolveBadgeClass(type) {
        if (type === 'compra' || type === 'aporte') return 'badge-compra';
        if (type === 'venda' || type === 'exclusao') return 'badge-venda';
        if (type === 'dividendo' || type === 'update_meta') return 'badge-provento';
        return 'badge-provento';
    }

    function resolveImpactClass(value) {
        if (value > 0) return 'val-pos';
        if (value < 0) return 'val-neg';
        return 'val-neutral';
    }

    function extractMetricData(cardResponse, metricId) {
        const cards = Array.isArray(cardResponse?.cards) ? cardResponse.cards : [];
        const card = cards.find((item) => item.cardId === 'card-painel-atividades') || cards[0] || null;
        const metrics = Array.isArray(card?.metrics) ? card.metrics : [];
        const metric = metrics.find((item) => item.metricId === metricId && item.status === 'ok');
        return metric?.data || null;
    }

    function buildImpactMapFromFinancialResult(cardResponse) {
        const data = extractMetricData(cardResponse, 'investments.financial_result');
        const widget = data?.widget;
        const views = widget && typeof widget === 'object' ? widget.views : null;
        const map = new Map();

        if (!views || typeof views !== 'object') {
            return map;
        }

        Object.entries(views).forEach(([viewId, view]) => {
            if (!String(viewId).startsWith('asset-')) return;
            const assetId = String(viewId).replace('asset-', '');
            const valueNumber = parseMoneyText(view?.value);
            map.set(assetId, valueNumber);
        });

        return map;
    }

    function createPainelCardController(slotElement) {
        if (!slotElement) return null;

        const section = slotElement.closest('.fixed-activities') || slotElement;
        const periodButtons = Array.from(section.querySelectorAll('[data-period]'));
        const clearTrigger = section.querySelector('#painel-clear-trigger');
        const clearMenu = section.querySelector('#painel-clear-menu');
        const tableBody = section.querySelector('#painel-atividades-tbody');
        const pageInfo = section.querySelector('#painel-page-info');
        const prevButton = section.querySelector('#painel-page-prev');
        const nextButton = section.querySelector('#painel-page-next');
        const emptyState = section.querySelector('#painel-empty-state');

        if (!tableBody || !pageInfo || !prevButton || !nextButton || !emptyState) {
            return null;
        }

        const state = {
            rows: [],
            page: 1,
            pageSize: 8,
            loading: false,
            filters: {
                activityPeriod: 'all',
                activityLimit: 120,
            },
            paging: {
                nextCursor: null,
                hasMore: false,
            },
        };

        function setLoadingStatus(isLoading) {
            state.loading = isLoading;
            section.classList.toggle('painel-loading', isLoading);
        }

        function updatePager(totalItems) {
            const totalPages = Math.max(1, Math.ceil(totalItems / state.pageSize));
            if (state.page > totalPages) state.page = totalPages;
            pageInfo.textContent = `Página ${state.page} de ${totalPages}`;
            prevButton.disabled = state.page <= 1;
            nextButton.disabled = state.page >= totalPages;
        }

        function renderRows() {
            const totalItems = state.rows.length;
            const start = (state.page - 1) * state.pageSize;
            const pageRows = state.rows.slice(start, start + state.pageSize);
            updatePager(totalItems);

            if (!pageRows.length) {
                tableBody.innerHTML = '';
                emptyState.style.display = '';
                return;
            }

            emptyState.style.display = 'none';
            const fragment = document.createDocumentFragment();

            pageRows.forEach((row) => {
                const badgeClass = resolveBadgeClass(row.activityType);
                const quantity = Number(row.quantity || 0);
                const impactValue = Number(row.impact?.value || 0);
                const impactClass = resolveImpactClass(impactValue);

                const tr = document.createElement('tr');

                const dateCell = document.createElement('td');
                dateCell.textContent = formatDate(row.referenceDate);
                tr.appendChild(dateCell);

                const assetCell = document.createElement('td');
                assetCell.textContent = row.assetDisplay || '—';
                tr.appendChild(assetCell);

                const activityCell = document.createElement('td');
                const badge = document.createElement('span');
                badge.className = `badge ${badgeClass}`;
                badge.textContent = row.activityLabel || 'Movimentação';
                activityCell.appendChild(badge);
                tr.appendChild(activityCell);

                const quantityCell = document.createElement('td');
                quantityCell.className = 'text-right';
                quantityCell.textContent = quantity ? quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 }) : '—';
                tr.appendChild(quantityCell);

                const unitPriceCell = document.createElement('td');
                unitPriceCell.className = 'text-right';
                unitPriceCell.textContent = Number(row.unitPrice || 0) > 0 ? formatCurrency(row.unitPrice, row.currency) : '—';
                tr.appendChild(unitPriceCell);

                const impactCell = document.createElement('td');
                impactCell.className = `text-right ${impactClass}`;
                impactCell.textContent = formatCurrency(impactValue, row.currency);
                tr.appendChild(impactCell);

                fragment.appendChild(tr);
            });

            tableBody.replaceChildren(fragment);
        }

        function applyPeriodButtons() {
            periodButtons.forEach((button) => {
                const selected = button.getAttribute('data-period') === state.filters.activityPeriod;
                button.classList.toggle('active', selected);
            });
        }

        function normalizeRows(cardResponse) {
            const historyData = extractMetricData(cardResponse, 'investments.activities_history');
            const items = Array.isArray(historyData?.items) ? historyData.items : [];
            state.paging = historyData?.paging || { nextCursor: null, hasMore: false };
            const impactByAssetId = buildImpactMapFromFinancialResult(cardResponse);

            return items.map((item) => {
                const assetId = item.assetId || null;
                const impactValue = assetId && impactByAssetId.has(assetId)
                    ? Number(impactByAssetId.get(assetId) || 0)
                    : 0;

                return {
                    ...item,
                    assetDisplay: item.ticker || item.assetName || item.assetId || '—',
                    impact: {
                        value: impactValue,
                        label: formatCurrency(impactValue, item.currency || 'BRL'),
                        className: resolveImpactClass(impactValue),
                        source: 'investments.financial_result',
                    },
                };
            });
        }

        async function fetchAndRenderLiveData(filterOverrides = {}) {
            state.filters = {
                ...state.filters,
                ...filterOverrides,
            };

            setLoadingStatus(true);

            try {
                const response = await window.YieldInvestments.api.queryCards(
                    [
                        {
                            cardId: 'card-painel-atividades',
                            title: 'Painel de Atividades',
                            presentation: 'table',
                            metricIds: ['investments.activities_history', 'investments.financial_result'],
                        },
                    ],
                    state.filters
                );

                state.rows = normalizeRows(response);
                state.page = 1;
                applyPeriodButtons();
                renderRows();
                return response;
            } finally {
                setLoadingStatus(false);
            }
        }

        async function clearHistoryByScope(scope) {
            const labels = {
                '30d': 'últimos 30 dias',
                '90d': 'últimos 90 dias',
                all: 'todo o histórico',
            };

            const confirmMessage = `Confirma apagar ${labels[scope] || 'o histórico selecionado'} do painel de atividades?`;
            if (!window.confirm(confirmMessage)) return;

            setLoadingStatus(true);
            try {
                await window.YieldInvestments.api.clearActivitiesHistory(scope);
                await fetchAndRenderLiveData();
            } finally {
                setLoadingStatus(false);
            }
        }

        periodButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const period = button.getAttribute('data-period') || 'all';
                fetchAndRenderLiveData({ activityPeriod: period }).catch(() => {});
            });
        });

        prevButton.addEventListener('click', () => {
            if (state.page <= 1) return;
            state.page -= 1;
            renderRows();
        });

        nextButton.addEventListener('click', () => {
            const totalPages = Math.max(1, Math.ceil(state.rows.length / state.pageSize));
            if (state.page >= totalPages) return;
            state.page += 1;
            renderRows();
        });

        if (clearTrigger && clearMenu) {
            clearTrigger.addEventListener('click', () => {
                clearMenu.classList.toggle('open');
            });

            clearMenu.addEventListener('click', (event) => {
                const target = event.target.closest('[data-clear-scope]');
                if (!target) return;
                clearMenu.classList.remove('open');
                const scope = target.getAttribute('data-clear-scope') || 'all';
                clearHistoryByScope(scope).catch(() => {});
            });

            document.addEventListener('click', (event) => {
                if (!clearMenu.classList.contains('open')) return;
                if (clearMenu.contains(event.target) || clearTrigger.contains(event.target)) return;
                clearMenu.classList.remove('open');
            });
        }

        applyPeriodButtons();
        renderRows();

        return {
            fetchAndRenderLiveData,
        };
    }

    window.YieldInvestmentsPainel = {
        createPainelCardController,
    };
})();
