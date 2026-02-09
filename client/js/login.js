/* ============================================================
 * login.js — Lógica de autenticação (login e cadastro)
 * ============================================================ */

// Detectar URL base da API
function getBaseUrl() {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = hostname === 'localhost' || hostname === '127.0.0.1' ? '3000' : window.location.port;
    return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
}

const API_BASE = getBaseUrl();

// ── Alternância entre formulários ──────────────────────────

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');

showRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
    clearErrors();
});

showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.remove('active');
    loginForm.classList.add('active');
    clearErrors();
});

// ── Limpar mensagens de erro ───────────────────────────────

function clearErrors() {
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('register-error').style.display = 'none';
}

function showError(formType, message) {
    const errorEl = document.getElementById(`${formType}-error`);
    errorEl.querySelector('span').textContent = message;
    errorEl.style.display = 'flex';
}

// ── Funções de loading ─────────────────────────────────────

function setLoading(formType, isLoading) {
    const form = document.getElementById(`${formType}-form`);
    const btn = form.querySelector('.btn-primary');
    const btnText = btn.querySelector('.btn-text');
    const btnLoading = btn.querySelector('.btn-loading');

    btn.disabled = isLoading;
    btnText.style.display = isLoading ? 'none' : 'inline';
    btnLoading.style.display = isLoading ? 'inline' : 'none';
}

// ── Login ──────────────────────────────────────────────────

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showError('login', 'Preencha todos os campos');
        return;
    }

    setLoading('login', true);

    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao fazer login');
        }

        // Salvar token e dados do usuário
        localStorage.setItem('yield_token', data.token);
        localStorage.setItem('yield_user', JSON.stringify(data.user));

        // Redirecionar para home
        window.location.href = 'home.html';
    } catch (error) {
        console.error('Erro no login:', error);
        showError('login', error.message);
        setLoading('login', false);
    }
});

// ── Cadastro ───────────────────────────────────────────────

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const passwordConfirm = document.getElementById('register-password-confirm').value;

    // Validações
    if (!name || !email || !password || !passwordConfirm) {
        showError('register', 'Preencha todos os campos');
        return;
    }

    if (name.length < 2) {
        showError('register', 'Nome deve ter pelo menos 2 caracteres');
        return;
    }

    if (!email.includes('@')) {
        showError('register', 'Email inválido');
        return;
    }

    if (password.length < 6) {
        showError('register', 'Senha deve ter pelo menos 6 caracteres');
        return;
    }

    if (password !== passwordConfirm) {
        showError('register', 'As senhas não coincidem');
        return;
    }

    setLoading('register', true);

    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao criar conta');
        }

        // Salvar token e dados do usuário
        localStorage.setItem('yield_token', data.token);
        localStorage.setItem('yield_user', JSON.stringify(data.user));

        // Redirecionar para home
        window.location.href = 'home.html';
    } catch (error) {
        console.error('Erro no cadastro:', error);
        showError('register', error.message);
        setLoading('register', false);
    }
});

// ── Verificar se já está autenticado ───────────────────────

window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('yield_token');
    if (token) {
        // Verificar se token é válido
        fetch(`${API_BASE}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
        })
        .then(response => {
            if (response.ok) {
                // Já está logado, redirecionar
                window.location.href = 'home.html';
            } else {
                // Token inválido, limpar
                localStorage.removeItem('yield_token');
                localStorage.removeItem('yield_user');
            }
        })
        .catch(() => {
            // Erro na verificação, continua na página de login
        });
    }
});
