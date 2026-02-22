const { tavily } = require('@tavily/core');
const aaConfig = require('../../config/analise-ativos.config');
const { COLS, validators } = require('./schemas');

function normalizeIndexKey(indexKey) {
  return String(indexKey || '').trim().toUpperCase();
}

class BenchmarkService {
  constructor({ getDb, logger, openaiService }) {
    this.getDb = getDb;
    this.logger = logger;
    this.openaiService = openaiService;
    this.tvly = aaConfig.tavily.apiKey ? tavily({ apiKey: aaConfig.tavily.apiKey }) : null;
  }

  async getCached(ticker, indexKey) {
    const db = await this.getDb();
    return db.collection(COLS.benchmarkCache).findOne({ ticker, indexKey });
  }

  async setCached(doc) {
    const db = await this.getDb();
    const validated = validators.benchmarkCache({ ...doc, createdAt: new Date() });
    if (!validated.valid) return;

    await db.collection(COLS.benchmarkCache).updateOne(
      { ticker: validated.doc.ticker, indexKey: validated.doc.indexKey },
      { $set: validated.doc },
      { upsert: true }
    );
  }

  async searchBenchmarkContext({ indexKey, sector }) {
    if (!this.tvly) return [];

    const query = `benchmark setorial ${indexKey} setor ${sector || 'geral'} Brasil 2025 2026`;

    const response = await this.tvly.search(query, {
      searchDepth: aaConfig.tavily.searchDepth,
      maxResults: 8,
      includeRawContent: true,
      topic: 'general',
    });

    return Array.isArray(response?.results) ? response.results : [];
  }

  async getBenchmark({ ticker, indexKey, sector }) {
    const tickerNorm = String(ticker || '').trim().toUpperCase();
    const keyNorm = normalizeIndexKey(indexKey);
    if (!tickerNorm || !keyNorm) {
      const error = new Error('Ticker/indexKey inválidos');
      error.status = 400;
      throw error;
    }

    const cached = await this.getCached(tickerNorm, keyNorm);
    if (cached) {
      return {
        value: cached.benchmarkValue,
        unit: cached.unit || '',
        text: cached.text || 'Benchmark setorial (cache)',
        source: cached.source || 'tavily+gpt-5-mini',
        cachedAt: cached.createdAt,
        cacheHit: true,
      };
    }

    const context = await this.searchBenchmarkContext({ indexKey: keyNorm, sector });
    const generated = await this.openaiService.generateBenchmark({
      ticker: tickerNorm,
      indexKey: keyNorm,
      sector,
      tavilyResults: context,
    });

    await this.setCached({
      ticker: tickerNorm,
      indexKey: keyNorm,
      sector: sector || 'N/A',
      benchmarkValue: generated.value,
      unit: generated.unit,
      text: generated.text,
      source: 'tavily+gpt-5-mini',
    });

    this.logger.ai('INFO', 'BenchmarkService', `Benchmark gerado para ${tickerNorm}/${keyNorm}`, {
      sector,
      hasContext: context.length > 0,
    });

    return {
      value: generated.value,
      unit: generated.unit,
      text: generated.text,
      source: 'tavily+gpt-5-mini',
      cachedAt: new Date(),
      cacheHit: false,
    };
  }
}

module.exports = { BenchmarkService, normalizeIndexKey };
