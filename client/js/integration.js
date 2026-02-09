/* ============================================================
 * integration.js — Código compartilhado entre páginas
 * 
 * Responsabilidades:
 *   1. Sidebar (navegação)
 *   2. YieldAuth — sistema de autenticação
 *   3. YieldChat — integração centralizada dos chats com o backend
 *
 * O backend expõe:
 *   POST /api/auth/register  { name, email, password }
 *   POST /api/auth/login     { email, password }
 *   POST /api/message        { chatId, message } → { response, chatId, timestamp, metadata }
 *   GET  /api/chat/:id/history                   → { chatId, recent, summary, wordCount }
 *   GET  /health                                 → { status, version, timestamp, uptime }
 * ============================================================ */

// ─── Sistema de Autenticação ─────────────────────────────────
const YieldAuth = {
    /** Salva o token JWT no localStorage */
    setToken(token) {
        localStorage.setItem('yield_token', token);
    },

    /** Recupera o token JWT do localStorage */
    getToken() {
        return localStorage.getItem('yield_token');
    },

    /** Remove o token (logout) */
    clearToken() {
        localStorage.removeItem('yield_token');
    },

    /** Verifica se o usuário está autenticado */
    isAuthenticated() {
        return !!this.getToken();
    },

    /** Decodifica o payload do JWT (sem verificação - apenas leitura) */
    decodeToken() {
        const token = this.getToken();
        if (!token) return null;

        try {
            const payload = token.split('.')[1];
            const decoded = JSON.parse(atob(payload));
            return decoded;
        } catch (err) {
            console.error('[YieldAuth] Erro ao decodificar token:', err);
            return null;
        }
    },

    /** Retorna os dados do usuário do token */
    getUser() {
        const decoded = this.decodeToken();
        if (!decoded) return null;

        return {
            id: decoded.userId,
            name: decoded.name,
            email: decoded.email,
            firstName: decoded.name?.split(' ')[0] || 'Usuário'
        };
    },

    /** Redireciona para login se não estiver autenticado */
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/html/login.html';
            return false;
        }
        return true;
    },

    /** Faz logout com confirmação */
    logout() {
        if (confirm('Tem certeza que deseja sair?')) {
            this.clearToken();
            window.location.href = '/html/login.html';
        }
    }
};

// Expor globalmente
window.YieldAuth = YieldAuth;

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

    // Adicionar funcionalidade ao botão de logout
    const logoutBtn = sidebar.querySelector('.logout a');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            YieldAuth.logout();
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Verificar autenticação em páginas protegidas
    const isLoginPage = window.location.pathname.includes('login.html');
    if (!isLoginPage) {
        YieldAuth.requireAuth();
    }

    const placeholder = document.getElementById('sidebar-placeholder');
    if (placeholder) {
        fetch('integration.html')
            .then(response => response.text())
            .then(data => {
                placeholder.innerHTML = data;
                initSidebar();
                updateUserName();
            });
    } else {
        initSidebar();
        updateUserName();
    }
});

