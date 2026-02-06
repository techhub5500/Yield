/**
 * @module core/memory/cycle
 * @description Representa um ciclo completo de interação (input + resposta).
 * LÓGICA PURA — sem IA.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * @class Cycle
 * Um ciclo completo = mensagem do usuário + resposta da IA.
 * A memória é atualizada a cada ciclo COMPLETO, não a cada mensagem individual.
 */
class Cycle {
  /**
   * @param {string} userInput - Mensagem do usuário
   * @param {string} aiResponse - Resposta da IA
   * @param {string} [timestamp] - ISO timestamp (auto-gerado se omitido)
   */
  constructor(userInput, aiResponse, timestamp = null) {
    this.id = uuidv4();
    this.userInput = userInput;
    this.aiResponse = aiResponse;
    this.timestamp = timestamp || new Date().toISOString();
  }

  /**
   * Serializa o ciclo para armazenamento.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      userInput: this.userInput,
      aiResponse: this.aiResponse,
      timestamp: this.timestamp,
    };
  }

  /**
   * Reconstrói um Cycle a partir de dados armazenados.
   * @param {Object} data
   * @returns {Cycle}
   */
  static fromJSON(data) {
    const cycle = new Cycle(data.userInput, data.aiResponse, data.timestamp);
    cycle.id = data.id;
    return cycle;
  }
}

module.exports = Cycle;
