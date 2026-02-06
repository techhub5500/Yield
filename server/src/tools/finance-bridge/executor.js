/**
 * @module tools/finance-bridge/executor
 * @description Executor de queries no MongoDB.
 * Converte JSON do Finance Bridge para queries MongoDB e executa.
 * Resolve períodos inteligentes e aplica lógica booleana.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 */

const { MongoClient } = require('mongodb');
const config = require('../../config');
const logger = require('../../utils/logger');

const COLLECTION = 'transactions';

/** @type {MongoClient|null} */
let _client = null;

/** @type {import('mongodb').Db|null} */
let _db = null;

/**
 * Conecta ao MongoDB (lazy, com retry).
 * @returns {Promise<import('mongodb').Db>}
 */
async function getDb() {
  if (_db) return _db;

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      _client = new MongoClient(config.mongodb.uri);
      await _client.connect();
      _db = _client.db(config.mongodb.dbName);
      logger.system('DEBUG', 'FinanceBridgeExecutor', 'Conexão com MongoDB estabelecida');
      return _db;
    } catch (error) {
      logger.error('FinanceBridgeExecutor', 'system', `Tentativa ${attempt}/${maxRetries} de conexão falhou`, {
        error: error.message,
      });
      if (attempt === maxRetries) throw error;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

/**
 * Executa uma query no MongoDB a partir de um JSON do Finance Bridge.
 * @param {Object} queryJson - JSON validado do Finance Bridge
 * @returns {Promise<Object[]>} Resultados brutos
 */
async function executeQuery(queryJson) {
  const db = await getDb();
  const params = queryJson.params || {};

  // Construir filtro MongoDB
  const mongoFilter = buildMongoFilter(params);
  
  // Construir opções (sort, limit)
  const mongoOptions = buildMongoOptions(params);

  logger.logic('DEBUG', 'FinanceBridgeExecutor', 'Executando query no MongoDB', {
    filter: JSON.stringify(mongoFilter).substring(0, 150),
  });

  try {
    const results = await db
      .collection(COLLECTION)
      .find(mongoFilter, mongoOptions)
      .toArray();

    logger.logic('DEBUG', 'FinanceBridgeExecutor', `Query retornou ${results.length} resultados`);
    return results;
  } catch (error) {
    logger.error('FinanceBridgeExecutor', 'logic', 'Falha ao executar query no MongoDB', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Executa um insert no MongoDB.
 * @param {Object} insertData - Dados do lançamento (já validados)
 * @returns {Promise<Object>} Resultado do insert
 */
async function executeInsert(insertData) {
  const db = await getDb();

  const document = {
    ...insertData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const result = await db.collection(COLLECTION).insertOne(document);

    logger.logic('DEBUG', 'FinanceBridgeExecutor', 'Insert executado com sucesso', {
      insertedId: result.insertedId?.toString(),
      category: insertData.category,
    });

    return {
      success: true,
      insertedId: result.insertedId,
      document,
    };
  } catch (error) {
    logger.error('FinanceBridgeExecutor', 'logic', 'Falha ao executar insert no MongoDB', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Constrói um filtro MongoDB a partir dos parâmetros do Finance Bridge.
 * LÓGICA PURA.
 * @param {Object} params
 * @returns {Object} Filtro MongoDB
 */
function buildMongoFilter(params) {
  const conditions = [];

  if (params.filters) {
    // Período
    if (params.filters.period) {
      const periodFilter = resolvePeriod(params.filters.period);
      if (periodFilter) {
        conditions.push(periodFilter);
      }
    }

    // Valor
    if (params.filters.amount) {
      const amountFilter = {};
      if (params.filters.amount.min !== undefined) {
        amountFilter.$gte = params.filters.amount.min;
      }
      if (params.filters.amount.max !== undefined) {
        amountFilter.$lte = params.filters.amount.max;
      }
      if (Object.keys(amountFilter).length > 0) {
        conditions.push({ amount: amountFilter });
      }
    }

    // Categorias
    if (params.filters.categories && params.filters.categories.length > 0) {
      conditions.push({
        category: { $in: params.filters.categories.map(c => new RegExp(c, 'i')) },
      });
    }

    // Subcategorias
    if (params.filters.subcategories && params.filters.subcategories.length > 0) {
      conditions.push({
        subcategory: { $in: params.filters.subcategories.map(s => new RegExp(s, 'i')) },
      });
    }

    // Status
    if (params.filters.status) {
      conditions.push({ status: params.filters.status });
    }

    // Método de pagamento
    if (params.filters.payment_method) {
      conditions.push({ payment_method: params.filters.payment_method });
    }

    // Tags
    if (params.filters.tags && params.filters.tags.length > 0) {
      conditions.push({ tags: { $in: params.filters.tags } });
    }
  }

  // Exclusões
  if (params.exclude) {
    if (params.exclude.categories && params.exclude.categories.length > 0) {
      conditions.push({
        category: { $nin: params.exclude.categories.map(c => new RegExp(c, 'i')) },
      });
    }
    if (params.exclude.tags && params.exclude.tags.length > 0) {
      conditions.push({ tags: { $nin: params.exclude.tags } });
    }
  }

  // Aplicar lógica booleana
  if (conditions.length === 0) return {};

  const logic = (params.logic || 'AND').toUpperCase();

  switch (logic) {
    case 'OR':
      return { $or: conditions };
    case 'NOT':
      // NOT combina AND com exclusões (já adicionadas acima)
      return conditions.length === 1 ? conditions[0] : { $and: conditions };
    case 'AND':
    default:
      return conditions.length === 1 ? conditions[0] : { $and: conditions };
  }
}

/**
 * Resolve períodos inteligentes para datas concretas.
 * LÓGICA PURA.
 * @param {Object} period - Objeto de período { start, end, named_period }
 * @returns {Object|null} Filtro MongoDB para date
 */
function resolvePeriod(period) {
  let start, end;

  if (period.named_period) {
    const resolved = resolveNamedPeriod(period.named_period);
    start = resolved.start;
    end = resolved.end;
  } else {
    start = period.start;
    end = period.end;
  }

  if (!start && !end) return null;

  const dateFilter = {};
  if (start) dateFilter.$gte = start;
  if (end) dateFilter.$lte = end;

  return { date: dateFilter };
}

/**
 * Resolve um período nomeado para datas reais.
 * LÓGICA PURA.
 * @param {string} namedPeriod
 * @returns {{ start: string, end: string }}
 */
function resolveNamedPeriod(namedPeriod) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  switch (namedPeriod) {
    case 'current_month': {
      const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      return { start, end: todayStr };
    }

    case 'last_month': {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        start: lastMonth.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0],
      };
    }

    case 'last_quarter': {
      const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        start: threeMonthsAgo.toISOString().split('T')[0],
        end: endOfLastMonth.toISOString().split('T')[0],
      };
    }

    case 'last_6_days': {
      const sixDaysAgo = new Date(today);
      sixDaysAgo.setDate(today.getDate() - 6);
      return {
        start: sixDaysAgo.toISOString().split('T')[0],
        end: todayStr,
      };
    }

    case 'fiscal_year': {
      const start = `${today.getFullYear()}-01-01`;
      return { start, end: todayStr };
    }

    case 'since_last_payday': {
      // Default para dia 05 do mês (pode ser refinado com dados reais)
      const payday = new Date(today.getFullYear(), today.getMonth(), 5);
      if (payday > today) {
        payday.setMonth(payday.getMonth() - 1);
      }
      return {
        start: payday.toISOString().split('T')[0],
        end: todayStr,
      };
    }

    default:
      logger.logic('WARN', 'FinanceBridgeExecutor', `Período nomeado desconhecido: "${namedPeriod}"`);
      return { start: null, end: todayStr };
  }
}

/**
 * Constrói opções MongoDB (sort, limit, projection).
 * LÓGICA PURA.
 * @param {Object} params
 * @returns {Object}
 */
function buildMongoOptions(params) {
  const options = {};

  // Sort
  if (params.sort) {
    const sortField = params.sort.field || 'date';
    const sortOrder = params.sort.order === 'asc' ? 1 : -1;
    options.sort = { [sortField]: sortOrder };
  } else {
    // Padrão: data mais recente primeiro
    options.sort = { date: -1 };
  }

  // Limit
  if (params.limit && typeof params.limit === 'number') {
    options.limit = Math.min(params.limit, 1000);
  } else {
    options.limit = 50;
  }

  return options;
}

/**
 * Fecha a conexão com o MongoDB.
 * @returns {Promise<void>}
 */
async function close() {
  if (_client) {
    await _client.close();
    _client = null;
    _db = null;
  }
}

module.exports = {
  executeQuery,
  executeInsert,
  buildMongoFilter,
  resolvePeriod,
  resolveNamedPeriod,
  buildMongoOptions,
  close,
};
