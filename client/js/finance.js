document.addEventListener('DOMContentLoaded', () => {
    // ---- Month/Year Selector Logic with Modal ----
    const monthDisplay = document.getElementById('current-month-display');
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    const modal = document.getElementById('year-modal');
    const closeModal = document.getElementById('close-modal');
    const yearBtns = document.querySelectorAll('.year-btn');

    let currentDate = new Date();
    const months = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    function updateDisplay() {
        monthDisplay.textContent = `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }

    prevBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        updateDisplay();
    });

    nextBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        updateDisplay();
    });

    // Modal Interaction
    monthDisplay.addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    yearBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedYear = parseInt(btn.textContent);
            currentDate.setFullYear(selectedYear);
            updateDisplay();
            modal.style.display = 'none';
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    updateDisplay();

    // ---- Options Switcher Logic (6 options) ----
    const optionBtns = document.querySelectorAll('.option-btn');
    const optionViews = document.querySelectorAll('.option-view');

    optionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');

            optionBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            optionViews.forEach(view => {
                view.classList.remove('active');
                if (view.id === target) {
                    view.classList.add('active');
                }
            });
        });
    });

    // ---- Chat Logic (Usando serviço unificado) ----
    const chatInput = document.querySelector('.chat-input-area textarea');
    const sendBtn = document.querySelector('.chat-input-area .send-btn');
    const chatMessages = document.querySelector('.chat-messages');

    // Inicializar serviço de chat unificado para a página finance
    const chatService = ChatManager.getChat('finance');

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
        indicator.id = 'finance-typing-indicator';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        chatMessages.appendChild(indicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('finance-typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    async function handleSend() {
        const text = chatInput.value.trim();
        if (text && !chatService.isProcessing()) {
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

    // Auto-expand textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

});
