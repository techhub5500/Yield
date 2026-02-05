require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const database = require('./config/database');
const financeBridge = require('./services/finance-bridge');
const agents = require('./services/agents');
const memoryManager = require('./services/memory');
const authRoutes = require('./routes/auth');
const logger = require('./utils/logger');
const strategicLogger = require('./utils/strategic-logger');

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

    // Servir arquivos estáticos do frontend
    const clientPath = path.join(__dirname, '../../client');
    this.app.use(express.static(clientPath));
    logger.info(`Servindo arquivos estáticos de: ${clientPath}`);

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
    // Rotas para páginas HTML
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../../client/html/home.html'));
    });

    this.app.get('/home.html', (req, res) => {
      res.sendFile(path.join(__dirname, '../../client/html/home.html'));
    });

    this.app.get('/finance.html', (req, res) => {
      res.sendFile(path.join(__dirname, '../../client/html/finance.html'));
    });

    this.app.get('/invest-dash.html', (req, res) => {
      res.sendFile(path.join(__dirname, '../../client/html/invest-dash.html'));
    });

    // Health check
    this.app.get('/api/health', async (req, res) => {
      try {
        const dbHealth = database.isConnected;
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

    // Rota do Chat com IA (Sistema Multi-Agente)
    this.app.post('/api/chat', async (req, res) => {
      const requestId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = Date.now();
      
      try {
        const { message, chatId, pageContext } = req.body;
        
        // Validações básicas
        if (!message || typeof message !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Mensagem é obrigatória'
          });
        }

        // Identificar usuário (por enquanto usa um ID fixo se não autenticado)
        const userId = req.user?.id || 'anonymous_user';
        const sessionChatId = chatId || `chat_${userId}_${Date.now()}`;

        // Contexto do usuário
        const context = {
          user_id: userId,
          chat_id: sessionChatId,
          page: pageContext || 'home',
          timezone: 'America/Sao_Paulo',
          currency: 'BRL',
          timestamp: new Date().toISOString()
        };

        logger.debug('Chat request received', { chatId: sessionChatId, page: context.page });

        // Carregar memória do chat (se existir)
        let memory = null;
        try {
          memory = await memoryManager.loadMemory(sessionChatId, userId);
        } catch (memError) {
          logger.warn('Não foi possível carregar memória, usando memória vazia', { error: memError.message });
          memory = {
            chat_id: sessionChatId,
            user_id: userId,
            recent_cycles: [],
            old_cycles: [],
            critical_data: {},
            metadata: { total_cycles: 0, total_word_count: 0 }
          };
        }

        // Processar mensagem via sistema de agentes
        const result = await agents.processMessage(memory, message, context);

        // Preparar resposta
        let responseText = '';
        if (result.finalResponse) {
          responseText = result.finalResponse.text || result.finalResponse;
        } else if (result.response) {
          responseText = result.response.text || result.response;
        } else if (result.data) {
          // Query simples retornou dados
          responseText = result.formattedResponse || JSON.stringify(result.data);
        } else {
          responseText = 'Desculpe, não consegui processar sua solicitação.';
        }

        // Salvar ciclo na memória (se possível)
        try {
          if (memory && memoryManager.addCycle) {
            await memoryManager.addCycle(sessionChatId, {
              user_message: message,
              ai_response: responseText
            });
          }
        } catch (saveError) {
          logger.warn('Não foi possível salvar memória', { error: saveError.message });
        }

        // Log estratégico de requisição completada
        const duration = Date.now() - startTime;
        await strategicLogger.info('request', 'ChatHandler',
          `Chat processado: ${result.agentType || 'junior'}`, {
            meta: {
              requestId,
              chatId: sessionChatId,
              agentType: result.agentType || 'junior',
              complexity: result.complexity,
              duration: `${duration}ms`
            }
          }
        );

        res.json({
          success: true,
          chatId: sessionChatId,
          response: responseText,
          metadata: {
            page: context.page,
            timestamp: new Date().toISOString(),
            agentType: result.agentType || 'junior',
            complexity: result.complexity
          }
        });

      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Erro ao processar chat', { error: error.message, stack: error.stack });
        
        // Log estratégico de erro
        await strategicLogger.error('request', 'ChatHandler',
          `Erro ao processar chat: ${error.message}`, {
            error,
            meta: { requestId, duration: `${duration}ms` }
          }
        );
        
        res.status(500).json({
          success: false,
          error: 'Erro ao processar mensagem',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      // Se for uma requisição de API, retorna JSON
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          success: false,
          message: 'Rota não encontrada'
        });
      }
      
      // Para outras requisições, retorna HTML amigável ou redireciona
      logger.warn(`Rota não encontrada: ${req.method} ${req.path}`);
      
      // Se aceita HTML, redireciona para home
      if (req.accepts('html')) {
        return res.redirect('/');
      }
      
      // Caso contrário, retorna erro simples
      res.status(404).send('Página não encontrada');
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
      // Inicializar sistema de logs estratégico
      await strategicLogger.initialize();
      await strategicLogger.processStart('Yield Finance Server', 'Application');
      
      logger.info('=== Iniciando Yield Finance Server ===');

      // Conectar ao banco de dados (não fatal se falhar)
      logger.info('Conectando ao MongoDB...');
      try {
        await database.connect();
        logger.info('✓ MongoDB conectado');
      } catch (error) {
        logger.warn('⚠ MongoDB não disponível - servidor continuará sem banco de dados');
        logger.warn('  Configure MONGODB_URI no arquivo .env para usar persistência');
      }

      // Verificar Finance Bridge
      logger.info('Verificando Finance Bridge...');
      const health = await financeBridge.healthCheck();
      logger.info('✓ Finance Bridge operacional', health);

      // Iniciar servidor HTTP
      const PORT = process.env.PORT || 3000;
      
      return new Promise((resolve, reject) => {
        this.server = this.app.listen(PORT, async () => {
          this.isRunning = true;
          logger.info(`✓ Servidor HTTP rodando na porta ${PORT}`);
          logger.info(`  API disponível em http://localhost:${PORT}/api`);
          logger.info(`  Frontend disponível em http://localhost:${PORT}`);
          logger.info('=== Servidor pronto para uso ===');
          
          // Log estratégico de servidor iniciado
          await strategicLogger.info('system', 'Application', 
            `Servidor Yield iniciado com sucesso na porta ${PORT}`, {
              eventName: 'server.start',
              meta: { port: PORT, env: process.env.NODE_ENV || 'development' }
            }
          );
          
          // Manter processo ativo
          this.setupGracefulShutdown();
          resolve();
        });

        // Tratamento de erro no servidor
        this.server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            logger.error(`❌ Porta ${PORT} já está em uso!`);
            logger.error(`   Execute este comando para liberar a porta:`);
            logger.error(`   Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`);
            process.exit(1);
          } else {
            logger.error('Erro no servidor HTTP', error);
            process.exit(1);
          }
        });
      });

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
        // Log estratégico de shutdown
        await strategicLogger.info('system', 'Application', 
          `Servidor encerrando (${signal})`, {
            eventName: 'server.stop',
            meta: { signal }
          }
        );
        
        // Fecha servidor HTTP
        if (this.server) {
          await new Promise((resolve) => this.server.close(resolve));
          logger.info('✓ Servidor HTTP encerrado');
        }

        await database.disconnect();
        logger.info('✓ Desconectado do MongoDB');
        
        // Encerrar sistema de logs
        await strategicLogger.shutdown();
        
        logger.info('Servidor encerrado com sucesso');
        process.exit(0);
      } catch (error) {
        logger.error('Erro ao encerrar servidor', error);
        await strategicLogger.critical('system', 'Application', 
          'Erro durante shutdown', { error });
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
