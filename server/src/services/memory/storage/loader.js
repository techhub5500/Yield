const memoryRepository = require('../../../models/MemoryRepository');
const wordCounter = require('../utils/word-counter');
const logger = require('../../../utils/logger');
const { AppError, ERROR_CODES } = require('../../../utils/error-handler');

/**
 * Carregador de Memória
 * Responsável por identificar e carregar memórias de chats
 */
class MemoryLoader {
  
  /**
   * Carrega ou cria memória para um chat
   * @param {string} chatId - ID do chat
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} Documento de memória
   */
  async loadMemory(chatId, userId) {
    const startTime = Date.now();
    
    try {
      // Tenta carregar memória existente
      let memory = await memoryRepository.findByChat(chatId);
      
      if (memory) {
        // Chat existente - carregar memória salva
        logger.info('Memória existente carregada', {
          chatId,
          totalCycles: memory.metadata.total_cycles,
          totalWords: memory.metadata.total_word_count
        });
        
        // Verifica e recalcula contagem de palavras se necessário
        memory = this.validateWordCount(memory);
        
      } else {
        // Chat novo - criar memória zerada
        memory = await this.createEmptyMemory(chatId, userId);
        
        logger.info('Nova memória criada', { chatId, userId });
      }
      
      const duration = Date.now() - startTime;
      logger.debug('MemoryLoader.loadMemory', { chatId, duration });
      
      return memory;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('MemoryLoader.loadMemory', duration, false, {
        chatId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Verifica se um chat é novo (não existe no banco)
   * @param {string} chatId - ID do chat
   * @returns {Promise<boolean>} True se é novo
   */
  async isNewChat(chatId) {
    try {
      const exists = await memoryRepository.chatExists(chatId);
      return !exists;
    } catch (error) {
      logger.error('MemoryLoader.isNewChat falhou', error);
      throw error;
    }
  }

  /**
   * Cria memória zerada para novo chat
   * @param {string} chatId - ID do chat
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} Nova memória
   */
  async createEmptyMemory(chatId, userId) {
    if (!chatId) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'chat_id é obrigatório');
    }
    if (!userId) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'user_id é obrigatório');
    }
    
    try {
      const memory = await memoryRepository.create(chatId, userId);
      
      logger.info('Memória zerada criada', { chatId, userId });
      
      return memory;
    } catch (error) {
      logger.error('MemoryLoader.createEmptyMemory falhou', error);
      throw error;
    }
  }

  /**
   * Valida e recalcula contagem de palavras se inconsistente
   * @param {Object} memory - Documento de memória
   * @returns {Object} Memória validada
   */
  validateWordCount(memory) {
    const calculatedCount = wordCounter.getTotalWordCount(memory);
    const storedCount = memory.metadata.total_word_count;
    
    // Se a diferença for maior que 5%, recalcula
    const tolerance = 0.05;
    const difference = Math.abs(calculatedCount - storedCount);
    const percentDiff = storedCount > 0 ? difference / storedCount : 0;
    
    if (percentDiff > tolerance) {
      logger.warn('Contagem de palavras inconsistente, recalculando', {
        stored: storedCount,
        calculated: calculatedCount,
        difference: percentDiff.toFixed(2) + '%'
      });
      
      // Recalcula todas as contagens
      memory = wordCounter.recalculateWordCount(memory);
    }
    
    return memory;
  }

  /**
   * Formata memória para envio aos agentes
   * @param {Object} memory - Documento de memória
   * @returns {Object} Memória formatada
   */
  formatMemoryForAgent(memory) {
    if (!memory) {
      return {
        has_history: false,
        recent: [],
        old_summaries: [],
        critical_data: null
      };
    }
    
    // Formata ciclos recentes
    const recentFormatted = (memory.recent_memory || []).map(cycle => ({
      user: cycle.user_message,
      assistant: cycle.ai_response,
      timestamp: cycle.timestamp
    }));
    
    // Formata resumos antigos
    const oldFormatted = (memory.old_memory || []).map(cycle => ({
      summary: cycle.summary,
      preserved: cycle.preserved_data,
      timestamp: cycle.timestamp
    }));
    
    // Formata dados críticos
    const criticalFormatted = this.formatCriticalData(memory.critical_data);
    
    return {
      has_history: recentFormatted.length > 0 || oldFormatted.length > 0,
      recent: recentFormatted,
      old_summaries: oldFormatted,
      critical_data: criticalFormatted,
      metadata: {
        total_cycles: memory.metadata.total_cycles,
        word_count: memory.metadata.total_word_count,
        usage_percentage: wordCounter.getUsagePercentage(memory).toFixed(1) + '%'
      }
    };
  }

