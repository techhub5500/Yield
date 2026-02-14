/**
 * @module tools/search/brapi
 * @description Cliente da API Brapi (dados de mercado financeiro).
 * Execução puramente lógica — chamada HTTP e retorno de dados estruturados.
 * 
 * Acesso: Apenas Coordenadores (Análise, Investimentos)
 * Uso: Cotações, indicadores, fundamentos de ativos brasileiros.
 * 
 * Regra de Ouro: Se a query envolve um símbolo (PETR4, BTC, SELIC), usar Brapi.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 */

const config = require('../../config');
const logger = require('../../utils/logger');

const BRAPI_BASE_URL = 'https://brapi.dev/api';

/**
 * @class BrapiClient
 * Cliente para a API Brapi (mercado financeiro brasileiro).
 */
class BrapiClient {
  constructor() {
    this._apiKey = process.env.BRAPI_API_KEY || '';
  }

  /**
   * Obtém cotação de um ativo.
   * @param {string} ticker - Ticker do ativo (ex: PETR4, VALE3)
   * @param {Object} [options]
   * @returns {Promise<Object>} Dados de cotação
   */
  async getQuote(ticker, options = {}) {
    return await this._request(`/quote/${encodeURIComponent(ticker)}`, {
      ticker,
      ...options,
    });
  }

  /**
   * Obtém histórico diário de um ativo.
   * @param {string} ticker
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async getQuoteHistory(ticker, options = {}) {
    const params = {
      ticker,
      interval: options.interval || '1d',
      range: options.range || 'max',
      ...options,
    };

    try {
      return await this._request(`/quote/${encodeURIComponent(ticker)}`, params);
    } catch (_error) {
      return await this._request(`/v2/quote/${encodeURIComponent(ticker)}`, params);
    }
  }

  /**
   * Obtém histórico de taxa básica de juros (ex.: SELIC).
   * @param {Object} [options]
   * @param {string} [options.country='brazil']
   * @param {boolean} [options.historical=true]
   * @param {string} [options.start] - DD/MM/YYYY
   * @param {string} [options.end] - DD/MM/YYYY
   * @param {string} [options.sortBy='date']
   * @param {string} [options.sortOrder='asc']
   * @returns {Promise<Object>}
   */
  async getPrimeRateHistory(options = {}) {
    return await this._request('/v2/prime-rate', {
      country: options.country || 'brazil',
      historical: String(options.historical ?? true),
      start: options.start,
      end: options.end,
      sortBy: options.sortBy || 'date',
      sortOrder: options.sortOrder || 'asc',
    });
  }

  /**
   * Obtém fundamentos de um ativo.
   * @param {string} ticker - Ticker do ativo
   * @returns {Promise<Object>} Dados de fundamentos
   */
  async getFundamentals(ticker) {
    return await this._request(`/quote/${encodeURIComponent(ticker)}`, {
      ticker,
      fundamental: true,
    });
  }

  /**
   * Obtém cotação de criptomoeda.
   * @param {string} coin - Símbolo da cripto (ex: BTC, ETH)
   * @returns {Promise<Object>} Dados de cotação
   */
  async getCrypto(coin) {
    return await this._request(`/v2/crypto`, {
      coin,
      currency: 'BRL',
    });
  }

  /**
   * Obtém cotação de moeda.
   * @param {string} currencies - Moedas (ex: 'USD-BRL,EUR-BRL')
   * @returns {Promise<Object>} Dados de câmbio
   */
  async getCurrency(currencies) {
    return await this._request(`/v2/currency`, { currency: currencies });
  }

  /**
   * Busca genérica na Brapi.
   * Analisa o input e escolhe o endpoint mais adequado.
   * @param {string} query - Termo de busca (ticker, moeda, etc.)
   * @returns {Promise<Object>} Dados estruturados
   */
  async search(query) {
    // Detectar tipo de query
    const upperQuery = query.toUpperCase().trim();

    // Cripto (BTC, ETH, etc.)
    if (/^(BTC|ETH|SOL|ADA|DOT|DOGE|XRP|USDT)$/i.test(upperQuery)) {
      return await this.getCrypto(upperQuery);
    }

    // Moeda (USD, EUR, etc.)
    if (/^(USD|EUR|GBP|JPY|CNY)$/i.test(upperQuery)) {
      return await this.getCurrency(`${upperQuery}-BRL`);
    }

    // Ação (PETR4, VALE3, etc.)
    if (/^[A-Z]{4}\d{1,2}$/i.test(upperQuery)) {
      return await this.getQuote(upperQuery);
    }

    // Indicadores (SELIC, IPCA, etc.)
    if (/selic|ipca|igp-?m|cdi/i.test(query)) {
      return await this._request('/v2/prime-rate', { ticker: query });
    }

    // Fallback: tentar como quote
    return await this.getQuote(upperQuery);
  }

  /**
   * Executa uma requisição à API Brapi.
   * @private
   * @param {string} endpoint - Endpoint da API
   * @param {Object} params - Parâmetros opcionais
   * @returns {Promise<Object>}
   */
  async _request(endpoint, params = {}) {
    const url = new URL(`${BRAPI_BASE_URL}${endpoint}`);

    // Adicionar API key e parâmetros
    if (this._apiKey) {
      url.searchParams.set('token', this._apiKey);
    }
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && key !== 'ticker') {
        url.searchParams.set(key, String(value));
      }
    }

    logger.logic('DEBUG', 'BrapiClient', `Requisição: ${endpoint}`, {
      params: JSON.stringify(params).substring(0, 80),
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(config.timeouts.search),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Error handling específico de mercado
        if (response.status === 404) {
          throw new Error(`Ativo não encontrado: ${params.ticker || endpoint}`);
        }

        throw new Error(`Brapi API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      logger.logic('DEBUG', 'BrapiClient', `Dados recebidos para ${endpoint}`);
      return data;
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        logger.error('BrapiClient', 'system', `Timeout na requisição: ${endpoint}`);
        throw new Error('Brapi: timeout na requisição');
      }

      logger.error('BrapiClient', 'system', `Falha na requisição Brapi: ${endpoint}`, {
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = BrapiClient;
