/**
 * @module tools/search/index
 * @description Abstração unificada do sistema de busca.
 * Centraliza acesso a Serper, Brapi e Tavily.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 * A decisão de qual API usar vem da IA (Junior ou Coordenadores).
 * Este módulo apenas executa a chamada à API escolhida.
 */

const SerperClient = require('./serper');
const BrapiClient = require('./brapi');
const TavilyClient = require('./tavily');
const logger = require('../../utils/logger');

/**
 * @class SearchManager
 * Gerenciador unificado de buscas externas.
 */
class SearchManager {
  constructor() {
    this.serper = new SerperClient();
    this.brapi = new BrapiClient();
    this.tavily = new TavilyClient();
  }

  /**
   * Executa uma busca na fonte especificada.
   * @param {string} query - Termo de busca
   * @param {string} [source='serper'] - Fonte: 'serper' | 'brapi' | 'tavily'
   * @param {Object} [options] - Opções adicionais (passadas ao cliente)
   * @returns {Promise<Object>} Resultados brutos
   */
  async search(query, source = 'serper', options = {}) {
    logger.logic('DEBUG', 'SearchManager', `Busca via "${source}": "${query.substring(0, 60)}"`);

    try {
      switch (source) {
        case 'serper':
          return await this.serper.search(query, options);

        case 'brapi':
          return await this.brapi.search(query);

        case 'tavily':
          return await this.tavily.deepSearch(query, options.context || '', options);

        default:
          logger.warn('SearchManager', 'logic', `Fonte desconhecida: "${source}", usando Serper`);
          return await this.serper.search(query, options);
      }
    } catch (error) {
      logger.error('SearchManager', 'logic', `Falha na busca (${source})`, {
        error: error.message,
        query: query.substring(0, 60),
      });
      throw error;
    }
  }
}

module.exports = SearchManager;
