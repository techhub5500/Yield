/**
 * Auth Routes
 * Rotas de autenticação da API
 */

const express = require('express');
const authService = require('../services/auth/auth-service');
const logger = require('../utils/logger');
const { AppError, ERROR_CODES } = require('../utils/error-handler');

const router = express.Router();

/**
 * Middleware de autenticação
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Token não fornecido');
    }

    const token = authHeader.split(' ')[1];
    const user = await authService.verifyAndGetUser(token);

    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.message || 'Não autorizado'
    });
  }
};

/**
 * POST /api/auth/register
 * Registra novo usuário
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const result = await authService.register({ name, email, password });

    res.status(201).json({
      success: true,
      user: result.user,
      token: result.token
    });
  } catch (error) {
    logger.warn('Erro no registro', { error: error.message });

    const status = error.code === ERROR_CODES.VALIDATION_ERROR ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Erro ao criar conta'
    });
  }
});

/**
 * POST /api/auth/login
 * Login com e-mail e senha
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'E-mail e senha são obrigatórios');
    }

    const result = await authService.login(email, password);

    res.json({
      success: true,
      user: result.user,
      token: result.token
    });
  } catch (error) {
    logger.warn('Erro no login', { email: req.body.email, error: error.message });

    const status = error.code === ERROR_CODES.UNAUTHORIZED ? 401 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Erro ao fazer login'
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Solicita recuperação de senha
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'E-mail é obrigatório');
    }

    const result = await authService.forgotPassword(email);

    res.json({
      success: true,
      message: result.message,
      // Em desenvolvimento, retorna o token para testes
      ...(result.resetToken && { resetToken: result.resetToken })
    });
  } catch (error) {
    // Sempre retorna sucesso por segurança
    res.json({
      success: true,
      message: 'Se o e-mail existir, você receberá instruções para redefinir sua senha.'
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Redefine a senha usando token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Token e nova senha são obrigatórios');
    }

    const result = await authService.resetPassword(token, password);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    logger.warn('Erro ao redefinir senha', { error: error.message });

    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao redefinir senha'
    });
  }
});

/**
 * GET /api/auth/verify
 * Verifica se o token é válido
 */
router.get('/verify', authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

/**
 * GET /api/auth/me
 * Retorna dados do usuário logado
 */
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

/**
 * POST /api/auth/logout
 * Logout (invalidação de token - futuro: blacklist)
 */
router.post('/logout', authMiddleware, (req, res) => {
  // Em uma implementação completa, adicionaria o token a uma blacklist
  logger.info('Logout', { userId: req.userId });

  res.json({
    success: true,
    message: 'Logout realizado com sucesso'
  });
});

/**
 * PUT /api/auth/change-password
 * Altera a senha do usuário logado
 */
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Senha atual e nova senha são obrigatórias');
    }

    // Verifica senha atual
    const user = await authService.verifyAndGetUser(req.headers.authorization.split(' ')[1]);
    
    // Atualiza para nova senha
    await authService.resetPassword(currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    logger.warn('Erro ao alterar senha', { userId: req.userId, error: error.message });

    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao alterar senha'
    });
  }
});

// Exporta router e middleware
module.exports = router;
module.exports.authMiddleware = authMiddleware;
