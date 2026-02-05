const transactionRepository = require('../../../models/TransactionRepository');
const { ValidationError } = require('../../../utils/error-handler');
const logger = require('../../../utils/logger');

/**
 * Operação: DELETE (Remoção)
 * 
 * Remove uma ou mais transações do banco
 */
class DeleteOperation {
  constructor() {
    this.description = 'Remove transações do banco de dados';
  }

  /**
   * Executa a remoção
   */
  async execute(params = {}, context = {}) {
    const startTime = Date.now();

    try {
      const { id, filters, confirm } = params;

      // Exigir confirmação explícita
      if (confirm !== true) {
        throw new ValidationError(
          'Confirmação obrigatória para deletar',
          { hint: 'Adicione "confirm: true" ao payload' }
        );
      }

      let result;
      let mode = 'single';

      // Modo 1: Deletar por ID
      if (id) {
        result = await this.deleteById(id, confirm, context);
      }
      // Modo 2: Deletar por filtros (múltiplas transações)
      else if (filters) {
        result = await this.deleteByFilters(filters, confirm, context);
        mode = 'multiple';
      }
      else {
        throw new ValidationError(
          'É necessário fornecer "id" ou "filters" para deletar'
        );
      }

      const duration = Date.now() - startTime;
      
      logger.info('Deleção executada', {
        mode,
        deleted_count: mode === 'multiple' ? result.deleted_count : 1,
        duration_ms: duration
      });

      return result;

    } catch (error) {
      logger.error('Erro na operação delete', error);
      throw error;
    }
  }

  /**
   * Deleta por ID
   */
  async deleteById(id, confirm, context) {
    const result = await transactionRepository.delete(id, confirm);

    return {
      deleted: result.deleted,
      message: 'Transação deletada com sucesso'
    };
  }

  /**
   * Deleta por filtros
   */
  async deleteByFilters(filters, confirm, context) {
    // Adicionar user_id aos filtros por segurança
    filters.user_id = context.user_id;

    const result = await transactionRepository.deleteMany(filters, confirm);

    return {
      deleted_count: result.deletedCount,
      message: `${result.deletedCount} transação(ões) deletada(s)`
    };
  }
}

module.exports = new DeleteOperation();
