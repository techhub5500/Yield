/**
 * @module core/memory/manager
 * @description Gerenciador central de memória.
 * Integra lógica pura (structure, counter, storage) com IA (summarizer, compressor).
 * 
 * Fluxo conforme constituição:
 *   1. LÓGICA: adicionar ciclo aos recentes
 *   2. LÓGICA: mover o mais antigo para old
 *   3. IA (nano): resumir o ciclo que saiu dos recentes
 *   4. LÓGICA: verificar limite (90%)
 *   5. SE > 90%: IA (full): comprimir resumos antigos
 *   6. LÓGICA: salvar no banco
 */

const Cycle = require('./cycle');
const Memory = require('./structure');
const storage = require('./storage');
const { summarizeCycle } = require('../../agents/memory/summarizer');
const { compressMemory } = require('../../agents/memory/compressor');
const logger = require('../../utils/logger');

class MemoryManager {
  /**
   * Carrega a memória de um chat.
   * @param {string} chatId
   * @returns {Promise<Memory>}
   */
  async load(chatId) {
    return await storage.loadMemory(chatId);
  }

  /**
   * Atualiza a memória após um ciclo completo (usuário + IA).
   * Este é o fluxo principal de gestão de memória.
   * 
   * @param {string} chatId - ID do chat
   * @param {string} userInput - Mensagem do usuário
   * @param {string} aiResponse - Resposta da IA
   * @returns {Promise<Memory>} Memória atualizada
   */
  async updateAfterCycle(chatId, userInput, aiResponse) {
    // Carregar memória atual
    const memory = await this.load(chatId);

    // LÓGICA: criar ciclo
    const cycle = new Cycle(userInput, aiResponse);

    // LÓGICA: adicionar aos recentes (pode retornar ciclo movido)
    const { movedCycle } = memory.addCycle(cycle);

    // Se um ciclo foi movido dos recentes para old → IA resume
    if (movedCycle) {
      // IA (nano): resumir o ciclo que saiu
      const summary = await summarizeCycle(movedCycle);

      // LÓGICA: adicionar resumo à memória antiga
      memory.addOldSummary(summary, movedCycle.timestamp);

      logger.logic('INFO', 'MemoryManager', `Ciclo ${movedCycle.id} movido para old e resumido`);
    }

    // LÓGICA: verificar se precisa comprimir
    if (memory.shouldCompress()) {
      logger.logic('INFO', 'MemoryManager', `Memória atingiu ${Math.round(memory.getUsagePercentage() * 100)}% — iniciando compressão`);

      // IA (full): comprimir resumos antigos
      const compressed = await compressMemory(memory.old);

      // LÓGICA: substituir resumos antigos pela versão comprimida
      memory.replaceOldWithCompressed(compressed);

      logger.logic('INFO', 'MemoryManager', `Memória comprimida. Novo uso: ${memory.wordCount} palavras`);
    }

    // LÓGICA: salvar no banco
    await storage.saveMemory(chatId, memory);

    return memory;
  }
}

module.exports = new MemoryManager();