// ─── Atualizar nome do usuário ──────────────────────────────
function updateUserName() {
    const user = YieldAuth.getUser();
    if (!user) return;

    // Atualizar todos os elementos que exibem o nome do usuário
    const nameElements = document.querySelectorAll('[data-user-name]');
    nameElements.forEach(el => {
        el.textContent = user.firstName;
    });
}

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

            if (!data.messages || data.messages.length === 0) return;

            // Limpa mensagens atuais
            this.messagesEl.innerHTML = '';

            // Renderizar todas as mensagens do histórico completo
            data.messages.forEach(msg => {
                if (msg.userInput)  this._appendMessage(msg.userInput, 'user');
                if (msg.aiResponse) this._appendMessage(msg.aiResponse, 'bot');
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

    /** Lista todos os chats salvos. */
    async listAllChats() {
        try {
            const data = await this._get('/api/chats');
            return data.chats || [];
        } catch (err) {
            console.error('[YieldChat] Erro ao listar chats:', err);
            return [];
        }
    }

    /** Abre o modal de histórico de chats. */
    async openHistoryModal() {
        const modal = document.getElementById('chat-history-modal');
        const container = document.getElementById('chat-list-container');
        
        if (!modal || !container) {
            console.error('[YieldChat] Elementos do modal não encontrados');
            return;
        }

        // Mostrar modal com loading
        modal.classList.add('show');
        container.innerHTML = `
            <div class="loading-chats">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Carregando conversas...</span>
            </div>
        `;

        // Carregar lista de chats
        const chats = await this.listAllChats();

        if (chats.length === 0) {
            container.innerHTML = `
                <div class="empty-chats">
                    <i class="fas fa-comment-slash"></i>
                    <p>Nenhuma conversa encontrada</p>
                </div>
            `;
            return;
        }

        // Renderizar lista de chats
        const chatList = document.createElement('div');
        chatList.className = 'chat-list';

        chats.forEach(chat => {
            const item = document.createElement('div');
            item.className = 'chat-item';
            if (chat.chatId === this.chatId) {
                item.classList.add('active');
            }

            const preview = chat.preview || 'Sem mensagens';
            const date = new Date(chat.timestamp);
            const dateStr = this._formatDate(date);
            const messageCount = chat.messageCount || 0;

            item.innerHTML = `
                <div class="chat-item-preview">${this._escapeHtml(preview)}</div>
                <div class="chat-item-meta">
                    <span class="chat-item-date">
                        <i class="fas fa-clock"></i>
                        ${dateStr}
                    </span>
                    <span class="chat-item-count">
                        <i class="fas fa-comment"></i>
                        ${messageCount}
                    </span>
                </div>
            `;

            item.addEventListener('click', () => {
                this.switchToChat(chat.chatId);
                modal.classList.remove('show');
            });

            chatList.appendChild(item);
        });

        container.innerHTML = '';
        container.appendChild(chatList);
    }

    /** Troca para outro chat. */
    async switchToChat(chatId) {
        if (chatId === this.chatId) return;

        this.chatId = chatId;
        this._saveChatId();
        this.messagesEl.innerHTML = '';
        this.historyLoaded = false;

        // Carregar histórico do novo chat
        await this.loadHistory();
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
            this.historyBtnEl.addEventListener('click', () => this.openHistoryModal());
        }

        // Fechar modal ao clicar no X ou fora dele
        const modal = document.getElementById('chat-history-modal');
        const closeBtn = document.getElementById('close-history-modal');
        
        if (modal && closeBtn) {
            closeBtn.addEventListener('click', () => modal.classList.remove('show'));
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
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
        const headers = { 'Content-Type': 'application/json' };
        
        // Adicionar token de autenticação se disponível
        const token = YieldAuth.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(this.baseUrl + path, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        // Se receber 401, redirecionar para login
        if (res.status === 401) {
            YieldAuth.clearToken();
            window.location.href = '/html/login.html';
            throw new Error('Sessão expirada');
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
        }

        return res.json();
    }

    /** GET genérico. */
    async _get(path) {
        const headers = {};
        
        // Adicionar token de autenticação se disponível
        const token = YieldAuth.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(this.baseUrl + path, { headers });

        // Se receber 401, redirecionar para login
        if (res.status === 401) {
            YieldAuth.clearToken();
            window.location.href = '/html/login.html';
            throw new Error('Sessão expirada');
        }

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

    /** Formata uma data de forma amigável. */
    _formatDate(date) {
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Hoje';
        if (days === 1) return 'Ontem';
        if (days < 7) return `${days} dias atrás`;
        
        return date.toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: 'short' 
        });
    }

    /** Escapa HTML para prevenir XSS. */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Expor globalmente para uso em qualquer página
window.YieldChat = YieldChat;
