const memoryConfig = require('../../../config/memory-config');
const wordCounter = require('./word-counter');
const logger = require('../../../utils/logger');

/**
 * Gerenciador de Ciclos de Conversação
 * Um ciclo = mensagem do usuário + resposta da IA
 */
class CycleManager {
  constructor() {
    this.maxRecentCycles = memoryConfig.memory.recentCyclesCount;
  }

  /**
   * Cria um novo objeto de ciclo
   * @param {string} userMessage - Mensagem do usuário
   * @param {string} aiResponse - Resposta da IA
   * @param {number} cycleId - ID sequencial do ciclo
   * @returns {Object} Objeto de ciclo
   */
  createCycle(userMessage, aiResponse, cycleId) {
    const cycle = {
      cycle_id: cycleId,
      timestamp: new Date(),
      user_message: userMessage,
      ai_response: aiResponse,
      word_count: 0
    };
    
    // Calcula contagem de palavras
    cycle.word_count = wordCounter.countCycleWords(cycle);
    
    logger.debug('CycleManager.createCycle', {
      cycleId,
      wordCount: cycle.word_count
    });
    
    return cycle;
  }

  /**
   * Verifica se memória recente está cheia
   * @param {Object} memory - Documento de memória
   * @returns {boolean} True se está no limite
   */
  isRecentMemoryFull(memory) {
    return memory.recent_memory.length >= this.maxRecentCycles;
  }

  /**
   * Retorna quantidade de ciclos recentes
   * @param {Object} memory - Documento de memória
   * @returns {number} Quantidade de ciclos
   */
  getCycleCount(memory) {
    return memory.recent_memory?.length || 0;
  }

  /**
   * Obtém o próximo ID de ciclo
   * @param {Object} memory - Documento de memória
   * @returns {number} Próximo ID
   */
  getNextCycleId(memory) {
    return (memory.metadata?.total_cycles || 0) + 1;
  }

  /**
   * Obtém o ciclo mais antigo da memória recente
   * @param {Object} memory - Documento de memória
   * @returns {Object|null} Ciclo mais antigo ou null
   */
  getOldestRecentCycle(memory) {
    if (!memory.recent_memory || memory.recent_memory.length === 0) {
      return null;
    }
    return memory.recent_memory[0];
  }

  /**
   * Obtém o ciclo mais recente
   * @param {Object} memory - Documento de memória
   * @returns {Object|null} Ciclo mais recente ou null
   */
  getMostRecentCycle(memory) {
    if (!memory.recent_memory || memory.recent_memory.length === 0) {
      return null;
    }
    return memory.recent_memory[memory.recent_memory.length - 1];
  }

  /**
   * Adiciona ciclo à memória recente (in-memory, não persiste)
   * @param {Object} memory - Documento de memória
   * @param {Object} cycle - Ciclo a adicionar
   * @returns {Object} Memória atualizada
   */
  addCycleToRecent(memory, cycle) {
    if (!memory.recent_memory) {
      memory.recent_memory = [];
    }
    
    memory.recent_memory.push(cycle);
    
    // Atualiza metadados
    memory.metadata.total_cycles = (memory.metadata.total_cycles || 0) + 1;
    memory.metadata.total_word_count = (memory.metadata.total_word_count || 0) + cycle.word_count;
    memory.metadata.updated_at = new Date();
    
    logger.debug('CycleManager.addCycleToRecent', {
      cycleId: cycle.cycle_id,
      recentCount: memory.recent_memory.length,
      totalCycles: memory.metadata.total_cycles
    });
    
    return memory;
  }

  /**
   * Remove o ciclo mais antigo da memória recente
   * @param {Object} memory - Documento de memória
   * @returns {Object} Ciclo removido
   */
  removeOldestCycle(memory) {
    if (!memory.recent_memory || memory.recent_memory.length === 0) {
      return null;
    }
    
    const removed = memory.recent_memory.shift();
    
    logger.debug('CycleManager.removeOldestCycle', {
      removedCycleId: removed.cycle_id,
      remainingCount: memory.recent_memory.length
    });
    
    return removed;
  }

