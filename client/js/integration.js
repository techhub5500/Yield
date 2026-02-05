/**
 * ===================================================
 * SISTEMA DE AUTENTICAÇÃO - YIELD
 * ===================================================
 */

const AUTH_API_URL = 'http://localhost:3000/api/auth';

/**
 * Gerenciador de Autenticação
 */
const AuthManager = {
  // Chave do localStorage
  STORAGE_KEY: 'yield_user',
  TOKEN_KEY: 'yield_token',

  /**
   * Verifica se o usuário está logado
   */
  isAuthenticated() {
    const token = localStorage.getItem(this.TOKEN_KEY);
    const user = this.getCurrentUser();
    return !!(token && user);
  },

  /**
   * Obtém o usuário atual
   */
  getCurrentUser() {
    try {
      const userData = localStorage.getItem(this.STORAGE_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  },

  /**
   * Obtém o ID do usuário atual
   */
  getUserId() {
    const user = this.getCurrentUser();
    return user ? user.id : null;
  },

  /**
   * Obtém o token de autenticação
   */
  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  /**
   * Salva os dados de autenticação
   */
  saveAuth(user, token, remember = false) {
    if (remember) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem(this.TOKEN_KEY, token);
    } else {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
      sessionStorage.setItem(this.TOKEN_KEY, token);
    }
  },

  /**
   * Remove os dados de autenticação (logout)
   */
  clearAuth() {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.STORAGE_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
  },

  /**
   * Login com email e senha
   */
  async login(email, password, remember = false) {
    try {
      const response = await fetch(`${AUTH_API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao fazer login');
      }

      this.saveAuth(data.user, data.token, remember);
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Cadastro de novo usuário
   */
  async register(name, email, password) {
    try {
      const response = await fetch(`${AUTH_API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao criar conta');
      }

      this.saveAuth(data.user, data.token, true);
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Solicitar recuperação de senha
   */
  async forgotPassword(email) {
    try {
      const response = await fetch(`${AUTH_API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao enviar e-mail');
      }

      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Logout
   */
  async logout() {
    try {
      const token = this.getToken();
      if (token) {
        await fetch(`${AUTH_API_URL}/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch {
      // Ignora erros de logout no servidor
    }
    this.clearAuth();
    window.location.reload();
  },

  /**
   * Verifica validade do token
   */
  async verifyToken() {
    const token = this.getToken();
    if (!token) return false;

    try {
      const response = await fetch(`${AUTH_API_URL}/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        this.clearAuth();
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Controlador do Modal de Autenticação
 */
const AuthModal = {
  overlay: null,
  loginForm: null,
  registerForm: null,
  forgotForm: null,
  currentMode: 'login', // 'login', 'register', 'forgot'

  /**
   * Inicializa o modal
   */
  init() {
    this.overlay = document.getElementById('auth-modal-overlay');
    this.loginForm = document.getElementById('login-form');
    this.registerForm = document.getElementById('register-form');
    this.forgotForm = document.getElementById('forgot-form');

    if (!this.overlay) return;

    this.bindEvents();
    this.checkAuthState();
  },

  /**
   * Vincula eventos
   */
  bindEvents() {
    // Toggle entre login e cadastro
    const toggleLink = document.getElementById('auth-toggle-link');
    if (toggleLink) {
      toggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleMode();
      });
    }

    // Link "Esqueceu a senha?"
    const forgotLink = document.getElementById('forgot-password-link');
    if (forgotLink) {
      forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showForgotPassword();
      });
    }

    // Botão "Voltar ao login"
    const backBtn = document.getElementById('back-to-login');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.showLogin();
      });
    }

    // Submit do login
    if (this.loginForm) {
      this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Submit do cadastro
    if (this.registerForm) {
      this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
    }

    // Submit da recuperação de senha
    if (this.forgotForm) {
      this.forgotForm.addEventListener('submit', (e) => this.handleForgotPassword(e));
    }

    // Toggle de visibilidade da senha
    document.querySelectorAll('.toggle-password').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        const icon = btn.querySelector('i');
        
        if (input.type === 'password') {
          input.type = 'text';
          icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
          input.type = 'password';
          icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
      });
    });

    // Força da senha
    const passwordInput = document.getElementById('register-password');
    if (passwordInput) {
      passwordInput.addEventListener('input', () => this.updatePasswordStrength());
    }

    // Google Login
    const googleBtn = document.getElementById('google-login');
    if (googleBtn) {
      googleBtn.addEventListener('click', () => this.handleGoogleLogin());
    }

    // Logout
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
      logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        AuthManager.logout();
      });
    }
  },

  /**
   * Verifica estado de autenticação e exibe/oculta modal
   */
  checkAuthState() {
    if (AuthManager.isAuthenticated()) {
      this.hide();
    } else {
      this.show();
    }
  },

  /**
   * Exibe o modal
   */
  show() {
    if (this.overlay) {
      this.overlay.classList.add('active');
      document.body.classList.add('auth-modal-open');
    }
  },

  /**
   * Oculta o modal
   */
  hide() {
    if (this.overlay) {
      this.overlay.classList.remove('active');
      document.body.classList.remove('auth-modal-open');
    }
  },

  /**
   * Alterna entre login e cadastro
   */
  toggleMode() {
    if (this.currentMode === 'login') {
      this.showRegister();
    } else {
      this.showLogin();
    }
  },

  /**
   * Exibe formulário de login
   */
  showLogin() {
    this.currentMode = 'login';
    this.loginForm.style.display = 'block';
    this.registerForm.style.display = 'none';
    this.forgotForm.style.display = 'none';
    
    document.getElementById('auth-title').textContent = 'Entrar';
    document.getElementById('auth-subtitle').textContent = 'Bem-vindo de volta ao Yield';
    document.getElementById('auth-toggle-text').innerHTML = 
      'Não tem uma conta? <a href="#" id="auth-toggle-link">Criar conta</a>';
    
    // Re-bind toggle link
    document.getElementById('auth-toggle-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleMode();
    });

    document.querySelector('.auth-divider').style.display = 'flex';
    document.querySelector('.auth-social').style.display = 'flex';

    this.clearErrors();
  },

  /**
   * Exibe formulário de cadastro
   */
  showRegister() {
    this.currentMode = 'register';
    this.loginForm.style.display = 'none';
    this.registerForm.style.display = 'block';
    this.forgotForm.style.display = 'none';
    
    document.getElementById('auth-title').textContent = 'Criar conta';
    document.getElementById('auth-subtitle').textContent = 'Comece a controlar suas finanças';
    document.getElementById('auth-toggle-text').innerHTML = 
      'Já tem uma conta? <a href="#" id="auth-toggle-link">Entrar</a>';
    
    // Re-bind toggle link
    document.getElementById('auth-toggle-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleMode();
    });

    document.querySelector('.auth-divider').style.display = 'flex';
    document.querySelector('.auth-social').style.display = 'flex';

    this.clearErrors();
  },

  /**
   * Exibe formulário de recuperação de senha
   */
  showForgotPassword() {
    this.currentMode = 'forgot';
    this.loginForm.style.display = 'none';
    this.registerForm.style.display = 'none';
    this.forgotForm.style.display = 'block';
    
    document.getElementById('auth-title').textContent = 'Recuperar senha';
    document.getElementById('auth-subtitle').textContent = 'Enviaremos instruções para seu e-mail';
    document.getElementById('auth-toggle-text').innerHTML = '';

    document.querySelector('.auth-divider').style.display = 'none';
    document.querySelector('.auth-social').style.display = 'none';

    this.clearErrors();
  },

  /**
   * Processa o login
   */
  async handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('remember-me').checked;
    const errorEl = document.getElementById('login-error');
    const submitBtn = this.loginForm.querySelector('.auth-submit-btn');

    this.setLoading(submitBtn, true);
    errorEl.textContent = '';

    const result = await AuthManager.login(email, password, remember);

    this.setLoading(submitBtn, false);

    if (result.success) {
      this.hide();
      window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: result.user }));
    } else {
      errorEl.textContent = result.error;
    }
  },

  /**
   * Processa o cadastro
   */
  async handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const errorEl = document.getElementById('register-error');
    const submitBtn = this.registerForm.querySelector('.auth-submit-btn');

    // Validações
    if (password !== confirmPassword) {
      errorEl.textContent = 'As senhas não coincidem';
      return;
    }

    if (password.length < 6) {
      errorEl.textContent = 'A senha deve ter pelo menos 6 caracteres';
      return;
    }

    this.setLoading(submitBtn, true);
    errorEl.textContent = '';

    const result = await AuthManager.register(name, email, password);

    this.setLoading(submitBtn, false);

    if (result.success) {
      this.hide();
      window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: result.user }));
    } else {
      errorEl.textContent = result.error;
    }
  },

  /**
   * Processa a recuperação de senha
   */
  async handleForgotPassword(e) {
    e.preventDefault();
    
    const email = document.getElementById('forgot-email').value.trim();
    const errorEl = document.getElementById('forgot-error');
    const successEl = document.getElementById('forgot-success');
    const submitBtn = this.forgotForm.querySelector('.auth-submit-btn');

    this.setLoading(submitBtn, true);
    errorEl.textContent = '';
    successEl.textContent = '';

    const result = await AuthManager.forgotPassword(email);

    this.setLoading(submitBtn, false);

    if (result.success) {
      successEl.textContent = 'Instruções enviadas para seu e-mail!';
    } else {
      errorEl.textContent = result.error;
    }
  },

  /**
   * Login com Google (placeholder)
   */
  handleGoogleLogin() {
    // TODO: Implementar OAuth com Google
    alert('Login com Google será implementado em breve!');
  },

  /**
   * Atualiza indicador de força da senha
   */
  updatePasswordStrength() {
    const password = document.getElementById('register-password').value;
    const strengthEl = document.getElementById('password-strength');
    const bar = strengthEl.querySelector('.strength-bar');
    const text = strengthEl.querySelector('.strength-text');

    let strength = 0;
    let label = 'Muito fraca';
    let color = '#ff4757';

    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    switch (strength) {
      case 0:
      case 1:
        label = 'Muito fraca';
        color = '#ff4757';
        break;
      case 2:
        label = 'Fraca';
        color = '#ffa502';
        break;
      case 3:
        label = 'Média';
        color = '#ffdd59';
        break;
      case 4:
        label = 'Forte';
        color = '#7bed9f';
        break;
      case 5:
        label = 'Muito forte';
        color = '#2ed573';
        break;
    }

    bar.style.width = `${(strength / 5) * 100}%`;
    bar.style.backgroundColor = color;
    text.textContent = label;
    text.style.color = color;
  },

  /**
   * Define estado de loading do botão
   */
  setLoading(button, isLoading) {
    if (isLoading) {
      button.disabled = true;
      button.classList.add('loading');
      button.querySelector('span').textContent = 'Aguarde...';
    } else {
      button.disabled = false;
      button.classList.remove('loading');
      // Restaura texto original baseado no modo
      const texts = {
        'login': 'Entrar',
        'register': 'Criar conta',
        'forgot': 'Enviar instruções'
      };
      button.querySelector('span').textContent = texts[this.currentMode] || 'Enviar';
    }
  },

  /**
   * Limpa mensagens de erro
   */
  clearErrors() {
    document.querySelectorAll('.auth-error, .auth-success').forEach(el => {
      el.textContent = '';
    });
  }
};

/**
 * ===================================================
 * SIDEBAR - Código existente
 * ===================================================
 */

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

/**
 * ===================================================
 * INICIALIZAÇÃO
 * ===================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    const placeholder = document.getElementById('sidebar-placeholder');
    if (placeholder) {
        fetch('integration.html')
            .then(response => response.text())
            .then(data => {
                placeholder.innerHTML = data;
                initSidebar();
                AuthModal.init();
            });
    } else {
        initSidebar();
        AuthModal.init();
    }
});

/**
 * Exporta para uso global
 */
window.AuthManager = AuthManager;
window.AuthModal = AuthModal;
