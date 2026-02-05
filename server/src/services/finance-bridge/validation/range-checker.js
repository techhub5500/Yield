const { ValidationError } = require('../../../utils/error-handler');

/**
 * Verificador de Range
 * 
 * Valida se valores estão dentro de limites aceitáveis
 */
class RangeChecker {
  
  /**
   * Valida ranges de valores
   */
  validate(data, rules = {}) {
    const errors = [];

    // Validações padrão se não especificadas
    const defaultRules = {
      amount: { min: 0, max: 1000000000 },
      limit: { min: 1, max: 1000 },
      skip: { min: 0, max: 1000000 },
      date: { maxPastYears: 10, maxFutureDays: 1 }
    };

    const finalRules = { ...defaultRules, ...rules };

    for (const [field, rule] of Object.entries(finalRules)) {
      const value = data[field];

      // Se o campo não existe, pular
      if (value === undefined || value === null) {
        continue;
      }

      // Validar amount
      if (field === 'amount') {
        const error = this.validateAmount(value, rule);
        if (error) errors.push({ field, ...error });
      }

      // Validar date
      if (field === 'date') {
        const error = this.validateDate(value, rule);
        if (error) errors.push({ field, ...error });
      }

      // Validar números com min/max
      if (typeof value === 'number' && (rule.min !== undefined || rule.max !== undefined)) {
        const error = this.validateNumber(field, value, rule);
        if (error) errors.push(error);
      }

      // Validar comprimento de strings
      if (typeof value === 'string' && (rule.minLength !== undefined || rule.maxLength !== undefined)) {
        const error = this.validateStringLength(field, value, rule);
        if (error) errors.push(error);
      }

      // Validar tamanho de arrays
      if (Array.isArray(value) && (rule.minItems !== undefined || rule.maxItems !== undefined)) {
        const error = this.validateArrayLength(field, value, rule);
        if (error) errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Valores fora do range permitido', errors);
    }

    return true;
  }

  /**
   * Valida valor monetário
   */
  validateAmount(value, rule) {
    if (typeof value !== 'number') {
      return {
        message: 'Valor deve ser um número',
        received: typeof value
      };
    }

    if (isNaN(value) || !isFinite(value)) {
      return {
        message: 'Valor deve ser um número válido',
        received: value
      };
    }

    if (value < (rule.min || 0)) {
      return {
        message: `Valor não pode ser negativo`,
        min: rule.min || 0,
        received: value
      };
    }

    if (value > (rule.max || 1000000000)) {
      return {
        message: `Valor máximo permitido é ${rule.max || 1000000000}`,
        max: rule.max || 1000000000,
        received: value
      };
    }

    // Validar casas decimais (máximo 2)
    const decimals = (value.toString().split('.')[1] || '').length;
    if (decimals > 2) {
      return {
        message: 'Valor não pode ter mais de 2 casas decimais',
        received: decimals
      };
    }

    return null;
  }

  /**
   * Valida data
   */
  validateDate(value, rule) {
    const date = new Date(value);

    if (isNaN(date.getTime())) {
      return {
        message: 'Data inválida',
        received: value
      };
    }

    const now = new Date();

    // Validar data no passado
    if (rule.maxPastYears) {
      const maxPastDate = new Date();
      maxPastDate.setFullYear(maxPastDate.getFullYear() - rule.maxPastYears);
      
      if (date < maxPastDate) {
        return {
          message: `Data não pode ser mais de ${rule.maxPastYears} anos no passado`,
          max_past_years: rule.maxPastYears,
          received: date.toISOString()
        };
      }
    }

    // Validar data no futuro
    if (rule.maxFutureDays !== undefined) {
      const maxFutureDate = new Date();
      maxFutureDate.setDate(maxFutureDate.getDate() + rule.maxFutureDays);
      
      if (date > maxFutureDate) {
        return {
          message: `Data não pode ser mais de ${rule.maxFutureDays} dia(s) no futuro`,
          max_future_days: rule.maxFutureDays,
          received: date.toISOString()
        };
      }
    }

    return null;
  }

  /**
   * Valida número genérico
   */
  validateNumber(field, value, rule) {
    if (rule.min !== undefined && value < rule.min) {
      return {
        field,
        message: `Valor mínimo é ${rule.min}`,
        min: rule.min,
        received: value
      };
    }

    if (rule.max !== undefined && value > rule.max) {
      return {
        field,
        message: `Valor máximo é ${rule.max}`,
        max: rule.max,
        received: value
      };
    }

    return null;
  }

  /**
   * Valida comprimento de string
   */
  validateStringLength(field, value, rule) {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return {
        field,
        message: `Comprimento mínimo é ${rule.minLength}`,
        min_length: rule.minLength,
        received: value.length
      };
    }

    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return {
        field,
        message: `Comprimento máximo é ${rule.maxLength}`,
        max_length: rule.maxLength,
        received: value.length
      };
    }

    return null;
  }

  /**
   * Valida tamanho de array
   */
  validateArrayLength(field, value, rule) {
    if (rule.minItems !== undefined && value.length < rule.minItems) {
      return {
        field,
        message: `Deve ter no mínimo ${rule.minItems} item(ns)`,
        min_items: rule.minItems,
        received: value.length
      };
    }

    if (rule.maxItems !== undefined && value.length > rule.maxItems) {
      return {
        field,
        message: `Deve ter no máximo ${rule.maxItems} item(ns)`,
        max_items: rule.maxItems,
        received: value.length
      };
    }

    return null;
  }

  /**
   * Valida range de datas
   */
  validateDateRange(start, end) {
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new ValidationError('Datas inválidas no range');
    }

    if (startDate > endDate) {
      throw new ValidationError(
        'Data inicial não pode ser maior que data final',
        { start, end }
      );
    }

    // Validar que o range não seja muito grande (máximo 5 anos)
    const maxRange = 5 * 365 * 24 * 60 * 60 * 1000; // 5 anos em ms
    const diff = endDate - startDate;

    if (diff > maxRange) {
      throw new ValidationError(
        'Range de datas não pode exceder 5 anos',
        { start, end }
      );
    }

    return true;
  }
}

module.exports = new RangeChecker();
