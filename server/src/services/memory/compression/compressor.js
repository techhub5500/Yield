const memoryConfig = require('../../../config/memory-config');
const wordCounter = require('../utils/word-counter');
const summarizer = require('./summarizer');
const preservation = require('./preservation');
const logger = require('../../../utils/logger');
const strategicLogger = require('../../../utils/strategic-logger');

/**
 * Sistema de Compressão de Memória
 * Reduz tamanho da memória quando atinge limites
 */
class MemoryCompressor {
  constructor() {
    this.maxWords = memoryConfig.memory.maxWords;
    this.compressionThreshold = memoryConfig.compressionThresholdWords;
    this.targetAfterCompression = memoryConfig.targetWordsAfterCompression;
  }

  /**
   * Verifica se memória precisa de compressão
   * @param {Object} memory - Documento de memória
   * @returns {boolean} True se precisa comprimir
   */
  needsCompression(memory) {
    return wordCounter.needsCompression(memory);
  }

  /**
   * Executa compressão da memória
   * @param {Object} memory - Documento de memória
   * @returns {Promise<Object>} Memória comprimida
   */
  async compress(memory) {
    const startTime = Date.now();
    const chatId = memory.chat_id;

    logger.info('Iniciando compressão de memória', {
      chatId,
      currentWords: memory.metadata.total_word_count,
      threshold: this.compressionThreshold,
      target: this.targetAfterCompression
    });

    try {
      // 1. Calcular situação atual
      const status = this.analyzeMemory(memory);
      
      // 2. Verificar se ciclos recentes já excedem limite
      if (status.recentWords >= this.targetAfterCompression) {
        logger.warn('Ciclos recentes excedem meta de compressão', {
          chatId,
          recentWords: status.recentWords,
          target: this.targetAfterCompression
        });
        // Não podemos comprimir os recentes, apenas os antigos
      }

      // 3. Calcular palavras disponíveis para memória antiga
      const wordsAvailableForOld = Math.max(0, this.targetAfterCompression - status.recentWords - status.criticalWords);

      logger.debug('Distribuição de palavras calculada', {
        target: this.targetAfterCompression,
        recent: status.recentWords,
        critical: status.criticalWords,
        availableForOld: wordsAvailableForOld
      });

      // 4. Comprimir memória antiga
      const compressedOldMemory = await this.compressOldMemory(
        memory.old_memory,
        wordsAvailableForOld
      );

      // 5. Extrair e preservar dados críticos antes de descartar
      await this.preserveCriticalDataFromOld(memory, compressedOldMemory.discarded);

      // 6. Atualizar memória
      memory.old_memory = compressedOldMemory.kept;
      
      // 7. Recalcular contagem de palavras
      memory = wordCounter.recalculateWordCount(memory);
      
      // 8. Atualizar metadados de compressão
      memory.metadata.last_compression = new Date();
      memory.metadata.compression_count = (memory.metadata.compression_count || 0) + 1;

      const duration = Date.now() - startTime;
      const reduction = status.totalWords - memory.metadata.total_word_count;
      
      logger.logOperation('MemoryCompressor.compress', duration, true, {
        chatId,
        wordsBefore: status.totalWords,
        wordsAfter: memory.metadata.total_word_count,
        reduction: reduction,
        reductionPercent: ((reduction / status.totalWords) * 100).toFixed(1) + '%'
      });

      // Log estratégico de compressão
      await strategicLogger.memoryCompression(status.totalWords, memory.metadata.total_word_count, duration);

      return memory;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryCompressor.compress', duration, false, {
        chatId,
        error: error.message
      });
      
      // Log estratégico de erro
      await strategicLogger.error('memory', 'MemoryCompressor',
        `Falha na compressão de memória: ${error.message}`,
        { error, meta: { chatId } }
      );
      
