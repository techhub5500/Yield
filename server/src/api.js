const financeBridge = require('./services/finance-bridge');
const nanoBridge = require('./services/finance-bridge/ai/nano-bridge');

/**
 * API Pública do Finance Bridge
 * 
 * Este arquivo exporta as funções principais que outros serviços
 * (como agentes de IA) podem usar para interagir com o sistema
 */

/**
 * Processa uma requisição estruturada em JSON
 * 
 * @param {Object} payload - Payload estruturado
 * @returns {Promise<Object>} Resultado da operação
 */
async function processRequest(payload) {
  return await financeBridge.process(payload);
}

/**
 * Converte texto em linguagem natural para operação
 * 
 * @param {string} text - Pedido em linguagem natural
 * @param {Object} context - Contexto do usuário
 * @returns {Promise<Object>} Resultado da operação
 */
async function processNaturalLanguage(text, context) {
  // Primeiro, transformar texto em JSON usando IA
  const json = await nanoBridge.transformToJSON(text, context);
  
  // Depois, executar a operação
  return await financeBridge.process(json);
}

/**
 * Lista operações disponíveis
 */
function getAvailableOperations() {
  return financeBridge.getAvailableOperations();
}

/**
 * Verifica status do serviço
 */
async function healthCheck() {
  return await financeBridge.healthCheck();
}

/**
 * Exemplo de uso direto
 */
async function exampleUsage() {
  const context = {
    user_id: 'user_123',
    user_timezone: 'America/Sao_Paulo',
    currency: 'BRL'
  };

  // Exemplo 1: Usando JSON estruturado
  const result1 = await processRequest({
    operation: 'query',
    params: {
      filters: {
        type: 'expense',
        named_period: 'current_month'
      },
      logic: 'AND',
      sort: { date: -1 },
      limit: 10
    },
    context
  });

  console.log('Resultado (JSON):', result1);

  // Exemplo 2: Usando linguagem natural (se API configurada)
  if (nanoBridge.isConfigured()) {
    const result2 = await processNaturalLanguage(
      'Quanto gastei este mês?',
      context
    );
    
    console.log('Resultado (linguagem natural):', result2);
  }
}

// Executar exemplo se este arquivo for executado diretamente
if (require.main === module) {
  require('./index'); // Iniciar servidor
  
  setTimeout(async () => {
    console.log('\n=== Executando exemplos de uso ===\n');
    await exampleUsage();
  }, 2000);
}

module.exports = {
  processRequest,
  processNaturalLanguage,
  getAvailableOperations,
  healthCheck
};
