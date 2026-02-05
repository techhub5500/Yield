/**
 * Sistema de Logs Estratégico - API Pública
 * 
 * Este arquivo exporta todas as funções e classes necessárias
 * para usar o sistema de logs em qualquer parte da aplicação.
 * 
 * USO BÁSICO:
 * 
 *   const logger = require('./utils/strategic-logger');
 *   
 *   // Logs simples
 *   await logger.info('system', 'MeuComponente', 'Operação concluída');
 *   await logger.error('database', 'MongoDB', 'Conexão falhou', { error: err });
 *   
 *   // Rastreamento de requisição
 *   const reqLog = logger.startRequest('req-123', { userId: 'user-1' });
 *   reqLog.info('Handler', 'Processando...');
 *   reqLog.end(true, { result: 'ok' });
 *   
 * NÍVEIS:
 *   - CRITICAL: Falhas que impedem funcionamento
 *   - ERROR: Erros recuperáveis
 *   - WARNING: Anomalias que merecem atenção
 *   - INFO: Eventos importantes
 * 
 * CATEGORIAS:
 *   - system: Ciclo de vida, saúde
 *   - request: Requisições HTTP
 *   - agent: Fluxo de agentes
 *   - bridge: Finance Bridge
 *   - memory: Sistema de memória
 *   - auth: Autenticação
 *   - database: Banco de dados
 */

const logManager = require('./log-manager');
const { LOG_LEVELS, LOG_CATEGORIES, BEHAVIOR_CONFIG } = require('./config');

/**
 * Inicializa o sistema de logs
 * Deve ser chamado uma vez no início da aplicação
 */
async function initialize() {
  await logManager.initialize();
}

/**
 * Log de nível CRITICAL
 * Use para falhas que impedem o funcionamento do sistema
 * 
 * @param {string} category - Categoria (system, agent, bridge, etc.)
 * @param {string} component - Nome do componente
 * @param {string} message - Mensagem de log
 * @param {Object} options - { meta, error, eventName, requestId }
 */
async function critical(category, component, message, options = {}) {
  await logManager.critical(category, component, message, options);
}

/**
 * Log de nível ERROR
 * Use para erros que podem ser recuperados
 * 
 * @param {string} category - Categoria (system, agent, bridge, etc.)
 * @param {string} component - Nome do componente
 * @param {string} message - Mensagem de log
 * @param {Object} options - { meta, error, eventName, requestId }
 */
async function error(category, component, message, options = {}) {
  await logManager.error(category, component, message, options);
}

/**
 * Log de nível WARNING
 * Use para situações anômalas que merecem atenção
 * 
 * @param {string} category - Categoria (system, agent, bridge, etc.)
 * @param {string} component - Nome do componente
 * @param {string} message - Mensagem de log
 * @param {Object} options - { meta, error, eventName, requestId }
 */
async function warning(category, component, message, options = {}) {
  await logManager.warning(category, component, message, options);
}

/**
 * Log de nível INFO
 * Use para eventos importantes do sistema
 * 
 * @param {string} category - Categoria (system, agent, bridge, etc.)
 * @param {string} component - Nome do componente
 * @param {string} message - Mensagem de log
 * @param {Object} options - { meta, error, eventName, requestId }
 */
async function info(category, component, message, options = {}) {
  await logManager.info(category, component, message, options);
}

/**
 * Inicia rastreamento de uma requisição
 * Retorna objeto com métodos de log vinculados à requisição
 * 
 * @param {string} requestId - ID único da requisição
 * @param {Object} context - Contexto inicial (userId, path, etc.)
 * @returns {Object} { info, warning, error, end }
 * 
 * @example
 *   const reqLog = startRequest('req-123', { userId: 'user-1' });
 *   reqLog.info('Handler', 'Iniciando processamento');
 *   // ... processamento ...
 *   reqLog.end(true, { itemsProcessed: 10 });
 */
function startRequest(requestId, context = {}) {
  return logManager.startRequest(requestId, context);
}

/**
 * Log de início de processo
 * 
 * @param {string} processName - Nome do processo
 * @param {string} component - Componente que iniciou
 * @param {Object} meta - Metadados adicionais
 */
async function processStart(processName, component, meta = {}) {
  await logManager.processStart(processName, component, meta);
}

/**
 * Log de fim de processo
 * 
 * @param {string} processName - Nome do processo
 * @param {string} component - Componente
 * @param {number} duration - Duração em ms
 * @param {boolean} success - Se foi bem-sucedido
 * @param {Object} meta - Metadados adicionais
 */
async function processEnd(processName, component, duration, success = true, meta = {}) {
  await logManager.processEnd(processName, component, duration, success, meta);
}

/**
 * Log de decisão do sistema
 * Usa para documentar decisões de roteamento e lógica
 * 
 * @param {string} component - Componente que tomou a decisão
 * @param {string} decision - O que foi decidido
 * @param {string} reason - Por que foi decidido
 * @param {Object} options - Opções adicionais
 */
async function decision(component, decision, reason, options = {}) {
  await logManager.decision(component, decision, reason, options);
}

/**
 * Log de operação do Finance Bridge
 * 
 * @param {string} operation - Nome da operação (query, insert, etc.)
 * @param {boolean} success - Se foi bem-sucedida
 * @param {number} duration - Duração em ms
 * @param {Object} meta - Metadados (filters, results count, etc.)
 */
async function bridgeOperation(operation, success, duration, meta = {}) {
  await logManager.bridgeOperation(operation, success, duration, meta);
}

/**
 * Log de escalada entre agentes
 * 
 * @param {string} fromAgent - Agente de origem
 * @param {string} toAgent - Agente de destino
 * @param {string} reason - Motivo da escalada
 * @param {Object} meta - Metadados adicionais
 */
async function agentEscalation(fromAgent, toAgent, reason, meta = {}) {
  await logManager.agentEscalation(fromAgent, toAgent, reason, meta);
}

/**
 * Log de compressão de memória
 * 
 * @param {number} beforeSize - Tamanho antes (palavras)
 * @param {number} afterSize - Tamanho depois (palavras)
 * @param {number} duration - Tempo de compressão (ms)
 */
async function memoryCompression(beforeSize, afterSize, duration) {
  await logManager.memoryCompression(beforeSize, afterSize, duration);
}

/**
 * Força escrita de logs pendentes no buffer
 */
async function flush() {
  await logManager.flush();
}

/**
 * Finaliza o sistema de logs
 * Deve ser chamado antes de encerrar a aplicação
 */
async function shutdown() {
  await logManager.shutdown();
}

/**
 * Retorna status e estatísticas do sistema de logs
 * 
 * @returns {Object} Status completo
 */
function getStatus() {
  return logManager.getStatus();
}

/**
 * Health check do sistema de logs
 * 
 * @returns {Object} { status, enabled, ... }
 */
function healthCheck() {
  return logManager.healthCheck();
}

// ===============================
// Exportações
// ===============================

module.exports = {
  // Inicialização
  initialize,
  shutdown,
  flush,
  
  // Logs por nível
  critical,
  error,
  warning,
  info,
  
  // Rastreamento de requisições
  startRequest,
  
  // Logs de processo
  processStart,
  processEnd,
  
  // Logs específicos do sistema
  decision,
  bridgeOperation,
  agentEscalation,
  memoryCompression,
  
  // Status e diagnóstico
  getStatus,
  healthCheck,
  
  // Constantes úteis
  LEVELS: LOG_LEVELS,
  CATEGORIES: LOG_CATEGORIES,
  
  // Acesso direto ao manager (uso avançado)
  manager: logManager
};
