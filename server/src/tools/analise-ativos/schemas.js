/**
 * @module tools/analise-ativos/schemas
 * @description Definição de schemas e índices MongoDB para as collections
 * exclusivas da página analise_ativos.html.
 *
 * O projeto utiliza o driver nativo do MongoDB (sem Mongoose), portanto este
 * módulo exporta:
 *  - Constantes com os nomes das collections.
 *  - Funções de validação de documento (equivalentes aos validators Mongoose).
 *  - `ensureIndexes(db)` — cria todos os índices necessários (incluindo TTL)
 *    na primeira inicialização. Idempotente: não gera erro se o índice já existir.
 *
 * Collections e seus propósitos:
 * ┌─────────────────────┬──────────────────────────────────────────────────┐
 * │ Collection          │ Propósito                                        │
 * ├─────────────────────┼──────────────────────────────────────────────────┤
 * │ aa_user_searches    │ Última pesquisa por usuário (sem TTL)            │
 * │ aa_annotations      │ Anotações por card + snapshot de dados           │
 * │ aa_ai_summaries     │ Resumos gerados pelo Gemini (sem TTL)            │
 * │ aa_index_cache      │ Cache de índices fundamentalistas (TTL 12h)      │
 * │ aa_benchmark_cache  │ Cache de benchmark setorial (TTL 90 dias)        │
 * │ aa_dossie_cache     │ Cache do dossiê por ticker (TTL 7 dias)          │
 * └─────────────────────┴──────────────────────────────────────────────────┘
 */

const aaConfig = require('../../config/analise-ativos.config');
const logger   = require('../../utils/logger');

const COLS = aaConfig.collections;

// ─── Validadores de documento ──────────────────────────────────────────────

/**
 * Valida e normaliza um documento de última pesquisa.
 * @param {Object} doc
 * @returns {{ valid: boolean, errors: string[], doc: Object }}
 */
function validateUserSearch(doc) {
  const errors = [];

  if (!doc || typeof doc !== 'object') {
    errors.push('Documento inválido');
    return { valid: false, errors, doc: null };
  }

  if (!doc.userId || typeof doc.userId !== 'string') errors.push('userId obrigatório (string)');
  if (!doc.ticker  || typeof doc.ticker  !== 'string') errors.push('ticker obrigatório (string)');

  const normalized = {
    userId:    String(doc.userId  || '').trim(),
    ticker:    String(doc.ticker  || '').trim().toUpperCase(),
    timestamp: doc.timestamp instanceof Date ? doc.timestamp : new Date(),
  };

  return { valid: errors.length === 0, errors, doc: normalized };
}

/**
 * Valida e normaliza um documento de anotação.
 * @param {Object} doc
 * @returns {{ valid: boolean, errors: string[], doc: Object }}
 */
function validateAnnotation(doc) {
  const errors = [];

  if (!doc || typeof doc !== 'object') {
    errors.push('Documento inválido');
    return { valid: false, errors, doc: null };
  }

  if (!doc.userId         || typeof doc.userId         !== 'string') errors.push('userId obrigatório');
  if (!doc.cardId         || typeof doc.cardId         !== 'string') errors.push('cardId obrigatório');
  if (!doc.cardLabel      || typeof doc.cardLabel      !== 'string') errors.push('cardLabel obrigatório');
  if (!doc.annotationText || typeof doc.annotationText !== 'string') errors.push('annotationText obrigatório');

  const normalized = {
    userId:         String(doc.userId         || '').trim(),
    ticker:         String(doc.ticker         || '').trim().toUpperCase(),
    cardId:         String(doc.cardId         || '').trim(),
    cardLabel:      String(doc.cardLabel      || '').trim(),
    annotationText: String(doc.annotationText || '').trim(),
    /**
     * cardSnapshot: objeto com os dados do card no momento da anotação.
     * Armazenado mas não exibido no frontend — apenas para contexto do Gemini.
     */
    cardSnapshot:   doc.cardSnapshot && typeof doc.cardSnapshot === 'object' ? doc.cardSnapshot : {},
    timestamp:      doc.timestamp instanceof Date ? doc.timestamp : new Date(),
    updatedAt:      new Date(),
  };

  return { valid: errors.length === 0, errors, doc: normalized };
}

