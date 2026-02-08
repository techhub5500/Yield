/**
 * @module utils/ai/openai-client
 * @description Implementação do cliente OpenAI.
 * Suporte para GPT-5.2, GPT-5-mini, GPT-5-nano (com placeholders atuais).
 * Inclui retry com exponential backoff e rate limiting awareness.
 */

const { OpenAI } = require('openai');
const AIClient = require('./client');
const config = require('../../config');
const logger = require('../logger');

/**
 * @class OpenAIClient
 * @extends AIClient
 */
class OpenAIClient extends AIClient {
  /**
   * @param {string} model - Nome do modelo (chave de config.models ou nome direto)
   * @param {Object} [options]
   * @param {string} [options.reasoning] - 'high' | 'medium' | 'low'
   * @param {string} [options.verbosity] - 'high' | 'low'
   */
  constructor(model, options = {}) {
    // Resolver nome do modelo via config
    const resolvedModel = config.models[model] || model;
    super(resolvedModel, options);

    this._openai = new OpenAI({ apiKey: config.openai.apiKey });
    this._maxRetries = config.timeouts.aiRetry.maxRetries;
    this._baseDelay = config.timeouts.aiRetry.baseDelay;
  }

  /**
   * Envia um prompt para a OpenAI e recebe a resposta.
   * Inclui retry com exponential backoff.
   * @param {string} systemPrompt
   * @param {string} userPrompt
   * @param {Object} [callOptions]
   * @returns {Promise<string>}
   */
  async complete(systemPrompt, userPrompt, callOptions = {}) {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const requestParams = {
      model: this.model,
      messages,
    };

    // Max tokens
    if (callOptions.max_completion_tokens) {
      requestParams.max_completion_tokens = callOptions.max_completion_tokens;
    }

  

    // Response format JSON
    if (callOptions.responseFormat === 'json') {
      requestParams.response_format = { type: 'json_object' };
    }

    // Retry loop com exponential backoff
    for (let attempt = 1; attempt <= this._maxRetries; attempt++) {
      try {
        const response = await this._openai.chat.completions.create(requestParams);
        const content = response.choices[0]?.message?.content || '';

        logger.ai('DEBUG', 'OpenAIClient', `Resposta recebida do modelo ${this.model}`, {
          tokens: response.usage?.total_tokens,
          attempt,
        });

        return content;
      } catch (error) {
        const isRetryable = error.status === 429 || error.status >= 500;

        if (isRetryable && attempt < this._maxRetries) {
          const delay = this._baseDelay * Math.pow(2, attempt - 1);
          logger.warn('OpenAIClient', 'ai', `Retry ${attempt}/${this._maxRetries} para ${this.model} em ${delay}ms`, {
            status: error.status,
            error: error.message,
          });
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        logger.error('OpenAIClient', 'ai', `Falha definitiva ao chamar ${this.model}`, {
          attempt,
          status: error.status,
          error: error.message,
        });
        throw error;
      }
    }
  }
}

module.exports = OpenAIClient;
