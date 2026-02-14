(function initManualAssetModalModule() {
    function createManualAssetModalController() {
        const trigger = document.getElementById('manual-asset-trigger');
        const overlay = document.getElementById('manual-asset-modal-overlay');
        const closeBtn = document.getElementById('manual-asset-close');
        const body = document.getElementById('manual-asset-modal-body');

        if (!trigger || !overlay || !closeBtn || !body) {
            return null;
        }

        const today = () => new Date().toISOString().slice(0, 10);

        const classOptions = [
            { id: 'equity', label: 'Renda Variável' },
            { id: 'fixed_income', label: 'Renda Fixa' },
            { id: 'funds', label: 'Fundos' },
            { id: 'crypto', label: 'Criptoativos' },
        ];

        const categoriesByClass = {
            equity: ['Ações', 'FIIs', 'ETFs', 'BDRs'],
            fixed_income: ['CDB', 'LCI', 'LCA', 'Tesouro', 'Debêntures'],
            funds: ['Multimercado', 'Ações', 'Cambial', 'Previdência'],
            crypto: ['Bitcoin', 'Ethereum', 'Altcoins', 'Stablecoins'],
        };

        const addFieldsByClass = {
            equity: [
                { id: 'ticker', label: 'Ticker (código)', placeholder: 'Ex.: PETR4, HGLG11', help: 'Código do ativo na corretora.', required: true },
                { id: 'operationType', label: 'Tipo de operação', type: 'select', options: ['Compra', 'Venda', 'Bonificação', 'Grupamento/Desdobramento'], help: 'Selecione o evento da nota de corretagem.', required: true },
                { id: 'operationDate', label: 'Data da operação', type: 'date', help: 'Data da nota de corretagem.', required: true },
                { id: 'quantity', label: 'Quantidade', type: 'number', min: '0', step: '0.0001', help: 'Quantidade de cotas/ações negociadas.', required: true },
                { id: 'unitPrice', label: 'Preço unitário', type: 'number', min: '0', step: '0.0001', help: 'Preço pago por unidade na operação.', required: true },
                { id: 'allocationTargetPct', label: 'Alocação Meta (%)', type: 'number', min: '0', step: '0.01', placeholder: 'Ex.: 15', help: 'Quanto você planeja ter deste ativo na carteira.' },
                { id: 'fees', label: 'Taxas (opcional)', type: 'number', min: '0', step: '0.0001', help: 'Corretagem e emolumentos para preço médio real.' },
                { id: 'broker', label: 'Corretora (opcional)', placeholder: 'Ex.: XP, NuInvest', help: 'Ajuda a lembrar onde o ativo está custodiado.' },
            ],
            fixed_income: [
                { id: 'name', label: 'Nome do ativo/emissor', placeholder: 'Ex.: CDB Banco Inter', help: 'Nome que identifica o título aplicado.', required: true },
                { id: 'appliedValue', label: 'Valor aplicado (R$)', type: 'number', min: '0', step: '0.01', help: 'Valor investido no dia da aplicação.', required: true },
                { id: 'indexer', label: 'Indexador', type: 'select', options: ['CDI', 'IPCA', 'Pré-fixado', 'SELIC'], help: 'Base usada para corrigir o rendimento.', required: true },
                { id: 'rate', label: 'Taxa do ativo', type: 'number', min: '0', step: '0.0001', help: 'Ex.: 110 (% do CDI) ou 6.5 (IPCA + %).', required: true },
                { id: 'applicationDate', label: 'Data de aplicação', type: 'date', help: 'Dia em que o dinheiro saiu da conta.', required: true },
                { id: 'maturityDate', label: 'Data de vencimento', type: 'date', help: 'Data em que o valor retorna para sua conta.', required: true },
                { id: 'liquidity', label: 'Liquidez', type: 'select', options: ['No Vencimento', 'Diária'], help: 'Informa se o resgate é livre ou só no vencimento.', required: true },
                { id: 'allocationTargetPct', label: 'Alocação Meta (%)', type: 'number', min: '0', step: '0.01', placeholder: 'Ex.: 25', help: 'Quanto você planeja ter deste ativo na carteira.' },
                { id: 'broker', label: 'Instituição (opcional)', placeholder: 'Ex.: Banco Inter', help: 'Onde o título foi contratado.' },
            ],
            funds: [
                { id: 'name', label: 'Nome do fundo / CNPJ', placeholder: 'Ex.: Fundo XP Ações', help: 'Identificação do fundo investido.', required: true },
                { id: 'transactionValue', label: 'Valor da transação (R$)', type: 'number', min: '0', step: '0.01', help: 'Valor bruto do aporte ou resgate.', required: true },
                { id: 'shares', label: 'Quantidade de cotas (opcional)', type: 'number', min: '0', step: '0.00000001', help: 'Se souber, melhora a precisão do histórico.' },
                { id: 'quotationDate', label: 'Data da cotização', type: 'date', help: 'Data em que o aporte/resgate foi processado.', required: true },
                { id: 'transactionType', label: 'Tipo', type: 'select', options: ['Aplicação', 'Resgate'], help: 'Selecione se entrou ou saiu dinheiro do fundo.', required: true },
                { id: 'allocationTargetPct', label: 'Alocação Meta (%)', type: 'number', min: '0', step: '0.01', placeholder: 'Ex.: 20', help: 'Quanto você planeja ter deste ativo na carteira.' },
            ],
            crypto: [
                { id: 'ticker', label: 'Ativo', placeholder: 'Ex.: BTC, ETH, SOL', help: 'Sigla da criptomoeda negociada.', required: true },
                { id: 'operationDate', label: 'Data da operação', type: 'date', help: 'Data da compra/venda na exchange.', required: true },
                { id: 'quantity', label: 'Quantidade', type: 'number', min: '0', step: '0.00000001', help: 'Aceita até 8 casas decimais.', required: true },
                { id: 'purchaseCurrency', label: 'Moeda de compra', type: 'select', options: ['BRL', 'USD'], help: 'Moeda usada na negociação.', required: true },
                { id: 'unitPrice', label: 'Preço unitário', type: 'number', min: '0', step: '0.00000001', help: 'Preço por unidade no momento da operação.', required: true },
                { id: 'allocationTargetPct', label: 'Alocação Meta (%)', type: 'number', min: '0', step: '0.01', placeholder: 'Ex.: 10', help: 'Quanto você planeja ter deste ativo na carteira.' },
                { id: 'exchangeFee', label: 'Taxa da exchange (opcional)', type: 'number', min: '0', step: '0.00000001', help: 'Custo cobrado pela corretora de cripto.' },
                { id: 'exchange', label: 'Exchange (opcional)', placeholder: 'Ex.: Binance', help: 'Onde a operação foi feita.' },
            ],
        };

        const movementCatalog = [
            {
                id: 'add_buy',
                label: 'Compra/Aporte',
                description: 'Aumenta posição e recalcula preço médio.',
            },
            {
                id: 'add_sell',
                label: 'Venda/Resgate',
                description: 'Reduz posição e registra resultado realizado.',
            },
            {
                id: 'add_income',
                label: 'Proventos (Dividendos/JCP)',
                description: 'Registra renda recebida sem mudar o preço médio.',
            },
            {
                id: 'update_balance',
                label: 'Atualizar Saldo Atual (Renda Fixa)',
                description: 'Atualiza saldo informado pelo banco e calcula rendimento.',
                onlyAssetClass: 'fixed_income',
            },
            {
                id: 'delete_asset',
                label: 'Apagar Ativo por Completo',
                description: 'Remove permanentemente o ativo, histórico e posições. Não pode ser desfeito.',
                danger: true,
            },
        ];

        const editFieldsByOperation = {
            add_buy: [
                { id: 'referenceDate', label: 'Data da movimentação', type: 'date', help: 'Data da compra/aporte.', required: true },
                { id: 'quantity', label: 'Quantidade', type: 'number', min: '0', step: '0.00000001', help: 'Quantidade adicionada à posição.', required: true },
                { id: 'price', label: 'Preço unitário', type: 'number', min: '0', step: '0.00000001', help: 'Valor por unidade nesta compra.', required: true },
                { id: 'fees', label: 'Taxas (opcional)', type: 'number', min: '0', step: '0.00000001', help: 'Custos operacionais da movimentação.' },
                { id: 'marketPrice', label: 'Preço atual (opcional)', type: 'number', min: '0', step: '0.00000001', help: 'Preço de mercado para atualizar o painel.' },
            ],
            add_sell: [
                { id: 'referenceDate', label: 'Data da movimentação', type: 'date', help: 'Data da venda/resgate.', required: true },
                { id: 'quantity', label: 'Quantidade vendida/resgatada', type: 'number', min: '0', step: '0.00000001', help: 'Quantidade que saiu da posição.', required: true },
                { id: 'price', label: 'Preço de venda', type: 'number', min: '0', step: '0.00000001', help: 'Preço efetivo da venda/resgate.', required: true },
                { id: 'fees', label: 'Taxas (opcional)', type: 'number', min: '0', step: '0.00000001', help: 'Custos cobrados nessa saída.' },
            ],
            add_income: [
                { id: 'referenceDate', label: 'Data do recebimento', type: 'date', help: 'Data em que o provento caiu na conta.', required: true },
                { id: 'incomeType', label: 'Tipo de provento', type: 'select', options: ['Dividendos', 'JCP'], help: 'Classificação para relatório de renda passiva.', required: true },
                { id: 'grossAmount', label: 'Valor recebido (R$)', type: 'number', min: '0', step: '0.01', help: 'Valor bruto do provento.', required: true },
            ],
            update_balance: [
                { id: 'referenceDate', label: 'Data da atualização', type: 'date', help: 'Data do saldo informado no app do banco.', required: true },
                { id: 'currentBalance', label: 'Saldo atual (R$)', type: 'number', min: '0', step: '0.01', help: 'Saldo atual mostrado pela instituição.', required: true },
            ],
            delete_asset: [
                { id: 'confirmation', label: 'Confirmação', placeholder: 'Escreva "APAGAR AGORA"', help: 'Para deletar permanentemente, digite a frase exigida.', required: true },
            ],
        };

        const state = {
            flow: null,
            step: 1,
            loading: false,
            error: '',
            success: '',
            addPayload: {
                assetClass: '',
                category: '',
                fields: {},
                brapi: {
                    loading: false,
                    error: '',
                    quote: null,
                    confirmed: false,
                    lookupKey: '',
                },
            },
            edit: {
                query: '',
                results: [],
                selectedAsset: null,
                operation: '',
                fields: {
                    referenceDate: today(),
                },
                brapi: {
                    loading: false,
                    error: '',
                    quote: null,
                    lookupKey: '',
                },
            },
        };

        function escapeHtml(value) {
            return String(value || '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;');
        }

        function parseNumber(rawValue) {
            if (rawValue === null || rawValue === undefined || rawValue === '') return null;
            const normalized = String(rawValue).replace(',', '.');
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : null;
        }

        function formatCurrency(value, currency = 'BRL') {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: currency || 'BRL',
            }).format(Number(value || 0));
        }

        function shouldUseBrapiByAssetClass(assetClass) {
            return assetClass === 'equity' || assetClass === 'crypto';
        }

        function isTickerLike(value) {
            return /^[A-Z]{3,6}\d{0,2}$/.test(String(value || '').trim().toUpperCase());
        }

        function buildAddLookupKey() {
            const ticker = String(state.addPayload.fields.ticker || '').trim().toUpperCase();
            const date = String(state.addPayload.fields.operationDate || today()).trim();
            return `${ticker}|${date}`;
        }

        function buildEditLookupKey() {
            const assetId = state.edit.selectedAsset?.assetId || '';
            const date = String(state.edit.fields.referenceDate || today()).trim();
            return `${assetId}|${date}|${state.edit.operation}`;
        }

        function renderAddBrapiPreview() {
            if (!shouldUseBrapiByAssetClass(state.addPayload.assetClass)) return '';

            const brapi = state.addPayload.brapi;
            const ticker = String(state.addPayload.fields.ticker || '').trim().toUpperCase();

            if (!ticker) {
                return '<div class="manual-field-help">Informe o ticker para buscar dados da Brapi.</div>';
            }

            if (brapi.loading) {
                return '<div class="manual-field-help">Consultando ticker na Brapi...</div>';
            }

            if (brapi.error) {
                return `<div class="manual-error-msg">${escapeHtml(brapi.error)}</div>`;
            }

            if (!brapi.quote) {
                return '<div class="manual-field-help">Aguardando consulta de preço pela Brapi.</div>';
            }

            return `
                <div class="manual-field-help">
                    <strong>${escapeHtml(brapi.quote.ticker || ticker)}</strong> · ${escapeHtml(brapi.quote.shortName || brapi.quote.longName || 'Ativo')}
                    <br />Preço na data (${escapeHtml(brapi.quote.sourceDate || brapi.quote.referenceDate)}):
                    <strong>${escapeHtml(formatCurrency(brapi.quote.priceOnReferenceDate, brapi.quote.currency))}</strong>
                    <br />
                    ${brapi.confirmed
                        ? '<span class="manual-success-msg">Ativo confirmado. Preço unitário carregado automaticamente.</span>'
                        : '<button class="manual-submit-btn" data-action="confirm-add-brapi" type="button">Confirmar ativo e aplicar preço</button>'}
                </div>
            `;
        }

        function renderEditBrapiHint() {
            if (!['add_buy', 'add_sell'].includes(state.edit.operation)) return '';

            const brapi = state.edit.brapi;

            if (brapi.loading) {
                return '<div class="manual-field-help">Consultando preço da data na Brapi...</div>';
            }

            if (brapi.error) {
                return `<div class="manual-error-msg">${escapeHtml(brapi.error)}</div>`;
            }

            if (!brapi.quote) return '';

            return `
                <div class="manual-field-help">
                    Preço sugerido pela Brapi em ${escapeHtml(brapi.quote.sourceDate || brapi.quote.referenceDate)}:
                    <strong>${escapeHtml(formatCurrency(brapi.quote.priceOnReferenceDate, brapi.quote.currency))}</strong>
                </div>
            `;
        }

        function getAddFields() {
            return addFieldsByClass[state.addPayload.assetClass] || [];
        }

        function getAllowedMovements() {
            const assetClass = state.edit.selectedAsset?.assetClass || '';
            return movementCatalog.filter((item) => !item.onlyAssetClass || item.onlyAssetClass === assetClass);
        }

        function getEditFields() {
            return editFieldsByOperation[state.edit.operation] || [];
        }

        function openModal() {
            overlay.classList.add('open');
            overlay.setAttribute('aria-hidden', 'false');
            resetFlow();
            render();
        }

        function closeModal() {
            overlay.classList.remove('open');
            overlay.setAttribute('aria-hidden', 'true');
        }

        function resetFlow() {
            state.flow = null;
            state.step = 1;
            state.loading = false;
            state.error = '';
            state.success = '';
            state.addPayload = { assetClass: '', category: '', fields: {} };
            state.edit = {
                query: '',
                results: [],
                selectedAsset: null,
                operation: '',
                fields: { referenceDate: today() },
                brapi: {
                    loading: false,
                    error: '',
                    quote: null,
                    lookupKey: '',
                },
            };

            state.addPayload.brapi = {
                loading: false,
                error: '',
                quote: null,
                confirmed: false,
                lookupKey: '',
            };
        }

        function setError(message) {
            state.error = message || '';
            state.success = '';
        }

        function setSuccess(message) {
            state.success = message || '';
            state.error = '';
        }

        function renderFeedback() {
            if (state.error) return `<div class="manual-error-msg">${escapeHtml(state.error)}</div>`;
            if (state.success) return `<div class="manual-success-msg">${escapeHtml(state.success)}</div>`;
            return '';
        }

        function renderField(field, value, inputIdPrefix) {
            const inputId = `${inputIdPrefix}-${field.id}`;
            const requiredMark = field.required ? ' *' : '';
            const commonAttrs = [
                field.min !== undefined ? `min="${escapeHtml(field.min)}"` : '',
                field.step !== undefined ? `step="${escapeHtml(field.step)}"` : '',
                field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : '',
            ].filter(Boolean).join(' ');

            const inputHtml = field.type === 'select'
                ? `
                    <select id="${inputId}" data-field-id="${field.id}" ${field.required ? 'required' : ''}>
                        <option value="">Selecione</option>
                        ${(field.options || []).map((option) => `
                            <option value="${escapeHtml(option)}" ${String(value || '') === String(option) ? 'selected' : ''}>${escapeHtml(option)}</option>
                        `).join('')}
                    </select>
                `
                : `
                    <input
                        id="${inputId}"
                        data-field-id="${field.id}"
                        type="${field.type || 'text'}"
                        value="${escapeHtml(value || '')}"
                        ${commonAttrs}
                        ${field.required ? 'required' : ''}
                    />
                `;

            return `
                <label class="manual-field" for="${inputId}">
                    <span class="manual-field-label">${escapeHtml(field.label)}${requiredMark}</span>
                    ${inputHtml}
                    <span class="manual-field-help">${escapeHtml(field.help || '')}</span>
                </label>
            `;
        }

        function renderFlowChooser() {
            body.innerHTML = `
                <div class="manual-step-title">Primeira etapa</div>
                <div class="manual-action-grid">
                    <button class="manual-option-btn" data-action="go-add">Cadastrar Ativo</button>
                    <button class="manual-option-btn" data-action="go-edit">Nova Movimentação</button>
                </div>
                ${renderFeedback()}
            `;
        }

        function renderAddStep() {
            if (state.step === 1) {
                body.innerHTML = `
                    <div class="manual-step-title">Cadastro manual · Etapa 1/3</div>
                    <div class="manual-class-grid">
                        ${classOptions.map((item) => `
                            <button class="manual-option-btn ${state.addPayload.assetClass === item.id ? 'active' : ''}" data-action="select-class" data-class="${item.id}">
                                ${item.label}
                            </button>
                        `).join('')}
                    </div>
                    ${renderFeedback()}
                `;
                return;
            }

            if (state.step === 2) {
                const categories = categoriesByClass[state.addPayload.assetClass] || [];
                body.innerHTML = `
                    <div class="manual-step-title">Cadastro manual · Etapa 2/3</div>
                    <div class="manual-category-grid">
                        ${categories.map((item) => `
                            <button class="manual-option-btn ${state.addPayload.category === item ? 'active' : ''}" data-action="select-category" data-category="${escapeHtml(item)}">
                                ${item}
                            </button>
                        `).join('')}
                    </div>
                    <div class="manual-row-actions">
                        <button class="manual-back-btn" data-action="back">Voltar</button>
                    </div>
                    ${renderFeedback()}
                `;
                return;
            }

            const fields = getAddFields();
            body.innerHTML = `
                <div class="manual-step-title">Cadastro manual · Etapa 3/3</div>
                <div class="manual-form-grid">
                    ${fields.map((field) => renderField(field, state.addPayload.fields[field.id], 'manual-add')).join('')}
                </div>
                ${renderAddBrapiPreview()}
                <div class="manual-row-actions">
                    <button class="manual-back-btn" data-action="back">Voltar</button>
                    <button class="manual-submit-btn" data-action="submit-add" ${state.loading ? 'disabled' : ''}>${state.loading ? 'Salvando...' : 'Salvar ativo'}</button>
                </div>
                ${renderFeedback()}
            `;
        }

        function renderEditStep() {
            if (state.step === 1) {
                body.innerHTML = `
                    <div class="manual-step-title">Nova movimentação · Etapa 1/3</div>
                    <div class="manual-form-grid" style="grid-template-columns: 1fr auto;">
                        <input id="manual-search-query" placeholder="Digite o nome do ativo" value="${escapeHtml(state.edit.query)}" />
                        <button class="manual-submit-btn" data-action="search-assets" ${state.loading ? 'disabled' : ''}>Buscar</button>
                    </div>
                    <div class="manual-category-grid">
                        ${state.edit.results.map((asset) => `
                            <button class="manual-option-btn ${state.edit.selectedAsset?.assetId === asset.assetId ? 'active' : ''}" data-action="select-asset" data-asset-id="${escapeHtml(asset.assetId)}">
                                <div>${escapeHtml(asset.name)}</div>
                                <div class="manual-option-desc">${escapeHtml(asset.assetClass)} · ${escapeHtml(asset.category || 'sem subtipo')}</div>
                            </button>
                        `).join('')}
                    </div>
                    <div class="manual-row-actions">
                        <button class="manual-back-btn" data-action="back">Voltar</button>
                        <button class="manual-submit-btn" data-action="next-edit" ${state.edit.selectedAsset ? '' : 'disabled'}>Continuar</button>
                    </div>
                    ${renderFeedback()}
                `;
                return;
            }

            if (state.step === 2) {
                const options = getAllowedMovements();
                body.innerHTML = `
                    <div class="manual-step-title">Nova movimentação · Etapa 2/3</div>
                    <div class="manual-edit-action-grid">
                        ${options.map((item) => `
                            <button class="manual-option-btn ${state.edit.operation === item.id ? 'active' : ''}" data-action="select-edit-operation" data-operation="${item.id}">
                                <div>${item.label}</div>
                                <div class="manual-option-desc">${item.description}</div>
                            </button>
                        `).join('')}
                    </div>
                    <div class="manual-row-actions">
                        <button class="manual-back-btn" data-action="back">Voltar</button>
                        <button class="manual-submit-btn" data-action="next-edit" ${state.edit.operation ? '' : 'disabled'}>Continuar</button>
                    </div>
                    ${renderFeedback()}
                `;
                return;
            }

            const fields = getEditFields();
            const isDelete = state.edit.operation === 'delete_asset';

            body.innerHTML = `
                <div class="manual-step-title">Nova movimentação · Etapa 3/3</div>
                <div class="manual-form-grid">
                    ${fields.map((field) => renderField(field, state.edit.fields[field.id], 'manual-edit')).join('')}
                </div>
                ${renderEditBrapiHint()}
                <div class="manual-row-actions">
                    <button class="manual-back-btn" data-action="back">Voltar</button>
                    <button class="manual-submit-btn ${isDelete ? 'danger' : ''}" data-action="submit-edit" ${state.loading ? 'disabled' : ''}>
                        ${state.loading ? 'Processando...' : (isDelete ? 'Apagar definitivamente' : 'Registrar movimentação')}
                    </button>
                </div>
                ${renderFeedback()}
            `;
        }

        function render() {
            if (!state.flow) {
                renderFlowChooser();
                return;
            }

            if (state.flow === 'add') {
                renderAddStep();
                return;
            }

            renderEditStep();
        }

        async function refreshConnectedCards() {
            const cards = Object.values(window.YieldInvestments?.cards || {});
            const refreshJobs = cards
                .filter((card) => typeof card?.fetchAndRenderLiveData === 'function')
                .map((card) => card.fetchAndRenderLiveData());

            if (!refreshJobs.length) return;
            await Promise.allSettled(refreshJobs);
        }

        function collectFormValues(fieldDefs, prefix, target) {
            const output = { ...target };
            fieldDefs.forEach((field) => {
                const element = body.querySelector(`#${prefix}-${field.id}`);
                output[field.id] = element?.value?.trim?.() ?? element?.value ?? '';
            });
            return output;
        }

        function validateRequiredFields(fieldDefs, values) {
            const missing = fieldDefs.find((field) => field.required && !String(values[field.id] || '').trim());
            if (missing) {
                throw new Error(`Preencha o campo obrigatório: ${missing.label}`);
            }
        }

        function buildAddPayload() {
            const assetClass = state.addPayload.assetClass;
            const category = state.addPayload.category;
            const fields = state.addPayload.fields;
            const allocationTargetPct = parseNumber(fields.allocationTargetPct);

            if (!assetClass) throw new Error('Selecione a classe do ativo.');
            if (!category) throw new Error('Selecione o tipo/subtipo do ativo.');
            if (allocationTargetPct !== null && (allocationTargetPct < 0 || allocationTargetPct > 100)) {
                throw new Error('Alocação Meta (%) deve estar entre 0 e 100.');
            }

            if (assetClass === 'equity') {
                const quantity = parseNumber(fields.quantity);
                const unitPrice = parseNumber(fields.unitPrice);
                const fees = parseNumber(fields.fees) || 0;
                const ticker = String(fields.ticker || '').toUpperCase();

                if (!state.addPayload.brapi.confirmed) {
                    throw new Error('Confirme o ativo retornado pela Brapi antes de salvar.');
                }
                if (!quantity || quantity <= 0) throw new Error('Quantidade inválida para renda variável.');
                if (unitPrice === null || unitPrice < 0) throw new Error('Preço unitário inválido para renda variável.');

                return {
                    assetClass,
                    category,
                    name: ticker,
                    ticker,
                    quantity,
                    avgPrice: unitPrice + (fees / quantity),
                    referenceDate: fields.operationDate,
                    currency: 'BRL',
                    status: 'open',
                    metadata: {
                        operationType: fields.operationType,
                        unitPrice,
                        fees,
                        allocationTargetPct,
                        broker: fields.broker || null,
                    },
                };
            }

            if (assetClass === 'fixed_income') {
                const appliedValue = parseNumber(fields.appliedValue);
                const rate = parseNumber(fields.rate);
                if (appliedValue === null || appliedValue <= 0) throw new Error('Valor aplicado inválido na renda fixa.');
                if (rate === null || rate < 0) throw new Error('Taxa do ativo inválida na renda fixa.');

                return {
                    assetClass,
                    category,
                    name: fields.name,
                    quantity: 1,
                    avgPrice: appliedValue,
                    referenceDate: fields.applicationDate,
                    currency: 'BRL',
                    status: 'open',
                    metadata: {
                        indexer: fields.indexer,
                        rate,
                        maturityDate: fields.maturityDate,
                        liquidity: fields.liquidity,
                        allocationTargetPct,
                        broker: fields.broker || null,
                    },
                };
            }

            if (assetClass === 'funds') {
                const transactionValue = parseNumber(fields.transactionValue);
                const shares = parseNumber(fields.shares);
                if (transactionValue === null || transactionValue <= 0) throw new Error('Valor da transação inválido para fundo.');

                const quantity = shares && shares > 0 ? shares : 1;
                const avgPrice = quantity > 0 ? transactionValue / quantity : transactionValue;

                return {
                    assetClass,
                    category,
                    name: fields.name,
                    quantity,
                    avgPrice,
                    referenceDate: fields.quotationDate,
                    currency: 'BRL',
                    status: 'open',
                    metadata: {
                        transactionType: fields.transactionType,
                        transactionValue,
                        shares: shares || null,
                        allocationTargetPct,
                    },
                };
            }

            if (assetClass === 'crypto') {
                const quantity = parseNumber(fields.quantity);
                const unitPrice = parseNumber(fields.unitPrice);
                const exchangeFee = parseNumber(fields.exchangeFee) || 0;
                const ticker = String(fields.ticker || '').toUpperCase();

                if (!state.addPayload.brapi.confirmed) {
                    throw new Error('Confirme o ativo retornado pela Brapi antes de salvar.');
                }
                if (!quantity || quantity <= 0) throw new Error('Quantidade inválida para criptoativo.');
                if (unitPrice === null || unitPrice < 0) throw new Error('Preço unitário inválido para criptoativo.');

                return {
                    assetClass,
                    category,
                    name: ticker,
                    ticker,
                    quantity,
                    avgPrice: unitPrice + (exchangeFee / quantity),
                    referenceDate: fields.operationDate,
                    currency: fields.purchaseCurrency || 'BRL',
                    status: 'open',
                    metadata: {
                        unitPrice,
                        exchangeFee,
                        allocationTargetPct,
                        exchange: fields.exchange || null,
                    },
                };
            }

            throw new Error('Classe de ativo não suportada no formulário manual.');
        }

        function buildEditPayload() {
            const values = state.edit.fields;
            const payload = {
                referenceDate: values.referenceDate || today(),
            };

            if (state.edit.operation === 'add_buy') {
                payload.quantity = parseNumber(values.quantity);
                payload.price = parseNumber(values.price);
                payload.fees = parseNumber(values.fees) || 0;
                payload.marketPrice = parseNumber(values.marketPrice);
            }

            if (state.edit.operation === 'add_sell') {
                payload.quantity = parseNumber(values.quantity);
                payload.price = parseNumber(values.price);
                payload.fees = parseNumber(values.fees) || 0;
            }

            if (state.edit.operation === 'add_income') {
                payload.incomeType = values.incomeType;
                payload.grossAmount = parseNumber(values.grossAmount);
            }

            if (state.edit.operation === 'update_balance') {
                payload.currentBalance = parseNumber(values.currentBalance);
            }

            return payload;
        }

        async function requestBrapiForAdd() {
            if (state.flow !== 'add' || state.step !== 3) return;
            if (!shouldUseBrapiByAssetClass(state.addPayload.assetClass)) return;

            const ticker = String(state.addPayload.fields.ticker || '').trim().toUpperCase();
            const date = String(state.addPayload.fields.operationDate || today()).trim();

            if (!isTickerLike(ticker) || !date) {
                state.addPayload.brapi = {
                    loading: false,
                    error: '',
                    quote: null,
                    confirmed: false,
                    lookupKey: '',
                };
                render();
                return;
            }

            const lookupKey = buildAddLookupKey();
            if (state.addPayload.brapi.lookupKey === lookupKey && state.addPayload.brapi.quote) {
                return;
            }

            state.addPayload.brapi.loading = true;
            state.addPayload.brapi.error = '';
            state.addPayload.brapi.lookupKey = lookupKey;
            state.addPayload.brapi.confirmed = false;
            render();

            try {
                const quote = await window.YieldInvestments.api.getBrapiQuoteByTicker(ticker, date);

                if (state.addPayload.brapi.lookupKey !== lookupKey) return;

                state.addPayload.brapi.loading = false;
                state.addPayload.brapi.quote = quote;
                state.addPayload.brapi.error = '';
                state.addPayload.brapi.confirmed = false;
                render();
            } catch (error) {
                if (state.addPayload.brapi.lookupKey !== lookupKey) return;
                state.addPayload.brapi.loading = false;
                state.addPayload.brapi.quote = null;
                state.addPayload.brapi.error = error.message || 'Falha ao consultar ticker na Brapi';
                state.addPayload.brapi.confirmed = false;
                render();
            }
        }

        async function requestBrapiForEdit() {
            if (state.flow !== 'edit' || state.step !== 3) return;
            if (!state.edit.selectedAsset || !['add_buy', 'add_sell'].includes(state.edit.operation)) return;

            const lookupKey = buildEditLookupKey();
            if (state.edit.brapi.lookupKey === lookupKey && state.edit.brapi.quote) {
                return;
            }

            state.edit.brapi.loading = true;
            state.edit.brapi.error = '';
            state.edit.brapi.lookupKey = lookupKey;
            render();

            try {
                const quote = await window.YieldInvestments.api.getBrapiQuoteByAsset(
                    state.edit.selectedAsset.assetId,
                    state.edit.fields.referenceDate || today()
                );

                if (state.edit.brapi.lookupKey !== lookupKey) return;

                state.edit.brapi.loading = false;
                state.edit.brapi.error = '';
                state.edit.brapi.quote = quote;
                state.edit.fields.price = String(quote.priceOnReferenceDate || '');
                render();
            } catch (error) {
                if (state.edit.brapi.lookupKey !== lookupKey) return;

                state.edit.brapi.loading = false;
                state.edit.brapi.quote = null;
                state.edit.brapi.error = error.message || 'Falha ao consultar preço na Brapi';
                render();
            }
        }

        async function handleSearchAssets() {
            try {
                state.loading = true;
                setError('');
                render();

                const result = await window.YieldInvestments.api.searchAssets(state.edit.query, 20);
                state.edit.results = Array.isArray(result.assets) ? result.assets : [];
                if (!state.edit.results.length) {
                    setError('Nenhum ativo encontrado para o usuário atual.');
                }
            } catch (error) {
                setError(error.message || 'Falha ao buscar ativos');
            } finally {
                state.loading = false;
                render();
            }
        }

        async function handleSubmitAdd() {
            try {
                const fields = getAddFields();
                state.addPayload.fields = collectFormValues(fields, 'manual-add', state.addPayload.fields);
                validateRequiredFields(fields, state.addPayload.fields);
                const requestPayload = buildAddPayload();

                state.loading = true;
                setError('');
                render();

                await window.YieldInvestments.api.createManualAsset(requestPayload);

                await refreshConnectedCards();
                setSuccess('Ativo salvo com sucesso e cards atualizados.');
            } catch (error) {
                setError(error.message || 'Falha ao salvar ativo');
            } finally {
                state.loading = false;
                render();
            }
        }

        async function handleSubmitEdit() {
            try {
                const fields = getEditFields();
                state.edit.fields = collectFormValues(fields, 'manual-edit', state.edit.fields);
                validateRequiredFields(fields, state.edit.fields);

                if (state.edit.operation === 'delete_asset') {
                    if (state.edit.fields.confirmation !== 'APAGAR AGORA') {
                        throw new Error('Você deve escrever exatamente "APAGAR AGORA" para confirmar.');
                    }

                    state.loading = true;
                    setError('');
                    render();

                    await window.YieldInvestments.api.deleteAsset(state.edit.selectedAsset.assetId);

                    await refreshConnectedCards();
                    setSuccess('Ativo removido com sucesso.');
                    setTimeout(() => {
                        resetFlow();
                        render();
                    }, 1500);
                    return;
                }

                const payload = buildEditPayload();

                state.loading = true;
                setError('');
                render();

                await window.YieldInvestments.api.editAsset(
                    state.edit.selectedAsset.assetId,
                    state.edit.operation,
                    payload
                );

                await refreshConnectedCards();
                setSuccess('Movimentação registrada com sucesso e cards recalculados.');
            } catch (error) {
                setError(error.message || 'Falha ao registrar movimentação');
            } finally {
                state.loading = false;
                render();
            }
        }

        body.addEventListener('click', (event) => {
            const target = event.target.closest('[data-action]');
            if (!target) return;

            const action = target.getAttribute('data-action');

            if (action === 'go-add') {
                state.flow = 'add';
                state.step = 1;
                setError('');
                render();
                return;
            }

            if (action === 'go-edit') {
                state.flow = 'edit';
                state.step = 1;
                setError('');
                render();
                return;
            }

            if (action === 'back') {
                if (state.step > 1) {
                    state.step -= 1;
                    setError('');
                    setSuccess('');
                    render();
                } else {
                    resetFlow();
                    render();
                }
                return;
            }

            if (action === 'select-class') {
                state.addPayload.assetClass = target.getAttribute('data-class') || '';
                state.addPayload.category = '';
                state.addPayload.fields = { operationDate: today(), applicationDate: today(), quotationDate: today() };
                state.addPayload.brapi = {
                    loading: false,
                    error: '',
                    quote: null,
                    confirmed: false,
                    lookupKey: '',
                };
                state.step = 2;
                setError('');
                render();
                return;
            }

            if (action === 'select-category') {
                state.addPayload.category = target.getAttribute('data-category') || '';
                state.step = 3;
                setError('');
                render();
                requestBrapiForAdd();
                return;
            }

            if (action === 'submit-add') {
                handleSubmitAdd();
                return;
            }

            if (action === 'confirm-add-brapi') {
                const quote = state.addPayload.brapi.quote;
                if (!quote || !Number.isFinite(Number(quote.priceOnReferenceDate))) {
                    setError('Não foi possível confirmar: preço da Brapi indisponível.');
                    render();
                    return;
                }

                state.addPayload.brapi.confirmed = true;
                state.addPayload.fields.unitPrice = String(quote.priceOnReferenceDate);
                setError('');
                render();
                return;
            }

            if (action === 'search-assets') {
                state.edit.query = body.querySelector('#manual-search-query')?.value?.trim() || '';
                handleSearchAssets();
                return;
            }

            if (action === 'select-asset') {
                const assetId = target.getAttribute('data-asset-id');
                state.edit.selectedAsset = state.edit.results.find((item) => item.assetId === assetId) || null;
                state.edit.operation = '';
                state.edit.fields = { referenceDate: today() };
                state.edit.brapi = {
                    loading: false,
                    error: '',
                    quote: null,
                    lookupKey: '',
                };
                render();
                return;
            }

            if (action === 'select-edit-operation') {
                state.edit.operation = target.getAttribute('data-operation') || '';
                state.edit.fields = { referenceDate: today() };
                state.edit.brapi = {
                    loading: false,
                    error: '',
                    quote: null,
                    lookupKey: '',
                };
                render();
                return;
            }

            if (action === 'next-edit') {
                if (state.flow === 'edit' && state.step < 3) {
                    state.step += 1;
                    setError('');
                    render();

                    if (state.step === 3) {
                        requestBrapiForEdit();
                    }
                }
                return;
            }

            if (action === 'submit-edit') {
                handleSubmitEdit();
            }
        });

        body.addEventListener('input', (event) => {
            const field = event.target.closest('[data-field-id]');
            if (!field) return;

            const fieldId = field.getAttribute('data-field-id');
            const rawValue = field.value;

            if (state.flow === 'add' && state.step === 3) {
                state.addPayload.fields[fieldId] = rawValue;

                if (fieldId === 'ticker' || fieldId === 'operationDate') {
                    state.addPayload.brapi.confirmed = false;
                    requestBrapiForAdd();
                }
                return;
            }

            if (state.flow === 'edit' && state.step === 3) {
                state.edit.fields[fieldId] = rawValue;
                if (fieldId === 'referenceDate' && ['add_buy', 'add_sell'].includes(state.edit.operation)) {
                    requestBrapiForEdit();
                }
            }
        });

        body.addEventListener('change', (event) => {
            const field = event.target.closest('[data-field-id]');
            if (!field) return;

            const fieldId = field.getAttribute('data-field-id');
            const rawValue = field.value;

            if (state.flow === 'add' && state.step === 3) {
                state.addPayload.fields[fieldId] = rawValue;

                if (fieldId === 'ticker' || fieldId === 'operationDate') {
                    state.addPayload.brapi.confirmed = false;
                    requestBrapiForAdd();
                }
                return;
            }

            if (state.flow === 'edit' && state.step === 3) {
                state.edit.fields[fieldId] = rawValue;
                if (fieldId === 'referenceDate' && ['add_buy', 'add_sell'].includes(state.edit.operation)) {
                    requestBrapiForEdit();
                }
            }
        });

        trigger.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) closeModal();
        });

        return { openModal, closeModal };
    }

    window.YieldInvestmentsManualModal = {
        createManualAssetModalController,
    };
})();
