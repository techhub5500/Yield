/**
 * Sistema de Memória Contextual
 * Fase 2 - Sistema Multi-Agente
 * 
 * Este módulo gerencia a memória de conversas, permitindo ao sistema
 * lembrar do contexto entre mensagens e preservar informações importantes.
 */

const memoryManager = require('./memory-manager');
const loader = require('./storage/loader');
const persistence = require('./storage/persistence');
const wordCounter = require('./utils/word-counter');
const cycleManager = require('./utils/cycle-manager');
const compressor = require('./compression/compressor');
const summarizer = require('./compression/summarizer');
const preservation = require('./compression/preservation');
const memoryConfig = require('../../config/memory-config');
const logger = require('../../utils/logger');

/**
 * API Principal do Sistema de Memória
 */
class MemoryService {
  
  /**
   * Carrega ou cria memória para um chat
   * Ponto de entrada principal quando uma mensagem é recebida
   * 
   * @param {string} chatId - ID único do chat
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} Documento de memória
   * 
   * @example
   * const memory = await memoryService.loadMemory('chat_123', 'user_456');
   */
  async loadMemory(chatId, userId) {
    return await memoryManager.loadMemory(chatId, userId);
  }

  /**
   * Processa um ciclo completo de conversação
   * Deve ser chamado após o usuário enviar uma mensagem E a IA responder
   * 
   * @param {Object} memory - Documento de memória
   * @param {string} userMessage - Mensagem do usuário
   * @param {string} aiResponse - Resposta da IA
   * @returns {Promise<Object>} Memória atualizada
   * 
   * @example
   * const updatedMemory = await memoryService.processCycle(
   *   memory,
   *   'Quanto gastei ontem?',
   *   'Você gastou R$ 150,00 ontem em 3 transações.'
   * );
   */
  async processCycle(memory, userMessage, aiResponse) {
    return await memoryManager.processCycle(memory, userMessage, aiResponse);
  }

  /**
   * Obtém memória formatada para envio aos agentes
   * Formato estruturado com ciclos recentes, resumos e dados críticos
   * 
   * @param {Object} memory - Documento de memória
   * @returns {Object} Memória formatada
   * 
   * @example
   * const formatted = memoryService.getFormattedMemory(memory);
   * // { has_history: true, recent: [...], old_summaries: [...], critical_data: {...} }
   */
  getFormattedMemory(memory) {
    return memoryManager.getFormattedMemory(memory);
  }

  /**
   * Obtém memória como texto para incluir em prompts
   * 
   * @param {Object} memory - Documento de memória
   * @returns {string} Texto formatado
   * 
   * @example
   * const text = memoryService.getMemoryAsText(memory);
   * // "=== CONVERSAS RECENTES ===\n[Usuário]: ...\n[Assistente]: ..."
   */
  getMemoryAsText(memory) {
    return memoryManager.getMemoryAsText(memory);
  }

  /**
   * Adiciona dado crítico manualmente
   * Usado quando informação importante é identificada explicitamente
   * 
   * @param {Object} memory - Documento de memória
   * @param {string} type - Tipo: 'financial_goals', 'configured_limits', 'declared_preferences', 'important_decisions'
   * @param {string} content - Conteúdo do dado
   * @returns {Promise<Object>} Memória atualizada
   * 
   * @example
   * await memoryService.addCriticalData(memory, 'financial_goals', 'Economizar R$ 5.000 até dezembro');
   */
  async addCriticalData(memory, type, content) {
    return await memoryManager.addCriticalData(memory, type, content);
  }

  /**
   * Obtém estatísticas completas da memória
   * 
   * @param {Object} memory - Documento de memória
   * @returns {Object} Estatísticas
   * 
   * @example
   * const stats = memoryService.getStats(memory);
   * // { cycles: {...}, words: {...}, compression: {...}, critical_data: {...} }
   */
  getStats(memory) {
    return memoryManager.getStats(memory);
  }

