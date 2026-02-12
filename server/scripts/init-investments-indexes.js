/**
 * @module scripts/init-investments-indexes
 * @description Cria índices e coleções base para dados estruturados de investimentos.
 *
 * Uso:
 *   cd server
 *   node scripts/init-investments-indexes.js
 */

const { MongoClient } = require('mongodb');
const config = require('../src/config');
const logger = require('../src/utils/logger');
const { COLLECTIONS } = require('../src/core/investments/repository');

async function main() {
  logger.init({
    minLevel: config.server.env === 'production' ? 'INFO' : 'DEBUG',
    console: true,
    file: true,
  });

  if (!config.mongodb.uri) {
    throw new Error('MONGODB_URI não configurada');
  }

  const client = new MongoClient(config.mongodb.uri);

  try {
    await client.connect();
    const db = client.db(config.mongodb.dbName);

    logger.system('INFO', 'InvestmentsIndexes', 'Conectado ao MongoDB');

    // Transactions: consultas por userId e referenceDate (timeseries)
    await db.collection(COLLECTIONS.TRANSACTIONS).createIndex({ userId: 1, referenceDate: -1 });
    await db.collection(COLLECTIONS.TRANSACTIONS).createIndex({ userId: 1, assetId: 1, referenceDate: -1 });
    await db.collection(COLLECTIONS.TRANSACTIONS).createIndex({ userId: 1, accountId: 1, referenceDate: -1 });

    // Positions: último snapshot por userId/assetId
    await db.collection(COLLECTIONS.POSITIONS).createIndex({ userId: 1, referenceDate: -1 });
    await db.collection(COLLECTIONS.POSITIONS).createIndex({ userId: 1, assetId: 1, referenceDate: -1 });

    // Assets: lookup rápido
    await db.collection(COLLECTIONS.ASSETS).createIndex({ userId: 1, assetId: 1 }, { unique: true });

    // Prices: séries por assetId/currency
    await db.collection(COLLECTIONS.PRICES).createIndex({ assetId: 1, currency: 1, referenceDate: -1 });

    logger.system('INFO', 'InvestmentsIndexes', 'Índices criados com sucesso');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  logger.error('InvestmentsIndexes', 'system', `Falha ao criar índices: ${error.message}`);
  process.exit(1);
});
