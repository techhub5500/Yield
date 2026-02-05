/**
 * Agentes - API Pública
 * Fases 3, 4, 5 e 6 - Sistema Multi-Agente Completo
 * 
 * Exporta todos os agentes do sistema para fácil acesso.
 * 
 * Arquitetura:
 * - Junior Agent (Fase 3): Porta de entrada, classifica e resolve queries simples
 * - Orchestrator (Fase 4): Gerencia tarefas complexas, gera DOC
 * - Coordinators (Fase 5): Agentes especializados (Analysis, Planning, Investments)
 * - Response Agent (Fase 6): Sintetiza e formata respostas finais
 * - Execution (Fase 6): Fluxo de execução contínua com ferramentas externas
 */

const juniorAgent = require('./junior');
const orchestratorAgent = require('./orchestrator');
const coordinators = require('./coordinators');
const responseAgent = require('./response');
const execution = require('./execution');
const strategicLogger = require('../../utils/strategic-logger');

/**
 * Processa uma mensagem do usuário (fluxo completo)
 * Ponto de entrada principal - decide se resolve localmente ou escala
 * 
 * @param {Object} memory - Memória completa do chat
 * @param {string} userMessage - Mensagem atual do usuário
 * @param {Object} context - Contexto adicional (user_id, etc)
 * @returns {Promise<Object>} Resultado do processamento
 */
async function processMessage(memory, userMessage, context = {}) {
  const startTime = Date.now();
  
  // 1. Processar com Agente Júnior
  const result = await juniorAgent.processMessage(memory, userMessage, context);
  
  // 2. Se precisa escalar para Orquestrador
  if (result.action === 'escalate' && result.target === 'orchestrator') {
    // Log estratégico de escalada
    await strategicLogger.agentEscalation('Junior', 'Orchestrator', 
      result.payload.reason || 'Tarefa complexa detectada',
      { complexity: result.complexity }
    );
    
    // 2.1 Processar tarefa complexa via Orquestrador
    const orchestratorResult = await orchestratorAgent.processComplexTask(
      result.payload.memory,
      result.payload.query,
      result.payload.context
    );

    // Log estratégico do orquestrador
    await strategicLogger.decision('Orchestrator', 
      `DOC gerado com ${orchestratorResult.doc?.task_distribution?.length || 0} tarefas`,
      'Decomposição de tarefa complexa'
    );

    // 2.2 Se tem resultados dos coordenadores, sintetizar resposta
    if (orchestratorResult.results) {
      const finalResponse = await responseAgent.process(
        memory,
        userMessage,
        orchestratorResult.doc,
        orchestratorResult.results
      );
      
      const duration = Date.now() - startTime;
      
      // Log estratégico da resposta final
      await strategicLogger.info('agent', 'ResponseAgent',
        `Resposta sintetizada de ${Object.keys(orchestratorResult.results.completed || {}).length} coordenadores`,
        {
          eventName: 'agent.response.deliver',
          meta: { duration: `${duration}ms` }
        }
      );
      
      return {
        ...orchestratorResult,
        finalResponse: finalResponse.response,
        metadata: {
          ...orchestratorResult.metadata,
          responseAgent: finalResponse.metadata
        }
      };
    }

    return orchestratorResult;
  }
  
  // Log estratégico de resolução pelo Junior
  const duration = Date.now() - startTime;
  await strategicLogger.info('agent', 'JuniorAgent',
    `Processado localmente: ${result.action || 'resolved'}`,
    {
      eventName: 'agent.junior.classify',
      meta: { 
        complexity: result.complexity,
        action: result.action,
        duration: `${duration}ms`
      }
    }
  );
  
  return result;
}

/**
 * Processa mensagem com fluxo de execução contínua
 * Usa o FlowController para gerenciar estado e ferramentas externas
 */
async function processMessageWithFlow(memory, userMessage, context = {}) {
  // Inicializar sistema de execução
  await execution.initialize();

  // Processar via fluxo controlado
  return execution.executeAgent(
    { 
      agentType: 'main',
      process: (m, q) => processMessage(m, q, context)
    },
    { memory, query: userMessage },
    { timeout: execution.DEFAULT_CONFIG.coordinatorTimeout }
  );
}

/**
 * Inicializa todos os subsistemas
 */
async function initializeAll() {
  await Promise.all([
    coordinators.initializeAll(),
    responseAgent.initialize(),
    execution.initialize()
  ]);
}

/**
 * Health check de todos os componentes
 */
async function healthCheck() {
  return {
    junior: { status: 'healthy' },
    orchestrator: { status: 'healthy' },
    coordinators: await coordinators.healthCheck?.() || { status: 'healthy' },
    response: await responseAgent.healthCheck(),
    execution: await execution.healthCheck(),
    timestamp: new Date().toISOString()
  };
}

/**
 * Shutdown graceful de todos os componentes
 */
async function shutdown() {
  await Promise.all([
    coordinators.shutdownAll?.(),
    responseAgent.shutdown(),
    execution.shutdown()
  ]);
}

module.exports = {
  // Agente Júnior (Fase 3)
  junior: juniorAgent,
  
  // Agente Orquestrador (Fase 4)
  orchestrator: orchestratorAgent,
  
  // Agentes Coordenadores (Fase 5)
  coordinators,
  
  // Agente de Resposta (Fase 6)
  response: responseAgent,
  
  // Sistema de Execução Contínua (Fase 6)
  execution,
  
  // Funções principais de processamento
  processMessage,
  processMessageWithFlow,
  
  // Gestão do ciclo de vida
  initializeAll,
  healthCheck,
  shutdown,
  
  // Atalhos para funções específicas do Júnior
  classifyMessage: juniorAgent.classifyMessage,
  
  // Atalhos para funções específicas do Orquestrador
  processComplexTask: orchestratorAgent.processComplexTask,
  generateDoc: orchestratorAgent.generateDoc,
  executeDoc: orchestratorAgent.executeDoc,
  getAgentContracts: orchestratorAgent.getAgentContracts,
  
  // Atalhos para Resposta
  formatResponse: responseAgent.formatSimpleResponse,
  
  // Constantes
  COMPLEXITY_LEVELS: juniorAgent.COMPLEXITY_LEVELS,
  INTENT_TYPES: juniorAgent.INTENT_TYPES,
  RESPONSE_TYPES: responseAgent.RESPONSE_TYPES,
  FLOW_STATUS: execution.FLOW_STATUS
};
