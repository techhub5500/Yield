const queryOperation = require('./operations/query');
const insertOperation = require('./operations/insert');
const updateOperation = require('./operations/update');
const deleteOperation = require('./operations/delete');
const aggregateOperation = require('./operations/aggregate');
const compareOperation = require('./operations/compare');
const logger = require('../../utils/logger');
const strategicLogger = require('../../utils/strategic-logger');
const { ErrorHandler, OperationNotFoundError, ValidationError } = require('../../utils/error-handler');

/**
 * Finance Bridge - Middleware entre agentes de IA e banco de dados
 * 
 * Este serviço recebe requisições estruturadas em JSON e executa
 * operações no banco de dados de forma segura e validada.
 */
class FinanceBridge {
  constructor() {
    // Mapeamento de operações disponíveis
    this.operations = {
      query: queryOperation,
      insert: insertOperation,
      update: updateOperation,
      delete: deleteOperation,
      aggregate: aggregateOperation,
      compare: compareOperation
    };
  }

  /**
   * Processa uma requisição
   * 
   * @param {Object} payload - Payload da requisição
   * @param {string} payload.operation - Tipo de operação (query, insert, update, delete, aggregate, compare)
   * @param {Object} payload.params - Parâmetros da operação
   * @param {Object} payload.context - Contexto do usuário (user_id, timezone, currency)
   * @returns {Object} Resultado da operação
   */
  async process(payload) {
    const startTime = Date.now();
    
    try {
      // Validar estrutura básica do payload
      this.validatePayload(payload);

      const { operation, params, context } = payload;

      logger.info(`Finance Bridge processando operação: ${operation}`, {
        user_id: context?.user_id,
        operation
      });

      // Verificar se a operação existe
      if (!this.operations[operation]) {
        throw new OperationNotFoundError(operation);
      }

      // Executar operação
      const handler = this.operations[operation];
      const result = await handler.execute(params, context);

      // Calcular tempo de execução
      const executionTime = Date.now() - startTime;

      logger.info(`Operação ${operation} concluída com sucesso`, {
        execution_time_ms: executionTime,
        user_id: context?.user_id
      });

      // Log estratégico da operação
      await strategicLogger.bridgeOperation(operation, true, executionTime, {
        userId: context?.user_id,
        resultsCount: Array.isArray(result) ? result.length : result?.data?.length
      });

      // Retornar resultado formatado
      return {
        success: true,
        data: result,
        metadata: {
          operation,
          execution_time_ms: executionTime,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error(`Erro ao processar operação`, {
        execution_time_ms: executionTime,
        error: error.message,
        operation: payload?.operation
      });

      // Log estratégico de erro
      await strategicLogger.bridgeOperation(payload?.operation || 'unknown', false, executionTime, {
        error: error.message
      });

      // Retornar erro formatado
      return ErrorHandler.handle(error);
    }
  }

  /**
   * Valida estrutura básica do payload
   */
  validatePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new ValidationError('Payload inválido: deve ser um objeto');
    }

    if (!payload.operation) {
      throw new ValidationError('Campo "operation" é obrigatório');
    }

    if (typeof payload.operation !== 'string') {
      throw new ValidationError('Campo "operation" deve ser uma string');
    }

    if (!payload.context || !payload.context.user_id) {
      throw new ValidationError('Campo "context.user_id" é obrigatório');
    }

    // Params é opcional, mas se fornecido deve ser objeto
    if (payload.params !== undefined && typeof payload.params !== 'object') {
      throw new ValidationError('Campo "params" deve ser um objeto');
    }
  }

  /**
   * Lista operações disponíveis
   */
  getAvailableOperations() {
    return Object.keys(this.operations).map(op => ({
      name: op,
      description: this.operations[op].description || 'Sem descrição'
    }));
  }

  /**
   * Verifica saúde do serviço
   */
  async healthCheck() {
    return {
      status: 'healthy',
      operations: Object.keys(this.operations),
      timestamp: new Date().toISOString()
    };
  }
}

// Exportar instância singleton
const financeBridge = new FinanceBridge();

module.exports = financeBridge;
