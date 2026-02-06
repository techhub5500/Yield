/**
 * @module index
 * @description Ponto de entrada do servidor Yield.
 * Inicializa logger, valida configurações e expõe bootstrap do servidor HTTP.
 */

const logger = require('./utils/logger');
const config = require('./config');

// Inicializar logger
logger.init({
  minLevel: config.server.env === 'production' ? 'INFO' : 'DEBUG',
  console: true,
  file: true,
});

logger.system('INFO', 'Server', `Yield Server v1.0.0 inicializado (${config.server.env})`);

// Validação de configurações essenciais
function validateConfig() {
  const missing = [];

  if (!config.mongodb.uri) missing.push('MONGODB_URI');
  if (!config.openai.apiKey) missing.push('OPENAI_API_KEY');

  if (missing.length > 0) {
    logger.error('Server', 'system', `Variáveis de ambiente ausentes: ${missing.join(', ')}`);
    process.exit(1);
  }

  logger.system('INFO', 'Server', 'Configurações validadas com sucesso');
}

validateConfig();

// Exportar módulos de todas as Fases
module.exports = {
  // Core - Lógica Pura (Fase 1)
  MemoryManager: require('./core/memory/manager'),
  Memory: require('./core/memory/structure'),
  Cycle: require('./core/memory/cycle'),
  counter: require('./core/memory/counter'),
  storage: require('./core/memory/storage'),

  // Core - Roteamento (Fase 2)
  Dispatcher: require('./core/router/dispatcher'),

  // Core - Orquestração (Fase 3)
  ExecutionManager: require('./core/orchestrator/execution-manager'),
  ExecutionQueue: require('./core/orchestrator/queue'),
  inputBuilder: require('./core/orchestrator/input-builder'),

  // Core - Estado (Fase 4)
  AgentState: require('./core/state/agent-state'),
  ExternalCallManager: require('./core/state/external-call-manager'),
  contextRecovery: require('./core/state/context-recovery'),

  // Agentes de IA (Fase 1)
  summarizer: require('./agents/memory/summarizer'),
  compressor: require('./agents/memory/compressor'),

  // Agentes de IA (Fase 2)
  junior: require('./agents/junior'),

  // Agentes de IA (Fase 3)
  orchestrator: require('./agents/orchestrator'),
  AnalysisCoordinator: require('./agents/coordinators/analysis'),
  InvestmentsCoordinator: require('./agents/coordinators/investments'),
  PlanningCoordinator: require('./agents/coordinators/planning'),
  BaseCoordinator: require('./agents/coordinators/base'),

  // Agentes de IA (Fase 4)
  responseAgent: require('./agents/response'),

  // Ferramentas (Fase 2)
  FinanceBridge: require('./tools/finance-bridge'),
  SearchManager: require('./tools/search'),

  // Ferramentas (Fase 3)
  MathModule: require('./tools/math'),

  // API HTTP (Fase 4)
  createServer: require('./api/server').createServer,
  startServer: require('./api/server').startServer,

  // Utilitários
  logger,
  config,
  ModelFactory: require('./utils/ai/model-factory'),
  AIClient: require('./utils/ai/client'),
  OpenAIClient: require('./utils/ai/openai-client'),
};
