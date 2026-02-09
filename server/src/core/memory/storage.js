/**
 * @module core/memory/storage
 * @description Persistência de memória no MongoDB.
 * CRUD operations: loadMemory, saveMemory.
 * LÓGICA PURA — sem IA, apenas I/O com banco.
 */

const { MongoClient } = require('mongodb');
const config = require('../../config');
const logger = require('../../utils/logger');
const Memory = require('./structure');

const COLLECTION = 'memories';

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
      logger.system('INFO', 'MemoryStorage', 'Conexão com MongoDB estabelecida');
      return _db;
    } catch (error) {
      logger.error('MemoryStorage', 'system', `Tentativa ${attempt}/${maxRetries} de conexão falhou`, {
        error: error.message,
      });
      if (attempt === maxRetries) throw error;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

/**
 * Carrega a memória de um chat.
 * @param {string} chatId - Identificador do chat
 * @param {string} [userId] - ID do usuário (para validação de ownership)
 * @returns {Promise<Memory>} Memória carregada ou nova memória vazia
 */
async function loadMemory(chatId, userId = null) {
  try {
    const db = await getDb();
    
    // Se userId fornecido, validar ownership
    const query = userId ? { chatId, userId } : { chatId };
    const doc = await db.collection(COLLECTION).findOne(query);

    if (doc && doc.memory) {
      logger.logic('DEBUG', 'MemoryStorage', `Memória carregada para chat ${chatId}`, {
        userId: userId || 'anônimo',
      });
      return Memory.fromJSON(doc.memory);
    }

    logger.logic('DEBUG', 'MemoryStorage', `Memória não encontrada para chat ${chatId}, inicializando vazia`);
    return new Memory();
  } catch (error) {
    logger.error('MemoryStorage', 'logic', `Falha ao carregar memória do chat ${chatId}`, {
      error: error.message,
    });
    // Fallback: retornar memória vazia para não quebrar o sistema
    return new Memory();
  }
}

/**
 * Salva a memória de um chat (upsert).
 * @param {string} chatId - Identificador do chat
 * @param {Memory} memory - Instância de Memory para salvar
 * @param {string} [userId] - ID do usuário (para vincular o chat)
 * @returns {Promise<boolean>} True se salvo com sucesso
 */
async function saveMemory(chatId, memory, userId = null) {
  try {
    const db = await getDb();
    
    const updateData = {
      chatId,
      memory: memory.toJSON(),
      updatedAt: new Date().toISOString(),
    };

    // Se userId fornecido, vincular ao chat
    if (userId) {
      updateData.userId = userId;
    }

    await db.collection(COLLECTION).updateOne(
      { chatId },
      { $set: updateData },
      { upsert: true }
    );

    logger.logic('DEBUG', 'MemoryStorage', `Memória salva para chat ${chatId}`, {
      userId: userId || 'anônimo',
      wordCount: memory.wordCount,
      recentCycles: memory.recent.length,
      oldSummaries: memory.old.length,
    });

    return true;
  } catch (error) {
    logger.error('MemoryStorage', 'logic', `Falha ao salvar memória do chat ${chatId}`, {
      error: error.message,
    });
    return false;
  }
}

/**
 * Lista todos os chats salvos ordenados por data de atualização (mais recentes primeiro).
 * @param {number} limit - Número máximo de chats a retornar (default: 50)
 * @param {string} [userId] - ID do usuário (para filtrar apenas seus chats)
 * @returns {Promise<Array>} Lista de chats com metadata
 */
async function getAllChats(limit = 50, userId = null) {
  try {
    const db = await getDb();
    
    // Se userId fornecido, filtrar apenas chats do usuário
    const query = userId ? { userId } : {};
    
    const chats = await db.collection(COLLECTION)
      .find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();

    const mapped = chats.map(doc => {
      const memory = Memory.fromJSON(doc.memory);
      
      // Pegar a primeira mensagem do histórico completo como preview
      let preview = '';
      let lastMessage = '';
      
      if (memory.fullHistory && memory.fullHistory.length > 0) {
        const firstMessage = memory.fullHistory[0];
        preview = firstMessage.userInput?.substring(0, 80) || 'Sem mensagem';
        const lastMsg = memory.fullHistory[memory.fullHistory.length - 1];
        lastMessage = lastMsg.userInput || lastMsg.aiResponse || '';
      }

      return {
        chatId: doc.chatId,
        preview: preview,
        lastMessage: lastMessage.substring(0, 100),
        timestamp: doc.updatedAt,
        messageCount: memory.fullHistory.length, // Total de mensagens reais
      };
    });

    logger.logic('DEBUG', 'MemoryStorage', `${mapped.length} chats carregados`);
    return mapped;
  } catch (error) {
    logger.error('MemoryStorage', 'logic', `Falha ao listar chats`, {
      error: error.message,
    });
    return [];
  }
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
    logger.system('INFO', 'MemoryStorage', 'Conexão com MongoDB encerrada');
  }
}

module.exports = {
  loadMemory,
  saveMemory,
  getAllChats,
  close,
};
