/**
 * Gerenciador Principal de Logs Estratégico
 * 
 * Classe central que coordena todo o sistema de logs.
 * Responsável por receber entradas de log, filtrar por nível,
 * formatar e delegar a escrita.
 */

const { LOG_LEVELS, LOG_CATEGORIES, BEHAVIOR_CONFIG, STRATEGIC_EVENTS } = require('./config');
const markdownFormatter = require('./formatters/markdown');
const fileWriter = require('./writers/file-writer');

class LogManager {
  constructor() {
    this.initialized = false;
    this.minLevelValue = this.getLevelValue(BEHAVIOR_CONFIG.minLevel);
    this.requestContexts = new Map(); // Rastreia contexto de requisições
    this.stats = {
      total: 0,
      byLevel: { CRITICAL: 0, ERROR: 0, WARNING: 0, INFO: 0 },
      byCategory: {}
    };
  }

  /**
   * Inicializa o sistema de logs
   */
  async initialize() {
    if (this.initialized) return;

    try {
      if (!BEHAVIOR_CONFIG.enabled) {
        console.log('[LogManager] Sistema de logs desabilitado');
        return;
      }

      await fileWriter.initialize();
      this.initialized = true;
      
      // Log de inicialização
      await this.info('system', 'LogManager', 'Sistema de logs estratégico iniciado', {
        minLevel: BEHAVIOR_CONFIG.minLevel,
        consoleOutput: BEHAVIOR_CONFIG.consoleOutput
      });
    } catch (error) {
      console.error('[LogManager] Falha na inicialização:', error.message);
    }
  }

  /**
   * Obtém valor numérico do nível de log
   */
  getLevelValue(level) {
    const levelConfig = LOG_LEVELS[level];
    return levelConfig ? levelConfig.value : 3;
  }

  /**
   * Verifica se um nível deve ser logado
   */
  shouldLog(level) {
    if (!BEHAVIOR_CONFIG.enabled) return false;
    const levelValue = this.getLevelValue(level);
    return levelValue <= this.minLevelValue;
  }

  /**
   * Verifica se é um evento estratégico (sempre logar)
   */
  isStrategicEvent(eventName) {
    return STRATEGIC_EVENTS.some(event => eventName.startsWith(event));
  }

  /**
   * Método principal de log
   * 
   * @param {string} level - Nível (CRITICAL, ERROR, WARNING, INFO)
   * @param {string} category - Categoria do log
   * @param {string} component - Componente que gerou o log
   * @param {string} message - Mensagem principal
   * @param {Object} options - Opções adicionais
   * @param {Object} options.meta - Metadados
   * @param {Error} options.error - Erro (para níveis ERROR/CRITICAL)
   * @param {string} options.eventName - Nome do evento (para eventos estratégicos)
   * @param {string} options.requestId - ID da requisição (para rastreamento)
   */
  async log(level, category, component, message, options = {}) {
    const { meta, error, eventName, requestId } = options;

    // Verifica se deve logar
    const isStrategic = eventName && this.isStrategicEvent(eventName);
    if (!this.shouldLog(level) && !isStrategic) return;

    // Garante inicialização
    if (!this.initialized) {
      await this.initialize();
      if (!this.initialized) return; // Falhou na inicialização
    }

    const timestamp = new Date();

    // Monta entrada de log
    const entry = {
      level,
      category,
      component,
      message,
      meta: meta || {},
      error: error || null,
      timestamp,
      eventName,
      requestId
    };

    // Adiciona contexto da requisição se disponível
    if (requestId && this.requestContexts.has(requestId)) {
      const context = this.requestContexts.get(requestId);
      entry.meta = { ...context, ...entry.meta };
    }

    // Atualiza estatísticas
    this.updateStats(level, category);

    // Formata como Markdown
    const formatted = markdownFormatter.formatEntry(entry);

    // Escreve no arquivo
    await fileWriter.write(formatted);

    // Output no console se configurado
    if (BEHAVIOR_CONFIG.consoleOutput) {
      this.logToConsole(entry);
    }
  }

  /**
   * Log de nível CRITICAL
   */
  async critical(category, component, message, options = {}) {
    await this.log('CRITICAL', category, component, message, options);
  }

  /**
   * Log de nível ERROR
   */
  async error(category, component, message, options = {}) {
    await this.log('ERROR', category, component, message, options);
  }

  /**
   * Log de nível WARNING
   */
  async warning(category, component, message, options = {}) {
    await this.log('WARNING', category, component, message, options);
  }

  /**
   * Log de nível INFO
   */
  async info(category, component, message, options = {}) {
    await this.log('INFO', category, component, message, options);
  }

  // ===============================
  // Métodos de Conveniência
  // ===============================

