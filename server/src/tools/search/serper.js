/**
 * @module tools/search/serper
 * @description Cliente da API Serper (Google Search).
 * Execução puramente lógica — chamada HTTP e retorno de dados brutos.
 * 
 * Acesso: Junior + Coordenadores
 * Uso: Informações gerais, notícias, fatos imediatos.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 */

const config = require('../../config');
const logger = require('../../utils/logger');

const SERPER_BASE_URL = 'https://google.serper.dev/search';

/**
 * @class SerperClient
 * Cliente para a API Serper (Google Search).
 */
class SerperClient {
  constructor() {
    this._apiKey = process.env.SERPER_API_KEY || '';
  }

  /**
   * Executa uma busca no Google via Serper.
   * @param {string} query - Termos de busca (diretos e objetivos)
   * @param {Object} [options]
   * @param {string} [options.gl='br'] - País (geolocalização)
   * @param {string} [options.hl='pt-br'] - Idioma
   * @param {number} [options.num=10] - Número de resultados
   * @returns {Promise<Object>} Resultados brutos da busca
   */
  async search(query, options = {}) {
    if (!this._apiKey) {
      logger.error('SerperClient', 'system', 'API key do Serper não configurada');
      throw new Error('SERPER_API_KEY não configurada');
    }

    const body = {
      q: query,
      gl: options.gl || 'br',
      hl: options.hl || 'pt-br',
      num: options.num || 10,
    };

    logger.logic('DEBUG', 'SerperClient', `Executando busca: "${query.substring(0, 60)}"`);

    try {
      const response = await fetch(SERPER_BASE_URL, {
        method: 'POST',
        headers: {
          'X-API-KEY': this._apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeouts.search),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Serper API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      logger.logic('DEBUG', 'SerperClient', `Busca retornou ${data.organic?.length || 0} resultados orgânicos`);

      return {
        organic: data.organic || [],
        answerBox: data.answerBox || null,
        knowledgeGraph: data.knowledgeGraph || null,
        relatedSearches: data.relatedSearches || [],
      };
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        logger.error('SerperClient', 'system', `Timeout na busca: "${query.substring(0, 40)}"`);
        throw new Error('Serper: timeout na busca');
      }

      logger.error('SerperClient', 'system', `Falha na busca Serper`, {
        error: error.message,
        query: query.substring(0, 60),
      });
      throw error;
    }
  }
}

module.exports = SerperClient;
