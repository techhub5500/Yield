const transactionRepository = require('../../../models/TransactionRepository');
const { ValidationError } = require('../../../utils/error-handler');
const logger = require('../../../utils/logger');

/**
 * Operação: INSERT (Inserção)
 * 
 * Cria nova transação no banco de dados
 */
class InsertOperation {
  constructor() {
    this.description = 'Cria uma nova transação financeira';
  }

  /**
   * Executa a inserção
   */
  async execute(params = {}, context = {}) {
    const startTime = Date.now();

    try {
      // Validar campos obrigatórios
      this.validateRequiredFields(params);

      // Preparar dados da transação
      const transactionData = {
        amount: params.amount,
        date: new Date(params.date),
        category: params.category,
        type: params.type,
        user_id: context.user_id
      };

      // Adicionar campos opcionais se fornecidos
      if (params.description) transactionData.description = params.description;
      if (params.subcategory) transactionData.subcategory = params.subcategory;
      if (params.tags) transactionData.tags = params.tags;
      if (params.payment_method) transactionData.payment_method = params.payment_method;
      if (params.merchant) transactionData.merchant = params.merchant;
      if (params.status) transactionData.status = params.status;

      // Criar transação
      const transaction = await transactionRepository.create(transactionData);

      const duration = Date.now() - startTime;
      
      logger.info('Transação inserida', {
        transaction_id: transaction._id,
        amount: transaction.amount,
        type: transaction.type,
        duration_ms: duration
      });

      return {
        transaction,
        message: 'Transação criada com sucesso'
      };

    } catch (error) {
      logger.error('Erro na operação insert', error);
      throw error;
    }
  }

  /**
   * Valida campos obrigatórios
   */
  validateRequiredFields(params) {
    const required = ['amount', 'date', 'category', 'type'];
    const missing = required.filter(field => !params[field]);

    if (missing.length > 0) {
      throw new ValidationError(
        'Campos obrigatórios faltando',
        { missing_fields: missing }
      );
    }

    // Validar tipo
    if (!['expense', 'income'].includes(params.type)) {
      throw new ValidationError(
        'Tipo inválido',
        { provided: params.type, valid: ['expense', 'income'] }
      );
    }

    // Validar amount
    if (typeof params.amount !== 'number' || params.amount < 0) {
      throw new ValidationError(
        'Valor deve ser um número positivo',
        { provided: params.amount }
      );
    }

    // Validar date
    const date = new Date(params.date);
    if (isNaN(date.getTime())) {
      throw new ValidationError(
        'Data inválida',
        { provided: params.date }
      );
    }
  }
}

module.exports = new InsertOperation();
