const Memory = require('./Memory');
const logger = require('../utils/logger');
const { DatabaseError, AppError, ERROR_CODES } = require('../utils/error-handler');

/**
 * Repository para operações de Memória
 * Encapsula todas as interações com o banco de dados
 */
class MemoryRepository {
  
  /**
   * Cria uma nova memória para um chat
   * @param {string} chatId - ID único do chat
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} Documento de memória criado
   */
  async create(chatId, userId) {
    const startTime = Date.now();
    
    try {
      const memory = new Memory({
        chat_id: chatId,
        user_id: userId,
        recent_memory: [],
        old_memory: [],
        metadata: {
          total_cycles: 0,
          total_word_count: 0,
          last_compression: null,
          compression_count: 0,
          created_at: new Date(),
          updated_at: new Date()
        },
        critical_data: {
          financial_goals: [],
          configured_limits: [],
          declared_preferences: [],
          important_decisions: []
        }
      });

      await memory.save();
      
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.create', duration, true, { chatId });
      
      return memory;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.create', duration, false, { chatId, error: error.message });
      
      if (error.code === 11000) {
        throw new AppError(ERROR_CODES.DUPLICATE_ENTRY, 'Memória já existe para este chat');
      }
      
      throw new DatabaseError('Falha ao criar memória', { original: error.message });
    }
  }

  /**
   * Busca memória por ID do chat
   * @param {string} chatId - ID do chat
   * @returns {Promise<Object|null>} Documento de memória ou null
   */
  async findByChat(chatId) {
    const startTime = Date.now();
    
    try {
      const memory = await Memory.findOne({ chat_id: chatId });
      
      const duration = Date.now() - startTime;
      logger.debug('MemoryRepository.findByChat', { chatId, found: !!memory, duration });
      
      return memory;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.findByChat', duration, false, { chatId, error: error.message });
      throw new DatabaseError('Falha ao buscar memória', { original: error.message });
    }
  }

  /**
   * Verifica se chat existe
   * @param {string} chatId - ID do chat
   * @returns {Promise<boolean>}
   */
  async chatExists(chatId) {
    try {
      return await Memory.chatExists(chatId);
    } catch (error) {
      logger.error('MemoryRepository.chatExists falhou', error);
      throw new DatabaseError('Falha ao verificar existência do chat', { original: error.message });
    }
  }

  /**
   * Busca todas as memórias de um usuário
   * @param {string} userId - ID do usuário
   * @param {Object} options - Opções de paginação
   * @returns {Promise<Array>} Lista de memórias
   */
  async findByUser(userId, options = {}) {
    const startTime = Date.now();
    const { limit = 10, skip = 0 } = options;
    
    try {
      const memories = await Memory.find({ user_id: userId })
        .sort({ 'metadata.updated_at': -1 })
        .skip(skip)
        .limit(limit);
      
      const duration = Date.now() - startTime;
      logger.debug('MemoryRepository.findByUser', { userId, count: memories.length, duration });
      
      return memories;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.findByUser', duration, false, { userId, error: error.message });
      throw new DatabaseError('Falha ao buscar memórias do usuário', { original: error.message });
    }
  }

  /**
   * Atualiza memória por ID do chat
   * @param {string} chatId - ID do chat
   * @param {Object} updates - Atualizações a aplicar
   * @returns {Promise<Object>} Documento atualizado
   */
  async update(chatId, updates) {
    const startTime = Date.now();
    
    try {
      // Sempre atualizar updated_at
      if (!updates.$set) {
        updates.$set = {};
      }
      updates.$set['metadata.updated_at'] = new Date();
      
      const memory = await Memory.findOneAndUpdate(
        { chat_id: chatId },
        updates,
        { new: true, runValidators: true }
      );
      
      if (!memory) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 'Memória não encontrada');
      }
      
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.update', duration, true, { chatId });
      
      return memory;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.update', duration, false, { chatId, error: error.message });
      
