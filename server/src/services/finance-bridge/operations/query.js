const transactionRepository = require('../../../models/TransactionRepository');
const booleanLogic = require('../filters/boolean-logic');
const smartPeriods = require('../filters/smart-periods');
const { ValidationError } = require('../../../utils/error-handler');
const logger = require('../../../utils/logger');

/**
 * Operação: QUERY (Consulta)
 * 
 * Busca transações com base em filtros complexos
 */
class QueryOperation {
  constructor() {
    this.description = 'Busca transações com filtros avançados';
  }

  /**
   * Executa a consulta
   */
  async execute(params = {}, context = {}) {
    const startTime = Date.now();

    try {
      // Extrair parâmetros
      const {
        filters = {},
        logic = 'AND',
        sort = { date: -1 },
        limit = 50,
        skip = 0,
        named_period = null
      } = params;

      // Adicionar user_id aos filtros
      filters.user_id = context.user_id;

      // Se houver período nomeado, resolver para datas
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

      // Construir query MongoDB
      const query = booleanLogic.buildQuery(filters, logic);

      // Aplicar filtros NOT se existirem
      const finalQuery = params.exclude 
        ? booleanLogic.addNotFilter(query, params.exclude)
        : query;

      // Executar busca
      const results = await transactionRepository.find(finalQuery, {
        sort,
        limit: Math.min(limit, 1000), // Máximo 1000
        skip
      });

      // Contar total (sem limit)
      const total = await transactionRepository.count(finalQuery);

      const duration = Date.now() - startTime;
      
      logger.info('Query executada', {
        results_count: results.length,
        total_count: total,
        duration_ms: duration,
        filters_used: Object.keys(filters).length
      });

      return {
        transactions: results,
        count: results.length,
        total,
        has_more: total > (skip + results.length),
        page_info: {
          limit,
          skip,
          current_page: Math.floor(skip / limit) + 1,
          total_pages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.error('Erro na operação query', error);
      throw error;
    }
  }
}

module.exports = new QueryOperation();
