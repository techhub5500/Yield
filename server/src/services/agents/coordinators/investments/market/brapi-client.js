/**
 * Brapi Client - Cliente da API Brapi
 * Fase 5 - Agentes Coordenadores
 * 
 * Cliente para acessar dados de mercado brasileiro
 * através da API Brapi (https://brapi.dev).
 */

const { logger } = require('../../../../../utils/logger');

/**
 * Configuração padrão
 */
const DEFAULT_CONFIG = {
  baseUrl: 'https://brapi.dev/api',
  timeout: 10000,
  retries: 3
};

/**
 * Tipos de ativos suportados
 */
const ASSET_TYPES = {
  STOCK: 'stock',      // Ações
  FII: 'fii',          // Fundos Imobiliários
  ETF: 'etf',          // ETFs
  BDR: 'bdr',          // BDRs
  CRYPTO: 'crypto',    // Criptomoedas
  INDEX: 'index'       // Índices
};

class BrapiClient {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.BRAPI_API_KEY;
    this.config = { ...DEFAULT_CONFIG };
    this._cache = new Map();
    this._cacheTimeout = 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Faz requisição à API
   * 
   * @param {string} endpoint - Endpoint
   * @param {Object} params - Query params
   * @returns {Promise<Object>} Resposta
   */
  async _request(endpoint, params = {}) {
    const url = new URL(`${this.config.baseUrl}${endpoint}`);
    
    // Adicionar parâmetros
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });

    // Adicionar API key se disponível
    if (this.apiKey) {
      url.searchParams.append('token', this.apiKey);
    }

    // Verificar cache
    const cacheKey = url.toString();
    const cached = this._cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this._cacheTimeout) {
      logger.debug('BrapiClient: Cache hit', { endpoint });
      return cached.data;
    }

    // Fazer requisição
    let lastError;
    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        logger.debug('BrapiClient: Requisição', { endpoint, attempt });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Cachear resultado
        this._cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });

        return data;

      } catch (error) {
        lastError = error;
        logger.warn('BrapiClient: Erro na tentativa', { 
          attempt, 
          error: error.message 
        });

        if (attempt < this.config.retries) {
          await this._sleep(1000 * attempt); // Backoff
        }
      }
    }

    logger.error('BrapiClient: Falha após todas as tentativas', { 
      endpoint,
      error: lastError?.message 
    });

    throw lastError;
  }

  /**
   * Obtém cotação de um ou mais ativos
   * 
   * @param {string|string[]} tickers - Ticker(s) do ativo
   * @param {Object} options - Opções adicionais
   * @returns {Promise<Object>} Cotações
   */
  async getQuote(tickers, options = {}) {
    const tickerList = Array.isArray(tickers) ? tickers.join(',') : tickers;
    
    const params = {
      range: options.range,        // 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
      interval: options.interval,  // 1m, 5m, 15m, 30m, 60m, 1d, 5d, 1wk, 1mo
      fundamental: options.fundamental, // true/false
      dividends: options.dividends      // true/false
    };

    try {
      const data = await this._request(`/quote/${tickerList}`, params);
      return this._formatQuoteResponse(data);
    } catch (error) {
      logger.error('BrapiClient: Erro ao obter cotação', { 
        tickers: tickerList, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Lista ações disponíveis
   * 
   * @param {Object} options - Opções de busca
   * @returns {Promise<Object>} Lista de ações
   */
  async listStocks(options = {}) {
    const params = {
      search: options.search,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      limit: options.limit || 100
    };

    const data = await this._request('/quote/list', params);
    return data;
  }

  /**
   * Obtém cotação de criptomoedas
   * 
   * @param {string|string[]} coins - Símbolo(s) da cripto
   * @param {string} currency - Moeda de cotação (BRL, USD)
   * @returns {Promise<Object>} Cotações
   */
  async getCryptoQuote(coins, currency = 'BRL') {
    const coinList = Array.isArray(coins) ? coins.join(',') : coins;
    
    const data = await this._request(`/v2/crypto`, {
      coin: coinList,
      currency
    });

    return this._formatCryptoResponse(data);
  }

  /**
   * Obtém dados de inflação
   * 
   * @param {Object} options - Opções
   * @returns {Promise<Object>} Dados de inflação
   */
  async getInflation(options = {}) {
    const params = {
      country: options.country || 'brazil',
      historical: options.historical || false,
      start: options.start,
      end: options.end
    };

    return this._request('/v2/inflation', params);
  }

  /**
   * Obtém taxa de câmbio
   * 
   * @param {string} from - Moeda origem
   * @param {string} to - Moeda destino
   * @returns {Promise<Object>} Taxa de câmbio
   */
  async getExchangeRate(from = 'USD', to = 'BRL') {
    const data = await this._request(`/v2/currency`, {
      currency: `${from}-${to}`
    });
    
    return {
      from,
      to,
      rate: data.currency?.[0]?.bidPrice || null,
      ask: data.currency?.[0]?.askPrice || null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Obtém dados de índices (IBOV, etc)
   * 
   * @param {string} index - Símbolo do índice
   * @returns {Promise<Object>} Dados do índice
   */
  async getIndex(index = '^BVSP') {
    return this.getQuote(index);
  }

  /**
   * Formata resposta de cotação
   */
  _formatQuoteResponse(data) {
    if (!data.results || data.results.length === 0) {
      return { success: false, results: [] };
    }

    const results = data.results.map(quote => ({
      symbol: quote.symbol,
      shortName: quote.shortName,
      longName: quote.longName,
      currency: quote.currency,
      
      // Preços
      price: quote.regularMarketPrice,
      previousClose: quote.regularMarketPreviousClose,
      open: quote.regularMarketOpen,
      high: quote.regularMarketDayHigh,
      low: quote.regularMarketDayLow,
      
      // Variação
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      
      // Volume
      volume: quote.regularMarketVolume,
      averageVolume: quote.averageDailyVolume3Month,
      
      // Market Cap
      marketCap: quote.marketCap,
      
      // 52 semanas
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      
      // Indicadores (se fundamental=true)
      fundamentals: quote.summaryProfile ? {
        sector: quote.summaryProfile.sector,
        industry: quote.summaryProfile.industry,
        description: quote.summaryProfile.longBusinessSummary
      } : null,
      
      // Dividendos (se dividends=true)
      dividends: quote.dividendsData ? {
        rate: quote.dividendsData.dividendRate,
        yield: quote.dividendsData.dividendYield,
        history: quote.dividendsData.cashDividends
      } : null,
      
      // Histórico de preços (se range especificado)
      historicalData: quote.historicalDataPrice,
      
      // Timestamp
      updatedAt: quote.regularMarketTime 
        ? new Date(quote.regularMarketTime * 1000).toISOString()
        : new Date().toISOString()
    }));

    return {
      success: true,
      results,
      requestedAt: new Date().toISOString()
    };
  }

  /**
   * Formata resposta de criptomoedas
   */
  _formatCryptoResponse(data) {
    if (!data.coins || data.coins.length === 0) {
      return { success: false, results: [] };
    }

    const results = data.coins.map(coin => ({
      symbol: coin.coin,
      name: coin.name,
      currency: coin.currency,
      
      // Preços
      price: coin.regularMarketPrice,
      high24h: coin.regularMarketDayHigh,
      low24h: coin.regularMarketDayLow,
      
      // Variação
      change24h: coin.regularMarketChange,
      changePercent24h: coin.regularMarketChangePercent,
      
      // Market Cap
      marketCap: coin.marketCap,
      
      // Ranking
      marketCapRank: coin.coinMarketCapRank,
      
      updatedAt: new Date().toISOString()
    }));

    return {
      success: true,
      results,
      requestedAt: new Date().toISOString()
    };
  }

  /**
   * Limpa cache
   */
  clearCache() {
    this._cache.clear();
  }

  /**
   * Sleep helper
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.getQuote('PETR4');
      return { status: 'healthy', hasApiKey: !!this.apiKey };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}

// Instância singleton
let brapiClientInstance = null;

function getBrapiClient(apiKey = null) {
  if (!brapiClientInstance) {
    brapiClientInstance = new BrapiClient(apiKey);
  }
  return brapiClientInstance;
}

module.exports = { 
  BrapiClient, 
  getBrapiClient,
  ASSET_TYPES,
  DEFAULT_CONFIG
};
