const aaConfig = require('../../config/analise-ativos.config');
const { COLS, validators } = require('./schemas');

function normalizeTicker(ticker) {
  return String(ticker || '').trim().toUpperCase();
}

function buildModulesKey({ modules = [], range = '', interval = '', dividends = false, endpoint = 'quote' }) {
  const moduleKey = Array.isArray(modules)
    ? modules.filter(Boolean).map((m) => String(m).trim()).sort().join(',')
    : String(modules || '');

  return [
    endpoint,
    moduleKey,
    range ? `range:${range}` : '',
    interval ? `interval:${interval}` : '',
    dividends ? 'dividends:true' : '',
  ].filter(Boolean).join('|');
}

function isFresh(createdAt, ttlSeconds) {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  const ageSeconds = (Date.now() - created) / 1000;
  return ageSeconds <= ttlSeconds;
}

class BrapiService {
  constructor({ getDb, logger }) {
    this.getDb = getDb;
    this.logger = logger;
  }

  async fetchJson(endpoint, query = {}) {
    if (!aaConfig.brapi.token) {
      const error = new Error('BRAPI token não configurado');
      error.status = 500;
      throw error;
    }

    const url = new URL(`${aaConfig.brapi.baseUrl}${endpoint}`);
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
    url.searchParams.set('token', aaConfig.brapi.token);

    const response = await fetch(url, { method: 'GET' });

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(`Brapi retornou ${response.status}: ${body || 'sem detalhes'}`);
      error.status = response.status >= 400 && response.status < 500 ? response.status : 502;
      throw error;
    }

    return response.json();
  }

  async getCache(ticker, modulesKey, ttlSeconds) {
    const db = await this.getDb();
    const doc = await db.collection(COLS.indexCache).findOne({
      ticker,
      modules: modulesKey,
    });

    if (!doc) return null;
    if (!isFresh(doc.createdAt, ttlSeconds)) return null;

    return doc;
  }

  async setCache({ ticker, modulesKey, data }) {
    const db = await this.getDb();

    const validated = validators.indexCache({
      ticker,
      modules: modulesKey,
      data,
      createdAt: new Date(),
    });

    if (!validated.valid) return;

    await db.collection(COLS.indexCache).updateOne(
      { ticker: validated.doc.ticker, modules: validated.doc.modules },
      { $set: validated.doc },
      { upsert: true }
    );
  }

  async fetchQuote(tickerInput, options = {}) {
    const ticker = normalizeTicker(tickerInput);
    if (!ticker) {
      const error = new Error('Ticker inválido');
      error.status = 400;
      throw error;
    }

    const {
      modules = [],
      dividends = false,
      range = '',
      interval = '',
      endpoint = 'quote',
      cacheTtl = aaConfig.ttl.quote,
    } = options;

    const modulesKey = buildModulesKey({ modules, range, interval, dividends, endpoint });

    const cached = await this.getCache(ticker, modulesKey, cacheTtl);
    if (cached) {
      return {
        data: cached.data,
        meta: {
          cacheHit: true,
          cachedAt: cached.createdAt,
          cacheKey: modulesKey,
        },
      };
    }

    const query = {};
    if (Array.isArray(modules) && modules.length) query.modules = modules.join(',');
    if (dividends) query.dividends = 'true';
    if (range) query.range = range;
    if (interval) query.interval = interval;

    const payload = await this.fetchJson(`/quote/${ticker}`, query);
    const result = Array.isArray(payload?.results) ? payload.results[0] : null;

    if (!result) {
      const error = new Error(`Ticker não encontrado: ${ticker}`);
      error.status = 404;
      throw error;
    }

    await this.setCache({ ticker, modulesKey, data: result });

    return {
      data: result,
      meta: {
        cacheHit: false,
        cachedAt: new Date(),
        cacheKey: modulesKey,
      },
    };
  }

  async search(queryInput) {
    const query = String(queryInput || '').trim();
    if (!query) return { data: [], meta: { cacheHit: false } };

    const normalized = query.toUpperCase();
    const modulesKey = `search|${normalized}`;
    const cacheTtl = aaConfig.ttl.quote;

    const cached = await this.getCache('__SEARCH__', modulesKey, cacheTtl);
    if (cached) {
      return {
        data: cached.data,
        meta: {
          cacheHit: true,
          cachedAt: cached.createdAt,
          cacheKey: modulesKey,
        },
      };
    }

    const payload = await this.fetchJson('/quote/list', { search: query });

    const list = Array.isArray(payload?.stocks)
      ? payload.stocks.map((item) => ({
        ticker: normalizeTicker(item.stock || item.symbol || item.ticker),
        shortName: item.name || item.shortName || '',
        longName: item.longName || item.name || '',
        sector: item.sector || item.type || '',
      })).filter((item) => item.ticker)
      : [];

    await this.setCache({
      ticker: '__SEARCH__',
      modulesKey,
      data: list,
    });

    return {
      data: list,
      meta: {
        cacheHit: false,
        cachedAt: new Date(),
        cacheKey: modulesKey,
      },
    };
  }
}

module.exports = { BrapiService, normalizeTicker };
