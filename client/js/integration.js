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
        
        // Garantir ícone correto se já começar colapsado
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
