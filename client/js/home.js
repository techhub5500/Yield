document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.querySelector('.chat-input');
    const chatMessages = document.getElementById('home-chat-messages');
    const body = document.body;
    const sendBtn = document.querySelector('.send-btn');
    
    // O botão está no template da sidebar agora
    let closeBtn = document.getElementById('close-chat-btn');
    
    let hasSentMessage = false;

    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        msgDiv.textContent = text;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
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
        // Opcional: chatMessages.innerHTML = '';
    }

    chatInput.addEventListener('input', () => {
        const val = chatInput.value.trim();
        if (val.length > 0) {
            openChat();
        } else if (!hasSentMessage) {
            closeChat();
        }
    });

    function handleSend() {
        const text = chatInput.value.trim();
        if (text) {
            hasSentMessage = true;
            addMessage(text, 'user');
            chatInput.value = '';
            chatInput.style.height = 'auto';

            setTimeout(() => {
                addMessage('Seja bem-vindo', 'bot');
            }, 800);
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
