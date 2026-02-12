/**
 * @module api/server
 * @description Servidor HTTP Express.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 * 
 * Responsabilidades:
 * - Expor API HTTP para integração com frontend
 * - CORS configurado para frontend
 * - Middleware de logging
 * - Error handling global
 * - Health check
 */

const path = require('path');
const express = require('express');
const config = require('../config');
const logger = require('../utils/logger');
const { createMessageRouter } = require('./routes/message');
const { createAuthRouter } = require('./routes/auth');
const { createInvestmentsRouter } = require('./routes/investments');

/**
 * Cria e configura o servidor Express.
 * 
 * @param {Object} dependencies - Dependências injetadas
 * @param {Object} dependencies.memoryManager - MemoryManager da Fase 1
 * @param {Object} dependencies.junior - Agente Junior da Fase 2
 * @param {Object} dependencies.dispatcher - Dispatcher da Fase 2
 * @param {Object} dependencies.orchestrator - Orquestrador da Fase 3
 * @param {Object} dependencies.executionManager - ExecutionManager da Fase 3
 * @param {Object} dependencies.responseAgent - Agente de Resposta da Fase 4
 * @param {Object} dependencies.externalCallManager - ExternalCallManager da Fase 4
 * @param {Object} [dependencies.financeBridge] - FinanceBridge (integração futura com investimentos)
 * @param {Object} [dependencies.investmentsService] - Serviço de métricas de investimentos (opcional)
 * @returns {Object} Aplicação Express configurada
 */
function createServer(dependencies = {}) {
  const app = express();

  // --- Middlewares ---

  // Parse JSON body
  app.use(express.json({ limit: '1mb' }));

  // CORS para frontend
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Middleware de logging — cada request logado
  app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const elapsed = Date.now() - start;
      const logLevel = res.statusCode >= 400 ? 'WARN' : 'DEBUG';

      logger.system(logLevel, 'HTTPServer', `${req.method} ${req.path} → ${res.statusCode} (${elapsed}ms)`);
    });

    next();
  });

  // --- Arquivos estáticos do frontend ---
  const clientDir = path.resolve(__dirname, '../../../client');
  app.use(express.static(clientDir));

  // Redirecionar raiz para home
  app.get('/', (req, res) => {
    res.redirect('/html/home.html');
  });

  // --- Rotas ---

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      timestamp: Date.now(),
      uptime: process.uptime(),
    });
  });

  // Rotas de autenticação (POST /api/auth/register, /api/auth/login, etc.)
  const authRouter = createAuthRouter();
  app.use('/api/auth', authRouter);

  // Rotas de mensagem (POST /api/message, GET /api/chat/:chatId/history)
  const messageRouter = createMessageRouter(dependencies);
  app.use('/api', messageRouter);

  // Rotas de investimentos (GET manifest, query de métricas e cards)
  const investmentsRouter = createInvestmentsRouter(dependencies);
  app.use('/api/investments', investmentsRouter);

  // --- Error handling global ---
  app.use((err, req, res, _next) => {
    logger.error('HTTPServer', 'system', `Erro não tratado: ${err.message}`, {
      path: req.path,
      method: req.method,
    });

    res.status(500).json({
      error: 'Erro interno do servidor',
      message: config.server.env === 'development' ? err.message : undefined,
    });
  });

  // 404
  app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada', path: req.path });
  });

  return app;
}

/**
 * Inicia o servidor HTTP.
 * 
 * @param {Object} app - Aplicação Express
 * @param {number} [port] - Porta (padrão: config.server.port)
 * @returns {Promise<Object>} Instância do servidor HTTP
 */
function startServer(app, port) {
  const serverPort = port || config.server.port;

  return new Promise((resolve) => {
    const server = app.listen(serverPort, () => {
      logger.system('INFO', 'HTTPServer', `Servidor iniciado na porta ${serverPort}`);
      resolve(server);
    });
  });
}

module.exports = { createServer, startServer };
