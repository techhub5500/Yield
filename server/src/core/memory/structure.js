/**
 * @module core/memory/structure
 * @description Estrutura de memória contextual do sistema.
 * Implementa a lógica pura de gestão de ciclos recentes e antigos.
 * 
 * Memória Recente: últimos 2 ciclos completos (acesso direto).
 * Memória Antiga: resumos de ciclos anteriores.
 * 
 * LÓGICA PURA conforme constituição — sem IA neste módulo.
 */

const Cycle = require('./cycle');
const { calculateTotalWords, calculateUsagePercentage } = require('./counter');
const config = require('../../config');

/**
 * @class Memory
 * Estrutura central de memória de um chat.
 */
class Memory {
  constructor() {
    /** @type {Cycle[]} Últimos 2 ciclos completos */
    this.recent = [];

    /** @type {Array<{content: string, timestamp: string}>} Resumos de ciclos anteriores */
    this.old = [];

    /** @type {Array<{userInput: string, aiResponse: string, timestamp: string, id: string}>} Histórico completo para exibição */
    this.fullHistory = [];

    /** @type {number} Cache de contagem de palavras */
    this.wordCount = 0;
  }

  /**
   * Adiciona um novo ciclo à memória recente.
   * Se já existem 2 ciclos recentes, o mais antigo é movido para old.
   * 
   * IMPORTANTE: O ciclo movido para old NÃO é resumido aqui.
   * O resumo é feito pelo MemoryManager via IA (nano), mantendo
   * a separação lógica/IA que a constituição exige.
   * 
   * @param {Cycle} cycle - Ciclo completo para adicionar
   * @returns {{ movedCycle: Cycle|null }} O ciclo que foi movido para old (precisa de resumo por IA), ou null
   */
  addCycle(cycle) {
    let movedCycle = null;

    // Se já temos o máximo de ciclos recentes, mover o mais antigo
    if (this.recent.length >= config.memory.maxRecentCycles) {
      movedCycle = this.recent.shift(); // Remove o mais antigo
    }

    // Adicionar novo ciclo aos recentes
    this.recent.push(cycle);

    // Adicionar também ao histórico completo (para exibição ao usuário)
    this.fullHistory.push({
      userInput: cycle.userInput,
      aiResponse: cycle.aiResponse,
      timestamp: cycle.timestamp,
      id: cycle.id,
    });

    // Recalcular contagem de palavras
    this.recalculateWordCount();

    return { movedCycle };
  }

  /**
   * Adiciona um resumo à memória antiga.
   * Chamado pelo MemoryManager após a IA resumir o ciclo.
   * @param {string} summary - Resumo textual do ciclo
   * @param {string} timestamp - Timestamp do ciclo original
   */
  addOldSummary(summary, timestamp) {
    this.old.push({
      content: summary,
      timestamp: timestamp,
    });
    this.recalculateWordCount();
  }

  /**
   * Verifica se a memória atingiu o limite de compressão (90%).
   * @returns {boolean}
   */
  shouldCompress() {
    const threshold = config.memory.maxWords * config.memory.compressionThreshold;
    return this.wordCount >= threshold;
  }

  /**
   * Substitui todos os resumos antigos por uma versão comprimida.
   * Chamado pelo MemoryManager após a IA comprimir.
   * @param {string} compressedContent - Conteúdo comprimido pela IA
   */
  replaceOldWithCompressed(compressedContent) {
    this.old = [{
      content: compressedContent,
      timestamp: new Date().toISOString(),
      compressed: true,
    }];
    this.recalculateWordCount();
  }

  /**
   * Recalcula a contagem total de palavras.
   * LÓGICA PURA.
   */
  recalculateWordCount() {
    this.wordCount = calculateTotalWords(this);
  }

  /**
   * Retorna a porcentagem de uso da memória.
   * @returns {number} 0 a 1
   */
  getUsagePercentage() {
    return calculateUsagePercentage(this.wordCount, config.memory.maxWords);
  }

  /**
   * Serializa a memória para persistência.
   * @returns {Object}
   */
  toJSON() {
    return {
      recent: this.recent.map(c => (c instanceof Cycle ? c.toJSON() : c)),
      old: this.old,
      fullHistory: this.fullHistory,
      wordCount: this.wordCount,
    };
  }

  /**
   * Reconstrói a Memory a partir de dados do banco.
   * @param {Object} data
   * @returns {Memory}
   */
  static fromJSON(data) {
    const memory = new Memory();

    if (data.recent && Array.isArray(data.recent)) {
      memory.recent = data.recent.map(c => Cycle.fromJSON(c));
    }

    if (data.old && Array.isArray(data.old)) {
      memory.old = data.old;
    }

    if (data.fullHistory && Array.isArray(data.fullHistory)) {
      memory.fullHistory = data.fullHistory;
    }

    memory.recalculateWordCount();
    return memory;
  }
}

module.exports = Memory;
