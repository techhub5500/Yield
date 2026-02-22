const { tavily } = require('@tavily/core');
const aaConfig = require('../../config/analise-ativos.config');
const { COLS, validators } = require('./schemas');

const DOSSIE_TOPICS = [
  { key: 'Governança', query: 'governança corporativa' },
  { key: 'Estrutura Societária', query: 'estrutura societária acionistas controlador free float' },
  { key: 'Remuneração de Diretores', query: 'remuneração diretoria conselho formulário de referência' },
  { key: 'Riscos Regulatórios', query: 'riscos regulatórios sanções compliance' },
  { key: 'Processos Judiciais Relevantes', query: 'processos judiciais relevantes contingências' },
];

class TavilyService {
  constructor({ getDb, logger, openaiService }) {
    this.getDb = getDb;
    this.logger = logger;
    this.openaiService = openaiService;
    this.tvly = aaConfig.tavily.apiKey ? tavily({ apiKey: aaConfig.tavily.apiKey }) : null;
  }

  async getCached(ticker) {
    const db = await this.getDb();
    return db.collection(COLS.dossieCache).findOne({ ticker });
  }

  async setCached(ticker, content) {
    const db = await this.getDb();
    const validated = validators.dossieCache({ ticker, content, createdAt: new Date() });
    if (!validated.valid) return;

    await db.collection(COLS.dossieCache).updateOne(
      { ticker: validated.doc.ticker },
      { $set: validated.doc },
      { upsert: true }
    );
  }

  async searchTopic(ticker, topicQuery) {
    if (!this.tvly) return [];

    const query = `${ticker} ${topicQuery} Brasil 2025 2026`;
    const response = await this.tvly.search(query, {
      searchDepth: aaConfig.tavily.searchDepth,
      maxResults: 6,
      includeRawContent: true,
      topic: 'general',
    });

    return Array.isArray(response?.results) ? response.results : [];
  }

  async getDossie(tickerInput) {
    const ticker = String(tickerInput || '').trim().toUpperCase();
    if (!ticker) {
      const error = new Error('Ticker inválido');
      error.status = 400;
      throw error;
    }

    const cached = await this.getCached(ticker);
    if (cached?.content) {
      return {
        content: cached.content,
        source: 'cache',
        model: aaConfig.openai.model,
        cachedAt: cached.createdAt,
        cacheHit: true,
      };
    }

    const contextByTopic = {};
    for (const topic of DOSSIE_TOPICS) {
      contextByTopic[topic.key] = await this.searchTopic(ticker, topic.query);
    }

    const generated = await this.openaiService.generateDossie({ ticker, contextByTopic });
    await this.setCached(ticker, generated.content);

    this.logger.ai('INFO', 'TavilyService', `Dossiê gerado para ${ticker}`, {
      topics: DOSSIE_TOPICS.length,
    });

    return {
      content: generated.content,
      source: 'tavily+gpt-5-mini',
      model: generated.model,
      cachedAt: new Date(),
      cacheHit: false,
    };
  }
}

module.exports = { TavilyService };