  /**
   * Inicia rastreamento de uma requisição
   * 
   * @param {string} requestId - ID único da requisição
   * @param {Object} context - Contexto inicial
   * @returns {Object} Objeto com métodos de log vinculados à requisição
   */
  startRequest(requestId, context = {}) {
    const startTime = Date.now();
    
    this.requestContexts.set(requestId, {
      requestId,
      startTime,
      ...context
    });

    // Retorna objeto com métodos de log vinculados
    const self = this;
    return {
      info: (component, message, meta) => 
        self.info('request', component, message, { requestId, meta }),
      warning: (component, message, meta) => 
        self.warning('request', component, message, { requestId, meta }),
      error: (component, message, error, meta) => 
        self.error('request', component, message, { requestId, error, meta }),
      end: (success = true, meta = {}) => 
        self.endRequest(requestId, success, meta)
    };
  }

  /**
   * Finaliza rastreamento de uma requisição
   */
  async endRequest(requestId, success = true, meta = {}) {
    const context = this.requestContexts.get(requestId);
    if (!context) return;

    const duration = Date.now() - context.startTime;
    
    await this.info('request', 'RequestTracker', 
      `Requisição ${success ? 'concluída' : 'falhou'} em ${duration}ms`, {
        requestId,
        meta: { ...meta, duration, success }
      }
    );

    this.requestContexts.delete(requestId);
  }

  /**
   * Log de início de processo
   */
  async processStart(processName, component, meta = {}) {
    await this.info('system', component, `▶️ Iniciando: ${processName}`, { meta });
  }

  /**
   * Log de fim de processo
   */
  async processEnd(processName, component, duration, success = true, meta = {}) {
    const level = success ? 'INFO' : 'ERROR';
    const status = success ? '✅ Concluído' : '❌ Falhou';
    await this.log(level, 'system', component, 
      `${status}: ${processName} (${duration}ms)`, { meta }
    );
  }

  /**
   * Log de decisão do sistema
   */
  async decision(component, decision, reason, options = {}) {
    await this.info('agent', component, 
      `🔀 Decisão: ${decision}. Motivo: ${reason}`, {
        eventName: 'decision.route',
        ...options
      }
    );
  }

  /**
   * Log de operação do Finance Bridge
   */
  async bridgeOperation(operation, success, duration, meta = {}) {
    const level = success ? 'INFO' : 'ERROR';
    await this.log(level, 'bridge', 'FinanceBridge',
      `${operation} ${success ? 'executada' : 'falhou'} em ${duration}ms`, {
        eventName: 'finance.operation.complete',
        meta: { operation, duration, ...meta }
      }
    );
  }

  /**
   * Log de escalada de agente
   */
  async agentEscalation(fromAgent, toAgent, reason, meta = {}) {
    await this.info('agent', fromAgent,
      `↗️ Escalando para ${toAgent}: ${reason}`, {
        eventName: 'agent.junior.escalate',
        meta: { fromAgent, toAgent, ...meta }
      }
    );
  }

  /**
   * Log de compressão de memória
   */
  async memoryCompression(beforeSize, afterSize, duration) {
    const reduction = ((beforeSize - afterSize) / beforeSize * 100).toFixed(1);
    await this.info('memory', 'MemoryManager',
      `🗜️ Memória comprimida: ${beforeSize} → ${afterSize} palavras (${reduction}% redução) em ${duration}ms`, {
        eventName: 'memory.compress',
        meta: { beforeSize, afterSize, reduction, duration }
      }
    );
  }

  // ===============================
  // Utilitários
  // ===============================

  /**
   * Atualiza estatísticas internas
   */
  updateStats(level, category) {
    this.stats.total++;
    this.stats.byLevel[level] = (this.stats.byLevel[level] || 0) + 1;
    this.stats.byCategory[category] = (this.stats.byCategory[category] || 0) + 1;
  }

  /**
   * Output no console
   */
  logToConsole(entry) {
    const levelConfig = LOG_LEVELS[entry.level];
    const prefix = `[${levelConfig.emoji}${entry.level}]`;
    const timeStr = markdownFormatter.formatTime(entry.timestamp);
    
    const line = `${prefix} ${timeStr} [${entry.component}] ${entry.message}`;
    
    switch (entry.level) {
      case 'CRITICAL':
      case 'ERROR':
        console.error(line);
        if (entry.error) console.error(entry.error);
        break;
      case 'WARNING':
        console.warn(line);
        break;
      default:
        console.log(line);
    }
  }

  /**
   * Força escrita de todos os logs pendentes
   */
  async flush() {
    await fileWriter.flush();
  }

  /**
   * Finaliza o sistema de logs
   */
  async shutdown() {
    await this.info('system', 'LogManager', 'Sistema de logs encerrando...');
    await fileWriter.shutdown();
    this.initialized = false;
  }

  /**
   * Retorna estatísticas e status do sistema
   */
  getStatus() {
    return {
      initialized: this.initialized,
      enabled: BEHAVIOR_CONFIG.enabled,
      minLevel: BEHAVIOR_CONFIG.minLevel,
      stats: this.stats,
      fileWriter: fileWriter.getStats(),
      activeRequests: this.requestContexts.size
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: this.initialized ? 'healthy' : 'not_initialized',
      enabled: BEHAVIOR_CONFIG.enabled,
      ...this.getStatus()
    };
  }
}

module.exports = new LogManager();
