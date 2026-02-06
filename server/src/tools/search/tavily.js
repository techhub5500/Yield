/**
 * @module tools/search/tavily
 * @description Cliente da API Tavily (pesquisa contextual profunda).
 * Execução puramente lógica — chamada HTTP e retorno de conteúdo.
 * 
 * Acesso: Apenas Coordenadores
 * Uso: Análises aprofundadas, contexto histórico, relatórios e estudos.
 * Diferencial: Retorna conteúdo limpo e focado, sem spam/SEO.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 */

const config = require('../../config');
const logger = require('../../utils/logger');

const TAVILY_BASE_URL = 'https://api.tavily.com';

/**
 * @class TavilyClient
 * Cliente para a API Tavily (pesquisa contextual profunda).
 */
class TavilyClient {
  constructor() {
    this._apiKey = process.env.TAVILY_API_KEY || '';
  }

  /**
   * Executa uma pesquisa profunda com contexto.
   * @param {string} query - Query de pesquisa
   * @param {string} [context=''] - Contexto adicional para filtrar resultados
   * @param {Object} [options]
   * @param {string} [options.searchDepth='advanced'] - 'basic' ou 'advanced'
   * @param {number} [options.maxResults=5] - Número máximo de resultados
   * @param {boolean} [options.includeAnswer=true] - Incluir resposta gerada
   * @returns {Promise<Object>} Resultados da pesquisa
   */
  async deepSearch(query, context = '', options = {}) {
    if (!this._apiKey) {
      logger.error('TavilyClient', 'system', 'API key do Tavily não configurada');
      throw new Error('TAVILY_API_KEY não configurada');
    }

    const body = {
      api_key: this._apiKey,
      query: context ? `${query} ${context}` : query,
      search_depth: options.searchDepth || 'advanced',
      max_results: options.maxResults || 5,
      include_answer: options.includeAnswer !== false,
      include_raw_content: false,
    };

    logger.logic('DEBUG', 'TavilyClient', `Pesquisa profunda: "${query.substring(0, 60)}"`, {
      depth: body.search_depth,
    });

    try {
      const response = await fetch(`${TAVILY_BASE_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeouts.search * 2), // Tavily pode ser mais lento
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tavily API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      logger.logic('DEBUG', 'TavilyClient', `Pesquisa retornou ${data.results?.length || 0} resultados`);

      return {
        answer: data.answer || null,
        results: (data.results || []).map(r => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score,
        })),
        query: data.query,
      };
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        logger.error('TavilyClient', 'system', `Timeout na pesquisa: "${query.substring(0, 40)}"`);
        throw new Error('Tavily: timeout na pesquisa');
      }

      logger.error('TavilyClient', 'system', 'Falha na pesquisa Tavily', {
        error: error.message,
        query: query.substring(0, 60),
      });
      throw error;
    }
  }
}

module.exports = TavilyClient;
