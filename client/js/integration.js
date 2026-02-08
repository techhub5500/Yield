/* ============================================================
 * integration.js — Código compartilhado entre páginas
 * 
 * Responsabilidades:
 *   1. Sidebar (navegação)
 *   2. YieldChat — integração centralizada dos chats com o backend
 *
 * O backend expõe:
 *   POST /api/message        { chatId, message } → { response, chatId, timestamp, metadata }
 *   GET  /api/chat/:id/history                   → { chatId, recent, summary, wordCount }
 *   GET  /health                                 → { status, version, timestamp, uptime }
 * ============================================================ */

// ─── Sidebar ─────────────────────────────────────────────────
const initSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-sidebar');
    const toggleIcon = document.getElementById('toggle-icon');
    const hasSubmenu = document.querySelectorAll('.has-submenu > a');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            if (sidebar.classList.contains('collapsed')) {
                toggleIcon.classList.replace('fa-angles-left', 'fa-angles-right');
            } else {
                toggleIcon.classList.replace('fa-angles-right', 'fa-angles-left');
            }
        });

        if (sidebar.classList.contains('collapsed')) {
            toggleIcon.classList.replace('fa-angles-left', 'fa-angles-right');
        }
    }

    hasSubmenu.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const parent = item.parentElement;
            parent.classList.toggle('open');
        });
    });
};

document.addEventListener('DOMContentLoaded', () => {
    const placeholder = document.getElementById('sidebar-placeholder');
    if (placeholder) {
        fetch('integration.html')
            .then(response => response.text())
            .then(data => {
                placeholder.innerHTML = data;
                initSidebar();
            });
    } else {
        initSidebar();
    }
});

// ─── YieldChat — integração centralizada com o backend ───────
/**
 * Classe reutilizável que conecta qualquer chat do frontend ao backend Yield.
 *
 * Uso mínimo (em qualquer página):
 *   const chat = new YieldChat({
 *       messagesEl : document.querySelector('.chat-messages'),
 *       inputEl    : document.querySelector('.chat-input'),
 *       sendBtnEl  : document.querySelector('.send-btn'),
 *   });
 *
 * Parâmetros opcionais:
 *   - newChatBtnEl   : botão "novo chat" (ícone +)
 *   - historyBtnEl   : botão "histórico" (ícone relógio)
 *   - pageId         : identificador da página (usado como prefixo no localStorage)
 *   - baseUrl        : URL base da API (padrão: detectado automaticamente)
 *   - onStateChange  : callback(state) — 'idle' | 'sending' | 'error'
 */
class YieldChat {
    /**
     * @param {Object} config
     * @param {HTMLElement} config.messagesEl   — Container de mensagens
     * @param {HTMLElement} config.inputEl      — Textarea de input
     * @param {HTMLElement} config.sendBtnEl    — Botão de envio
     * @param {HTMLElement} [config.newChatBtnEl]  — Botão de novo chat
     * @param {HTMLElement} [config.historyBtnEl]  — Botão de histórico
     * @param {string}      [config.pageId='default'] — ID da página (prefixo localStorage)
     * @param {string}      [config.baseUrl]    — URL base da API
     * @param {Function}    [config.onStateChange] — Callback de mudança de estado
     */
    constructor(config = {}) {
        // Elementos obrigatórios
        this.messagesEl = config.messagesEl;
        this.inputEl    = config.inputEl;
        this.sendBtnEl  = config.sendBtnEl;

        if (!this.messagesEl || !this.inputEl || !this.sendBtnEl) {
            console.error('[YieldChat] Elementos obrigatórios não fornecidos (messagesEl, inputEl, sendBtnEl).');
            return;
        }

        // Elementos opcionais
        this.newChatBtnEl  = config.newChatBtnEl  || null;
        this.historyBtnEl  = config.historyBtnEl  || null;
        this.pageId        = config.pageId        || 'default';
        this.onStateChange = config.onStateChange || null;

        // Estado interno
        this.isProcessing   = false;
        this.historyLoaded  = false;

        // URL base da API
        this.baseUrl = config.baseUrl || this._resolveBaseUrl();

        // chatId persistido por página
        this.chatId = this._loadOrCreateChatId();

        // Bind de eventos
        this._bindEvents();
    }

    // ── API pública ──────────────────────────────────────────

    /** Envia uma mensagem ao backend e exibe a resposta. */
    async send(text) {
        const trimmed = (text || '').trim();
        if (!trimmed || this.isProcessing) return;

        this.isProcessing = true;
        this._setState('sending');
        this._appendMessage(trimmed, 'user');

        const typingEl = this._showTypingIndicator();

        try {
            const data = await this._post('/api/message', {
                chatId:  this.chatId,
                message: trimmed,
            });

            this._removeTypingIndicator(typingEl);
            this._appendMessage(data.response, 'bot');
        } catch (err) {
            this._removeTypingIndicator(typingEl);
            this._appendMessage('Desculpe, não consegui processar sua mensagem. Tente novamente.', 'bot error');
            console.error('[YieldChat] Erro ao enviar mensagem:', err);
            this._setState('error');
        } finally {
            this.isProcessing = false;
            this._setState('idle');
        }
    }

