/**
 * Auth Service
 * Serviço de autenticação JWT
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userRepository = require('../../models/UserRepository');
const logger = require('../../utils/logger');
const { AppError, ERROR_CODES } = require('../../utils/error-handler');

// Configurações
const JWT_SECRET = process.env.JWT_SECRET || 'yield_secret_key_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const RESET_TOKEN_EXPIRES = 60 * 60 * 1000; // 1 hora

class AuthService {
  /**
   * Gera token JWT
   * @param {Object} user - Usuário
   * @returns {string} Token JWT
   */
  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  /**
   * Verifica e decodifica token JWT
   * @param {string} token - Token JWT
   * @returns {Object} Payload decodificado
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Token expirado');
      }
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Token inválido');
    }
  }

  /**
   * Login com e-mail e senha
   * @param {string} email - E-mail
   * @param {string} password - Senha
   * @returns {Promise<Object>} { user, token }
   */
  async login(email, password) {
    const startTime = Date.now();

    try {
      // Busca usuário com senha
      const user = await userRepository.findByEmailForAuth(email);

      if (!user) {
        throw new AppError(ERROR_CODES.UNAUTHORIZED, 'E-mail ou senha incorretos');
      }

      // Verifica status
      if (user.status !== 'active') {
        throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Conta suspensa ou inativa');
      }

      // Compara senha
      const isMatch = await user.comparePassword(password);

      if (!isMatch) {
        throw new AppError(ERROR_CODES.UNAUTHORIZED, 'E-mail ou senha incorretos');
      }

      // Atualiza último login
      await userRepository.updateLastLogin(user._id);

      // Gera token
      const publicUser = user.toPublicJSON();
      const token = this.generateToken(publicUser);

      const duration = Date.now() - startTime;
      logger.info('Login bem-sucedido', { userId: publicUser.id, email, duration });

      return { user: publicUser, token };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.warn('Falha no login', { email, duration, error: error.message });
      
      if (error instanceof AppError) throw error;
      throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Erro ao fazer login');
    }
  }

  /**
   * Registra novo usuário
   * @param {Object} userData - { name, email, password }
   * @returns {Promise<Object>} { user, token }
   */
  async register(userData) {
    const startTime = Date.now();

    try {
      // Validações básicas
      if (!userData.name || userData.name.trim().length < 2) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Nome deve ter pelo menos 2 caracteres');
      }

      if (!userData.email || !this.isValidEmail(userData.email)) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'E-mail inválido');
      }

      if (!userData.password || userData.password.length < 6) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Senha deve ter pelo menos 6 caracteres');
      }

      // Cria usuário
      const user = await userRepository.create({
        name: userData.name.trim(),
        email: userData.email.toLowerCase().trim(),
        password: userData.password
      });

      // Gera token
      const token = this.generateToken(user);

      const duration = Date.now() - startTime;
      logger.info('Registro bem-sucedido', { userId: user.id, email: user.email, duration });

      return { user, token };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.warn('Falha no registro', { email: userData.email, duration, error: error.message });
      
      if (error instanceof AppError) throw error;
      throw error;
    }
  }

  /**
   * Solicita recuperação de senha
   * @param {string} email - E-mail do usuário
   * @returns {Promise<Object>} { message, token (apenas em dev) }
   */
  async forgotPassword(email) {
    const startTime = Date.now();

    try {
      // Gera token de recuperação
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      const expires = new Date(Date.now() + RESET_TOKEN_EXPIRES);

      // Salva token (mesmo que usuário não exista, não revelamos isso)
      const userExists = await userRepository.setResetPasswordToken(email, hashedToken, expires);

      const duration = Date.now() - startTime;
      logger.info('Recuperação de senha solicitada', { email, userExists, duration });

      // Em produção, enviaria e-mail aqui
      // await emailService.sendPasswordReset(email, resetToken);

      const response = { message: 'Se o e-mail existir, você receberá instruções para redefinir sua senha.' };

      // Em desenvolvimento, retorna o token para testes
      if (process.env.NODE_ENV === 'development') {
        response.resetToken = resetToken;
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Erro na recuperação de senha', { email, duration, error: error.message });
      
      // Sempre retorna mensagem genérica por segurança
      return { message: 'Se o e-mail existir, você receberá instruções para redefinir sua senha.' };
    }
  }

  /**
   * Redefine a senha usando token
   * @param {string} token - Token de recuperação
   * @param {string} newPassword - Nova senha
   * @returns {Promise<Object>} { message }
   */
  async resetPassword(token, newPassword) {
    const startTime = Date.now();

    try {
      // Hash do token para comparar
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      // Busca usuário pelo token
      const user = await userRepository.findByResetToken(hashedToken);

      if (!user) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Token inválido ou expirado');
      }

      // Valida nova senha
      if (!newPassword || newPassword.length < 6) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Senha deve ter pelo menos 6 caracteres');
      }

      // Atualiza senha
      await userRepository.updatePassword(user._id, newPassword);

      // Limpa token
      await userRepository.clearResetToken(user._id);

      const duration = Date.now() - startTime;
      logger.info('Senha redefinida com sucesso', { userId: user._id.toString(), duration });

      return { message: 'Senha redefinida com sucesso!' };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.warn('Falha ao redefinir senha', { duration, error: error.message });
      
      if (error instanceof AppError) throw error;
      throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Erro ao redefinir senha');
    }
  }

  /**
   * Verifica token e retorna usuário
   * @param {string} token - Token JWT
   * @returns {Promise<Object>} Usuário
   */
  async verifyAndGetUser(token) {
    try {
      const decoded = this.verifyToken(token);
      const user = await userRepository.findById(decoded.id);

      if (!user) {
        throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Usuário não encontrado');
      }

      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Token inválido');
    }
  }

  /**
   * Valida formato de e-mail
   * @param {string} email - E-mail
   * @returns {boolean}
   */
  isValidEmail(email) {
    const emailRegex = /^\S+@\S+\.\S+$/;
    return emailRegex.test(email);
  }

  /**
   * Obtém ID do usuário do token
   * @param {string} token - Token JWT
   * @returns {string|null} User ID ou null
   */
  getUserIdFromToken(token) {
    try {
      const decoded = this.verifyToken(token);
      return decoded.id;
    } catch {
      return null;
    }
  }
}

module.exports = new AuthService();
