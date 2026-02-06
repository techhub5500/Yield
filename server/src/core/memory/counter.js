/**
 * @module core/memory/counter
 * @description Funções puras de contagem de palavras.
 * Sem dependências externas — apenas manipulação de strings.
 * LÓGICA PURA conforme constituição.
 */

/**
 * Conta palavras em um texto.
 * @param {string} text - Texto para contar
 * @returns {number} Número de palavras
 */
function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Calcula o total de palavras na memória (recent + old).
 * @param {Object} memory - Estrutura de memória { recent: [], old: [] }
 * @returns {number} Total de palavras
 */
function calculateTotalWords(memory) {
  if (!memory) return 0;

  let total = 0;

  // Contar palavras dos ciclos recentes
  if (Array.isArray(memory.recent)) {
    for (const cycle of memory.recent) {
      total += countWords(cycle.userInput || '');
      total += countWords(cycle.aiResponse || '');
    }
  }

  // Contar palavras dos resumos antigos
  if (Array.isArray(memory.old)) {
    for (const summary of memory.old) {
      if (typeof summary === 'string') {
        total += countWords(summary);
      } else if (summary && typeof summary.content === 'string') {
        total += countWords(summary.content);
      }
    }
  }

  return total;
}

/**
 * Calcula a porcentagem de uso da memória em relação ao limite.
 * @param {number} wordCount - Contagem atual de palavras
 * @param {number} maxWords - Limite máximo de palavras
 * @returns {number} Porcentagem de uso (0 a 1)
 */
function calculateUsagePercentage(wordCount, maxWords) {
  if (maxWords <= 0) return 0;
  return wordCount / maxWords;
}

module.exports = {
  countWords,
  calculateTotalWords,
  calculateUsagePercentage,
};
