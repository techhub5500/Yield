const memoryConfig = require('../../config/memory-config');
const cycleManager = require('./utils/cycle-manager');
const wordCounter = require('./utils/word-counter');
const loader = require('./storage/loader');
const persistence = require('./storage/persistence');
const summarizer = require('./compression/summarizer');
const compressor = require('./compression/compressor');
const preservation = require('./compression/preservation');
const logger = require('../../utils/logger');

/**
 * Gerenciador Principal de Memória
 * Orquestra todas as operações do sistema de memória
 */
class MemoryManager {
  constructor() {
    this.maxRecentCycles = memoryConfig.memory.recentCyclesCount;
  }

  /**
   * Carrega ou cria memória para um chat
   * @param {string} chatId - ID do chat
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} Documento de memória
   */
  async loadMemory(chatId, userId) {
    return await loader.loadMemory(chatId, userId);
  }

  /**
   * Processa um ciclo completo (mensagem + resposta)
   * Este é o método principal chamado após cada interação
   * @param {Object} memory - Documento de memória
   * @param {string} userMessage - Mensagem do usuário
   * @param {string} aiResponse - Resposta da IA
   * @returns {Promise<Object>} Memória atualizada
   */
  async processCycle(memory, userMessage, aiResponse) {
    const startTime = Date.now();
    const chatId = memory.chat_id;

    logger.info('Processando novo ciclo', {
      chatId,
      currentCycles: cycleManager.getCycleCount(memory)
    });

    try {
      // 1. Criar novo ciclo
      const cycleId = cycleManager.getNextCycleId(memory);
      const newCycle = cycleManager.createCycle(userMessage, aiResponse, cycleId);

      // 2. Verificar se precisa promover ciclo antigo
      if (cycleManager.isRecentMemoryFull(memory)) {
        memory = await this.promoteOldestCycle(memory);
      }

      // 3. Adicionar novo ciclo à memória recente
      memory = cycleManager.addCycleToRecent(memory, newCycle);

      // 4. Extrair e armazenar dados críticos
      const criticalData = preservation.analyzeCycle(newCycle);
      if (this.hasCriticalData(criticalData)) {
        memory = preservation.addCriticalDataToMemory(memory, criticalData);
      }

      // 5. Verificar se precisa de compressão
      if (compressor.needsCompression(memory)) {
        memory = await compressor.compress(memory);
      }

      // 6. Persistir memória
      await persistence.onCycleComplete(memory, newCycle);

      const duration = Date.now() - startTime;
      logger.logOperation('MemoryManager.processCycle', duration, true, {
        chatId,
        cycleId,
        totalWords: memory.metadata.total_word_count
      });

      return memory;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryManager.processCycle', duration, false, {
        chatId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Promove o ciclo mais antigo para memória antiga
   * @param {Object} memory - Documento de memória
   * @returns {Promise<Object>} Memória atualizada
   */
  async promoteOldestCycle(memory) {
    const oldestCycle = cycleManager.getOldestRecentCycle(memory);
    
    if (!oldestCycle) {
      logger.warn('Nenhum ciclo para promover');
      return memory;
    }

    logger.debug('Promovendo ciclo para memória antiga', {
      cycleId: oldestCycle.cycle_id
    });

    try {
      // Resumir o ciclo
      const summaryResult = await summarizer.summarizeCycle(oldestCycle);

      // Criar ciclo antigo
      const oldCycle = cycleManager.createOldCycle(
        oldestCycle,
        summaryResult.summary,
        summaryResult.preserved_data
      );

      // Promover
      memory = cycleManager.promoteOldestCycle(memory, oldCycle);

      logger.info('Ciclo promovido com sucesso', {
        cycleId: oldestCycle.cycle_id,
        originalWords: oldestCycle.word_count,
        summaryWords: oldCycle.summary_word_count
      });

      return memory;

    } catch (error) {
      logger.error('Falha ao promover ciclo', error);

      // Em caso de falha, cria resumo de fallback
      const fallbackSummary = summarizer.createFallbackSummary(oldestCycle);
      const oldCycle = cycleManager.createOldCycle(
        oldestCycle,
        fallbackSummary.summary,
        fallbackSummary.preserved_data
      );
      oldCycle.pending_summarization = true;

      memory = cycleManager.promoteOldestCycle(memory, oldCycle);
      
      return memory;
    }
  }

  /**
   * Verifica se há dados críticos extraídos
   * @param {Object} criticalData - Dados críticos
   * @returns {boolean} True se há dados
   */
  hasCriticalData(criticalData) {
    return Object.values(criticalData).some(arr => arr.length > 0);
  }

  /**
   * Adiciona dados críticos manualmente
   * @param {Object} memory - Documento de memória
   * @param {string} type - Tipo de dado crítico
   * @param {string} content - Conteúdo
   * @returns {Promise<Object>} Memória atualizada
   */
  async addCriticalData(memory, type, content) {
    const validTypes = Object.values(preservation.constructor.TYPES);
    
    if (!validTypes.includes(type)) {
      throw new Error(`Tipo inválido: ${type}. Válidos: ${validTypes.join(', ')}`);
    }

    const item = {
      content,
      extracted_at: new Date(),
      source_cycle_id: null,
      numerical_value: preservation.extractNumericalValue(content),
      date_value: preservation.extractDateValue(content)
    };

    const newCriticalData = {
      financial_goals: [],
      configured_limits: [],
      declared_preferences: [],
      important_decisions: []
    };
    newCriticalData[type].push(item);

    memory = preservation.addCriticalDataToMemory(memory, newCriticalData);
    await persistence.onCriticalDataAdded(memory, type);

    return memory;
  }

  /**
   * Obtém memória formatada para agentes
   * @param {Object} memory - Documento de memória
   * @returns {Object} Memória formatada
   */
  getFormattedMemory(memory) {
    return loader.formatMemoryForAgent(memory);
  }

  /**
   * Obtém memória como texto
   * @param {Object} memory - Documento de memória
   * @returns {string} Texto formatado
   */
  getMemoryAsText(memory) {
    return loader.formatMemoryAsText(memory);
  }

  /**
   * Força compressão da memória
   * @param {Object} memory - Documento de memória
   * @returns {Promise<Object>} Memória comprimida
   */
  async forceCompression(memory) {
    logger.info('Forçando compressão', { chatId: memory.chat_id });
    
    memory = await compressor.compress(memory);
    await persistence.onCompressionComplete(memory);
    
    return memory;
  }

  /**
   * Retenta resumo de ciclos pendentes
   * @param {Object} memory - Documento de memória
   * @returns {Promise<Object>} Memória atualizada
   */
  async retryPendingSummarization(memory) {
    const pendingCycles = cycleManager.getPendingCycles(memory);

    if (pendingCycles.length === 0) {
      logger.debug('Nenhum ciclo pendente de resumo');
      return memory;
    }

    logger.info('Retentando resumo de ciclos pendentes', {
      count: pendingCycles.length
    });

    for (const cycle of pendingCycles) {
      try {
        // Tenta resumir novamente usando o resumo atual como base
        const result = await summarizer.compressFurther(
          cycle.summary,
          cycle.preserved_data
        );

        // Atualiza ciclo
        cycle.summary = result.compressed_summary;
        cycle.summary_word_count = wordCounter.countWords(result.compressed_summary);
        cycle.pending_summarization = false;

        logger.info('Resumo pendente concluído', { cycleId: cycle.cycle_id });

      } catch (error) {
        logger.warn('Retry de resumo falhou', {
          cycleId: cycle.cycle_id,
          error: error.message
        });
      }
    }

    // Recalcula contagem de palavras
    memory = wordCounter.recalculateWordCount(memory);
    await persistence.saveMemory(memory);

    return memory;
  }

  /**
   * Obtém estatísticas completas da memória
   * @param {Object} memory - Documento de memória
   * @returns {Object} Estatísticas
   */
  getStats(memory) {
    const cycleStats = cycleManager.getCycleStats(memory);
    const wordStats = wordCounter.getMemoryStatus(memory);
    const compressionStats = compressor.getCompressionStats(memory);
    const criticalStats = preservation.getCriticalDataSummary(memory);

    return {
      chat_id: memory.chat_id,
      user_id: memory.user_id,
      cycles: cycleStats,
      words: wordStats,
      compression: compressionStats,
      critical_data: criticalStats,
      metadata: {
        created_at: memory.metadata.created_at,
        updated_at: memory.metadata.updated_at,
        total_cycles: memory.metadata.total_cycles
      }
    };
  }

  /**
   * Limpa memória de um chat
   * @param {string} chatId - ID do chat
   * @param {boolean} confirm - Confirmação
   * @returns {Promise<Object>} Resultado
   */
  async clearMemory(chatId, confirm = false) {
    if (!confirm) {
      return { 
        success: false, 
        message: 'Confirmação necessária. Passe confirm=true para limpar.' 
      };
    }

    const memoryRepository = require('../../models/MemoryRepository');
    
    try {
      await memoryRepository.delete(chatId, true);
      persistence.clearCache(chatId);
      persistence.cancelAutoSave(chatId);

      logger.info('Memória limpa', { chatId });

      return { success: true, message: 'Memória removida com sucesso' };

    } catch (error) {
      logger.error('Falha ao limpar memória', error);
      throw error;
    }
  }

  /**
   * Exporta memória para backup
   * @param {Object} memory - Documento de memória
   * @returns {Object} Dados para backup
   */
  exportMemory(memory) {
    return {
      version: '2.0',
      exported_at: new Date().toISOString(),
      chat_id: memory.chat_id,
      user_id: memory.user_id,
      recent_memory: memory.recent_memory,
      old_memory: memory.old_memory,
      critical_data: memory.critical_data,
      metadata: memory.metadata
    };
  }

  /**
   * Verifica saúde do sistema de memória
   * @returns {Promise<Object>} Status de saúde
   */
  async healthCheck() {
    const summarizerHealth = await summarizer.healthCheck();
    const persistenceStats = persistence.getStats();

    return {
      status: summarizerHealth.healthy ? 'healthy' : 'degraded',
      components: {
        summarizer: summarizerHealth,
        persistence: persistenceStats
      },
      config: {
        max_words: memoryConfig.memory.maxWords,
        compression_threshold: memoryConfig.compressionThresholdWords,
        target_after_compression: memoryConfig.targetWordsAfterCompression,
        recent_cycles_count: memoryConfig.memory.recentCyclesCount
      }
    };
  }
}

module.exports = new MemoryManager();
