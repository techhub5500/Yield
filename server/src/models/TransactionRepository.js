const Transaction = require('./Transaction');
const logger = require('../utils/logger');
const { ValidationError, DatabaseError } = require('../utils/error-handler');

/**
 * Repository para operações CRUD básicas de transações
 */
class TransactionRepository {
  
  /**
   * Criar nova transação (CREATE)
   */
  async create(data) {
    const startTime = Date.now();
    
    try {
      // Validar campos obrigatórios
      const requiredFields = ['amount', 'date', 'category', 'type', 'user_id'];
      const missingFields = requiredFields.filter(field => !data[field]);
      
      if (missingFields.length > 0) {
        throw new ValidationError(
          'Campos obrigatórios faltando', 
          { missingFields }
        );
      }

      // Criar transação
      const transaction = new Transaction(data);
      const saved = await transaction.save();
      
      const duration = Date.now() - startTime;
      logger.logOperation('Transação criada', duration, true, { id: saved._id });
      
      return saved;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('Criar transação', duration, false, { error: error.message });
      
      if (error.name === 'ValidationError') {
        throw new ValidationError(error.message, error.errors);
      }
      throw new DatabaseError('Erro ao criar transação', { original: error.message });
    }
  }

  /**
   * Buscar transações com filtros (READ)
   */
  async find(filters = {}, options = {}) {
    const startTime = Date.now();
    
    try {
      const {
        sort = { date: -1 },
        limit = 50,
        skip = 0
      } = options;

      // Validar limite
      if (limit > 1000) {
        throw new ValidationError('Limite máximo é 1000 registros');
      }

      const query = Transaction.find(filters)
        .sort(sort)
        .limit(limit)
        .skip(skip);

      const results = await query.exec();
      
      const duration = Date.now() - startTime;
      logger.logOperation('Busca de transações', duration, true, { 
        count: results.length,
        filters: Object.keys(filters).length 
      });
      
      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('Buscar transações', duration, false, { error: error.message });
      throw new DatabaseError('Erro ao buscar transações', { original: error.message });
    }
  }

  /**
   * Buscar transação por ID
   */
  async findById(id) {
    const startTime = Date.now();
    
    try {
      const transaction = await Transaction.findById(id);
      
      if (!transaction) {
        throw new ValidationError('Transação não encontrada', { id });
      }
      
      const duration = Date.now() - startTime;
      logger.logOperation('Busca por ID', duration, true, { id });
      
      return transaction;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('Buscar por ID', duration, false, { error: error.message });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Erro ao buscar transação por ID', { original: error.message });
    }
  }

  /**
   * Contar transações com filtros
   */
  async count(filters = {}) {
    try {
      return await Transaction.countDocuments(filters);
    } catch (error) {
      throw new DatabaseError('Erro ao contar transações', { original: error.message });
    }
  }

  /**
   * Atualizar transação (UPDATE)
   */
  async update(id, updates) {
    const startTime = Date.now();
    
    try {
      // Não permitir atualizar campos de sistema
      delete updates.created_at;
      delete updates._id;
      
      // Validar se existe
      const existing = await this.findById(id);
      
      if (!existing) {
        throw new ValidationError('Transação não encontrada', { id });
      }

      // Atualizar
      Object.assign(existing, updates);
      const updated = await existing.save();
      
      const duration = Date.now() - startTime;
      logger.logOperation('Transação atualizada', duration, true, { 
        id,
        fieldsUpdated: Object.keys(updates).length 
      });
      
      return updated;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('Atualizar transação', duration, false, { error: error.message });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      if (error.name === 'ValidationError') {
        throw new ValidationError(error.message, error.errors);
      }
      throw new DatabaseError('Erro ao atualizar transação', { original: error.message });
    }
  }

  /**
   * Atualizar múltiplas transações
   */
  async updateMany(filters, updates) {
    const startTime = Date.now();
    
    try {
      delete updates.created_at;
      delete updates._id;
      
      const result = await Transaction.updateMany(filters, { $set: updates });
      
      const duration = Date.now() - startTime;
      logger.logOperation('Múltiplas transações atualizadas', duration, true, { 
        modified: result.modifiedCount 
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('Atualizar múltiplas transações', duration, false, { error: error.message });
      throw new DatabaseError('Erro ao atualizar transações', { original: error.message });
    }
  }

  /**
   * Deletar transação (DELETE)
   */
  async delete(id, confirm = false) {
    const startTime = Date.now();
    
    try {
      // Exigir confirmação
      if (!confirm) {
        throw new ValidationError(
          'Confirmação obrigatória para deletar transação',
          { hint: 'Use confirm: true' }
        );
      }

      // Verificar se existe
      const existing = await this.findById(id);
      
      if (!existing) {
        throw new ValidationError('Transação não encontrada', { id });
      }

      // Deletar
      await Transaction.findByIdAndDelete(id);
      
      const duration = Date.now() - startTime;
      logger.logOperation('Transação deletada', duration, true, { id });
      
      return { success: true, id, deleted: existing };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('Deletar transação', duration, false, { error: error.message });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Erro ao deletar transação', { original: error.message });
    }
  }

  /**
   * Deletar múltiplas transações
   */
  async deleteMany(filters, confirm = false) {
    const startTime = Date.now();
    
    try {
      if (!confirm) {
        throw new ValidationError(
          'Confirmação obrigatória para deletar transações',
          { hint: 'Use confirm: true' }
        );
      }

      const result = await Transaction.deleteMany(filters);
      
      const duration = Date.now() - startTime;
      logger.logOperation('Múltiplas transações deletadas', duration, true, { 
        deleted: result.deletedCount 
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('Deletar múltiplas transações', duration, false, { error: error.message });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Erro ao deletar transações', { original: error.message });
    }
  }

  /**
   * Executar agregação customizada
   */
  async aggregate(pipeline) {
    const startTime = Date.now();
    
    try {
      const results = await Transaction.aggregate(pipeline);
      
      const duration = Date.now() - startTime;
      logger.logOperation('Agregação executada', duration, true, { 
        stages: pipeline.length,
        results: results.length 
      });
      
      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logOperation('Agregação', duration, false, { error: error.message });
      throw new DatabaseError('Erro na agregação', { original: error.message });
    }
  }
}

module.exports = new TransactionRepository();