/**
 * Valida e normaliza um documento de resumo gerado por IA.
 * @param {Object} doc
 * @returns {{ valid: boolean, errors: string[], doc: Object }}
 */
function validateAiSummary(doc) {
  const errors = [];

  if (!doc || typeof doc !== 'object') {
    errors.push('Documento inválido');
    return { valid: false, errors, doc: null };
  }

  if (!doc.userId  || typeof doc.userId  !== 'string') errors.push('userId obrigatório');
  if (!doc.content || typeof doc.content !== 'string') errors.push('content obrigatório');

  const normalized = {
    userId:    String(doc.userId  || '').trim(),
    ticker:    String(doc.ticker  || '').trim().toUpperCase(),
    content:   String(doc.content || '').trim(),
    model:     String(doc.model   || aaConfig.gemini.model),
    timestamp: doc.timestamp instanceof Date ? doc.timestamp : new Date(),
  };

  return { valid: errors.length === 0, errors, doc: normalized };
}

/**
 * Valida e normaliza um documento de cache de índices Brapi.
 * @param {Object} doc
 * @returns {{ valid: boolean, errors: string[], doc: Object }}
 */
function validateIndexCache(doc) {
  const errors = [];

  if (!doc || typeof doc !== 'object') {
    errors.push('Documento inválido');
    return { valid: false, errors, doc: null };
  }

  if (!doc.ticker  || typeof doc.ticker  !== 'string') errors.push('ticker obrigatório');
  if (!doc.modules || typeof doc.modules !== 'string') errors.push('modules obrigatório (string com os nomes dos módulos)');
  if (!doc.data    || typeof doc.data    !== 'object') errors.push('data obrigatório (objeto com a resposta da Brapi)');

  const normalized = {
    ticker:    String(doc.ticker  || '').trim().toUpperCase(),
    modules:   String(doc.modules || '').trim(),
    data:      doc.data || {},
    /**
     * createdAt é o campo utilizado pelo índice TTL.
     * O MongoDB removerá automaticamente o documento após `ttl.indices` segundos.
     */
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(),
  };

  return { valid: errors.length === 0, errors, doc: normalized };
}

/**
 * Valida e normaliza um documento de cache de benchmark setorial.
 * @param {Object} doc
 * @returns {{ valid: boolean, errors: string[], doc: Object }}
 */
function validateBenchmarkCache(doc) {
  const errors = [];

  if (!doc || typeof doc !== 'object') {
    errors.push('Documento inválido');
    return { valid: false, errors, doc: null };
  }

  if (!doc.ticker   || typeof doc.ticker   !== 'string') errors.push('ticker obrigatório');
  if (!doc.indexKey || typeof doc.indexKey !== 'string') errors.push('indexKey obrigatório (ex.: "ROE", "P/L")');
  if (!doc.sector   || typeof doc.sector   !== 'string') errors.push('sector obrigatório');

  const normalized = {
    ticker:         String(doc.ticker         || '').trim().toUpperCase(),
    indexKey:       String(doc.indexKey       || '').trim(),
    sector:         String(doc.sector         || '').trim(),
    benchmarkValue: doc.benchmarkValue !== undefined ? doc.benchmarkValue : null,
    unit:           String(doc.unit           || '').trim(),
    source:         String(doc.source         || 'tavily+gemini'),
    createdAt:      doc.createdAt instanceof Date ? doc.createdAt : new Date(),
  };

  return { valid: errors.length === 0, errors, doc: normalized };
}

/**
 * Valida e normaliza um documento de cache de dossiê.
 * @param {Object} doc
 * @returns {{ valid: boolean, errors: string[], doc: Object }}
 */
