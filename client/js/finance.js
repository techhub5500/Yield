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

    // ---- Chat Logic (integrado via YieldChat) ----
    const chatInput = document.querySelector('.chat-input-area textarea');
    const sendBtn = document.querySelector('.chat-input-area .send-btn');
    const chatMessages = document.querySelector('.chat-messages');

    // Botões de ação do chat
    const actionBtns = document.querySelectorAll('.action-icons .chat-btn');
    const newChatBtn  = actionBtns[0] || null;  // ícone +
    const historyBtn  = actionBtns[1] || null;  // ícone histórico

    const chat = new YieldChat({
        messagesEl   : chatMessages,
        inputEl      : chatInput,
        sendBtnEl    : sendBtn,
        newChatBtnEl : newChatBtn,
        historyBtnEl : historyBtn,
        pageId       : 'finance',
    });

});
