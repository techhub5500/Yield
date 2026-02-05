const axios = require('axios');
const memoryConfig = require('../../../config/memory-config');
const logger = require('../../../utils/logger');
const { AppError, ERROR_CODES } = require('../../../utils/error-handler');

/**
 * Integração com GPT-5 Nano para resumos de memória
 * Transforma ciclos completos em resumos concisos
 */
class MemorySummarizer {
  constructor() {
    this.apiUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
    this.apiKey = process.env.OPENAI_API_KEY;
    this.model = memoryConfig.summarizer.model;
    this.timeout = memoryConfig.summarizer.timeout;
    this.maxRetries = memoryConfig.summarizer.maxRetries;
    this.maxSummaryWords = memoryConfig.summarizer.maxSummaryWords;
    this.maxCompressedWords = memoryConfig.summarizer.maxCompressedWords;
  }

  /**
   * Prompt de sistema para resumo de ciclos
   */
  getSummarySystemPrompt() {
    return `Você é um assistente de resumo para um sistema financeiro.

TAREFA: Resumir a conversa abaixo de forma concisa, preservando:
- Todos os valores numéricos (R$ X, porcentagens, quantidades)
- Todas as datas mencionadas
- Decisões importantes tomadas
- Contexto essencial para continuidade

REGRAS:
- Seja extremamente conciso (máximo ${this.maxSummaryWords} palavras)
- Use linguagem direta e objetiva
- Não adicione interpretações
- Preserve números exatamente como mencionados

FORMATO DE SAÍDA (JSON válido):
{
  "summary": "resumo aqui",
  "preserved_data": {
    "numerical_values": [],
    "dates": [],
    "decisions": [],
    "essential_context": ""
  }
}

Responda APENAS com o JSON, sem texto adicional.`;
  }

  /**
   * Prompt de sistema para compressão adicional
   */
  getCompressionSystemPrompt() {
    return `Você é um assistente de compressão extrema para um sistema de memória.

TAREFA: Comprimir o resumo abaixo ao MÁXIMO possível, mantendo apenas:
- Valores numéricos exatos
- Datas específicas
- Decisões finais

REGRAS:
- Máximo de ${this.maxCompressedWords} palavras
- Use abreviações se necessário
- Remova qualquer contexto não essencial
- Preserve TODOS os números e datas

FORMATO DE SAÍDA (JSON válido):
{
  "compressed_summary": "texto ultra-comprimido",
  "preserved_values": []
}

Responda APENAS com o JSON, sem texto adicional.`;
  }

