/**
 * @module tools/finance-bridge/validators
 * @description Validadores para o Finance Bridge.
 * Validação de tipos, ranges, campos obrigatórios e sanitização.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 */

const logger = require('../../utils/logger');

/**
 * Valida uma query JSON do Finance Bridge.
 * @param {Object} queryJson - JSON da query
 * @returns {{ valid: boolean, errors: string[], sanitized: Object }}
 */
function validateQuery(queryJson) {
  const errors = [];

  if (!queryJson || typeof queryJson !== 'object') {
    return { valid: false, errors: ['Query não é um objeto válido'], sanitized: null };
  }

  // Validar operação
  if (queryJson.operation !== 'query') {
    errors.push(`Operação inválida: "${queryJson.operation}". Esperado: "query"`);
  }

  // Validar params
  if (!queryJson.params || typeof queryJson.params !== 'object') {
    errors.push('Campo "params" ausente ou inválido');
    return { valid: false, errors, sanitized: null };
  }

  const params = queryJson.params;

  // Validar filtros de período
  if (params.filters && params.filters.period) {
    const period = params.filters.period;
    if (period.start && !isValidDate(period.start)) {
      errors.push(`Data de início inválida: "${period.start}". Formato esperado: YYYY-MM-DD`);
    }
    if (period.end && !isValidDate(period.end)) {
      errors.push(`Data de fim inválida: "${period.end}". Formato esperado: YYYY-MM-DD`);
    }
    if (period.start && period.end && period.start > period.end) {
      errors.push('Data de início é posterior à data de fim');
    }
  }

  // Validar filtros de valor
  if (params.filters && params.filters.amount) {
    const amount = params.filters.amount;
    if (amount.min !== undefined && (typeof amount.min !== 'number' || amount.min < 0)) {
      errors.push(`Valor mínimo inválido: "${amount.min}"`);
    }
    if (amount.max !== undefined && (typeof amount.max !== 'number' || amount.max < 0)) {
      errors.push(`Valor máximo inválido: "${amount.max}"`);
    }
    if (amount.min !== undefined && amount.max !== undefined && amount.min > amount.max) {
      errors.push('Valor mínimo é maior que valor máximo');
    }
  }

  // Validar categorias (sanitização)
  if (params.filters && params.filters.categories) {
    if (!Array.isArray(params.filters.categories)) {
      errors.push('Campo "categories" deve ser um array');
    } else {
      params.filters.categories = params.filters.categories
        .filter(c => typeof c === 'string')
        .map(c => sanitizeString(c))
        .filter(c => c.length > 0);

      if (params.filters.categories.length === 0) {
        delete params.filters.categories;
      }
    }
  }

  // Validar tipo (expense | income)
  if (params.filters && params.filters.type !== undefined) {
    if (!['expense', 'income'].includes(params.filters.type)) {
      errors.push(`Tipo inválido: "${params.filters.type}". Esperado: "expense" ou "income"`);
    }
  }

  // Validar lógica booleana
  if (params.logic && !['AND', 'OR', 'NOT'].includes(params.logic)) {
    errors.push(`Lógica inválida: "${params.logic}". Esperado: AND, OR, NOT`);
  }

  // Validar sort
  if (params.sort) {
    const validFields = ['date', 'amount', 'category'];
    const validOrders = ['asc', 'desc'];
    if (params.sort.field && !validFields.includes(params.sort.field)) {
      errors.push(`Campo de ordenação inválido: "${params.sort.field}"`);
    }
    if (params.sort.order && !validOrders.includes(params.sort.order)) {
      errors.push(`Ordem inválida: "${params.sort.order}"`);
    }
  }

  // Validar limit
  if (params.limit !== undefined) {
    if (typeof params.limit !== 'number' || params.limit < 1 || params.limit > 1000) {
      errors.push(`Limite inválido: "${params.limit}". Deve ser entre 1 e 1000`);
    }
  }

  if (errors.length > 0) {
    logger.logic('WARN', 'FinanceBridgeValidator', `Validação de query falhou: ${errors.join('; ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? queryJson : null,
  };
}

/**
 * Valida um JSON de insert do Finance Bridge.
 * @param {Object} insertJson - JSON do insert
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateInsert(insertJson) {
  const errors = [];

  if (!insertJson || typeof insertJson !== 'object') {
    return { valid: false, errors: ['Insert não é um objeto válido'] };
  }

  const params = insertJson.params || insertJson;

  // Campos obrigatórios
  if (params.amount === undefined || typeof params.amount !== 'number' || params.amount <= 0) {
    errors.push(`Valor inválido: "${params.amount}". Deve ser um número positivo`);
  }

  if (!params.date || !isValidDate(params.date)) {
    errors.push(`Data inválida: "${params.date}". Formato esperado: YYYY-MM-DD`);
  }

  if (!params.category || typeof params.category !== 'string') {
    errors.push('Campo "category" ausente ou inválido');
  }

  // Validar tipo
  if (params.type && !['expense', 'income'].includes(params.type)) {
    errors.push(`Tipo inválido: "${params.type}". Esperado: "expense" ou "income"`);
  }

  // Sanitização de strings
  if (params.description) {
    params.description = sanitizeString(params.description);
  }
  if (params.category) {
    params.category = sanitizeString(params.category);
  }
  if (params.subcategory) {
    params.subcategory = sanitizeString(params.subcategory);
  }

  // Validação de data futura para despesas
  if (params.type === 'expense' && params.date) {
    const transactionDate = new Date(params.date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    if (transactionDate >= tomorrow) {
      errors.push('Data futura não é permitida para despesas normais');
    }
  }

  if (errors.length > 0) {
    logger.logic('WARN', 'FinanceBridgeValidator', `Validação de insert falhou: ${errors.join('; ')}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Verifica se uma string é uma data válida ISO 8601 (YYYY-MM-DD).
 * @param {string} dateStr
 * @returns {boolean}
 */
function isValidDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr + 'T00:00:00Z');
  return !isNaN(date.getTime());
}

/**
 * Sanitiza uma string para prevenir injection.
 * @param {string} str
 * @returns {string}
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  // Remove caracteres potencialmente perigosos
  return str
    .replace(/[${}]/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .substring(0, 500); // Limite de tamanho
}

module.exports = {
  validateQuery,
  validateInsert,
  isValidDate,
  sanitizeString,
};
