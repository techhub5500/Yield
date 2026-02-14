/**
 * @module core/investments/repository
 * @description Repositório MongoDB para dados estruturados de investimentos.
 *
 * LÓGICA PURA — sem IA.
 */

const { MongoClient } = require('mongodb');
const crypto = require('crypto');
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

/**
 * Busca ativos por nome para usuário autenticado.
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} [params.query]
 * @param {number} [params.limit]
 * @returns {Promise<Object[]>}
 */
async function searchAssetsByName(params) {
  const db = await getDb();
  const query = String(params.query || '').trim();
  const limit = Number.isFinite(Number(params.limit)) ? Math.max(1, Number(params.limit)) : 20;

  const filter = { userId: params.userId };
  if (query) {
    filter.name = { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }

  return db
    .collection(COLLECTIONS.ASSETS)
    .find(filter)
    .sort({ name: 1 })
    .limit(limit)
    .toArray();
}

/**
 * Retorna um ativo por assetId/userId.
 * @param {Object} params
 * @returns {Promise<Object|null>}
 */
async function getAssetById(params) {
  const db = await getDb();
  return db.collection(COLLECTIONS.ASSETS).findOne({
    userId: params.userId,
    assetId: params.assetId,
  });
}

/**
 * Upsert de ativo estruturado.
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function upsertAsset(payload) {
  const db = await getDb();
  const now = new Date().toISOString();

  const assetId = payload.assetId || `asset_${crypto.randomUUID()}`;
  const document = {
    userId: payload.userId,
    assetId,
    name: payload.name,
    ticker: payload.ticker || null,
    assetClass: payload.assetClass,
    category: payload.category,
    currency: payload.currency,
    status: payload.status || 'open',
    accountId: payload.accountId || null,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    metadata: payload.metadata || {},
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.ASSETS).updateOne(
    { userId: payload.userId, assetId },
    {
      $set: document,
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  return { ...document, createdAt: now };
}

/**
 * Insere snapshot de posição.
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function insertPositionSnapshot(payload) {
  const db = await getDb();
  const now = new Date().toISOString();

  const quantity = Number(payload.quantity);
  const avgPrice = Number(payload.avgPrice);
  const marketPrice = Number.isFinite(Number(payload.marketPrice))
    ? Number(payload.marketPrice)
    : avgPrice;

  const investedAmount = Number.isFinite(Number(payload.investedAmount))
    ? Number(payload.investedAmount)
    : quantity * avgPrice;

  const marketValue = Number.isFinite(Number(payload.marketValue))
    ? Number(payload.marketValue)
    : quantity * marketPrice;

  const document = {
    userId: payload.userId,
    assetId: payload.assetId,
    referenceDate: payload.referenceDate,
    currency: payload.currency,
    assetClass: payload.assetClass,
    status: payload.status || 'open',
    accountId: payload.accountId || null,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    quantity,
    avgPrice,
    marketPrice,
    investedAmount,
    marketValue,
    source: payload.source || 'manual',
    actionType: payload.actionType || 'update_position',
    createdAt: now,
  };

  await db.collection(COLLECTIONS.POSITIONS).insertOne(document);
  return document;
}

/**
 * Insere movimentação de investimento.
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function insertInvestmentTransaction(payload) {
  const db = await getDb();
  const now = new Date().toISOString();

  const document = {
    userId: payload.userId,
    assetId: payload.assetId,
    referenceDate: payload.referenceDate,
    currency: payload.currency,
    assetClass: payload.assetClass,
    status: payload.status || 'open',
    accountId: payload.accountId || null,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    operation: payload.operation,
    quantity: Number(payload.quantity || 0),
    price: Number(payload.price || 0),
    grossAmount: Number(payload.grossAmount || 0),
    fees: Number(payload.fees || 0),
    metadata: payload.metadata || {},
    source: payload.source || 'manual',
    createdAt: now,
  };

  await db.collection(COLLECTIONS.TRANSACTIONS).insertOne(document);
  return document;
}

/**
 * Remove um ativo e todos os dados relacionados (posições e transações).
 * @param {string} userId
 * @param {string} assetId
 * @returns {Promise<boolean>}
 */
async function deleteAsset(userId, assetId) {
  const db = await getDb();
  
  // Remove do cadastro de ativos
  const assetResult = await db.collection(COLLECTIONS.ASSETS).deleteOne({ 
    assetId, 
    userId 
  });

  if (assetResult.deletedCount > 0) {
    // Remove posições relacionadas
    await db.collection(COLLECTIONS.POSITIONS).deleteMany({ assetId, userId });
    // Remove transações relacionadas
    await db.collection(COLLECTIONS.TRANSACTIONS).deleteMany({ assetId, userId });
    return true;
  }

  return false;
}

/**
 * Último snapshot por ativo de um usuário.
 * @param {Object} params
 * @returns {Promise<Object[]>}
 */
async function listLatestPositionsByUser(params) {
  const db = await getDb();
  const baseFilter = buildCommonFilter({
    userId: params.userId,
    filters: params.filters || {},
    end: params.end,
  });

  return db.collection(COLLECTIONS.POSITIONS).aggregate([
    { $match: baseFilter },
    { $sort: { referenceDate: -1, createdAt: -1 } },
    {
      $group: {
        _id: '$assetId',
        doc: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$doc' } },
  ]).toArray();
}

module.exports = {
  COLLECTIONS,
  getDb,
  listTransactions,
  listPositions,
  listAssets,
  searchAssetsByName,
  getAssetById,
  upsertAsset,
  deleteAsset,
  insertPositionSnapshot,
  insertInvestmentTransaction,
  listLatestPositionsByUser,
};
