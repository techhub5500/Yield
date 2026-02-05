const memoryConfig = require('../../../config/memory-config');
const logger = require('../../../utils/logger');

/**
 * Utilitário para contagem de palavras
 * Gerencia limites e verificações do sistema de memória
 */
class WordCounter {
  constructor() {
    this.maxWords = memoryConfig.memory.maxWords;
    this.compressionThreshold = memoryConfig.memory.compressionThreshold;
    this.targetAfterCompression = memoryConfig.memory.targetAfterCompression;
  }

  /**
   * Conta palavras em um texto
   * @param {string} text - Texto para contar
   * @returns {number} Quantidade de palavras
   */
  countWords(text) {
    if (!text || typeof text !== 'string') {
      return 0;
    }
    
    // Remove espaços extras e divide por espaços
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length;
  }

  /**
   * Conta palavras em um ciclo recente
   * @param {Object} cycle - Ciclo com user_message e ai_response
   * @returns {number} Total de palavras do ciclo
   */
  countCycleWords(cycle) {
    if (!cycle) return 0;
    
    const userWords = this.countWords(cycle.user_message);
    const aiWords = this.countWords(cycle.ai_response);
    
    return userWords + aiWords;
  }

  /**
   * Conta palavras em um ciclo antigo (resumido)
   * @param {Object} oldCycle - Ciclo resumido
   * @returns {number} Palavras do resumo
   */
  countOldCycleWords(oldCycle) {
    if (!oldCycle) return 0;
    return this.countWords(oldCycle.summary);
  }

  /**
   * Calcula palavras nos ciclos recentes
   * @param {Object} memory - Documento de memória
   * @returns {number} Total de palavras nos ciclos recentes
   */
  calculateRecentWordsCount(memory) {
    if (!memory || !memory.recent_memory) return 0;
    
    return memory.recent_memory.reduce((total, cycle) => {
      return total + (cycle.word_count || this.countCycleWords(cycle));
    }, 0);
  }

  /**
   * Calcula palavras na memória antiga
   * @param {Object} memory - Documento de memória
   * @returns {number} Total de palavras na memória antiga
   */
  calculateOldWordsCount(memory) {
    if (!memory || !memory.old_memory) return 0;
    
    return memory.old_memory.reduce((total, cycle) => {
      return total + (cycle.summary_word_count || this.countOldCycleWords(cycle));
    }, 0);
  }

  /**
   * Calcula palavras nos dados críticos
   * @param {Object} memory - Documento de memória
   * @returns {number} Total de palavras nos dados críticos
   */
  calculateCriticalDataWordsCount(memory) {
    if (!memory || !memory.critical_data) return 0;
    
    let total = 0;
    
    const categories = ['financial_goals', 'configured_limits', 'declared_preferences', 'important_decisions'];
    
    for (const category of categories) {
      if (memory.critical_data[category]) {
        for (const item of memory.critical_data[category]) {
          total += this.countWords(item.content);
        }
      }
    }
    
    return total;
  }

  /**
   * Calcula total de palavras da memória
   * @param {Object} memory - Documento de memória
   * @returns {number} Total de palavras
   */
  getTotalWordCount(memory) {
    const recentWords = this.calculateRecentWordsCount(memory);
    const oldWords = this.calculateOldWordsCount(memory);
    const criticalWords = this.calculateCriticalDataWordsCount(memory);
    
    const total = recentWords + oldWords + criticalWords;
    
    logger.debug('WordCounter.getTotalWordCount', {
      recent: recentWords,
      old: oldWords,
      critical: criticalWords,
      total
    });
    
    return total;
  }

  /**
   * Recalcula e atualiza contagem de palavras
   * @param {Object} memory - Documento de memória
   * @returns {Object} Memória com contagem atualizada
   */
  recalculateWordCount(memory) {
    // Atualiza word_count de cada ciclo recente
    if (memory.recent_memory) {
      for (const cycle of memory.recent_memory) {
        cycle.word_count = this.countCycleWords(cycle);
      }
    }
    
    // Atualiza summary_word_count de cada ciclo antigo
    if (memory.old_memory) {
      for (const cycle of memory.old_memory) {
        cycle.summary_word_count = this.countOldCycleWords(cycle);
      }
    }
    
    // Atualiza total
    memory.metadata.total_word_count = this.getTotalWordCount(memory);
    
    return memory;
  }

  /**
   * Retorna porcentagem de uso do limite
   * @param {Object} memory - Documento de memória
   * @returns {number} Porcentagem de uso (0-100)
   */
  getUsagePercentage(memory) {
    const total = memory.metadata?.total_word_count ?? this.getTotalWordCount(memory);
    return (total / this.maxWords) * 100;
  }

  /**
   * Verifica se memória precisa de compressão
   * @param {Object} memory - Documento de memória
   * @returns {boolean} True se precisa comprimir
   */
  needsCompression(memory) {
    const total = memory.metadata?.total_word_count ?? this.getTotalWordCount(memory);
    const threshold = this.maxWords * this.compressionThreshold;
    
    const needsIt = total >= threshold;
    
    if (needsIt) {
      logger.info('Memória atingiu limite de compressão', {
        current: total,
        threshold,
        percentage: this.getUsagePercentage(memory).toFixed(1) + '%'
      });
    }
    
    return needsIt;
  }

  /**
   * Calcula meta de palavras após compressão
   * @returns {number} Meta de palavras
   */
  getTargetWordsAfterCompression() {
    return Math.floor(this.maxWords * this.targetAfterCompression);
  }

  /**
   * Calcula quantas palavras precisam ser removidas
   * @param {Object} memory - Documento de memória
   * @returns {number} Palavras a remover
   */
  getWordsToRemove(memory) {
    const current = memory.metadata?.total_word_count ?? this.getTotalWordCount(memory);
    const target = this.getTargetWordsAfterCompression();
    
    return Math.max(0, current - target);
  }

  /**
   * Verifica se memória está dentro dos limites
   * @param {Object} memory - Documento de memória
   * @returns {Object} Status da memória
   */
  getMemoryStatus(memory) {
    const total = memory.metadata?.total_word_count ?? this.getTotalWordCount(memory);
    const recentWords = this.calculateRecentWordsCount(memory);
    const oldWords = this.calculateOldWordsCount(memory);
    const criticalWords = this.calculateCriticalDataWordsCount(memory);
    const percentage = this.getUsagePercentage(memory);
    const needsCompression = this.needsCompression(memory);
    
    return {
      total_words: total,
      max_words: this.maxWords,
      usage_percentage: percentage.toFixed(1) + '%',
      breakdown: {
        recent: recentWords,
        old: oldWords,
        critical: criticalWords
      },
      needs_compression: needsCompression,
      compression_threshold: (this.compressionThreshold * 100) + '%',
      target_after_compression: this.getTargetWordsAfterCompression(),
      words_available: this.maxWords - total
    };
  }
}

module.exports = new WordCounter();
