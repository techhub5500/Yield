const transactionRepository = require('../../../models/TransactionRepository');
const { ValidationError } = require('../../../utils/error-handler');
const logger = require('../../../utils/logger');

/**
 * Operação: UPDATE (Atualização)
 * 
 * Atualiza uma ou mais transações existentes
 */
class UpdateOperation {
  constructor() {
    this.description = 'Atualiza transações existentes';
  }

  /**
   * Executa a atualização
   */
  async execute(params = {}, context = {}) {
    const startTime = Date.now();

    try {
      const { id, filters, updates } = params;

      // Validar que há algo para atualizar
      if (!updates || Object.keys(updates).length === 0) {
        throw new ValidationError('Nenhum campo para atualizar foi fornecido');
      }

      // Impedir atualização de campos protegidos
      this.validateUpdates(updates);

      let result;
      let mode = 'single';

      // Modo 1: Atualizar por ID
      if (id) {
        result = await this.updateById(id, updates, context);
      }
      // Modo 2: Atualizar por filtros (múltiplas transações)
      else if (filters) {
        result = await this.updateByFilters(filters, updates, context);
        mode = 'multiple';
      }
      else {
        throw new ValidationError(
          'É necessário fornecer "id" ou "filters" para atualizar'
        );
      }

      const duration = Date.now() - startTime;
      
      logger.info('Atualização executada', {
        mode,
        modified_count: mode === 'multiple' ? result.modified_count : 1,
        duration_ms: duration
      });

      return result;

    } catch (error) {
      logger.error('Erro na operação update', error);
      throw error;
    }
  }

  /**
   * Atualiza por ID
   */
  async updateById(id, updates, context) {
    const transaction = await transactionRepository.update(id, updates);

    return {
      transaction,
      message: 'Transação atualizada com sucesso'
    };
  }

  /**
   * Atualiza por filtros
   */
  async updateByFilters(filters, updates, context) {
    // Adicionar user_id aos filtros por segurança
    filters.user_id = context.user_id;

    const result = await transactionRepository.updateMany(filters, updates);

    return {
      modified_count: result.modifiedCount,
      matched_count: result.matchedCount,
      message: `${result.modifiedCount} transação(ões) atualizada(s)`
    };
  }

  /**
   * Valida campos que podem ser atualizados
   */
  validateUpdates(updates) {
    // Campos protegidos que não podem ser atualizados
    const protectedFields = ['_id', 'user_id', 'created_at'];
    
    const invalid = protectedFields.filter(field => updates.hasOwnProperty(field));
    
    if (invalid.length > 0) {
      throw new ValidationError(
        'Campos protegidos não podem ser atualizados',
        { invalid_fields: invalid }
      );
    }

    // Validar tipo se fornecido
    if (updates.type && !['expense', 'income'].includes(updates.type)) {
      throw new ValidationError(
        'Tipo inválido',
        { provided: updates.type, valid: ['expense', 'income'] }
      );
    }

    // Validar amount se fornecido
    if (updates.amount !== undefined) {
      if (typeof updates.amount !== 'number' || updates.amount < 0) {
        throw new ValidationError(
          'Valor deve ser um número positivo',
          { provided: updates.amount }
        );
      }
    }

    // Validar date se fornecida
    if (updates.date) {
      const date = new Date(updates.date);
      if (isNaN(date.getTime())) {
        throw new ValidationError(
          'Data inválida',
          { provided: updates.date }
        );
      }
    }
  }
}

module.exports = new UpdateOperation();
