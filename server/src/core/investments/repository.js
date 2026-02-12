/**
 * @module core/investments/repository
 * @description Repositório MongoDB para dados estruturados de investimentos.
 *
 * LÓGICA PURA — sem IA.
 */

const { MongoClient } = require('mongodb');
const config = require('../../config');
const logger = require('../../utils/logger');

const COLLECTIONS = {
  TRANSACTIONS: 'investments_transactions',
  POSITIONS: 'investments_positions',
  ASSETS: 'investments_assets',
  PRICES: 'investments_prices',
};

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
      logger.system('DEBUG', 'InvestmentsRepository', 'Conexão com MongoDB estabelecida');
      return _db;
    } catch (error) {
      logger.error('InvestmentsRepository', 'system', `Tentativa ${attempt}/${maxRetries} de conexão falhou`, {
        error: error.message,
      });

      if (attempt === maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/**
 * Constrói filtro comum para dados de investimento.
 * @param {Object} params
 * @returns {Object}
 */
function buildCommonFilter(params) {
  const filter = {
    userId: params.userId,
  };

  if (params.start || params.end) {
    filter.referenceDate = {};
    if (params.start) filter.referenceDate.$gte = params.start;
    if (params.end) filter.referenceDate.$lte = params.end;
  }

  if (params.filters?.currencies?.length) {
    filter.currency = { $in: params.filters.currencies };
  }

  if (params.filters?.assetClasses?.length) {
    filter.assetClass = { $in: params.filters.assetClasses };
  }

  if (params.filters?.statuses?.length) {
    filter.status = { $in: params.filters.statuses };
  }

  if (params.filters?.accountIds?.length) {
    filter.accountId = { $in: params.filters.accountIds };
  }

  if (params.filters?.tags?.length) {
    filter.tags = { $in: params.filters.tags };
  }

  return filter;
}

/**
 * Lista transações estruturadas de investimentos.
 * @param {Object} params
 * @returns {Promise<Object[]>}
 */
async function listTransactions(params) {
  const db = await getDb();
  const filter = buildCommonFilter(params);

  return db
    .collection(COLLECTIONS.TRANSACTIONS)
    .find(filter)
    .sort({ referenceDate: -1 })
    .toArray();
}

/**
 * Lista posições estruturadas de investimentos.
 * @param {Object} params
 * @returns {Promise<Object[]>}
 */
async function listPositions(params) {
  const db = await getDb();
  const filter = buildCommonFilter(params);

  return db
    .collection(COLLECTIONS.POSITIONS)
    .find(filter)
    .sort({ referenceDate: -1 })
    .toArray();
}

/**
 * Lista cadastro de ativos.
 * @param {Object} params
 * @returns {Promise<Object[]>}
 */
async function listAssets(params) {
  const db = await getDb();
  const filter = { userId: params.userId };

  if (params.filters?.assetClasses?.length) {
    filter.assetClass = { $in: params.filters.assetClasses };
  }

  return db.collection(COLLECTIONS.ASSETS).find(filter).toArray();
}

module.exports = {
  COLLECTIONS,
  getDb,
  listTransactions,
  listPositions,
  listAssets,
};