  /**
   * Verifica se chat existe
   * 
   * @param {string} chatId - ID do chat
   * @returns {Promise<boolean>}
   */
  async isNewChat(chatId) {
    return await loader.isNewChat(chatId);
  }

  /**
   * Obtém estatísticas de um chat
   * 
   * @param {string} chatId - ID do chat
   * @returns {Promise<Object>} Estatísticas
   */
  async getChatStats(chatId) {
    return await loader.getChatStats(chatId);
  }

  /**
   * Força compressão da memória
   * 
   * @param {Object} memory - Documento de memória
   * @returns {Promise<Object>} Memória comprimida
   */
  async forceCompression(memory) {
    return await memoryManager.forceCompression(memory);
  }

  /**
   * Verifica se memória precisa de compressão
   * 
   * @param {Object} memory - Documento de memória
   * @returns {boolean}
   */
  needsCompression(memory) {
    return compressor.needsCompression(memory);
  }

  /**
   * Simula compressão sem aplicar
   * Útil para preview do impacto
   * 
   * @param {Object} memory - Documento de memória
   * @returns {Promise<Object>} Resultado simulado
   */
  async simulateCompression(memory) {
    return await compressor.simulateCompression(memory);
  }

  /**
   * Retenta resumo de ciclos pendentes
   * 
   * @param {Object} memory - Documento de memória
   * @returns {Promise<Object>} Memória atualizada
   */
  async retryPendingSummarization(memory) {
    return await memoryManager.retryPendingSummarization(memory);
  }

  /**
   * Limpa memória de um chat
   * 
   * @param {string} chatId - ID do chat
   * @param {boolean} confirm - Deve ser true para confirmar
   * @returns {Promise<Object>} Resultado
   */
  async clearMemory(chatId, confirm = false) {
    return await memoryManager.clearMemory(chatId, confirm);
  }

  /**
   * Exporta memória para backup
   * 
   * @param {Object} memory - Documento de memória
   * @returns {Object} Dados para backup
   */
  exportMemory(memory) {
    return memoryManager.exportMemory(memory);
  }

  /**
   * Obtém status de uso da memória
   * 
   * @param {Object} memory - Documento de memória
   * @returns {Object} Status
   */
  getMemoryStatus(memory) {
    return wordCounter.getMemoryStatus(memory);
  }

  /**
   * Obtém resumo de dados críticos
   * 
   * @param {Object} memory - Documento de memória
   * @returns {Object} Resumo
   */
  getCriticalDataSummary(memory) {
    return preservation.getCriticalDataSummary(memory);
  }

  /**
   * Verifica saúde do sistema
   * 
   * @returns {Promise<Object>} Status de saúde
   */
  async healthCheck() {
    return await memoryManager.healthCheck();
  }

  /**
   * Obtém configurações atuais
   * 
   * @returns {Object} Configurações
   */
  getConfig() {
    return {
      max_words: memoryConfig.memory.maxWords,
      compression_threshold: memoryConfig.compressionThresholdWords,
      target_after_compression: memoryConfig.targetWordsAfterCompression,
      recent_cycles_count: memoryConfig.memory.recentCyclesCount,
      auto_detection_enabled: memoryConfig.criticalData.enableAutoDetection
    };
  }

  /**
   * Para todos os processos em background
   * Deve ser chamado no shutdown da aplicação
   */
  shutdown() {
    persistence.stopAllAutoSaves();
    logger.info('Sistema de memória encerrado');
  }
}

// Exporta instância única (singleton)
const memoryService = new MemoryService();

// Exporta também componentes individuais para uso avançado
module.exports = {
  // API principal
  memoryService,
  
  // Componentes individuais
  memoryManager,
  loader,
  persistence,
  wordCounter,
  cycleManager,
  compressor,
  summarizer,
  preservation,
  
  // Configurações
  memoryConfig,
  
  // Tipos de dados críticos
  CriticalDataTypes: preservation.constructor.TYPES
};

// Export default para conveniência
module.exports.default = memoryService;