      throw error;
    }
  }

  /**
   * Analisa estado atual da memória
   * @param {Object} memory - Documento de memória
   * @returns {Object} Análise
   */
  analyzeMemory(memory) {
    const recentWords = wordCounter.calculateRecentWordsCount(memory);
    const oldWords = wordCounter.calculateOldWordsCount(memory);
    const criticalWords = wordCounter.calculateCriticalDataWordsCount(memory);
    const totalWords = memory.metadata.total_word_count || (recentWords + oldWords + criticalWords);

    return {
      recentWords,
      oldWords,
      criticalWords,
      totalWords,
      recentCycles: memory.recent_memory?.length || 0,
      oldCycles: memory.old_memory?.length || 0
    };
  }

  /**
   * Comprime memória antiga para caber no limite
   * @param {Array} oldMemory - Ciclos antigos
   * @param {number} targetWords - Meta de palavras
   * @returns {Promise<Object>} Ciclos mantidos e descartados
   */
  async compressOldMemory(oldMemory, targetWords) {
    if (!oldMemory || oldMemory.length === 0) {
      return { kept: [], discarded: [] };
    }

    const kept = [];
    const discarded = [];
    let currentWords = 0;

    // Processa do mais novo ao mais antigo (mantém os mais recentes)
    const sortedOld = [...oldMemory].reverse();

    for (const cycle of sortedOld) {
      const cycleWords = cycle.summary_word_count || wordCounter.countWords(cycle.summary);

      if (currentWords + cycleWords <= targetWords) {
        // Ainda cabe, mantém
        kept.unshift(cycle); // Adiciona no início para manter ordem
        currentWords += cycleWords;
      } else if (kept.length === 0 && targetWords > 0) {
        // Primeiro ciclo não cabe, tenta comprimir mais
        const compressed = await this.compressCycleFurther(cycle, targetWords);
        
        if (compressed.summary_word_count <= targetWords) {
          kept.unshift(compressed);
          currentWords += compressed.summary_word_count;
        } else {
          // Mesmo comprimido não cabe, descarta
          discarded.push(cycle);
        }
      } else {
        // Não cabe mais, tenta comprimir
        const remainingSpace = targetWords - currentWords;
        
        if (remainingSpace >= 10) { // Pelo menos 10 palavras de espaço
          const compressed = await this.compressCycleFurther(cycle, remainingSpace);
          
          if (compressed.summary_word_count <= remainingSpace) {
            kept.unshift(compressed);
            currentWords += compressed.summary_word_count;
          } else {
            discarded.push(cycle);
          }
        } else {
          discarded.push(cycle);
        }
      }
    }

    logger.debug('Compressão de memória antiga concluída', {
      originalCount: oldMemory.length,
      keptCount: kept.length,
      discardedCount: discarded.length,
      wordsUsed: currentWords,
      targetWords
    });

    return { kept, discarded };
  }

  /**
   * Comprime um ciclo ainda mais
   * @param {Object} cycle - Ciclo a comprimir
   * @param {number} maxWords - Máximo de palavras
   * @returns {Promise<Object>} Ciclo comprimido
   */
  async compressCycleFurther(cycle, maxWords) {
    try {
      const result = await summarizer.compressFurther(
        cycle.summary,
        cycle.preserved_data
      );

      return {
        ...cycle,
        summary: result.compressed_summary,
        summary_word_count: wordCounter.countWords(result.compressed_summary),
        preserved_data: {
          ...cycle.preserved_data,
          numerical_values: [
            ...(cycle.preserved_data.numerical_values || []),
            ...(result.preserved_values || [])
          ]
        }
      };

    } catch (error) {
      logger.warn('Falha ao comprimir ciclo, usando truncagem', {
        cycleId: cycle.cycle_id,
        error: error.message
      });

      // Fallback: trunca o resumo
      const words = cycle.summary.split(/\s+/);
      const truncated = words.slice(0, maxWords).join(' ');

      return {
        ...cycle,
        summary: truncated + (words.length > maxWords ? '...' : ''),
        summary_word_count: Math.min(words.length, maxWords)
      };
    }
  }

  /**
   * Preserva dados críticos de ciclos descartados
   * @param {Object} memory - Documento de memória
   * @param {Array} discardedCycles - Ciclos descartados
   */
  async preserveCriticalDataFromOld(memory, discardedCycles) {
    if (!discardedCycles || discardedCycles.length === 0) {
      return;
    }

    for (const cycle of discardedCycles) {
      // Extrai dados críticos do resumo
      const criticalData = preservation.extractCriticalData(
        cycle.summary,
        cycle.cycle_id
      );

      // Adiciona preserved_data do ciclo aos dados críticos
      if (cycle.preserved_data) {
        // Valores numéricos viram metas se parecerem relevantes
        if (cycle.preserved_data.essential_context) {
          const contextCritical = preservation.extractCriticalData(
            cycle.preserved_data.essential_context,
            cycle.cycle_id
          );
          
          for (const category of Object.keys(criticalData)) {
            criticalData[category] = [
              ...criticalData[category],
              ...contextCritical[category]
            ];
          }
        }
      }

      // Mescla com dados críticos existentes
      preservation.addCriticalDataToMemory(memory, criticalData);
    }

    logger.info('Dados críticos preservados de ciclos descartados', {
      discardedCount: discardedCycles.length
    });
  }

  /**
   * Executa compressão de emergência
   * Quando a memória está criticamente cheia
   * @param {Object} memory - Documento de memória
   * @returns {Promise<Object>} Memória comprimida
   */
  async emergencyCompress(memory) {
    logger.warn('Executando compressão de emergência', {
      chatId: memory.chat_id,
      currentWords: memory.metadata.total_word_count
    });

    // Comprime agressivamente a memória antiga
    const result = await this.compressOldMemory(memory.old_memory, 200); // Máximo 200 palavras
    
    memory.old_memory = result.kept;
    
    // Preserva dados críticos
    await this.preserveCriticalDataFromOld(memory, result.discarded);
    
    // Limita dados críticos
    preservation.pruneOldCriticalData(memory, 5);
    
    // Recalcula
    memory = wordCounter.recalculateWordCount(memory);
    
    memory.metadata.last_compression = new Date();
    memory.metadata.compression_count = (memory.metadata.compression_count || 0) + 1;

    logger.info('Compressão de emergência concluída', {
      chatId: memory.chat_id,
      newWordCount: memory.metadata.total_word_count
    });

    return memory;
  }

  /**
   * Obtém estatísticas de compressão
   * @param {Object} memory - Documento de memória
   * @returns {Object} Estatísticas
   */
  getCompressionStats(memory) {
    const status = this.analyzeMemory(memory);
    const needsCompression = this.needsCompression(memory);
    const usagePercentage = wordCounter.getUsagePercentage(memory);

    return {
      current_words: status.totalWords,
      max_words: this.maxWords,
      compression_threshold: this.compressionThreshold,
      target_after_compression: this.targetAfterCompression,
      usage_percentage: usagePercentage.toFixed(1) + '%',
      needs_compression: needsCompression,
      breakdown: {
        recent: status.recentWords,
        old: status.oldWords,
        critical: status.criticalWords
      },
      compression_count: memory.metadata.compression_count || 0,
      last_compression: memory.metadata.last_compression,
      cycles: {
        recent: status.recentCycles,
        old: status.oldCycles
      }
    };
  }

  /**
   * Simula compressão sem aplicar
   * @param {Object} memory - Documento de memória
   * @returns {Promise<Object>} Resultado simulado
   */
  async simulateCompression(memory) {
    const status = this.analyzeMemory(memory);
    const wordsAvailableForOld = Math.max(0, this.targetAfterCompression - status.recentWords - status.criticalWords);

    // Simula sem chamar API
    let keptCount = 0;
    let discardedCount = 0;
    let estimatedWords = status.recentWords + status.criticalWords;

    const sortedOld = [...(memory.old_memory || [])].reverse();

    for (const cycle of sortedOld) {
      const cycleWords = cycle.summary_word_count || wordCounter.countWords(cycle.summary);
      
      if (estimatedWords + cycleWords <= this.targetAfterCompression) {
        keptCount++;
        estimatedWords += cycleWords;
      } else {
        discardedCount++;
      }
    }

    return {
      before: {
        total_words: status.totalWords,
        old_cycles: status.oldCycles
      },
      after: {
        estimated_words: estimatedWords,
        kept_cycles: keptCount,
        discarded_cycles: discardedCount
      },
      reduction: {
        words: status.totalWords - estimatedWords,
        cycles: discardedCount,
        percentage: (((status.totalWords - estimatedWords) / status.totalWords) * 100).toFixed(1) + '%'
      }
    };
  }
}

module.exports = new MemoryCompressor();
