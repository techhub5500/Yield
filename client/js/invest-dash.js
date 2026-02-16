document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('wheel', () => {}, { passive: true });
    window.addEventListener('touchstart', () => {}, { passive: true });

    if (window.YieldAuth && !window.YieldAuth.isAuthenticated()) {
        return;
    }

    const InvestmentsApi = {
        _baseUrl: (() => {
            if (window.location.protocol === 'file:') return 'http://localhost:3000';
            const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
            if (isLocalHost && window.location.port && window.location.port !== '3000') {
                return 'http://localhost:3000';
            }
            return '';
        })(),

        async _request(path, options = {}) {
            const headers = options.headers || {};
            const token = window.YieldAuth?.getToken?.();
            if (token) headers.Authorization = `Bearer ${token}`;

            const response = await fetch(this._baseUrl + path, {
                ...options,
                headers,
            });

            if (response.status === 401) {
                window.YieldAuth?.clearToken?.();
                window.location.href = '/html/login.html';
                throw new Error('Sessão expirada');
            }

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => ({}));
                throw new Error(errorPayload.error || `HTTP ${response.status}`);
            }

            return response.json();
        },

        getManifest() {
            return this._request('/api/investments/manifest');
        },

        queryMetrics(metricIds = [], filters = {}) {
            return this._request('/api/investments/metrics/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ metricIds, filters }),
            });
        },

        queryCards(cards = [], filters = {}) {
            return this._request('/api/investments/cards/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cards, filters }),
            });
        },

        createManualAsset(payload = {}) {
            return this._request('/api/investments/assets/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        },

        searchAssets(query = '', limit = 20) {
            const params = new URLSearchParams({ q: query, limit: String(limit) });
            return this._request(`/api/investments/assets/search?${params.toString()}`);
        },

        editAsset(assetId, operation, payload = {}) {
            return this._request(`/api/investments/assets/${encodeURIComponent(assetId)}/edit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operation, payload }),
            });
        },

        deleteAsset(assetId) {
            return this._request(`/api/investments/assets/${encodeURIComponent(assetId)}`, {
                method: 'DELETE',
            });
        },

        getBrapiQuoteByTicker(ticker, date) {
            const params = new URLSearchParams({ ticker: String(ticker || '') });
            if (date) params.set('date', String(date));
            return this._request(`/api/investments/brapi/quote?${params.toString()}`);
        },

        getBrapiQuoteByAsset(assetId, date) {
            const params = new URLSearchParams();
            if (date) params.set('date', String(date));
            const query = params.toString();
            const suffix = query ? `?${query}` : '';
            return this._request(`/api/investments/assets/${encodeURIComponent(assetId)}/quote${suffix}`);
        },
    };

    function collectSlots() {
        const mainCards = Array.from(document.querySelectorAll('.main-card-full'));
        const miniCards = Array.from(document.querySelectorAll('.mini-info-card'));

        return {
            main: mainCards.map((element, index) => ({ slotId: `main-${index + 1}`, element })),
            mini: miniCards.map((element, index) => ({ slotId: `mini-${index + 1}`, element })),
        };
    }

    window.YieldInvestments = {
        api: InvestmentsApi,
        slots: collectSlots(),
        state: {
            manifest: null,
        },
        cards: {},
        async preloadManifest() {
            const data = await InvestmentsApi.getManifest();
            this.state.manifest = data;
            return data;
        },
    };

    const patrimonioFactory = window.YieldInvestmentsPatrimonio?.createPatrimonioCardController;
    const normalizeWidgetModel = window.YieldInvestmentsPatrimonio?.normalizeWidgetModel;
    const rentabilidadeFactory = window.YieldInvestmentsRentabilidade?.createRentabilidadeCardController;
    const resultadoFactory = window.YieldInvestmentsResultado?.createResultadoCardController;
    const alocacaoFactory = window.YieldInvestmentsAlocacao?.createAlocacaoCardController;
    const manualModalFactory = window.YieldInvestmentsManualModal?.createManualAssetModalController;

    const patrimonioSlot = document.getElementById('patrimonio-card-slot');
    const resultadoSlot = document.getElementById('resultado-card-slot');
    const alocacaoSlot = document.getElementById('alocacao-card-slot');
    const rentabilidadeSlot = document.getElementById('rentabilidade-card-slot');
    const patrimonioCard = typeof patrimonioFactory === 'function'
        ? patrimonioFactory(patrimonioSlot)
        : null;
    const resultadoCard = typeof resultadoFactory === 'function'
        ? resultadoFactory(resultadoSlot)
        : null;
    const alocacaoCard = typeof alocacaoFactory === 'function'
        ? alocacaoFactory(alocacaoSlot)
        : null;
    const rentabilidadeCard = typeof rentabilidadeFactory === 'function'
        ? rentabilidadeFactory(rentabilidadeSlot)
        : null;

    if (typeof manualModalFactory === 'function') {
        manualModalFactory();
    }

    if (patrimonioCard) {
        window.YieldInvestments.cards.patrimonio = patrimonioCard;
        patrimonioCard.fetchAndRenderLiveData().catch(() => {
            if (typeof normalizeWidgetModel === 'function') {
                patrimonioCard.applyModel(normalizeWidgetModel(null));
            }
        });
    }

    if (rentabilidadeCard) {
        window.YieldInvestments.cards.rentabilidade = rentabilidadeCard;
        rentabilidadeCard.fetchAndRenderLiveData().catch(() => {});
    }

    if (resultadoCard) {
        window.YieldInvestments.cards.resultado = resultadoCard;
        resultadoCard.fetchAndRenderLiveData().catch(() => {});
    }

    if (alocacaoCard) {
        window.YieldInvestments.cards.alocacao = alocacaoCard;
        alocacaoCard.fetchAndRenderLiveData().catch(() => {});
    }

    window.YieldInvestments.preloadManifest().catch(() => {});

    const mainOptBtns = document.querySelectorAll('.main-opt-btn');
    const optionContents = document.querySelectorAll('.option-content');
    mainOptBtns.forEach((button) => {
        button.addEventListener('click', () => {
            const target = button.getAttribute('data-target');
            mainOptBtns.forEach((item) => item.classList.remove('active'));
            button.classList.add('active');

            optionContents.forEach((content) => {
                content.classList.remove('active');
                if (content.id === target) content.classList.add('active');
            });
        });
    });

    const cardOptions = document.querySelectorAll('.card-opt');
    cardOptions.forEach((option) => {
        option.addEventListener('click', () => {
            const parent = option.parentElement;
            parent.querySelectorAll('.card-opt').forEach((item) => item.classList.remove('active'));
            option.classList.add('active');

            const mainCardTarget = option.getAttribute('data-main-card');
            if (!mainCardTarget || !patrimonioSlot || !resultadoSlot || !alocacaoSlot) return;

            const showSlot = (target) => {
                patrimonioSlot.style.display = target === 'patrimonio' ? '' : 'none';
                resultadoSlot.style.display = target === 'resultado' ? '' : 'none';
                alocacaoSlot.style.display = target === 'alocacao' ? '' : 'none';
            };

            if (mainCardTarget === 'patrimonio') {
                showSlot('patrimonio');
                if (patrimonioCard) {
                    patrimonioCard.fetchAndRenderLiveData().catch(() => {});
                }
            }

            if (mainCardTarget === 'resultado') {
                showSlot('resultado');
                if (resultadoCard) {
                    resultadoCard.fetchAndRenderLiveData().catch(() => {});
                }
            }

            if (mainCardTarget === 'alocacao') {
                showSlot('alocacao');
                if (alocacaoCard) {
                    alocacaoCard.fetchAndRenderLiveData().catch(() => {});
                }
            }
        });
    });

    const bottomMenu = document.getElementById('bottom-menu');
    const toggleBtn = document.getElementById('toggle-bottom-menu');
    const menuIcon = document.getElementById('menu-icon');

    if (toggleBtn && bottomMenu) {
        toggleBtn.addEventListener('click', () => {
            bottomMenu.classList.toggle('expanded');
            bottomMenu.classList.toggle('collapsed');

            if (bottomMenu.classList.contains('collapsed')) {
                menuIcon.classList.replace('fa-times', 'fa-bars');
            }
        });
    }

    const navOpts = document.querySelectorAll('.nav-opt');
    navOpts.forEach((option) => {
        option.addEventListener('click', () => {
            navOpts.forEach((item) => item.classList.remove('active'));
            option.classList.add('active');
        });
    });
});
