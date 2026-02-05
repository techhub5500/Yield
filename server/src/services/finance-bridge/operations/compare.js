const transactionRepository = require('../../../models/TransactionRepository');
const booleanLogic = require('../filters/boolean-logic');
const smartPeriods = require('../filters/smart-periods');
const { ValidationError } = require('../../../utils/error-handler');
const logger = require('../../../utils/logger');

/**
 * Operação: COMPARE (Comparação)
 * 
 * Compara dados entre dois períodos ou categorias
 */
class CompareOperation {
  constructor() {
    this.description = 'Compara transações entre dois períodos ou categorias';
  }

  /**
   * Executa a comparação
   */
  async execute(params = {}, context = {}) {
    const startTime = Date.now();

    try {
      const {
        compare_type = 'period', // 'period' ou 'category'
        period_a,
        period_b,
        category_a,
        category_b,
        filters = {},
        metric = 'sum' // sum, avg, count
      } = params;

      // Validar tipo de comparação
      if (!['period', 'category'].includes(compare_type)) {
        throw new ValidationError(
          'Tipo de comparação inválido',
          { provided: compare_type, valid: ['period', 'category'] }
        );
      }

      let resultA, resultB;

      // Executar comparação
      if (compare_type === 'period') {
        if (!period_a || !period_b) {
          throw new ValidationError('Períodos A e B são obrigatórios para comparação de períodos');
        }
        
        const comparison = await this.comparePeriods(period_a, period_b, filters, metric, context);
        resultA = comparison.period_a;
        resultB = comparison.period_b;
      } else {
        if (!category_a || !category_b) {
          throw new ValidationError('Categorias A e B são obrigatórias para comparação de categorias');
        }
        
        const comparison = await this.compareCategories(category_a, category_b, filters, metric, context);
        resultA = comparison.category_a;
        resultB = comparison.category_b;
      }

      // Calcular diferenças
      const difference = this.calculateDifference(resultA, resultB, metric);

      const duration = Date.now() - startTime;
      
      logger.info('Comparação executada', {
        compare_type,
        metric,
        duration_ms: duration
      });

      return {
        compare_type,
        metric,
        [compare_type === 'period' ? 'period_a' : 'category_a']: resultA,
        [compare_type === 'period' ? 'period_b' : 'category_b']: resultB,
        difference
      };

    } catch (error) {
      logger.error('Erro na operação compare', error);
      throw error;
    }
  }

  /**
   * Compara dois períodos
   */
  async comparePeriods(periodA, periodB, filters, metric, context) {
    // Resolver período A
    const rangeA = await smartPeriods.resolve(periodA, context.user_timezone, context.user_id);
    
    // Resolver período B
    const rangeB = await smartPeriods.resolve(periodB, context.user_timezone, context.user_id);

    // Obter dados de cada período
    const dataA = await this.getAggregateData({ ...filters, date_range: rangeA }, metric, context);
    const dataB = await this.getAggregateData({ ...filters, date_range: rangeB }, metric, context);

    return {
      period_a: {
        period: periodA,
        date_range: {
          start: rangeA.start.toISOString(),
          end: rangeA.end.toISOString()
        },
        ...dataA
      },
      period_b: {
        period: periodB,
        date_range: {
          start: rangeB.start.toISOString(),
          end: rangeB.end.toISOString()
        },
        ...dataB
      }
    };
  }

  /**
   * Compara duas categorias
   */
  async compareCategories(categoryA, categoryB, filters, metric, context) {
    // Obter dados de cada categoria
    const dataA = await this.getAggregateData(
      { ...filters, categories: [categoryA] },
      metric,
      context
    );
    
    const dataB = await this.getAggregateData(
      { ...filters, categories: [categoryB] },
      metric,
      context
    );

    return {
      category_a: {
        category: categoryA,
        ...dataA
      },
      category_b: {
        category: categoryB,
        ...dataB
      }
    };
  }

  /**
   * Obtém dados agregados
   */
  async getAggregateData(filters, metric, context) {
    // Adicionar user_id
    filters.user_id = context.user_id;

    // Construir query
    const matchQuery = booleanLogic.buildQuery(filters, 'AND');

    // Pipeline de agregação
    const pipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          average: { $avg: '$amount' },
          count: { $sum: 1 },
          minimum: { $min: '$amount' },
          maximum: { $max: '$amount' }
        }
      }
    ];

    const results = await transactionRepository.aggregate(pipeline);
    const data = results[0] || { total: 0, average: 0, count: 0, minimum: 0, maximum: 0 };

    return {
      total: data.total || 0,
      average: data.average || 0,
      count: data.count || 0,
      minimum: data.minimum || 0,
      maximum: data.maximum || 0
    };
  }

  /**
   * Calcula diferença entre dois conjuntos de dados
   */
  calculateDifference(dataA, dataB, metric) {
    const valueA = dataA[metric] || dataA.total || 0;
    const valueB = dataB[metric] || dataB.total || 0;

    const absolute = valueB - valueA;
    const percentage = valueA !== 0 ? ((valueB - valueA) / valueA) * 100 : 0;

    return {
      absolute,
      percentage: Math.round(percentage * 100) / 100,
      direction: absolute > 0 ? 'increase' : absolute < 0 ? 'decrease' : 'equal',
      metric_used: metric
    };
  }
}

module.exports = new CompareOperation();
