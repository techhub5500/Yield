require('dotenv').config();
const express = require('express');
const cors = require('cors');
const database = require('./config/database');
const financeBridge = require('./services/finance-bridge');
const authRoutes = require('./routes/auth');
const logger = require('./utils/logger');

/**
 * Aplicação Principal do Servidor
 */
class Application {
  constructor() {
    this.isRunning = false;
    this.server = null;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Configura middlewares do Express
   */
  setupMiddleware() {
    // CORS
    this.app.use(cors({
      origin: '*', // Em produção, especificar domínios permitidos
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // JSON parser
    this.app.use(express.json({ limit: '10mb' }));

    // URL encoded
    this.app.use(express.urlencoded({ extended: true }));

    // Log de requisições
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.debug(`${req.method} ${req.path}`, {
          status: res.statusCode,
          duration: `${duration}ms`
        });
      });
      next();
    });
  }

  /**
   * Configura rotas da API
   */
  setupRoutes() {
    // Health check
    this.app.get('/api/health', async (req, res) => {
      try {
        const dbHealth = database.isConnected();
        const fbHealth = await financeBridge.healthCheck();

        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          services: {
            database: dbHealth ? 'connected' : 'disconnected',
            financeBridge: fbHealth.status
          }
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: error.message
        });
      }
    });

    // Rotas de autenticação
    this.app.use('/api/auth', authRoutes);

    // Rota de teste do Finance Bridge
    this.app.post('/api/finance', async (req, res) => {
      try {
        const result = await financeBridge.process(req.body);
        res.json(result);
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: 'Rota não encontrada'
      });
    });

    // Error handler
    this.app.use((err, req, res, next) => {
      logger.error('Erro não tratado', { error: err.message, stack: err.stack });
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    });
  }

  /**
   * Inicializa a aplicação
   */
  async start() {
    try {
      logger.info('=== Iniciando Yield Finance Server ===');

      // Conectar ao banco de dados
      logger.info('Conectando ao MongoDB...');
      await database.connect();
      logger.info('✓ MongoDB conectado');

      // Verificar Finance Bridge
      logger.info('Verificando Finance Bridge...');
      const health = await financeBridge.healthCheck();
      logger.info('✓ Finance Bridge operacional', health);

      // Iniciar servidor HTTP
      const PORT = process.env.PORT || 3000;
      this.server = this.app.listen(PORT, () => {
        logger.info(`✓ Servidor HTTP rodando na porta ${PORT}`);
        logger.info(`  API disponível em http://localhost:${PORT}/api`);
      });

      this.isRunning = true;
      logger.info('=== Servidor pronto para uso ===');

      // Manter processo ativo
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Falha ao iniciar servidor', error);
      process.exit(1);
    }
  }

  /**
   * Configura desligamento gracioso
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`\n${signal} recebido, encerrando servidor...`);
      
      try {
        // Fecha servidor HTTP
        if (this.server) {
          await new Promise((resolve) => this.server.close(resolve));
          logger.info('✓ Servidor HTTP encerrado');
        }

        await database.disconnect();
        logger.info('✓ Desconectado do MongoDB');
        logger.info('Servidor encerrado com sucesso');
        process.exit(0);
      } catch (error) {
        logger.error('Erro ao encerrar servidor', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Para a aplicação
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Parando aplicação...');
    
    if (this.server) {
      await new Promise((resolve) => this.server.close(resolve));
    }
    
    await database.disconnect();
    this.isRunning = false;
    logger.info('Aplicação parada');
  }
}

// Criar e iniciar aplicação
const app = new Application();

// Iniciar se executado diretamente
if (require.main === module) {
  app.start();
}

module.exports = app;