      if (error instanceof AppError) throw error;
      throw new DatabaseError('Falha ao atualizar memória', { original: error.message });
    }
  }

  /**
   * Salva documento de memória (completo)
   * @param {Object} memory - Documento Mongoose
   * @returns {Promise<Object>} Documento salvo
   */
  async save(memory) {
    const startTime = Date.now();
    
    try {
      memory.metadata.updated_at = new Date();
      await memory.save();
      
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.save', duration, true, { chatId: memory.chat_id });
      
      return memory;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.save', duration, false, { chatId: memory.chat_id, error: error.message });
      throw new DatabaseError('Falha ao salvar memória', { original: error.message });
    }
  }

  /**
   * Adiciona ciclo à memória recente
   * @param {string} chatId - ID do chat
   * @param {Object} cycle - Ciclo a adicionar
   * @returns {Promise<Object>} Documento atualizado
   */
  async addRecentCycle(chatId, cycle) {
    const startTime = Date.now();
    
    try {
      const memory = await Memory.findOneAndUpdate(
        { chat_id: chatId },
        {
          $push: { recent_memory: cycle },
          $inc: { 
            'metadata.total_cycles': 1,
            'metadata.total_word_count': cycle.word_count 
          },
          $set: { 'metadata.updated_at': new Date() }
        },
        { new: true }
      );
      
      if (!memory) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 'Memória não encontrada');
      }
      
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.addRecentCycle', duration, true, { 
        chatId, 
        cycleId: cycle.cycle_id 
      });
      
      return memory;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.addRecentCycle', duration, false, { 
        chatId, 
        error: error.message 
      });
      
      if (error instanceof AppError) throw error;
      throw new DatabaseError('Falha ao adicionar ciclo', { original: error.message });
    }
  }

  /**
   * Move ciclo mais antigo para memória antiga (resumido)
   * @param {string} chatId - ID do chat
   * @param {Object} summarizedCycle - Ciclo resumido
   * @returns {Promise<Object>} Documento atualizado
   */
  async promoteOldestCycle(chatId, summarizedCycle) {
    const startTime = Date.now();
    
    try {
      // Busca memória atual para obter o ciclo a ser removido
      const memory = await Memory.findOne({ chat_id: chatId });
      
      if (!memory || memory.recent_memory.length === 0) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 'Nenhum ciclo recente para promover');
      }
      
      const oldestCycle = memory.recent_memory[0];
      const wordsDifference = summarizedCycle.summary_word_count - oldestCycle.word_count;
      
      // Remove o ciclo mais antigo da memória recente e adiciona à antiga
      const updatedMemory = await Memory.findOneAndUpdate(
        { chat_id: chatId },
        {
          $pop: { recent_memory: -1 },  // Remove primeiro elemento
          $push: { old_memory: summarizedCycle },
          $inc: { 'metadata.total_word_count': wordsDifference },
          $set: { 'metadata.updated_at': new Date() }
        },
        { new: true }
      );
      
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.promoteOldestCycle', duration, true, { 
        chatId, 
        cycleId: summarizedCycle.cycle_id 
      });
      
      return updatedMemory;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.promoteOldestCycle', duration, false, { 
        chatId, 
        error: error.message 
      });
      
      if (error instanceof AppError) throw error;
      throw new DatabaseError('Falha ao promover ciclo', { original: error.message });
    }
  }

  /**
   * Adiciona dados críticos
   * @param {string} chatId - ID do chat
   * @param {string} type - Tipo de dado crítico
   * @param {Object} item - Item a adicionar
   * @returns {Promise<Object>} Documento atualizado
   */
  async addCriticalData(chatId, type, item) {
    const validTypes = ['financial_goals', 'configured_limits', 'declared_preferences', 'important_decisions'];
    
    if (!validTypes.includes(type)) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, `Tipo de dado crítico inválido: ${type}`);
    }
    
    const startTime = Date.now();
    
    try {
      const updateField = `critical_data.${type}`;
      
      const memory = await Memory.findOneAndUpdate(
        { chat_id: chatId },
        {
          $push: { [updateField]: item },
          $set: { 'metadata.updated_at': new Date() }
        },
        { new: true }
      );
      
      if (!memory) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 'Memória não encontrada');
      }
      
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.addCriticalData', duration, true, { chatId, type });
      
      return memory;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.addCriticalData', duration, false, { 
        chatId, 
        type,
        error: error.message 
      });
      
      if (error instanceof AppError) throw error;
      throw new DatabaseError('Falha ao adicionar dado crítico', { original: error.message });
    }
  }

  /**
   * Atualiza após compressão
   * @param {string} chatId - ID do chat
   * @param {Array} compressedOldMemory - Memória antiga comprimida
   * @param {number} newWordCount - Nova contagem de palavras
   * @returns {Promise<Object>} Documento atualizado
   */
  async updateAfterCompression(chatId, compressedOldMemory, newWordCount) {
    const startTime = Date.now();
    
    try {
      const memory = await Memory.findOneAndUpdate(
        { chat_id: chatId },
        {
          $set: {
            old_memory: compressedOldMemory,
            'metadata.total_word_count': newWordCount,
            'metadata.last_compression': new Date(),
            'metadata.updated_at': new Date()
          },
          $inc: { 'metadata.compression_count': 1 }
        },
        { new: true }
      );
      
      if (!memory) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 'Memória não encontrada');
      }
      
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.updateAfterCompression', duration, true, { 
        chatId, 
        newWordCount 
      });
      
      return memory;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.updateAfterCompression', duration, false, { 
        chatId, 
        error: error.message 
      });
      
      if (error instanceof AppError) throw error;
      throw new DatabaseError('Falha ao atualizar após compressão', { original: error.message });
    }
  }

  /**
   * Deleta memória de um chat
   * @param {string} chatId - ID do chat
   * @param {boolean} confirm - Confirmação obrigatória
   * @returns {Promise<Object>} Resultado da deleção
   */
  async delete(chatId, confirm = false) {
    if (!confirm) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Confirmação obrigatória para deletar memória');
    }
    
    const startTime = Date.now();
    
    try {
      const result = await Memory.findOneAndDelete({ chat_id: chatId });
      
      if (!result) {
        throw new AppError(ERROR_CODES.NOT_FOUND, 'Memória não encontrada');
      }
      
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.delete', duration, true, { chatId });
      
      return { deleted: true, chatId };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryRepository.delete', duration, false, { chatId, error: error.message });
      
      if (error instanceof AppError) throw error;
      throw new DatabaseError('Falha ao deletar memória', { original: error.message });
    }
  }

  /**
   * Conta total de memórias
   * @param {Object} filter - Filtros opcionais
   * @returns {Promise<number>} Total de memórias
   */
  async count(filter = {}) {
    try {
      return await Memory.countDocuments(filter);
    } catch (error) {
      logger.error('MemoryRepository.count falhou', error);
      throw new DatabaseError('Falha ao contar memórias', { original: error.message });
    }
  }

  /**
   * Busca memórias que precisam de compressão
   * @param {number} threshold - Limite de palavras
   * @returns {Promise<Array>} Memórias acima do limite
   */
  async findNeedingCompression(threshold) {
    try {
      return await Memory.find({
        'metadata.total_word_count': { $gte: threshold }
      });
    } catch (error) {
      logger.error('MemoryRepository.findNeedingCompression falhou', error);
      throw new DatabaseError('Falha ao buscar memórias para compressão', { original: error.message });
    }
  }
}

module.exports = new MemoryRepository();
