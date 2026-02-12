document.addEventListener('DOMContentLoaded', () => {
    // Base de investimentos: não renderiza métricas ainda.
    // Apenas prepara:
    // - API client autenticado
    // - mapeamento de slots de cards
    // - helpers globais para testes futuros via console

    // ---- Otimização de Scroll ----
    // Remove qualquer delay potencial garantindo que o navegador não espere por JS para rolar
    window.addEventListener('wheel', () => {}, { passive: true });
    window.addEventListener('touchstart', () => {}, { passive: true });

    // ---- Guard: autenticação ----
    if (window.YieldAuth && !window.YieldAuth.isAuthenticated()) {
        return;
    }

    // ---- API Client (Investimentos) ----
    const InvestmentsApi = {
        _baseUrl: (function resolveBaseUrl() {
            if (window.location.protocol === 'file:') {
                return 'http://localhost:3000';
            }
            return '';
        })(),

        async _request(path, options = {}) {
            const headers = options.headers || {};
            const token = window.YieldAuth?.getToken?.();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(this._baseUrl + path, {
                ...options,
                headers,
            });

            if (res.status === 401) {
                window.YieldAuth?.clearToken?.();
                window.location.href = '/html/login.html';
                throw new Error('Sessão expirada');
            }

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
            }

            return res.json();
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
    };

    // ---- Slots do Dashboard ----
    function collectSlots() {
        const mainCards = Array.from(document.querySelectorAll('.main-card-50'));
        const miniCards = Array.from(document.querySelectorAll('.stat-card-mini'));

        const mainSlots = mainCards.map((el, index) => ({
            slotId: `main-${index + 1}`,
            element: el,
        }));

        const miniSlots = miniCards.map((el, index) => ({
            slotId: `mini-${index + 1}`,
            element: el,
        }));

        return {
            main: mainSlots,
            mini: miniSlots,
        };
    }

    const slots = collectSlots();

    // ---- Expor base para console/debug (para testes futuros) ----
    window.YieldInvestments = {
        api: InvestmentsApi,
        slots,
        state: {
            manifest: null,
        },
        async preloadManifest() {
            const data = await InvestmentsApi.getManifest();
            this.state.manifest = data;
            return data;
        },
    };

    // Preload silencioso do manifest (sem alterar UI)
    window.YieldInvestments.preloadManifest().catch(() => {});

    // ---- Main Options Switcher ----
    const mainOptBtns = document.querySelectorAll('.main-opt-btn');
    const optionContents = document.querySelectorAll('.option-content');

    mainOptBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');

            // Toggle active button
            mainOptBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Toggle active content
            optionContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === target) {
                    content.classList.add('active');
                }
            });
        });
    });

    // ---- Card Options Switcher ----
    const cardOptions = document.querySelectorAll('.card-opt');
    cardOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            // Find sibling buttons in the same header and remove active
            const parent = opt.parentElement;
            parent.querySelectorAll('.card-opt').forEach(b => b.classList.remove('active'));
            opt.classList.add('active');
        });
    });

    // ---- Bottom Floating Menu Toggle ----
    const bottomMenu = document.getElementById('bottom-menu');
    const toggleBtn = document.getElementById('toggle-bottom-menu');
    const menuIcon = document.getElementById('menu-icon');

    if (toggleBtn && bottomMenu) {
        toggleBtn.addEventListener('click', () => {
            bottomMenu.classList.toggle('expanded');
            bottomMenu.classList.toggle('collapsed');

            // Change icon from Bars to "X" or just keep bars
            if (bottomMenu.classList.contains('collapsed')) {
                menuIcon.classList.replace('fa-times', 'fa-bars'); 
            } else {
                // If you want a close icon when expanded
                // menuIcon.classList.replace('fa-bars', 'fa-times');
            }
        });
    }

    // ---- Top Navigation Options ----
    const navOpts = document.querySelectorAll('.nav-opt');
    navOpts.forEach(opt => {
        opt.addEventListener('click', () => {
            navOpts.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
        });
    });
});
