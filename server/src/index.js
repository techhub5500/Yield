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
  MathDirect: require('./tools/math-direct'),

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

// --- Inicialização do servidor HTTP ---
// Se executado diretamente (não via require), iniciar o servidor.
if (require.main === module) {
  const { createServer, startServer } = require('./api/server');
  const memoryManager = require('./core/memory/manager');        // singleton
  const junior = require('./agents/junior');                      // { analyze, formatMemoryForPrompt }
  const Dispatcher = require('./core/router/dispatcher');         // class
  const orchestrator = require('./agents/orchestrator');           // { plan, formatMemoryForOrchestrator }
  const ExecutionManager = require('./core/orchestrator/execution-manager'); // class
  const responseAgent = require('./agents/response');              // { synthesize, formatDirectResponse }
  const ExternalCallManager = require('./core/state/external-call-manager'); // class

  // Ferramentas (Fase 2 + 3)
  const FinanceBridge = require('./tools/finance-bridge');
  const SearchManager = require('./tools/search');
  const MathModule = require('./tools/math');
  const MathDirect = require('./tools/math-direct');

  // Coordenadores (Fase 3)
  const AnalysisCoordinator = require('./agents/coordinators/analysis');
  const InvestmentsCoordinator = require('./agents/coordinators/investments');
  const PlanningCoordinator = require('./agents/coordinators/planning');

  // Instanciar ferramentas
  const financeBridge = new FinanceBridge();
  const searchManager = new SearchManager();
  const mathModule = MathModule; // já é singleton (module.exports = new MathModule())
  const mathDirect = MathDirect;
  const externalCallManager = new ExternalCallManager();

  // Instanciar coordenadores com ferramentas injetadas
  const coordinatorTools = { financeBridge, searchManager, mathModule };
  const coordinators = {
    analysis: new AnalysisCoordinator(coordinatorTools),
    investments: new InvestmentsCoordinator(coordinatorTools),
    planning: new PlanningCoordinator(coordinatorTools),
  };

  // Instanciar ExecutionManager com coordenadores
  const executionManager = new ExecutionManager(coordinators);

  // Instanciar Dispatcher com TODAS as ferramentas e agentes
  const dispatcher = new Dispatcher({
    financeBridge,
    searchManager,
    mathDirect,
    orchestrator,
    executionManager,
    externalCallManager,
  });

  const dependencies = {
    memoryManager,
    junior,
    dispatcher,
    orchestrator,
    executionManager,
    responseAgent,
    externalCallManager,
  };

  const app = createServer(dependencies);
  startServer(app).then(() => {
    logger.system('INFO', 'Server', `Yield Server pronto para receber conexões na porta ${config.server.port}`);
  }).catch((err) => {
    logger.error('Server', 'system', `Falha ao iniciar servidor: ${err.message}`);
    process.exit(1);
  });
}