    /** Carrega o histórico do chat atual e exibe no container de mensagens. */
    async loadHistory() {
        try {
            const data = await this._get(`/api/chat/${this.chatId}/history`);

            if (!data.recent || data.recent.length === 0) return;

            // Limpa mensagens atuais
            this.messagesEl.innerHTML = '';

            // Se há resumo de conversas antigas, mostrar como contexto
            if (data.summary && data.summary !== 'Sem histórico anterior.') {
                this._appendMessage(data.summary, 'bot system');
            }

            // Renderizar ciclos recentes
            data.recent.forEach(cycle => {
                if (cycle.userInput)  this._appendMessage(cycle.userInput, 'user');
                if (cycle.aiResponse) this._appendMessage(cycle.aiResponse, 'bot');
            });

            this.historyLoaded = true;
        } catch (err) {
            console.error('[YieldChat] Erro ao carregar histórico:', err);
        }
    }

    /** Inicia um novo chat (gera novo chatId, limpa mensagens). */
    newChat() {
        this.chatId = this._generateId();
        this._saveChatId();
        this.messagesEl.innerHTML = '';
        this.historyLoaded = false;
    }

    /** Verifica se o backend está disponível. */
    async healthCheck() {
        try {
            const data = await this._get('/health');
            return data && data.status === 'ok';
        } catch {
            return false;
        }
    }

    /** Retorna o chatId atual. */
    getChatId() {
        return this.chatId;
    }

    // ── Internos — DOM ───────────────────────────────────────

    /** Adiciona uma mensagem ao container de chat. */
    _appendMessage(text, className) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${className}`;

        // Bot messages podem conter markdown simples — renderizar formatação básica
        if (className.includes('bot') && !className.includes('error')) {
            msgDiv.innerHTML = this._renderMarkdown(text);
        } else {
            msgDiv.textContent = text;
        }

        this.messagesEl.appendChild(msgDiv);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    /** Mostra indicador de digitação ("...") enquanto aguarda resposta. */
    _showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message bot typing-indicator';
        indicator.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
        this.messagesEl.appendChild(indicator);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        return indicator;
    }

    /** Remove o indicador de digitação. */
    _removeTypingIndicator(el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    /** Renderiza markdown básico para respostas do bot. */
    _renderMarkdown(text) {
        if (!text) return '';
        let html = text
            // Escape HTML para segurança
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // Bold: **text**
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic: *text*
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Inline code: `text`
            .replace(/`(.*?)`/g, '<code>$1</code>')
            // Line breaks
            .replace(/\n/g, '<br>');
        return html;
    }

    // ── Internos — Eventos ───────────────────────────────────

    /** Conecta eventos de UI aos métodos do chat. */
    _bindEvents() {
        // Envio pelo botão
        this.sendBtnEl.addEventListener('click', () => this._handleSend());

        // Envio pelo Enter (Shift+Enter = nova linha)
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._handleSend();
            }
        });

        // Auto-expand do textarea
        this.inputEl.addEventListener('input', () => {
            this.inputEl.style.height = 'auto';
            this.inputEl.style.height = this.inputEl.scrollHeight + 'px';
        });

        // Botão de novo chat
        if (this.newChatBtnEl) {
            this.newChatBtnEl.addEventListener('click', () => this.newChat());
        }

        // Botão de histórico
        if (this.historyBtnEl) {
            this.historyBtnEl.addEventListener('click', () => this.loadHistory());
        }
    }

    /** Handler interno de envio. */
    _handleSend() {
        const text = this.inputEl.value.trim();
        if (!text) return;
        this.inputEl.value = '';
        this.inputEl.style.height = 'auto';
        this.send(text);
    }

    /** Notifica mudança de estado via callback. */
    _setState(state) {
        if (typeof this.onStateChange === 'function') {
            this.onStateChange(state);
        }
    }

    // ── Internos — Rede ──────────────────────────────────────

    /** Detecta a URL base da API automaticamente. */
    _resolveBaseUrl() {
        // Se acessado via file://, usar localhost:3000
        if (window.location.protocol === 'file:') {
            return 'http://localhost:3000';
        }
        // Se acessado via HTTP, a API está no mesmo origin
        return '';
    }

    /** POST genérico com JSON. */
    async _post(path, body) {
        const res = await fetch(this.baseUrl + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
        }

        return res.json();
    }

    /** GET genérico. */
    async _get(path) {
        const res = await fetch(this.baseUrl + path);

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
        }

        return res.json();
    }

    // ── Internos — chatId ────────────────────────────────────

    /** Carrega chatId do localStorage ou cria um novo. */
    _loadOrCreateChatId() {
        const key = `yield_chatId_${this.pageId}`;
        const stored = localStorage.getItem(key);
        if (stored) return stored;

        const newId = this._generateId();
        localStorage.setItem(key, newId);
        return newId;
    }

    /** Salva o chatId atual no localStorage. */
    _saveChatId() {
        const key = `yield_chatId_${this.pageId}`;
        localStorage.setItem(key, this.chatId);
    }

    /** Gera um UUID v4 simples. */
    _generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }
}

// Expor globalmente para uso em qualquer página
window.YieldChat = YieldChat;
