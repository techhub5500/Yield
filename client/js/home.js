document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.querySelector('.chat-input');
    const chatMessages = document.getElementById('home-chat-messages');
    const body = document.body;
    const sendBtn = document.querySelector('.send-btn');

    // Botões de ação do chat
    const actionBtns = document.querySelectorAll('.action-icons-left .chat-btn');
    const newChatBtn  = actionBtns[0] || null;  // ícone +
    const historyBtn  = actionBtns[1] || null;  // ícone histórico

    // O botão está no template da sidebar
    let closeBtn = document.getElementById('close-chat-btn');

    let hasSentMessage = false;

    // ── Integração com o backend via YieldChat ──
    const chat = new YieldChat({
        messagesEl   : chatMessages,
        inputEl      : chatInput,
        sendBtnEl    : sendBtn,
        newChatBtnEl : newChatBtn,
        historyBtnEl : historyBtn,
        pageId       : 'home',
        onStateChange: (state) => {
            if (state === 'sending') {
                hasSentMessage = true;
                openChat();
            }
        },
    });

    // ── Comportamento de abrir/fechar chat (específico da home) ──
    function openChat() {
        if (!body.classList.contains('chat-active')) {
            body.classList.add('chat-active');
            if (!closeBtn) closeBtn = document.getElementById('close-chat-btn');
            if (closeBtn) closeBtn.style.display = 'flex';

            setTimeout(() => {
                chatMessages.style.display = 'flex';
            }, 600);
        }
    }

    function closeChat() {
        body.classList.remove('chat-active');
        if (!closeBtn) closeBtn = document.getElementById('close-chat-btn');
        if (closeBtn) closeBtn.style.display = 'none';

        chatMessages.style.display = 'none';
        chatInput.value = '';
        chatInput.style.height = 'auto';
        hasSentMessage = false;
    }

    chatInput.addEventListener('input', () => {
        const val = chatInput.value.trim();
        if (val.length > 0) {
            openChat();
        } else if (!hasSentMessage) {
            closeChat();
        }
    });

    // Fechar chat pelo botão da sidebar
    document.addEventListener('click', (e) => {
        if (e.target.closest('#close-chat-btn')) {
            closeChat();
        }
    });
});
