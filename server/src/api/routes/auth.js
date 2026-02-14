/**
 * @module api/routes/auth
 * @description Rotas de autenticação: registro, login, logout, verificação.
 * 
 * LÓGICA PURA — validação e manipulação de sessões.
 * 
 * Endpoints:
 * - POST /api/auth/register — Cadastro de novo usuário
 * - POST /api/auth/login — Login (retorna JWT)
 * - POST /api/auth/logout — Logout (invalida token)
 * - GET /api/auth/me — Verifica sessão atual e retorna dados do usuário
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');
const config = require('../../config');
const logger = require('../../utils/logger');

const USERS_COLLECTION = 'users';

/** @type {MongoClient|null} */
let _client = null;

/** @type {import('mongodb').Db|null} */
let _db = null;

/**
 * Conecta ao MongoDB (reutiliza conexão).
 * @returns {Promise<import('mongodb').Db>}
 */
async function getDb() {
  if (_db) return _db;

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      _client = new MongoClient(config.mongodb.uri);
      await _client.connect();
      _db = _client.db(config.mongodb.dbName);
      logger.system('INFO', 'AuthStorage', 'Conexão com MongoDB estabelecida (auth)');
      return _db;
    } catch (error) {
      logger.error('AuthStorage', 'system', `Tentativa ${attempt}/${maxRetries} de conexão falhou`, {
        error: error.message,
      });
      if (attempt === maxRetries) throw error;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

/**
 * Cria o router de autenticação.
 * @returns {express.Router}
 */
function createAuthRouter() {
  const router = express.Router();

  /**
   * POST /api/auth/register
   * Cadastro de novo usuário.
   * 
   * Body: { name: string, email: string, password: string }
   * Response: { success: true, userId: string, token: string, user: { name, email } }
   */
  router.post('/register', async (req, res, next) => {
    try {
      const { name, email, password } = req.body;

      // Validação de input
      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Nome deve ter pelo menos 2 caracteres' });
      }

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Email inválido' });
      }

      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
      }

      const db = await getDb();
      const usersCollection = db.collection(USERS_COLLECTION);

      // Verificar se email já existe
      const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(409).json({ error: 'Email já cadastrado' });
      }

      // Hash da senha
      const passwordHash = await bcrypt.hash(password, 10);

      // Criar usuário
      const user = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await usersCollection.insertOne(user);
      const userId = result.insertedId.toString();

      // Gerar JWT
      const token = jwt.sign(
        { userId, email: user.email, name: user.name },
        config.auth.jwtSecret,
        { expiresIn: config.auth.jwtExpiration }
      );

      logger.logic('INFO', 'AuthRoute', `Novo usuário cadastrado: ${user.email}`);

      return res.status(201).json({
        success: true,
        userId,
        token,
        user: {
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      logger.error('AuthRoute', 'system', `Erro no registro: ${error.message}`);
      next(error);
    }
  });

  /**
   * POST /api/auth/login
   * Login de usuário.
   * 
   * Body: { email: string, password: string }
   * Response: { success: true, token: string, user: { name, email } }
   */
  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = req.body;

      // Validação de input
      if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
      }

      const db = await getDb();
      const usersCollection = db.collection(USERS_COLLECTION);

      // Buscar usuário
      const user = await usersCollection.findOne({ email: email.toLowerCase().trim() });
      if (!user) {
        return res.status(401).json({ error: 'Email ou senha incorretos' });
      }

      // Verificar senha
      let passwordValid = false;

      if (typeof user.passwordHash === 'string' && user.passwordHash.length > 0) {
        passwordValid = await bcrypt.compare(password, user.passwordHash);
      } else if (typeof user.password === 'string' && user.password.length > 0) {
        // Compatibilidade com registros legados que armazenam senha em texto.
        // Migra para hash no primeiro login válido.
        passwordValid = password === user.password;

        if (passwordValid) {
          const passwordHash = await bcrypt.hash(password, 10);
          await usersCollection.updateOne(
            { _id: user._id },
            {
              $set: {
                passwordHash,
                updatedAt: new Date().toISOString(),
              },
              $unset: {
                password: '',
              },
            }
          );

          logger.system('WARN', 'AuthRoute', `Usuário migrado para passwordHash: ${user.email}`);
        }
      }

      if (!passwordValid) {
        return res.status(401).json({ error: 'Email ou senha incorretos' });
      }

      // Gerar JWT
      const userId = user._id.toString();
      const token = jwt.sign(
        { userId, email: user.email, name: user.name },
        config.auth.jwtSecret,
        { expiresIn: config.auth.jwtExpiration }
      );

      logger.logic('INFO', 'AuthRoute', `Login realizado: ${user.email}`);

      return res.json({
        success: true,
        token,
        user: {
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      logger.error('AuthRoute', 'system', `Erro no login: ${error.message}`);
      next(error);
    }
  });

  /**
   * GET /api/auth/me
   * Verifica sessão atual e retorna dados do usuário.
   * Requer header Authorization: Bearer <token>
   * 
   * Response: { user: { userId, name, email } }
   */
  router.get('/me', async (req, res, next) => {
    try {
      // Extrair token do header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token não fornecido' });
      }

      const token = authHeader.substring(7); // Remove "Bearer "

      // Verificar token
      let decoded;
      try {
        decoded = jwt.verify(token, config.auth.jwtSecret);
      } catch (err) {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
      }

      // Retornar dados do usuário
      return res.json({
        user: {
          userId: decoded.userId,
          name: decoded.name,
          email: decoded.email,
        },
      });
    } catch (error) {
      logger.error('AuthRoute', 'system', `Erro ao verificar sessão: ${error.message}`);
      next(error);
    }
  });

  /**
   * POST /api/auth/logout
   * Logout (no backend stateless JWT, apenas confirma)
   * Frontend deve remover o token do localStorage.
   * 
   * Response: { success: true, message: string }
   */
  router.post('/logout', (req, res) => {
    logger.logic('DEBUG', 'AuthRoute', 'Logout solicitado');
    return res.json({
      success: true,
      message: 'Logout realizado com sucesso',
    });
  });

  return router;
}

module.exports = { createAuthRouter };
