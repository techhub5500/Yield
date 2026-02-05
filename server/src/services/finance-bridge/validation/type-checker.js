const { ValidationError, ERROR_CODES } = require('../../../utils/error-handler');

/**
 * Validador de Tipos
 * 
 * Garante que cada campo receba o tipo de dado correto
 */
class TypeChecker {
  
  /**
   * Valida tipos de dados de um objeto
   */
  validate(data, schema) {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];

      // Verificar se é obrigatório
      if (rules.required && (value === undefined || value === null)) {
        errors.push({
          field,
          message: `Campo "${field}" é obrigatório`,
          expected: rules.type
        });
        continue;
      }

      // Se não é obrigatório e está ausente, pular
      if (!rules.required && (value === undefined || value === null)) {
        continue;
      }

      // Validar tipo
      const typeError = this.validateType(field, value, rules.type);
      if (typeError) {
        errors.push(typeError);
      }

      // Validações adicionais
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push({
          field,
          message: `Valor "${value}" não é válido`,
          expected: rules.enum,
          received: value
        });
      }

      if (rules.min !== undefined && value < rules.min) {
        errors.push({
          field,
          message: `Valor mínimo é ${rules.min}`,
          received: value
        });
      }

      if (rules.max !== undefined && value > rules.max) {
        errors.push({
          field,
          message: `Valor máximo é ${rules.max}`,
          received: value
        });
      }

      if (rules.minLength !== undefined && value.length < rules.minLength) {
        errors.push({
          field,
          message: `Tamanho mínimo é ${rules.minLength}`,
          received: value.length
        });
      }

      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        errors.push({
          field,
          message: `Tamanho máximo é ${rules.maxLength}`,
          received: value.length
        });
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Erros de validação de tipos', errors);
    }

    return true;
  }

  /**
   * Valida tipo de um valor
   */
  validateType(field, value, expectedType) {
    switch (expectedType) {
      case 'string':
        if (typeof value !== 'string') {
          return {
            field,
            message: `Deve ser uma string`,
            expected: 'string',
            received: typeof value
          };
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return {
            field,
            message: `Deve ser um número`,
            expected: 'number',
            received: typeof value
          };
        }
        break;

      case 'integer':
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          return {
            field,
            message: `Deve ser um número inteiro`,
            expected: 'integer',
            received: typeof value
          };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return {
            field,
            message: `Deve ser um booleano`,
            expected: 'boolean',
            received: typeof value
          };
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          return {
            field,
            message: `Deve ser um array`,
            expected: 'array',
            received: typeof value
          };
        }
        break;

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value) || value === null) {
          return {
            field,
            message: `Deve ser um objeto`,
            expected: 'object',
            received: typeof value
          };
        }
        break;

      case 'date':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return {
            field,
            message: `Deve ser uma data válida`,
            expected: 'date (ISO 8601)',
            received: value
          };
        }
        break;

      default:
        return {
          field,
          message: `Tipo de validação desconhecido: ${expectedType}`
        };
    }

    return null;
  }

  /**
   * Schemas predefinidos para validação
   */
  getSchemas() {
    return {
      transaction: {
        amount: { type: 'number', required: true, min: 0, max: 1000000000 },
        date: { type: 'date', required: true },
        category: { type: 'string', required: true, maxLength: 100 },
        type: { type: 'string', required: true, enum: ['expense', 'income'] },
        description: { type: 'string', required: false, maxLength: 500 },
        subcategory: { type: 'string', required: false, maxLength: 100 },
        tags: { type: 'array', required: false },
        payment_method: { type: 'string', required: false },
        merchant: { type: 'string', required: false, maxLength: 200 },
        status: { type: 'string', required: false, enum: ['pendente', 'confirmada', 'cancelada'] }
      },

      query: {
        limit: { type: 'integer', required: false, min: 1, max: 1000 },
        skip: { type: 'integer', required: false, min: 0 },
        logic: { type: 'string', required: false, enum: ['AND', 'OR'] }
      },

      aggregate: {
        operation: { type: 'string', required: true, enum: ['sum', 'avg', 'count', 'min', 'max'] },
        group_by: { type: 'string', required: false, enum: ['category', 'type', 'payment_method', 'status', 'month', 'year', 'day', 'week'] }
      },

      compare: {
        compare_type: { type: 'string', required: true, enum: ['period', 'category'] },
        metric: { type: 'string', required: false, enum: ['sum', 'avg', 'count'] }
      }
    };
  }
}

module.exports = new TypeChecker();