function validateDossieCache(doc) {
  const errors = [];

  if (!doc || typeof doc !== 'object') {
    errors.push('Documento inválido');
    return { valid: false, errors, doc: null };
  }

  if (!doc.ticker  || typeof doc.ticker  !== 'string') errors.push('ticker obrigatório');
  if (!doc.content || typeof doc.content !== 'string') errors.push('content obrigatório (Markdown do dossiê)');

  const normalized = {
    ticker:    String(doc.ticker  || '').trim().toUpperCase(),
    content:   String(doc.content || '').trim(),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(),
  };

  return { valid: errors.length === 0, errors, doc: normalized };
}

// ─── Criação de índices ────────────────────────────────────────────────────

/**
 * Cria todos os índices necessários para as collections desta página.
 * Deve ser chamado uma única vez na inicialização do servidor.
 *
 * Índices TTL usam o campo `createdAt` com `expireAfterSeconds`.
 * O MongoDB daemon de expiração roda a cada ~60 segundos; documentos expirados
 * são removidos automaticamente sem necesidade de cron jobs.
 *
 * @param {import('mongodb').Db} db - Instância do banco MongoDB
 * @returns {Promise<void>}
 */
async function ensureIndexes(db) {
  try {
    // ── aa_user_searches ────────────────────────────────────
    // Índice único por userId: garante upsert eficiente de última pesquisa
    await db.collection(COLS.userSearches).createIndex(
      { userId: 1 },
      { unique: true, name: 'idx_aa_user_searches_userId' }
    );

    // ── aa_annotations ──────────────────────────────────────
    // Busca por usuário e por card
    await db.collection(COLS.annotations).createIndex(
      { userId: 1, timestamp: -1 },
      { name: 'idx_aa_annotations_user_ts' }
    );
    await db.collection(COLS.annotations).createIndex(
      { userId: 1, cardId: 1 },
      { name: 'idx_aa_annotations_user_card' }
    );

    // ── aa_ai_summaries ─────────────────────────────────────
    await db.collection(COLS.aiSummaries).createIndex(
      { userId: 1, timestamp: -1 },
      { name: 'idx_aa_ai_summaries_user_ts' }
    );

    // ── aa_index_cache (TTL 12h) ────────────────────────────
    await db.collection(COLS.indexCache).createIndex(
      { ticker: 1, modules: 1 },
      { unique: true, name: 'idx_aa_index_cache_ticker_modules' }
    );
    await db.collection(COLS.indexCache).createIndex(
      { createdAt: 1 },
      {
        expireAfterSeconds: aaConfig.ttl.indices,
        name: 'idx_aa_index_cache_ttl',
      }
    );

    // ── aa_benchmark_cache (TTL 90 dias) ────────────────────
    await db.collection(COLS.benchmarkCache).createIndex(
      { ticker: 1, indexKey: 1 },
      { unique: true, name: 'idx_aa_benchmark_cache_ticker_key' }
    );
    await db.collection(COLS.benchmarkCache).createIndex(
      { createdAt: 1 },
      {
        expireAfterSeconds: aaConfig.ttl.benchmark,
        name: 'idx_aa_benchmark_cache_ttl',
      }
    );

    // ── aa_dossie_cache (TTL 7 dias) ────────────────────────
    await db.collection(COLS.dossieCache).createIndex(
      { ticker: 1 },
      { unique: true, name: 'idx_aa_dossie_cache_ticker' }
    );
    await db.collection(COLS.dossieCache).createIndex(
      { createdAt: 1 },
      {
        expireAfterSeconds: aaConfig.ttl.dossie,
        name: 'idx_aa_dossie_cache_ttl',
      }
    );

    logger.system('INFO', 'AnaliseAtivosSchemas', 'Índices das collections aa_* criados/confirmados com sucesso');
  } catch (err) {
    logger.error('AnaliseAtivosSchemas', 'system', `Erro ao criar índices: ${err.message}`, { error: err.message });
    // Não lança — índices duplicados retornam erro mas o sistema pode continuar
  }
}

module.exports = {
  COLS,
  ensureIndexes,
  validators: {
    userSearch:     validateUserSearch,
    annotation:     validateAnnotation,
    aiSummary:      validateAiSummary,
    indexCache:     validateIndexCache,
    benchmarkCache: validateBenchmarkCache,
    dossieCache:    validateDossieCache,
  },
};
