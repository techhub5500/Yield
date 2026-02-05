/**
 * Response - API Pública do Agente de Resposta
 * Fase 6 - Sistema Multi-Agente Financeiro
 * 
 * Este módulo exporta o Agente de Resposta e seus componentes:
 * - ResponseAgent: Agente principal que sintetiza e formata respostas
 * - Synthesizer: Combina resultados de múltiplos coordenadores
 * - Formatter: Formata valores e aplica estilos
 */

const { 
  ResponseAgent, 
  RESPONSE_STATUS, 
  RESPONSE_TYPES,
  initialize,
  getInstance,
  process 
} = require('./response-agent');
const Synthesizer = require('./synthesizer');
const Formatter = require('./formatter');

/**
 * Cache de instância inicializada
 */
let initialized = false;

/**
 * Inicializa o módulo de resposta
 * @returns {Promise<Object>} Instância do ResponseAgent
 */
async function initializeResponseModule() {
  if (initialized) {
    return getInstance();
  }
  
  const agent = await initialize();
  initialized = true;
  return agent;
}

/**
 * Processa resultados e gera resposta final
 * 
 * @param {Object} params - Parâmetros de processamento
 * @param {Object} params.memory - Memória do chat
 * @param {string} params.query - Query original do usuário
 * @param {Object} params.doc - DOC do Orquestrador
 * @param {Object} params.results - Resultados dos coordenadores
 * @returns {Promise<Object>} Resposta final formatada
 */
async function processResponse(params) {
  const { memory, query, doc, results } = params;
  return process(memory, query, doc, results);
}

/**
 * Formata resposta simples (para uso direto)
 * 
 * @param {Object} data - Dados a formatar
 * @param {string} query - Query do usuário
 * @returns {Object} Resposta formatada
 */
function formatSimpleResponse(data, query) {
  const formatter = new Formatter();
  const synthesizer = new Synthesizer();
  
  // Se é resultado direto (não de coordenadores)
  if (!data.completed && !data.results) {
    // Formatar como resposta simples
    const formatted = {
      text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      structured: {
        type: RESPONSE_TYPES.CONFIRMATION,
        data,
        timestamp: new Date().toISOString()
      }
    };
    
    return formatted;
  }
  
  // Se tem resultados de coordenadores
  const combinedResults = synthesizer.combineResults(data.completed || data.results);
  const insights = synthesizer.extractKeyInsights(combinedResults);
  const prioritized = synthesizer.prioritizeContent(insights, query);
  const structure = synthesizer.generateResponseStructure(prioritized, { 
    agentsUsed: Object.keys(data.completed || data.results) 
  });
  
  let content = '';
  
  if (structure.title) content += `${structure.title}\n\n`;
  if (structure.summary) content += `${structure.summary}\n\n`;
  
  for (const section of structure.sections || []) {
    content += formatter.formatSection(section);
  }
  
  if (structure.alerts?.length > 0) {
    content += formatter.formatAlerts(structure.alerts);
  }
  
  if (structure.suggestions?.length > 0) {
    content += formatter.formatSuggestions(structure.suggestions);
  }
  
  return {
    text: content.trim(),
    structured: structure
  };
}

/**
 * Health check do módulo
 */
async function healthCheck() {
  try {
    const agent = getInstance();
    return agent.healthCheck();
  } catch {
    return {
      status: 'not_initialized',
      agent: 'response',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Shutdown do módulo
 */
async function shutdown() {
  initialized = false;
}

module.exports = {
  // Classes
  ResponseAgent,
  Synthesizer,
  Formatter,
  
  // Constantes
  RESPONSE_STATUS,
  RESPONSE_TYPES,
  
  // Funções principais
  initialize: initializeResponseModule,
  getInstance,
  process: processResponse,
  formatSimpleResponse,
  
  // Utilitários
  healthCheck,
  shutdown,
  
  // Alias para compatibilidade
  processResponse
};
