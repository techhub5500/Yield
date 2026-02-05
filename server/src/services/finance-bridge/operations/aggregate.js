const transactionRepository = require('../../../models/TransactionRepository');
const booleanLogic = require('../filters/boolean-logic');
const smartPeriods = require('../filters/smart-periods');
const { ValidationError } = require('../../../utils/error-handler');
const logger = require('../../../utils/logger');

/**
 * Operação: AGGREGATE (Cálculos)
 * 
 * Realiza cálculos matemáticos sobre grupos de transações
 */
class AggregateOperation {
  constructor() {
    this.description = 'Calcula agregações sobre transações (soma, média, contagem)';
  }

  /**
   * Executa a agregação
   */
  async execute(params = {}, context = {}) {
    const startTime = Date.now();

    try {
      const {
        operation = 'sum',
        group_by = null,
        filters = {},
        named_period = null
      } = params;

      // Validar operação
      const validOps = ['sum', 'avg', 'count', 'min', 'max'];
      if (!validOps.includes(operation)) {
        throw new ValidationError(
          'Operação de agregação inválida',
          { provided: operation, valid: validOps }
        );
      }

      // Adicionar user_id aos filtros
      filters.user_id = context.user_id;

      // Resolver período nomeado se fornecido
      if (named_period) {
        const period = await smartPeriods.resolve(
          named_period,
          context.user_timezone,
          context.user_id
        );
        
        filters.date_range = {
          start: period.start,
          end: period.end
        };
      }

      // Construir match query
      const matchQuery = booleanLogic.buildQuery(filters, 'AND');

      // Construir pipeline de agregação
      const pipeline = this.buildPipeline(operation, group_by, matchQuery);

      // Executar agregação
      const results = await transactionRepository.aggregate(pipeline);

      // Formatar resultados
      const formatted = this.formatResults(results, operation, group_by);

      const duration = Date.now() - startTime;
      
      logger.info('Agregação executada', {
        operation,
        group_by,
        results_count: results.length,
        duration_ms: duration
      });

      return formatted;

    } catch (error) {
      logger.error('Erro na operação aggregate', error);
      throw error;
    }
  }

  /**
   * Constrói pipeline de agregação MongoDB
   */
  buildPipeline(operation, groupBy, matchQuery) {
    const pipeline = [];

    // Stage 1: Match (filtrar)
    if (Object.keys(matchQuery).length > 0) {
      pipeline.push({ $match: matchQuery });
    }

    // Stage 2: Group (agrupar)
    const groupStage = {
      _id: this.getGroupExpression(groupBy)
    };

    // Adicionar operação de agregação
    switch (operation) {
      case 'sum':
        groupStage.total = { $sum: '$amount' };
        groupStage.count = { $sum: 1 };
        break;
      
      case 'avg':
        groupStage.average = { $avg: '$amount' };
        groupStage.count = { $sum: 1 };
        break;
      
      case 'count':
        groupStage.count = { $sum: 1 };
        break;
      
      case 'min':
        groupStage.minimum = { $min: '$amount' };
        groupStage.count = { $sum: 1 };
        break;
      
      case 'max':
        groupStage.maximum = { $max: '$amount' };
        groupStage.count = { $sum: 1 };
        break;
    }

    pipeline.push({ $group: groupStage });

    // Stage 3: Sort (ordenar)
    if (groupBy) {
      pipeline.push({ $sort: { _id: 1 } });
    }

    return pipeline;
  }

  /**
   * Obtém expressão de agrupamento
   */
  getGroupExpression(groupBy) {
    if (!groupBy) {
      return null; // Agrupar tudo junto
    }

    switch (groupBy) {
      case 'category':
        return '$category';
      
      case 'type':
        return '$type';
      
      case 'payment_method':
        return '$payment_method';
      
      case 'status':
        return '$status';
      
      case 'month':
        return {
          year: { $year: '$date' },
          month: { $month: '$date' }
        };
      
      case 'year':
        return { $year: '$date' };
      
      case 'day':
        return {
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' }
        };
      
      case 'week':
        return {
          year: { $year: '$date' },
          week: { $week: '$date' }
        };
      
      default:
        throw new ValidationError(
          'Tipo de agrupamento inválido',
          {
            provided: groupBy,
            valid: ['category', 'type', 'payment_method', 'status', 'month', 'year', 'day', 'week']
          }
        );
    }
  }

  /**
   * Formata resultados da agregação
   */
  formatResults(results, operation, groupBy) {
    if (!groupBy) {
      // Sem agrupamento, retornar resultado único
      const result = results[0] || {};
      return {
        operation,
        result: {
          total: result.total,
          average: result.average,
          count: result.count || 0,
          minimum: result.minimum,
          maximum: result.maximum
        }
      };
    }

    // Com agrupamento, retornar array de grupos
    return {
      operation,
      group_by: groupBy,
      groups: results.map(r => ({
        group: this.formatGroupKey(r._id, groupBy),
        total: r.total,
        average: r.average,
        count: r.count || 0,
        minimum: r.minimum,
        maximum: r.maximum
      })),
      total_groups: results.length
    };
  }

  /**
   * Formata chave do grupo
   */
  formatGroupKey(key, groupBy) {
    if (!key) return 'all';

    if (groupBy === 'month' && typeof key === 'object') {
      return `${key.year}-${String(key.month).padStart(2, '0')}`;
    }

    if (groupBy === 'day' && typeof key === 'object') {
      return `${key.year}-${String(key.month).padStart(2, '0')}-${String(key.day).padStart(2, '0')}`;
    }

    if (groupBy === 'week' && typeof key === 'object') {
      return `${key.year}-W${String(key.week).padStart(2, '0')}`;
    }

    return key;
  }
}

module.exports = new AggregateOperation();
