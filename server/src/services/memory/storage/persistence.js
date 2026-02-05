const memoryRepository = require('../../../models/MemoryRepository');
const memoryConfig = require('../../../config/memory-config');
const logger = require('../../../utils/logger');

/**
 * Sistema de Persistência de Memória
 * Gerencia salvamento automático e manual
 */
class MemoryPersistence {
  constructor() {
    this.autoSaveInterval = memoryConfig.persistence.autoSaveInterval;
    this.retryAttempts = memoryConfig.persistence.retryAttempts;
    this.retryDelay = memoryConfig.persistence.retryDelay;
    
    // Cache local para fallback
    this.localCache = new Map();
    
    // Timers de auto-save
    this.autoSaveTimers = new Map();
  }

  /**
   * Salva memória no banco de dados
   * @param {Object} memory - Documento de memória
   * @returns {Promise<Object>} Memória salva
   */
  async saveMemory(memory) {
    const startTime = Date.now();
    const chatId = memory.chat_id;
    
    try {
      // Salva no banco
      const saved = await memoryRepository.save(memory);
      
      // Atualiza cache local
      this.localCache.set(chatId, {
        memory: saved,
        savedAt: new Date()
      });
      
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryPersistence.saveMemory', duration, true, { chatId });
      
      return saved;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryPersistence.saveMemory', duration, false, {
        chatId,
        error: error.message
      });
      
      // Salva em cache local como fallback
      this.saveToLocalCache(chatId, memory);
      
