/**
 * User Repository
 * Operações de CRUD para usuários
 */

const User = require('./User');
const logger = require('../utils/logger');
const { AppError, ERROR_CODES } = require('../utils/error-handler');

class UserRepository {
  /**
   * Cria um novo usuário
   * @param {Object} userData - Dados do usuário
   * @returns {Promise<Object>} Usuário criado (público)
   */
  async create(userData) {
    const startTime = Date.now();

    try {
      // Verifica se e-mail já existe
      const emailExists = await User.emailExists(userData.email);
      if (emailExists) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'E-mail já está em uso');
      }

      const user = new User(userData);
      await user.save();

      const duration = Date.now() - startTime;
      logger.debug('UserRepository.create', { email: userData.email, duration });

      return user.toPublicJSON();
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('UserRepository.create', duration, false, { email: userData.email, error: error.message });

      if (error instanceof AppError) throw error;
      if (error.code === 11000) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'E-mail já está em uso');
      }
      throw error;
    }
  }

  /**
   * Busca usuário por ID
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object|null>} Usuário ou null
   */
  async findById(userId) {
    const startTime = Date.now();

    try {
      const user = await User.findById(userId);
      
      const duration = Date.now() - startTime;
      logger.debug('UserRepository.findById', { userId, found: !!user, duration });

      return user ? user.toPublicJSON() : null;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('UserRepository.findById', duration, false, { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Busca usuário por e-mail (para autenticação)
   * @param {string} email - E-mail do usuário
   * @returns {Promise<Object|null>} Usuário com senha ou null
   */
  async findByEmailForAuth(email) {
    const startTime = Date.now();

    try {
      const user = await User.findByEmailWithPassword(email);
      
      const duration = Date.now() - startTime;
      logger.debug('UserRepository.findByEmailForAuth', { email, found: !!user, duration });

      return user;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('UserRepository.findByEmailForAuth', duration, false, { email, error: error.message });
      throw error;
    }
  }

  /**
   * Busca usuário por e-mail (público)
   * @param {string} email - E-mail do usuário
   * @returns {Promise<Object|null>} Usuário público ou null
   */
  async findByEmail(email) {
    const startTime = Date.now();

    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      
      const duration = Date.now() - startTime;
      logger.debug('UserRepository.findByEmail', { email, found: !!user, duration });

      return user ? user.toPublicJSON() : null;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('UserRepository.findByEmail', duration, false, { email, error: error.message });
      throw error;
    }
  }

  /**
   * Busca usuário por ID do Google
   * @param {string} googleId - ID do Google
   * @returns {Promise<Object|null>} Usuário público ou null
   */
  async findByGoogleId(googleId) {
    const startTime = Date.now();

    try {
      const user = await User.findByGoogleId(googleId);
      
      const duration = Date.now() - startTime;
      logger.debug('UserRepository.findByGoogleId', { googleId, found: !!user, duration });

      return user ? user.toPublicJSON() : null;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('UserRepository.findByGoogleId', duration, false, { googleId, error: error.message });
      throw error;
    }
  }

  /**
   * Atualiza dados do usuário
   * @param {string} userId - ID do usuário
   * @param {Object} updates - Dados para atualizar
   * @returns {Promise<Object>} Usuário atualizado
   */
  async update(userId, updates) {
    const startTime = Date.now();

    try {
      // Campos protegidos que não podem ser atualizados diretamente
      const protectedFields = ['password', 'email', 'oauth', 'resetPasswordToken', 'resetPasswordExpires'];
      protectedFields.forEach(field => delete updates[field]);

      const user = await User.findByIdAndUpdate(
        userId,
        { ...updates, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 'Usuário não encontrado');
      }

      const duration = Date.now() - startTime;
      logger.debug('UserRepository.update', { userId, duration });

      return user.toPublicJSON();
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('UserRepository.update', duration, false, { userId, error: error.message });
      
      if (error instanceof AppError) throw error;
      throw error;
    }
  }

  /**
   * Atualiza a senha do usuário
   * @param {string} userId - ID do usuário
   * @param {string} newPassword - Nova senha
   * @returns {Promise<boolean>} Sucesso
   */
  async updatePassword(userId, newPassword) {
    const startTime = Date.now();

    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 'Usuário não encontrado');
      }

      user.password = newPassword;
      await user.save();

      const duration = Date.now() - startTime;
      logger.debug('UserRepository.updatePassword', { userId, duration });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('UserRepository.updatePassword', duration, false, { userId, error: error.message });
      
      if (error instanceof AppError) throw error;
      throw error;
    }
  }

  /**
   * Define token de recuperação de senha
   * @param {string} email - E-mail do usuário
   * @param {string} token - Token de recuperação
   * @param {Date} expires - Data de expiração
   * @returns {Promise<boolean>} Sucesso
   */
  async setResetPasswordToken(email, token, expires) {
    const startTime = Date.now();

    try {
      const user = await User.findOneAndUpdate(
        { email: email.toLowerCase() },
        { 
          resetPasswordToken: token,
          resetPasswordExpires: expires
        }
      );

      const duration = Date.now() - startTime;
      logger.debug('UserRepository.setResetPasswordToken', { email, found: !!user, duration });

      return !!user;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('UserRepository.setResetPasswordToken', duration, false, { email, error: error.message });
      throw error;
    }
  }

  /**
   * Busca usuário por token de recuperação de senha
   * @param {string} token - Token de recuperação
   * @returns {Promise<Object|null>} Usuário ou null
   */
  async findByResetToken(token) {
    const startTime = Date.now();

    try {
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() }
      }).select('+resetPasswordToken +resetPasswordExpires');

      const duration = Date.now() - startTime;
      logger.debug('UserRepository.findByResetToken', { found: !!user, duration });

      return user;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('UserRepository.findByResetToken', duration, false, { error: error.message });
      throw error;
    }
  }

  /**
   * Limpa token de recuperação de senha
   * @param {string} userId - ID do usuário
   * @returns {Promise<boolean>} Sucesso
   */
  async clearResetToken(userId) {
    const startTime = Date.now();

    try {
      await User.findByIdAndUpdate(userId, {
        $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 }
      });

      const duration = Date.now() - startTime;
      logger.debug('UserRepository.clearResetToken', { userId, duration });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('UserRepository.clearResetToken', duration, false, { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Atualiza último login
   * @param {string} userId - ID do usuário
   * @returns {Promise<void>}
   */
  async updateLastLogin(userId) {
    try {
      await User.findByIdAndUpdate(userId, { lastLoginAt: new Date() });
    } catch (error) {
      // Não propaga erro, apenas loga
      logger.warn('Falha ao atualizar último login', { userId, error: error.message });
    }
  }

  /**
   * Deleta um usuário
   * @param {string} userId - ID do usuário
   * @param {boolean} confirm - Confirmação obrigatória
   * @returns {Promise<boolean>} Sucesso
   */
  async delete(userId, confirm = false) {
    const startTime = Date.now();

    try {
      if (!confirm) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Confirmação obrigatória para deletar usuário');
      }

      const result = await User.findByIdAndDelete(userId);

      const duration = Date.now() - startTime;
      logger.debug('UserRepository.delete', { userId, deleted: !!result, duration });

      return !!result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('UserRepository.delete', duration, false, { userId, error: error.message });
      
      if (error instanceof AppError) throw error;
      throw error;
    }
  }

  /**
   * Cria ou atualiza usuário OAuth (Google)
   * @param {Object} profile - Perfil do Google
   * @returns {Promise<Object>} Usuário público
   */
  async upsertGoogleUser(profile) {
    const startTime = Date.now();

    try {
      let user = await User.findByGoogleId(profile.id);

      if (user) {
        // Atualiza último login
        await this.updateLastLogin(user._id);
        return user.toPublicJSON();
      }

      // Verifica se e-mail já existe
      user = await User.findOne({ email: profile.email.toLowerCase() });
      
      if (user) {
        // Vincula conta Google ao usuário existente
        user.oauth.google = {
          id: profile.id,
          email: profile.email
        };
        await user.save();
        await this.updateLastLogin(user._id);
        return user.toPublicJSON();
      }

      // Cria novo usuário
      user = new User({
        name: profile.name,
        email: profile.email,
        avatar: profile.picture,
        password: Math.random().toString(36).slice(-12) + 'A1!', // Senha aleatória
        oauth: {
          google: {
            id: profile.id,
            email: profile.email
          }
        }
      });

      await user.save();

      const duration = Date.now() - startTime;
      logger.debug('UserRepository.upsertGoogleUser', { googleId: profile.id, duration });

      return user.toPublicJSON();
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('UserRepository.upsertGoogleUser', duration, false, { googleId: profile.id, error: error.message });
      throw error;
    }
  }
}

module.exports = new UserRepository();
