document.addEventListener('DOMContentLoaded', () => {
    // ---- Otimização de Scroll ----
    // Remove qualquer delay potencial garantindo que o navegador não espere por JS para rolar
    window.addEventListener('wheel', () => {}, { passive: true });
    window.addEventListener('touchstart', () => {}, { passive: true });

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
