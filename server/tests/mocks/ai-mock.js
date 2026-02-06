/**
 * @module tests/mocks/ai-mock
 * @description Mock de cliente IA para testes.
 * Simula respostas de IA com latência configurável.
 * Permite injetar respostas específicas por teste.
 * Conta chamadas para validar uso correto de modelos.
 */

const AIClient = require('../../src/utils/ai/client');

class MockAIClient extends AIClient {
  /**
   * @param {string} model - Nome do modelo mockado
   * @param {Object} [options]
   */
  constructor(model = 'mock', options = {}) {
    super(model, options);
    this._responses = [];
    this._defaultResponse = 'Mock AI response';
    this._callLog = [];
    this._latency = options.latency || 0;
  }

  /**
   * Injeta uma resposta para a próxima chamada.
   * Respostas são consumidas na ordem em que foram adicionadas (FIFO).
   * @param {string} response
   * @returns {MockAIClient} Para encadear
   */
  willRespond(response) {
    this._responses.push(response);
    return this;
  }

  /**
   * Define a resposta padrão (usada quando a fila está vazia).
   * @param {string} response
   * @returns {MockAIClient}
   */
  setDefault(response) {
    this._defaultResponse = response;
    return this;
  }

  /**
   * Retorna o log de todas as chamadas feitas.
   * @returns {Array<{systemPrompt: string, userPrompt: string, options: Object, timestamp: string}>}
   */
  getCalls() {
    return this._callLog;
  }

  /**
   * Retorna o número total de chamadas.
   * @returns {number}
   */
  getCallCount() {
    return this._callLog.length;
  }

  /**
   * Reseta o mock (limpa respostas e log).
   */
  reset() {
    this._responses = [];
    this._callLog = [];
  }

  /**
   * @override
   */
  async complete(systemPrompt, userPrompt, callOptions = {}) {
    if (this._latency > 0) {
      await new Promise(r => setTimeout(r, this._latency));
    }

    this._callLog.push({
      model: this.model,
      systemPrompt,
      userPrompt,
      options: callOptions,
      timestamp: new Date().toISOString(),
    });

    return this._responses.length > 0
      ? this._responses.shift()
      : this._defaultResponse;
  }
}

module.exports = MockAIClient;
