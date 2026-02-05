const logger = require('./logger');

/**
 * Códigos de erro padronizados
 */
const ERROR_CODES = {
  // Validação
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_TYPE: 'INVALID_TYPE',
  INVALID_RANGE: 'INVALID_RANGE',
  MISSING_FIELD: 'MISSING_FIELD',
  
  // Banco de dados
  DATABASE_ERROR: 'DATABASE_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  
  // Operações
  OPERATION_NOT_FOUND: 'OPERATION_NOT_FOUND',
  OPERATION_FAILED: 'OPERATION_FAILED',
  
  // Segurança
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  MALICIOUS_INPUT: 'MALICIOUS_INPUT',
  
  // Sistema
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TIMEOUT: 'TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
};

/**
 * Classe base para erros customizados
 */
class AppError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp
      }
    };
  }
}

/**
 * Erro de validação
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(ERROR_CODES.VALIDATION_ERROR, message, details);
  }
}

/**
 * Erro de banco de dados
 */
class DatabaseError extends AppError {
  constructor(message, details = null) {
    super(ERROR_CODES.DATABASE_ERROR, message, details);
  }
}

/**
 * Erro de operação não encontrada
 */
class OperationNotFoundError extends AppError {
  constructor(operation) {
    super(
      ERROR_CODES.OPERATION_NOT_FOUND, 
      `Operação '${operation}' não existe`,
      { validOperations: ['query', 'insert', 'update', 'delete', 'aggregate', 'compare'] }
    );
  }
}

/**
 * Tratador global de erros
 */
class ErrorHandler {
  /**
   * Trata erro e retorna resposta formatada
   */
  handle(error) {
    // Log do erro
    logger.error('Erro capturado:', error);

    // Se já é um AppError, retorna formatado
    if (error instanceof AppError) {
      return error.toJSON();
    }

    // Erros do MongoDB/Mongoose
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      return new DatabaseError(error.message, { original: error.name }).toJSON();
    }

    // Erros de validação do Mongoose
    if (error.name === 'ValidationError') {
      const details = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      return new ValidationError('Erro de validação', details).toJSON();
    }

    // Erro genérico
    return new AppError(
      ERROR_CODES.INTERNAL_ERROR,
      'Erro interno do servidor',
      process.env.NODE_ENV === 'development' ? { message: error.message, stack: error.stack } : null
    ).toJSON();
  }

  /**
   * Cria resposta de erro formatada
   */
  createError(code, message, details = null) {
    return new AppError(code, message, details).toJSON();
  }
}

module.exports = {
  ErrorHandler: new ErrorHandler(),
  AppError,
  ValidationError,
  DatabaseError,
  OperationNotFoundError,
  ERROR_CODES
};