  /**
   * Formata dados críticos para exibição
   * @param {Object} criticalData - Dados críticos
   * @returns {Object} Dados formatados
   */
  formatCriticalData(criticalData) {
    if (!criticalData) return null;
    
    const hasData = 
      (criticalData.financial_goals?.length > 0) ||
      (criticalData.configured_limits?.length > 0) ||
      (criticalData.declared_preferences?.length > 0) ||
      (criticalData.important_decisions?.length > 0);
    
    if (!hasData) return null;
    
    return {
      goals: criticalData.financial_goals?.map(g => g.content) || [],
      limits: criticalData.configured_limits?.map(l => l.content) || [],
      preferences: criticalData.declared_preferences?.map(p => p.content) || [],
      decisions: criticalData.important_decisions?.map(d => d.content) || []
    };
  }

  /**
   * Gera texto formatado da memória para contexto
   * @param {Object} memory - Documento de memória
   * @returns {string} Texto formatado
   */
  formatMemoryAsText(memory) {
    if (!memory) return '';
    
    const formatted = this.formatMemoryForAgent(memory);
    
    if (!formatted.has_history) {
      return '[Novo chat - sem histórico]';
    }
    
    let text = '';
    
    // Dados críticos primeiro (sempre relevantes)
    if (formatted.critical_data) {
      text += '=== INFORMAÇÕES IMPORTANTES DO USUÁRIO ===\n';
      
      if (formatted.critical_data.goals.length > 0) {
        text += 'Metas financeiras:\n';
        formatted.critical_data.goals.forEach(g => text += `  • ${g}\n`);
      }
      
      if (formatted.critical_data.limits.length > 0) {
        text += 'Limites configurados:\n';
        formatted.critical_data.limits.forEach(l => text += `  • ${l}\n`);
      }
      
      if (formatted.critical_data.preferences.length > 0) {
        text += 'Preferências:\n';
        formatted.critical_data.preferences.forEach(p => text += `  • ${p}\n`);
      }
      
      if (formatted.critical_data.decisions.length > 0) {
        text += 'Decisões importantes:\n';
        formatted.critical_data.decisions.forEach(d => text += `  • ${d}\n`);
      }
      
      text += '\n';
    }
    
    // Resumos antigos
    if (formatted.old_summaries.length > 0) {
      text += '=== HISTÓRICO RESUMIDO ===\n';
      formatted.old_summaries.forEach(s => {
        text += `[Resumo]: ${s.summary}\n`;
      });
      text += '\n';
    }
    
    // Ciclos recentes (mais importantes)
    if (formatted.recent.length > 0) {
      text += '=== CONVERSAS RECENTES ===\n';
      formatted.recent.forEach((cycle, i) => {
        text += `[Usuário]: ${cycle.user}\n`;
        text += `[Assistente]: ${cycle.assistant}\n`;
        if (i < formatted.recent.length - 1) text += '---\n';
      });
    }
    
    return text;
  }

  /**
   * Busca memórias de um usuário
   * @param {string} userId - ID do usuário
   * @param {Object} options - Opções de paginação
   * @returns {Promise<Array>} Lista de memórias
   */
  async getUserMemories(userId, options = {}) {
    try {
      return await memoryRepository.findByUser(userId, options);
    } catch (error) {
      logger.error('MemoryLoader.getUserMemories falhou', error);
      throw error;
    }
  }

  /**
   * Obtém estatísticas de um chat
   * @param {string} chatId - ID do chat
   * @returns {Promise<Object>} Estatísticas
   */
  async getChatStats(chatId) {
    try {
      const memory = await memoryRepository.findByChat(chatId);
      
      if (!memory) {
        return { exists: false };
      }
      
      return {
        exists: true,
        chat_id: memory.chat_id,
        user_id: memory.user_id,
        ...wordCounter.getMemoryStatus(memory),
        cycles: {
          recent: memory.recent_memory.length,
          old: memory.old_memory.length,
          total: memory.metadata.total_cycles
        },
        critical_data_count: {
          goals: memory.critical_data.financial_goals?.length || 0,
          limits: memory.critical_data.configured_limits?.length || 0,
          preferences: memory.critical_data.declared_preferences?.length || 0,
          decisions: memory.critical_data.important_decisions?.length || 0
        },
        created_at: memory.metadata.created_at,
        updated_at: memory.metadata.updated_at,
        compressions: memory.metadata.compression_count,
        last_compression: memory.metadata.last_compression
      };
    } catch (error) {
      logger.error('MemoryLoader.getChatStats falhou', error);
      throw error;
    }
  }
}

module.exports = new MemoryLoader();
