/**
 * @module utils/ai/client
 * @description Interface abstrata para clientes de IA.
 * Qualquer provider (OpenAI, Anthropic, etc.) deve implementar esta interface.
 * Facilita troca de providers, testes com mocks e desacoplamento.
 */

/**
 * @class AIClient
 * Contrato base para todos os clientes de IA.
 * Subclasses DEVEM implementar o método `complete`.
 */
class AIClient {
  /**
   * @param {string} model - Identificador do modelo
   * @param {Object} [options] - Opções do modelo
   * @param {string} [options.reasoning] - Nível de raciocínio: 'high' | 'medium' | 'low'
   * @param {string} [options.verbosity] - Nível de verbosidade: 'high' | 'low'
   */
  constructor(model, options = {}) {
    this.model = model;
    this.options = options;
  }

  /**
   * Envia um prompt para a IA e recebe a resposta.
   * @param {string} systemPrompt - Prompt de sistema (role: system)
   * @param {string} userPrompt - Prompt do usuário (role: user)
   * @param {Object} [callOptions] - Opções adicionais por chamada
   * @param {number} [callOptions.maxTokens] - Limite de tokens de resposta
   * @param {number} [callOptions.temperature] - Temperatura (0-1)
   * @returns {Promise<string>} Resposta da IA
   */
  async complete(systemPrompt, userPrompt, callOptions = {}) {
    throw new Error('AIClient.complete() deve ser implementado pela subclasse');
  }

  /**
   * Envia um prompt esperando resposta JSON.
   * @param {string} systemPrompt
   * @param {string} userPrompt
   * @param {Object} [callOptions]
   * @returns {Promise<Object>} Resposta parseada como JSON
   */
  async completeJSON(systemPrompt, userPrompt, callOptions = {}) {
    const response = await this.complete(systemPrompt, userPrompt, {
      ...callOptions,
      responseFormat: 'json',
    });

    try {
      return JSON.parse(response);
    } catch {
      // Tenta extrair JSON de blocos de código
      const match = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) return JSON.parse(match[1].trim());
      throw new Error(`Resposta da IA não é JSON válido: ${response.substring(0, 100)}...`);
    }
  }
}

module.exports = AIClient;
