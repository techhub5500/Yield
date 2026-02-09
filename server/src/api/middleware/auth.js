/**
 * @module api/middleware/auth
 * @description Middleware de autenticação JWT.
 * 
 * LÓGICA PURA — validação de token e extração de userId.
 * 
 * Uso:
 * - Aplicar em rotas que requerem autenticação
 * - Adiciona req.user = { userId, email, name } ao request
 */

const jwt = require('jsonwebtoken');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Middleware que verifica JWT e extrai dados do usuário.
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next
 */
function authenticateToken(req, res, next) {
  // Extrair token do header Authorization
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.logic('WARN', 'AuthMiddleware', 'Tentativa de acesso sem token', {
      path: req.path,
      method: req.method,
    });
    return res.status(401).json({ 
      error: 'Autenticação necessária',
      message: 'Token não fornecido' 
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  // Verificar e decodificar token
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    
    // Adicionar dados do usuário ao request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
    };

    logger.logic('DEBUG', 'AuthMiddleware', `Usuário autenticado: ${decoded.email}`, {
      userId: decoded.userId,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.logic('WARN', 'AuthMiddleware', `Token inválido: ${error.message}`, {
      path: req.path,
      method: req.method,
    });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expirado',
        message: 'Faça login novamente' 
      });
    }

    return res.status(401).json({ 
      error: 'Token inválido',
      message: 'Autenticação falhou' 
    });
  }
}

/**
 * Middleware opcional - não falha se não houver token, mas extrai se houver.
 * Útil para rotas que funcionam com ou sem autenticação.
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Sem token, mas continua
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
    };
  } catch (error) {
    // Token inválido, mas continua sem usuário
    req.user = null;
  }

  next();
}

module.exports = {
  authenticateToken,
  optionalAuth,
};
