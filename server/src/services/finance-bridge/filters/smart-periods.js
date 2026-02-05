const dateUtils = require('../../shared/date-utils');
const transactionRepository = require('../../../models/TransactionRepository');
const { ValidationError } = require('../../../utils/error-handler');

/**
 * Períodos Inteligentes
 * 
 * Traduz termos em linguagem natural para intervalos de datas reais
 */
class SmartPeriods {
  
  /**
   * Resolve um período nomeado para datas reais
   * 
   * @param {string} namedPeriod - Nome do período (ex: current_month, last_7_days)
   * @param {string} timezone - Fuso horário do usuário
   * @param {string} userId - ID do usuário (necessário para since_last_payday)
   * @returns {Object} { start: Date, end: Date }
   */
  async resolve(namedPeriod, timezone = 'UTC', userId = null) {
    const now = new Date();
    const userNow = timezone ? dateUtils.applyTimezone(now, timezone) : now;

    // Mapa de períodos disponíveis
    const periods = {
      // Dia
      today: () => ({
        start: dateUtils.getStartOfDay(userNow),
        end: dateUtils.getEndOfDay(userNow)
      }),
      
      yesterday: () => ({
        start: dateUtils.getStartOfDay(dateUtils.addDays(userNow, -1)),
        end: dateUtils.getEndOfDay(dateUtils.addDays(userNow, -1))
      }),

      // Semana
      this_week: () => ({
        start: dateUtils.getFirstDayOfWeek(userNow, false), // Domingo
        end: dateUtils.getEndOfDay(userNow)
      }),

      last_week: () => {
        const lastWeekStart = dateUtils.getFirstDayOfWeek(dateUtils.addDays(userNow, -7), false);
        const lastWeekEnd = dateUtils.addDays(lastWeekStart, 6);
        return {
          start: lastWeekStart,
          end: dateUtils.getEndOfDay(lastWeekEnd)
        };
      },

      // Mês
      current_month: () => ({
        start: dateUtils.getFirstDayOfMonth(userNow),
        end: dateUtils.getEndOfDay(userNow)
      }),

      last_month: () => {
        const lastMonthDate = dateUtils.addMonths(userNow, -1);
        return {
          start: dateUtils.getFirstDayOfMonth(lastMonthDate),
          end: dateUtils.getLastDayOfMonth(lastMonthDate)
        };
      },

      // Trimestre
      last_quarter: () => {
        const threeMonthsAgo = dateUtils.addMonths(userNow, -3);
        return {
          start: dateUtils.getFirstDayOfMonth(threeMonthsAgo),
          end: dateUtils.getLastDayOfMonth(dateUtils.addMonths(userNow, -1))
        };
      },

      current_quarter: () => {
        const currentQuarter = Math.floor(userNow.getMonth() / 3);
        const quarterStartMonth = currentQuarter * 3;
        const quarterStart = new Date(userNow.getFullYear(), quarterStartMonth, 1);
        return {
          start: quarterStart,
          end: dateUtils.getEndOfDay(userNow)
        };
      },

      // Ano
      fiscal_year: () => ({
        start: dateUtils.getFirstDayOfYear(userNow),
        end: dateUtils.getLastDayOfYear(userNow)
      }),

      current_year: () => ({
        start: dateUtils.getFirstDayOfYear(userNow),
        end: dateUtils.getEndOfDay(userNow)
      }),

      last_year: () => {
        const lastYear = new Date(userNow.getFullYear() - 1, 0, 1);
        return {
          start: dateUtils.getFirstDayOfYear(lastYear),
          end: dateUtils.getLastDayOfYear(lastYear)
        };
      },

      // Períodos dinâmicos baseados em X dias
      last_7_days: () => ({
        start: dateUtils.getStartOfDay(dateUtils.addDays(userNow, -7)),
        end: dateUtils.getEndOfDay(userNow)
      }),

      last_15_days: () => ({
        start: dateUtils.getStartOfDay(dateUtils.addDays(userNow, -15)),
        end: dateUtils.getEndOfDay(userNow)
      }),

      last_30_days: () => ({
        start: dateUtils.getStartOfDay(dateUtils.addDays(userNow, -30)),
        end: dateUtils.getEndOfDay(userNow)
      }),

      last_60_days: () => ({
        start: dateUtils.getStartOfDay(dateUtils.addDays(userNow, -60)),
        end: dateUtils.getEndOfDay(userNow)
      }),

      last_90_days: () => ({
        start: dateUtils.getStartOfDay(dateUtils.addDays(userNow, -90)),
        end: dateUtils.getEndOfDay(userNow)
      }),

      // Período especial: desde o último salário
      since_last_payday: async () => {
        if (!userId) {
          throw new ValidationError('user_id é obrigatório para "since_last_payday"');
        }

        // Buscar última transação de salário
        const lastSalary = await transactionRepository.find(
          {
            user_id: userId,
            type: 'income',
            $or: [
              { category: { $regex: /salário/i } },
              { category: { $regex: /salary/i } },
              { description: { $regex: /salário/i } }
            ]
          },
          { sort: { date: -1 }, limit: 1 }
        );

        if (lastSalary.length === 0) {
          // Se não encontrar salário, usar início do mês atual
          return {
            start: dateUtils.getFirstDayOfMonth(userNow),
            end: dateUtils.getEndOfDay(userNow)
          };
        }

        return {
          start: dateUtils.getStartOfDay(lastSalary[0].date),
          end: dateUtils.getEndOfDay(userNow)
        };
      }
    };

    // Verificar se o período existe
    if (!periods[namedPeriod]) {
      // Tentar padrão last_X_days dinâmico
      const match = namedPeriod.match(/^last_(\d+)_days?$/);
      if (match) {
        const days = parseInt(match[1], 10);
        if (days > 0 && days <= 365) {
          return {
            start: dateUtils.getStartOfDay(dateUtils.addDays(userNow, -days)),
            end: dateUtils.getEndOfDay(userNow)
          };
        }
      }

      throw new ValidationError(
        `Período "${namedPeriod}" não reconhecido`,
        { availablePeriods: Object.keys(periods) }
      );
    }

    // Resolver período
    const period = await periods[namedPeriod]();
    
    return {
      start: period.start,
      end: period.end
    };
  }

  /**
   * Lista todos os períodos disponíveis
   */
  getAvailablePeriods() {
    return [
      'today',
      'yesterday',
      'this_week',
      'last_week',
      'current_month',
      'last_month',
      'current_quarter',
      'last_quarter',
      'current_year',
      'last_year',
      'fiscal_year',
      'last_7_days',
      'last_15_days',
      'last_30_days',
      'last_60_days',
      'last_90_days',
      'since_last_payday',
      'last_X_days (onde X é um número entre 1 e 365)'
    ];
  }
}

module.exports = new SmartPeriods();
