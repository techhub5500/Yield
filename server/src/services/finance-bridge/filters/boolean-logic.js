const { ValidationError } = require('../../../utils/error-handler');

/**
 * Lógica Booleana para Filtros
 * 
 * Combina múltiplos critérios de busca usando operadores AND, OR
 */
class BooleanLogic {
  
  /**
   * Constrói query MongoDB a partir de filtros e lógica booleana
   * 
   * @param {Object} filters - Objeto com os filtros
   * @param {string} logic - Tipo de lógica: 'AND' ou 'OR' (padrão: 'AND')
   * @returns {Object} Query MongoDB
   */
  buildQuery(filters, logic = 'AND') {
    if (!filters || typeof filters !== 'object') {
      return {};
    }

    // Validar tipo de lógica
    if (!['AND', 'OR'].includes(logic.toUpperCase())) {
      throw new ValidationError(
        'Lógica deve ser "AND" ou "OR"',
        { provided: logic }
      );
    }

    const conditions = [];

    // Processar cada filtro
    for (const [key, value] of Object.entries(filters)) {
      const condition = this.processFilter(key, value);
      if (condition) {
        conditions.push(condition);
      }
    }

    // Se não houver condições, retornar query vazia
    if (conditions.length === 0) {
      return {};
    }

    // Se houver apenas uma condição, retornar diretamente
    if (conditions.length === 1) {
      return conditions[0];
    }

    // Aplicar lógica booleana
    if (logic.toUpperCase() === 'AND') {
      return { $and: conditions };
    } else {
      return { $or: conditions };
    }
  }

  /**
   * Processa um filtro individual
   */
  processFilter(key, value) {
    // Ignorar valores nulos ou undefined
    if (value === null || value === undefined) {
      return null;
    }

    // Filtros especiais
    switch (key) {
      case 'date_range':
        return this.buildDateRangeFilter(value);
      
      case 'amount_range':
        return this.buildAmountRangeFilter(value);
      
      case 'categories':
        return this.buildCategoriesFilter(value);
      
      case 'exclude_categories':
        return this.buildExcludeCategoriesFilter(value);
      
      case 'tags':
        return this.buildTagsFilter(value);
      
      case 'exclude_tags':
        return this.buildExcludeTagsFilter(value);
      
      case 'status':
        return this.buildStatusFilter(value);
      
      case 'payment_method':
        return this.buildPaymentMethodFilter(value);
      
      case 'type':
        return this.buildTypeFilter(value);
      
      case 'merchant':
        return this.buildMerchantFilter(value);
      
      case 'user_id':
        return { user_id: value };
      
      default:
        // Filtro genérico
        return { [key]: value };
    }
  }

  /**
   * Constrói filtro de data
   */
  buildDateRangeFilter(range) {
    if (!range.start && !range.end) {
      return null;
    }

    const filter = {};
    
    if (range.start) {
      filter.$gte = new Date(range.start);
    }
    
    if (range.end) {
      filter.$lte = new Date(range.end);
    }

    return { date: filter };
  }

  /**
   * Constrói filtro de valor
   */
  buildAmountRangeFilter(range) {
    if (range.min === undefined && range.max === undefined) {
      return null;
    }

    const filter = {};
    
    if (range.min !== undefined) {
      filter.$gte = range.min;
    }
    
    if (range.max !== undefined) {
      filter.$lte = range.max;
    }

    return { amount: filter };
  }

  /**
   * Constrói filtro de categorias (inclusão)
   */
  buildCategoriesFilter(categories) {
    if (!Array.isArray(categories) || categories.length === 0) {
      return null;
    }

    // Case-insensitive regex para cada categoria
    const regexes = categories.map(cat => new RegExp(`^${cat}$`, 'i'));
    
    return { category: { $in: regexes } };
  }

  /**
   * Constrói filtro de exclusão de categorias
   */
  buildExcludeCategoriesFilter(categories) {
    if (!Array.isArray(categories) || categories.length === 0) {
      return null;
    }

    const regexes = categories.map(cat => new RegExp(`^${cat}$`, 'i'));
    
    return { category: { $nin: regexes } };
  }

  /**
   * Constrói filtro de tags (inclusão)
   */
  buildTagsFilter(tags) {
    if (!Array.isArray(tags) || tags.length === 0) {
      return null;
    }

    // Todas as tags devem estar presentes
    return { tags: { $all: tags } };
  }

  /**
   * Constrói filtro de exclusão de tags
   */
  buildExcludeTagsFilter(tags) {
    if (!Array.isArray(tags) || tags.length === 0) {
      return null;
    }

    return { tags: { $nin: tags } };
  }

  /**
   * Constrói filtro de status
   */
  buildStatusFilter(status) {
    if (Array.isArray(status)) {
      return { status: { $in: status } };
    }
    return { status };
  }

  /**
   * Constrói filtro de método de pagamento
   */
  buildPaymentMethodFilter(method) {
    if (Array.isArray(method)) {
      return { payment_method: { $in: method } };
    }
    return { payment_method: method };
  }

  /**
   * Constrói filtro de tipo (expense/income)
   */
  buildTypeFilter(type) {
    if (Array.isArray(type)) {
      return { type: { $in: type } };
    }
    return { type };
  }

  /**
   * Constrói filtro de estabelecimento
   */
  buildMerchantFilter(merchant) {
    // Case-insensitive search
    return { merchant: new RegExp(merchant, 'i') };
  }

  /**
   * Adiciona filtro de exclusão (NOT) a uma query existente
   */
  addNotFilter(query, notFilters) {
    if (!notFilters || typeof notFilters !== 'object') {
      return query;
    }

    const notConditions = [];

    for (const [key, value] of Object.entries(notFilters)) {
      const condition = this.processFilter(key, value);
      if (condition) {
        // Inverter a condição usando $nor
        notConditions.push(condition);
      }
    }

    if (notConditions.length === 0) {
      return query;
    }

    // Se query já tem condições, combinar com $and
    if (Object.keys(query).length > 0) {
      return {
        $and: [
          query,
          { $nor: notConditions }
        ]
      };
    }

    return { $nor: notConditions };
  }
}

module.exports = new BooleanLogic();