      // Tenta retry
      return await this.retryWithBackoff(() => memoryRepository.save(memory), chatId);
    }
  }

  /**
   * Atualização parcial da memória
   * @param {string} chatId - ID do chat
   * @param {Object} updates - Atualizações
   * @returns {Promise<Object>} Memória atualizada
   */
  async updateMemory(chatId, updates) {
    const startTime = Date.now();
    
    try {
      const updated = await memoryRepository.update(chatId, updates);
      
      // Atualiza cache
      this.localCache.set(chatId, {
        memory: updated,
        savedAt: new Date()
      });
      
      const duration = Date.now() - startTime;
      logger.debug('MemoryPersistence.updateMemory', { chatId, duration });
      
      return updated;
      
    } catch (error) {
      logger.error('MemoryPersistence.updateMemory falhou', {
        chatId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Hook executado ao completar um ciclo
   * @param {Object} memory - Documento de memória
   * @param {Object} cycle - Ciclo completado
   * @returns {Promise<Object>} Memória salva
   */
  async onCycleComplete(memory, cycle) {
    logger.info('Ciclo completo, persistindo memória', {
      chatId: memory.chat_id,
      cycleId: cycle.cycle_id
    });
    
    return await this.saveMemory(memory);
  }

  /**
   * Hook executado após compressão
   * @param {Object} memory - Documento de memória
   * @returns {Promise<Object>} Memória salva
   */
  async onCompressionComplete(memory) {
    logger.info('Compressão completa, persistindo memória', {
      chatId: memory.chat_id,
      newWordCount: memory.metadata.total_word_count
    });
    
    return await this.saveMemory(memory);
  }

  /**
   * Hook executado ao adicionar dados críticos
   * @param {Object} memory - Documento de memória
   * @param {string} type - Tipo de dado crítico
   * @returns {Promise<Object>} Memória salva
   */
  async onCriticalDataAdded(memory, type) {
    logger.info('Dado crítico adicionado, persistindo memória', {
      chatId: memory.chat_id,
      type
    });
    
    return await this.saveMemory(memory);
  }

  /**
   * Configura auto-save para um chat
   * @param {string} chatId - ID do chat
   * @param {Function} getMemoryFn - Função para obter memória atual
   */
  scheduleAutoSave(chatId, getMemoryFn) {
    // Cancela timer existente
    this.cancelAutoSave(chatId);
    
    const timer = setInterval(async () => {
      try {
        const memory = await getMemoryFn();
        if (memory) {
          await this.saveMemory(memory);
          logger.debug('Auto-save executado', { chatId });
        }
      } catch (error) {
        logger.error('Auto-save falhou', { chatId, error: error.message });
      }
    }, this.autoSaveInterval);
    
    this.autoSaveTimers.set(chatId, timer);
    
    logger.debug('Auto-save agendado', {
      chatId,
      interval: this.autoSaveInterval + 'ms'
    });
  }

  /**
   * Cancela auto-save de um chat
   * @param {string} chatId - ID do chat
   */
  cancelAutoSave(chatId) {
    const timer = this.autoSaveTimers.get(chatId);
    
    if (timer) {
      clearInterval(timer);
      this.autoSaveTimers.delete(chatId);
      logger.debug('Auto-save cancelado', { chatId });
    }
  }

  /**
   * Salva em cache local (fallback)
   * @param {string} chatId - ID do chat
   * @param {Object} memory - Memória a salvar
   */
  saveToLocalCache(chatId, memory) {
    this.localCache.set(chatId, {
      memory: JSON.parse(JSON.stringify(memory)), // Deep clone
      savedAt: new Date(),
      pending: true
    });
    
    logger.warn('Memória salva em cache local (pendente sync)', { chatId });
  }

  /**
   * Obtém do cache local
   * @param {string} chatId - ID do chat
   * @returns {Object|null} Memória em cache ou null
   */
  getFromLocalCache(chatId) {
    return this.localCache.get(chatId);
  }

  /**
   * Sincroniza cache local com banco
   * @returns {Promise<Object>} Resultado da sincronização
   */
  async syncLocalCache() {
    const pending = [];
    const errors = [];
    
    for (const [chatId, cached] of this.localCache.entries()) {
      if (cached.pending) {
        try {
          await memoryRepository.save(cached.memory);
          cached.pending = false;
          cached.savedAt = new Date();
          pending.push(chatId);
          
          logger.info('Cache sincronizado com sucesso', { chatId });
        } catch (error) {
          errors.push({ chatId, error: error.message });
          logger.error('Falha ao sincronizar cache', { chatId, error: error.message });
        }
      }
    }
    
    return {
      synced: pending,
      failed: errors,
      total_pending: errors.length
    };
  }

  /**
   * Retry com backoff exponencial
   * @param {Function} operation - Operação a executar
   * @param {string} chatId - ID do chat (para log)
   * @returns {Promise<any>} Resultado da operação
   */
  async retryWithBackoff(operation, chatId) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      const delay = this.retryDelay * Math.pow(2, attempt - 1);
      
      logger.info(`Tentativa ${attempt}/${this.retryAttempts} após ${delay}ms`, { chatId });
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        logger.warn(`Tentativa ${attempt} falhou`, {
          chatId,
          error: error.message
        });
      }
    }
    
    logger.error('Todas as tentativas falharam', { chatId });
    throw lastError;
  }

  /**
   * Limpa cache local de um chat
   * @param {string} chatId - ID do chat
   */
  clearCache(chatId) {
    this.localCache.delete(chatId);
  }

  /**
   * Limpa todo o cache local
   */
  clearAllCache() {
    this.localCache.clear();
  }

  /**
   * Para todos os auto-saves
   */
  stopAllAutoSaves() {
    for (const [chatId, timer] of this.autoSaveTimers.entries()) {
      clearInterval(timer);
    }
    this.autoSaveTimers.clear();
    logger.info('Todos os auto-saves cancelados');
  }

  /**
   * Obtém estatísticas do sistema de persistência
   * @returns {Object} Estatísticas
   */
  getStats() {
    const pendingCount = Array.from(this.localCache.values())
      .filter(c => c.pending).length;
    
    return {
      cache_size: this.localCache.size,
      pending_sync: pendingCount,
      active_auto_saves: this.autoSaveTimers.size,
      config: {
        auto_save_interval: this.autoSaveInterval,
        retry_attempts: this.retryAttempts,
        retry_delay: this.retryDelay
      }
    };
  }
}

module.exports = new MemoryPersistence();
