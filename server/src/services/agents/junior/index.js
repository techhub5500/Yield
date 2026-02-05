/**
 * Agente Júnior - API Pública
 * Fase 3 - Sistema Multi-Agente
 * 
 * Exporta a interface pública do Agente Júnior para uso por outros módulos.
 */

const { JuniorAgent } = require('./junior-agent');
const { Classifier, COMPLEXITY_LEVELS, INTENT_TYPES } = require('./classifier');
const { Resolver } = require('./resolver');

// Instância singleton do agente
const juniorAgent = new JuniorAgent();

/**
 * Processa uma mensagem do usuário
 * Ponto de entrada principal do Agente Júnior
 * 
 * @param {Object} memory - Memória completa do chat
 * @param {string} userMessage - Mensagem atual do usuário
 * @param {Object} context - Contexto adicional (user_id, timezone, etc)
 * @returns {Promise<Object>} Resultado do processamento
 * 
 * @example
 * const result = await juniorService.processMessage(
 *   memory,
 *   'Quanto gastei ontem?',
 *   { user_id: 'user_123' }
 * );
 * 
 * // Resultado possível:
 * // {
 * //   action: 'resolved',
 * //   response: 'Você gastou R$ 150,00 ontem em 3 transações.',
 * //   data: { results: [...] }
 * // }
 */
async function processMessage(memory, userMessage, context = {}) {
  return juniorAgent.process(memory, userMessage, context);
}

/**
 * Obtém informações sobre o Agente Júnior
 * 
 * @returns {Object} Informações do agente
 */
function getAgentInfo() {
  return juniorAgent.getInfo();
}

/**
 * Verifica a saúde do Agente Júnior
 * 
 * @returns {Promise<Object>} Status de saúde
 */
async function healthCheck() {
  return juniorAgent.healthCheck();
}

/**
 * Classifica uma mensagem sem processar
 * Útil para testes e debugging
 * 
 * @param {Object} memory - Memória do chat
 * @param {string} userMessage - Mensagem a classificar
 * @returns {Promise<Object>} Resultado da classificação
 */
async function classifyMessage(memory, userMessage) {
  const classifier = new Classifier();
  return classifier.classify(memory, userMessage);
}

module.exports = {
  // Funções principais
  processMessage,
  getAgentInfo,
  healthCheck,
  classifyMessage,
  
  // Constantes exportadas
  COMPLEXITY_LEVELS,
  INTENT_TYPES,
  
  // Classes (para uso avançado)
  JuniorAgent,
  Classifier,
  Resolver
};
