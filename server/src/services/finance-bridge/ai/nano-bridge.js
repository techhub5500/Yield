const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../../utils/logger');
const { ValidationError, AppError, ERROR_CODES } = require('../../../utils/error-handler');

/**
 * Integração com GPT-5 Nano
 * 
 * Transforma texto em linguagem natural para JSON estruturado
 */
class NanoBridge {
  constructor() {
    this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    this.apiKey = process.env.OPENAI_API_KEY;
    this.model = 'gpt-4o-mini'; // Modelo padrão - pode mudar para gpt-5-nano quando disponível
    this.systemPrompt = null;
    this.maxRetries = 1;
    this.timeout = 10000; // 10 segundos
  }

  /**
   * Carrega o prompt de sistema
   */
  async loadSystemPrompt() {
    if (this.systemPrompt) {
      return this.systemPrompt;
    }

    try {
      const promptPath = path.join(__dirname, 'prompts', 'query-builder.txt');
      this.systemPrompt = await fs.readFile(promptPath, 'utf-8');
      return this.systemPrompt;
    } catch (error) {
      logger.error('Erro ao carregar prompt de sistema', error);
      throw new AppError(
        ERROR_CODES.INTERNAL_ERROR,
        'Falha ao carregar configuração do assistente'
      );
    }
  }

  /**
   * Transforma texto em JSON
   * 
   * @param {string} naturalLanguageQuery - Pedido em linguagem natural
   * @param {Object} context - Contexto adicional (user_id, timezone, etc)
   * @returns {Object} JSON estruturado
   */
  async transformToJSON(naturalLanguageQuery, context = {}) {
    const startTime = Date.now();

    try {
      // Carregar prompt de sistema
      const systemPrompt = await this.loadSystemPrompt();

      // Preparar payload para a API
      const payload = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: naturalLanguageQuery
          }
        ],
        temperature: 0.1, // Baixa criatividade, respostas mais determinísticas
        max_tokens: 1000,
        response_format: { type: "json_object" } // Forçar JSON (se suportado)
      };

      logger.info('Enviando pedido para GPT-5 Nano', {
        query_length: naturalLanguageQuery.length
      });

      // Fazer requisição
      const response = await this.makeRequest(payload);

      // Extrair e validar JSON
      const json = this.extractJSON(response);

      // Adicionar contexto ao JSON
      if (!json.context) {
        json.context = {};
      }
      json.context.user_id = context.user_id;
      json.context.user_timezone = context.user_timezone || 'UTC';
      json.context.currency = context.currency || 'BRL';

      const duration = Date.now() - startTime;
      
      logger.info('JSON gerado com sucesso', {
        operation: json.operation,
        duration_ms: duration
      });

      return json;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Erro ao transformar texto em JSON', {
        duration_ms: duration,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Faz requisição para a API
   */
  async makeRequest(payload, attempt = 1) {
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
      // Timeout
      if (error.code === 'ECONNABORTED') {
        throw new AppError(
          ERROR_CODES.TIMEOUT,
          'Timeout ao processar pedido'
        );
      }

      // Erro de autenticação
      if (error.response?.status === 401) {
        throw new AppError(
          ERROR_CODES.UNAUTHORIZED,
          'API key inválida ou expirada'
        );
      }

      // Retry em caso de erro temporário
      if (attempt < this.maxRetries && error.response?.status >= 500) {
        logger.warn(`Tentando novamente (${attempt + 1}/${this.maxRetries})...`);
        await this.sleep(1000 * attempt); // Backoff exponencial
        return this.makeRequest(payload, attempt + 1);
      }

      // Erro genérico da API
      throw new AppError(
        ERROR_CODES.SERVICE_UNAVAILABLE,
        'Serviço de IA indisponível',
        { original: error.message }
      );
    }
  }

  /**
   * Extrai JSON da resposta
   */
  extractJSON(response) {
    try {
      // Extrair conteúdo da mensagem
      const content = response.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Resposta vazia do modelo');
      }

      // Tentar parsear diretamente
      try {
        return JSON.parse(content);
      } catch (e) {
        // Se falhar, tentar extrair JSON de markdown
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                         content.match(/```\s*([\s\S]*?)\s*```/);
        
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1]);
        }

        throw e;
      }

    } catch (error) {
      logger.error('Erro ao parsear JSON', { error: error.message });
      throw new ValidationError(
        'Resposta do modelo não é um JSON válido',
        { raw_response: response.choices?.[0]?.message?.content }
      );
    }
  }

  /**
   * Valida estrutura básica do JSON gerado
   */
  validateJSON(json) {
    if (!json.operation) {
      throw new ValidationError('JSON gerado não possui campo "operation"');
    }

    const validOps = ['query', 'insert', 'update', 'delete', 'aggregate', 'compare'];
    if (!validOps.includes(json.operation)) {
      throw new ValidationError(
        'Operação inválida no JSON gerado',
        { operation: json.operation, valid: validOps }
      );
    }

    return true;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Verifica se a API está configurada
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.isConfigured()) {
      return {
        status: 'not_configured',
        message: 'API key não configurada'
      };
    }

    try {
      // Teste simples
      const result = await this.transformToJSON('teste', { user_id: 'test' });
      return {
        status: 'healthy',
        message: 'API funcionando corretamente'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message
      };
    }
  }
}

module.exports = new NanoBridge();
