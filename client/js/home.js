document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.querySelector('.chat-input');
    const chatMessages = document.getElementById('home-chat-messages');
    const body = document.body;
    const sendBtn = document.querySelector('.send-btn');
    
    // O botão está no template da sidebar agora
    let closeBtn = document.getElementById('close-chat-btn');
    
    let hasSentMessage = false;

    // Inicializar serviço de chat unificado
    const chatService = ChatManager.getChat('home');

    // Configurar callbacks do chat
    chatService.on('loading', (isLoading) => {
        if (sendBtn) {
            sendBtn.disabled = isLoading;
            if (isLoading) {
                sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            } else {
                sendBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
            }
        }
    });

    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        msgDiv.textContent = text;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message bot typing-indicator';
        indicator.id = 'typing-indicator';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        chatMessages.appendChild(indicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    function openChat() {
        if (!body.classList.contains('chat-active')) {
            body.classList.add('chat-active');
            // Como o placeholder pode demorar para carregar, buscamos o botão se ele ainda não foi pego
            if (!closeBtn) closeBtn = document.getElementById('close-chat-btn');
            if (closeBtn) closeBtn.style.display = 'flex';
            
            setTimeout(() => {
                chatMessages.style.display = 'flex';
            }, 600); // Sincronizado com a transição de 0.8s
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

    async function handleSend() {
        const text = chatInput.value.trim();
        if (text && !chatService.isProcessing()) {
            hasSentMessage = true;
            addMessage(text, 'user');
            chatInput.value = '';
            chatInput.style.height = 'auto';

            // Mostrar indicador de digitação
            addTypingIndicator();

            // Enviar para o backend
            const result = await chatService.sendMessage(text);
            
            // Remover indicador e mostrar resposta
            removeTypingIndicator();
            addMessage(result.response, 'bot');
        }
    }

    sendBtn.addEventListener('click', handleSend);
    
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    // Delegar evento se o botão ainda não existir no DOM no load (por causa do fetch do placeholder)
    document.addEventListener('click', (e) => {
        if (e.target.closest('#close-chat-btn')) {
            closeChat();
        }
    });

    // Auto-expand textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
});
