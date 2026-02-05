/**
 * Cliente da API Serper
 * Fase 3 - Sistema de Busca Externa
 * 
 * Cliente para a API Serper (Google Search API)
 * Usado pelo Agente Júnior para buscas gerais na internet.
 */

const axios = require('axios');
const logger = require('../../utils/logger');

class SerperClient {
  
  constructor() {
    this.apiKey = process.env.SERPER_API_KEY;
    this.baseUrl = 'https://google.serper.dev/search';
    this.timeout = 10000; // 10 segundos
    this.maxRetries = 2;
  }

  /**
   * Executa uma busca no Google via Serper
   * 
   * @param {string} query - Termos de busca
   * @param {Object} options - Opções de busca
   * @returns {Promise<Array>} Resultados formatados
   * 
   * @example
   * const results = await serperClient.search('taxa selic fevereiro 2026');
   */
  async search(query, options = {}) {
    const startTime = Date.now();

    try {
      if (!this.isConfigured()) {
        logger.warn('API Serper não configurada, retornando vazio');
        return [];
      }

      logger.info('Executando busca Serper', { 
        query,
        country: options.country || 'br'
      });

      const response = await this.makeRequest({
        q: query,
        gl: options.country || 'br',
        hl: options.language || 'pt-br',
        num: options.numResults || 5
      });

      const results = this.formatResults(response);

      const duration = Date.now() - startTime;

      logger.info('Busca Serper concluída', {
        query,
        results_count: results.length,
        duration_ms: duration
      });

      return results;

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Erro na busca Serper', {
        query,
        error: error.message,
        duration_ms: duration
      });

      throw error;
    }
  }

  /**
   * Faz a requisição para a API
   */
  async makeRequest(payload, attempt = 1) {
    try {
      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });

      return response.data;

    } catch (error) {
      // Timeout
      if (error.code === 'ECONNABORTED') {
        throw new Error('Timeout na busca externa');
      }

      // Erro de autenticação
      if (error.response?.status === 401) {
        throw new Error('API key do Serper inválida');
      }

      // Rate limit
      if (error.response?.status === 429) {
        if (attempt < this.maxRetries) {
          logger.warn('Rate limit atingido, aguardando...');
          await this.sleep(1000 * attempt);
          return this.makeRequest(payload, attempt + 1);
        }
        throw new Error('Limite de requisições excedido');
      }

      // Retry em caso de erro temporário
      if (attempt < this.maxRetries && error.response?.status >= 500) {
        logger.warn(`Tentando novamente (${attempt + 1}/${this.maxRetries})...`);
        await this.sleep(1000 * attempt);
        return this.makeRequest(payload, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Formata os resultados da busca
   */
  formatResults(data) {
    const results = [];

    // Answer Box (resposta direta do Google)
    if (data.answerBox) {
      const answer = data.answerBox;
      results.push({
        type: 'answer',
        content: answer.answer || answer.snippet || answer.title,
        title: answer.title,
        source: answer.link
      });
    }

    // Knowledge Graph
    if (data.knowledgeGraph) {
      const kg = data.knowledgeGraph;
      results.push({
        type: 'knowledge',
        title: kg.title,
        content: kg.description,
        attributes: kg.attributes
      });
    }

    // Resultados orgânicos
    if (data.organic && Array.isArray(data.organic)) {
      data.organic.forEach(item => {
        results.push({
          type: 'organic',
          title: item.title,
          snippet: item.snippet,
          link: item.link,
          position: item.position
        });
      });
    }

    // People Also Ask
    if (data.peopleAlsoAsk && Array.isArray(data.peopleAlsoAsk)) {
      data.peopleAlsoAsk.slice(0, 3).forEach(item => {
        results.push({
          type: 'related',
          question: item.question,
          answer: item.snippet,
          link: item.link
        });
      });
    }

    return results;
  }

  /**
   * Verifica se a API está configurada
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Helper para sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.isConfigured()) {
      return {
        status: 'not_configured',
        message: 'SERPER_API_KEY não configurada'
      };
    }

    try {
      // Teste simples com busca rápida
      await this.search('teste', { numResults: 1 });
      
      return {
        status: 'healthy',
        message: 'API Serper funcionando'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message
      };
    }
  }
}

module.exports = { SerperClient };