  /**
   * Cria objeto de ciclo antigo (resumido)
   * @param {Object} originalCycle - Ciclo original
   * @param {string} summary - Resumo gerado
   * @param {Object} preservedData - Dados preservados
   * @returns {Object} Ciclo resumido
   */
  createOldCycle(originalCycle, summary, preservedData = {}) {
    const oldCycle = {
      cycle_id: originalCycle.cycle_id,
      timestamp: originalCycle.timestamp,
      summary: summary,
      preserved_data: {
        numerical_values: preservedData.numerical_values || [],
        dates: preservedData.dates || [],
        decisions: preservedData.decisions || [],
        essential_context: preservedData.essential_context || ''
      },
      original_word_count: originalCycle.word_count,
      summary_word_count: wordCounter.countWords(summary),
      pending_summarization: false
    };
    
    logger.debug('CycleManager.createOldCycle', {
      cycleId: oldCycle.cycle_id,
      originalWords: oldCycle.original_word_count,
      summaryWords: oldCycle.summary_word_count,
      reduction: ((1 - oldCycle.summary_word_count / oldCycle.original_word_count) * 100).toFixed(1) + '%'
    });
    
    return oldCycle;
  }

  /**
   * Adiciona ciclo resumido à memória antiga
   * @param {Object} memory - Documento de memória
   * @param {Object} oldCycle - Ciclo resumido
   * @returns {Object} Memória atualizada
   */
  addCycleToOld(memory, oldCycle) {
    if (!memory.old_memory) {
      memory.old_memory = [];
    }
    
    memory.old_memory.push(oldCycle);
    
    logger.debug('CycleManager.addCycleToOld', {
      cycleId: oldCycle.cycle_id,
      oldMemoryCount: memory.old_memory.length
    });
    
    return memory;
  }

  /**
   * Promove o ciclo mais antigo para memória antiga
   * Requer resumo do ciclo antes de chamar
   * @param {Object} memory - Documento de memória
   * @param {Object} summarizedCycle - Ciclo já resumido
   * @returns {Object} Memória atualizada
   */
  promoteOldestCycle(memory, summarizedCycle) {
    // Remove da memória recente
    const removed = this.removeOldestCycle(memory);
    
    if (!removed) {
      logger.warn('CycleManager.promoteOldestCycle - Nenhum ciclo para promover');
      return memory;
    }
    
    // Adiciona à memória antiga
    this.addCycleToOld(memory, summarizedCycle);
    
    // Ajusta contagem de palavras (diferença entre original e resumo)
    const wordsDifference = summarizedCycle.summary_word_count - removed.word_count;
    memory.metadata.total_word_count += wordsDifference;
    
    logger.info('CycleManager.promoteOldestCycle concluído', {
      cycleId: removed.cycle_id,
      wordsReduced: Math.abs(wordsDifference)
    });
    
    return memory;
  }

  /**
   * Verifica se é necessário promover ciclo
   * @param {Object} memory - Documento de memória
   * @returns {boolean} True se precisa promover
   */
  needsPromotion(memory) {
    return this.getCycleCount(memory) > this.maxRecentCycles;
  }

  /**
   * Obtém estatísticas dos ciclos
   * @param {Object} memory - Documento de memória
   * @returns {Object} Estatísticas
   */
  getCycleStats(memory) {
    const recentCycles = memory.recent_memory || [];
    const oldCycles = memory.old_memory || [];
    
    return {
      recent: {
        count: recentCycles.length,
        max: this.maxRecentCycles,
        cycles: recentCycles.map(c => ({
          id: c.cycle_id,
          timestamp: c.timestamp,
          words: c.word_count
        }))
      },
      old: {
        count: oldCycles.length,
        cycles: oldCycles.map(c => ({
          id: c.cycle_id,
          timestamp: c.timestamp,
          original_words: c.original_word_count,
          summary_words: c.summary_word_count,
          pending: c.pending_summarization
        }))
      },
      total_cycles: memory.metadata?.total_cycles || 0
    };
  }

  /**
   * Marca ciclo antigo como pendente de resumo
   * Usado quando o GPT-5 Nano falha
   * @param {Object} memory - Documento de memória
   * @param {number} cycleId - ID do ciclo
   * @returns {Object} Memória atualizada
   */
  markCycleAsPending(memory, cycleId) {
    const cycle = memory.old_memory.find(c => c.cycle_id === cycleId);
    
    if (cycle) {
      cycle.pending_summarization = true;
      logger.warn('CycleManager.markCycleAsPending', { cycleId });
    }
    
    return memory;
  }

  /**
   * Obtém ciclos pendentes de resumo
   * @param {Object} memory - Documento de memória
   * @returns {Array} Ciclos pendentes
   */
  getPendingCycles(memory) {
    if (!memory.old_memory) return [];
    
    return memory.old_memory.filter(c => c.pending_summarization);
  }
}

module.exports = new CycleManager();
