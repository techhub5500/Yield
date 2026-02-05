/**
 * Serviço de Busca Externa - API Pública
 * Fase 3 - Agente Júnior
 * 
 * Integra diferentes APIs de busca para fornecer informações externas.
 * O Agente Júnior usa este serviço para responder perguntas que
 * requerem dados da internet (taxas, cotações, informações gerais).
 */

const { SerperClient } = require('./serper-client');
const logger = require('../../utils/logger');

// Instância singleton do cliente Serper
const serperClient = new SerperClient();

/**
 * Palavras de parada a remover das queries
 */
const STOP_WORDS = [
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'por', 'para', 'com', 'sem', 'sobre', 'entre',
  'que', 'qual', 'quais', 'como', 'quando', 'onde', 'porque',
  'é', 'está', 'são', 'estão', 'foi', 'era', 'será',
  'eu', 'você', 'ele', 'ela', 'nós', 'eles', 'elas',
  'meu', 'minha', 'seu', 'sua', 'nosso', 'nossa',
  'esse', 'essa', 'este', 'esta', 'isso', 'isto',
  'muito', 'pouco', 'mais', 'menos', 'bem', 'mal',
  'agora', 'hoje', 'atualmente', 'momento', 'dia'
];

/**
 * Executa uma busca na internet
 * 
 * @param {string} query - Termos de busca (podem ser em linguagem natural)
 * @param {Object} options - Opções de busca
 * @returns {Promise<Array>} Resultados formatados
 * 
 * @example
 * const results = await searchService.search('qual a taxa selic atual');
 */
async function search(query, options = {}) {
  try {
    // Otimizar a query
    const optimizedQuery = optimizeQuery(query);
    
    logger.debug('Query otimizada', { 
      original: query, 
      optimized: optimizedQuery 
    });

    // Executar busca via Serper
    const results = await serperClient.search(optimizedQuery, options);

    return results;

  } catch (error) {
    logger.error('Erro no serviço de busca', { 
      query, 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Otimiza a query para busca
 * Remove palavras desnecessárias e adiciona contexto temporal
 * 
 * @param {string} query - Query original
 * @returns {string} Query otimizada
 */
function optimizeQuery(query) {
  let optimized = query.toLowerCase();

  // Remover stop words
  const words = optimized.split(/\s+/);
  const filtered = words.filter(word => 
    !STOP_WORDS.includes(word) && word.length > 1
  );
  optimized = filtered.join(' ');

  // Adicionar contexto temporal para certos tipos de busca
  const now = new Date();
  const month = now.toLocaleString('pt-BR', { month: 'long' });
  const year = now.getFullYear();

  // Se perguntar sobre taxa/índice, adicionar mês/ano
  if (/taxa|índice|indice|selic|cdi|ipca|igpm|inflação|inflacao/.test(query.toLowerCase())) {
    if (!optimized.includes(String(year))) {
      optimized += ` ${month} ${year}`;
    }
  }

  // Se perguntar sobre cotação, garantir "hoje"
  if (/cotação|cotacao|dólar|dolar|euro|preço|preco/.test(query.toLowerCase())) {
    if (!optimized.includes('hoje')) {
      optimized += ' hoje';
    }
  }

  // Se perguntar sobre investimentos
  if (/investimento|investir|rendimento|rentabilidade/.test(query.toLowerCase())) {
    if (!optimized.includes(String(year))) {
      optimized += ` ${year}`;
    }
  }

  // Limpar espaços extras
  optimized = optimized.replace(/\s+/g, ' ').trim();

  return optimized;
}

/**
 * Busca informações financeiras específicas
 * Otimizado para termos financeiros brasileiros
 * 
 * @param {string} topic - Tópico financeiro (selic, cdi, dolar, etc)
 * @returns {Promise<Object>} Informação encontrada
 */
async function searchFinancialInfo(topic) {
  const now = new Date();
  const month = now.toLocaleString('pt-BR', { month: 'long' });
  const year = now.getFullYear();

  const topicQueries = {
    selic: `taxa selic ${month} ${year}`,
    cdi: `taxa cdi ${month} ${year}`,
    ipca: `ipca acumulado ${year}`,
    dolar: 'cotação dólar hoje',
    euro: 'cotação euro hoje',
    poupanca: `rendimento poupança ${year}`,
    bitcoin: 'cotação bitcoin hoje BRL'
  };

  const query = topicQueries[topic.toLowerCase()] || `${topic} ${year}`;
  
  const results = await search(query, { numResults: 3 });

  // Tentar extrair a informação mais relevante
  const answerResult = results.find(r => r.type === 'answer');
  if (answerResult) {
    return {
      topic,
      value: answerResult.content,
      source: answerResult.source,
      type: 'direct'
    };
  }

  // Se não tiver resposta direta, retornar primeiro resultado
  if (results.length > 0) {
    return {
      topic,
      value: results[0].snippet || results[0].content,
      source: results[0].link,
      type: 'snippet'
    };
  }

  return {
    topic,
    value: null,
    type: 'not_found'
  };
}

/**
 * Formata resultados de busca para resposta ao usuário
 * 
 * @param {Array} results - Resultados da busca
 * @param {string} originalQuery - Query original do usuário
 * @returns {string} Resposta formatada
 */
function formatResponse(results, originalQuery) {
  if (!results || results.length === 0) {
    return 'Não encontrei informações sobre isso no momento.';
  }

  // Se tiver uma resposta direta (answer box)
  const answerResult = results.find(r => r.type === 'answer');
  if (answerResult) {
    return `📌 **Resposta:** ${answerResult.content}`;
  }

  // Se tiver knowledge graph
  const knowledgeResult = results.find(r => r.type === 'knowledge');
  if (knowledgeResult) {
    let response = `📚 **${knowledgeResult.title}**\n`;
    response += `${knowledgeResult.content}\n`;
    
    if (knowledgeResult.attributes) {
      response += '\n**Detalhes:**\n';
      for (const [key, value] of Object.entries(knowledgeResult.attributes).slice(0, 5)) {
        response += `• ${key}: ${value}\n`;
      }
    }
    
    return response;
  }

  // Formatar resultados orgânicos
  let response = '🔍 **Resultados encontrados:**\n\n';
  
  const organicResults = results.filter(r => r.type === 'organic').slice(0, 3);
  
  organicResults.forEach((r, i) => {
    response += `${i + 1}. **${r.title}**\n`;
    response += `   ${r.snippet}\n\n`;
  });

  return response;
}

/**
 * Health check do serviço de busca
 */
async function healthCheck() {
  return serperClient.healthCheck();
}

/**
 * Verifica se o serviço está configurado
 */
function isConfigured() {
  return serperClient.isConfigured();
}

module.exports = {
  search,
  searchFinancialInfo,
  optimizeQuery,
  formatResponse,
  healthCheck,
  isConfigured,
  
  // Cliente para uso direto se necessário
  SerperClient
};