  /**
   * Resume um ciclo completo
   * @param {Object} cycle - Ciclo com user_message e ai_response
   * @returns {Promise<Object>} Resumo e dados preservados
   */
  async summarizeCycle(cycle) {
    const startTime = Date.now();
    
    if (!this.apiKey) {
      logger.warn('API Key não configurada, retornando resumo simplificado');
      return this.createFallbackSummary(cycle);
    }

    try {
      const userContent = `CONVERSA:
[Mensagem do Usuário]: ${cycle.user_message}
[Resposta da IA]: ${cycle.ai_response}`;

      const payload = {
        model: this.model,
        messages: [
          { role: 'system', content: this.getSummarySystemPrompt() },
          { role: 'user', content: userContent }
        ],
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: "json_object" }
      };

      const response = await this.makeRequest(payload);
      const result = this.parseResponse(response);

      const duration = Date.now() - startTime;
      logger.logOperation('MemorySummarizer.summarizeCycle', duration, true, {
        cycleId: cycle.cycle_id,
        originalWords: cycle.word_count,
        summaryWords: this.countWords(result.summary)
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('MemorySummarizer.summarizeCycle', duration, false, {
        cycleId: cycle.cycle_id,
        error: error.message
      });

      // Retorna resumo de fallback em caso de erro
      return this.createFallbackSummary(cycle);
    }
  }

  /**
   * Comprime um resumo existente ainda mais
   * @param {string} currentSummary - Resumo atual
   * @param {Object} preservedData - Dados já preservados
   * @returns {Promise<Object>} Resumo ultra-comprimido
   */
  async compressFurther(currentSummary, preservedData = {}) {
    const startTime = Date.now();

    if (!this.apiKey) {
      logger.warn('API Key não configurada, retornando resumo truncado');
      return this.createTruncatedSummary(currentSummary);
    }

    try {
      const userContent = `RESUMO ATUAL:
${currentSummary}

DADOS JÁ PRESERVADOS SEPARADAMENTE:
${JSON.stringify(preservedData, null, 2)}`;

      const payload = {
        model: this.model,
        messages: [
          { role: 'system', content: this.getCompressionSystemPrompt() },
          { role: 'user', content: userContent }
        ],
        temperature: 0.1,
        max_tokens: 150,
        response_format: { type: "json_object" }
      };

      const response = await this.makeRequest(payload);
      const result = this.parseCompressionResponse(response);

      const duration = Date.now() - startTime;
      logger.logOperation('MemorySummarizer.compressFurther', duration, true, {
        originalWords: this.countWords(currentSummary),
        compressedWords: this.countWords(result.compressed_summary)
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('MemorySummarizer.compressFurther', duration, false, {
        error: error.message
      });

      return this.createTruncatedSummary(currentSummary);
    }
  }

  /**
   * Faz requisição à API
   * @param {Object} payload - Payload da requisição
   * @returns {Promise<Object>} Resposta da API
   */
  async makeRequest(payload) {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.post(this.apiUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: this.timeout
        });

        return response.data;

      } catch (error) {
        lastError = error;

        if (error.response?.status === 401) {
          throw new AppError(ERROR_CODES.UNAUTHORIZED, 'API Key inválida');
        }

        if (error.response?.status >= 500) {
          logger.warn(`Tentativa ${attempt + 1} falhou, retentando...`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Parseia resposta de resumo
   * @param {Object} response - Resposta da API
   * @returns {Object} Resumo parseado
   */
  parseResponse(response) {
    try {
      const content = response.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('Resposta vazia da API');
      }

      const parsed = JSON.parse(content);

      return {
        summary: parsed.summary || '',
        preserved_data: {
          numerical_values: parsed.preserved_data?.numerical_values || [],
          dates: parsed.preserved_data?.dates || [],
          decisions: parsed.preserved_data?.decisions || [],
          essential_context: parsed.preserved_data?.essential_context || ''
        }
      };

    } catch (error) {
      logger.error('Falha ao parsear resposta de resumo', error);
      throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Falha ao processar resumo');
    }
  }

  /**
   * Parseia resposta de compressão
   * @param {Object} response - Resposta da API
   * @returns {Object} Compressão parseada
   */
  parseCompressionResponse(response) {
    try {
      const content = response.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('Resposta vazia da API');
      }

      const parsed = JSON.parse(content);

      return {
        compressed_summary: parsed.compressed_summary || '',
        preserved_values: parsed.preserved_values || []
      };

    } catch (error) {
      logger.error('Falha ao parsear resposta de compressão', error);
      throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Falha ao processar compressão');
    }
  }

  /**
   * Cria resumo de fallback (quando API falha)
   * @param {Object} cycle - Ciclo original
   * @returns {Object} Resumo simplificado
   */
  createFallbackSummary(cycle) {
    // Extrai primeiras palavras de cada mensagem
    const userStart = this.getFirstWords(cycle.user_message, 15);
    const aiStart = this.getFirstWords(cycle.ai_response, 20);

    // Extrai números e datas com regex
    const numbers = this.extractNumbers(cycle.user_message + ' ' + cycle.ai_response);
    const dates = this.extractDates(cycle.user_message + ' ' + cycle.ai_response);

    const summary = `Usuário: "${userStart}..." Assistente: "${aiStart}..."`;

    logger.warn('Usando resumo de fallback', {
      cycleId: cycle.cycle_id,
      summaryLength: this.countWords(summary)
    });

    return {
      summary,
      preserved_data: {
        numerical_values: numbers,
        dates: dates,
        decisions: [],
        essential_context: ''
      }
    };
  }

  /**
   * Cria resumo truncado (para compressão de fallback)
   * @param {string} text - Texto original
   * @returns {Object} Resumo truncado
   */
  createTruncatedSummary(text) {
    const words = text.split(/\s+/);
    const truncated = words.slice(0, this.maxCompressedWords).join(' ');

    return {
      compressed_summary: truncated + (words.length > this.maxCompressedWords ? '...' : ''),
      preserved_values: this.extractNumbers(text)
    };
  }

  /**
   * Conta palavras em um texto
   * @param {string} text - Texto
   * @returns {number} Quantidade de palavras
   */
  countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  /**
   * Obtém primeiras N palavras
   * @param {string} text - Texto
   * @param {number} n - Quantidade de palavras
   * @returns {string} Primeiras palavras
   */
  getFirstWords(text, n) {
    if (!text) return '';
    return text.trim().split(/\s+/).slice(0, n).join(' ');
  }

  /**
   * Extrai números do texto
   * @param {string} text - Texto
   * @returns {Array} Números encontrados
   */
  extractNumbers(text) {
    if (!text) return [];
    
    // Regex para valores monetários e números
    const patterns = [
      /R\$\s*[\d.,]+/g,           // R$ 1.234,56
      /[\d.,]+\s*%/g,             // 12,5%
      /\d+(?:[.,]\d+)?/g          // Números simples
    ];

    const numbers = new Set();
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(m => numbers.add(m.trim()));
      }
    }

    return Array.from(numbers).slice(0, 10); // Limita a 10 valores
  }

  /**
   * Extrai datas do texto
   * @param {string} text - Texto
   * @returns {Array} Datas encontradas
   */
  extractDates(text) {
    if (!text) return [];
    
    const patterns = [
      /\d{1,2}\/\d{1,2}\/\d{2,4}/g,                    // 25/12/2026
      /\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/gi,           // 25 de dezembro de 2026
      /\d{1,2}\s+de\s+\w+/gi,                         // 25 de dezembro
      /(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de)?\s*\d{4}/gi,
      /(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?:\/|\.)\d{2,4}/gi
    ];

    const dates = new Set();
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(m => dates.add(m.trim()));
      }
    }

    return Array.from(dates).slice(0, 5); // Limita a 5 datas
  }

  /**
   * Verifica saúde do serviço
   * @returns {Promise<Object>} Status
   */
  async healthCheck() {
    const hasApiKey = !!this.apiKey;
    
    if (!hasApiKey) {
      return {
        healthy: false,
        message: 'API Key não configurada',
        fallback_available: true
      };
    }

    try {
      const response = await axios.post(this.apiUrl, {
        model: this.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 5000
      });

      return {
        healthy: true,
        model: this.model,
        response_time: response.headers['x-response-time'] || 'N/A'
      };

    } catch (error) {
      return {
        healthy: false,
        message: error.message,
        fallback_available: true
      };
    }
  }
}

module.exports = new MemorySummarizer();
