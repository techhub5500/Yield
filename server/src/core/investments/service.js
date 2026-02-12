/**
 * @module core/investments/service
 * @description Serviço de alto nível para métricas e cards de investimentos.
 *
 * LÓGICA PURA — sem IA.
 */

const { createFinancialLogContext } = require('../../utils/financial-logger');
const { listMetrics } = require('../metrics/registry');
const { runMetrics } = require('../metrics/engine');
const { normalizeInvestmentsFilters } = require('./filters');
const { buildPeriodWindows } = require('./periods');
const repository = require('./repository');

/**
 * @class InvestmentsMetricsService
 * @description Camada de serviço escalável para cards e métricas de investimentos.
 */
class InvestmentsMetricsService {
  /**
   * @param {Object} deps
   * @param {Object} [deps.financeBridge] - Bridge existente para integração futura
   */
  constructor(deps = {}) {
    this.financeBridge = deps.financeBridge || null;
  }

  /**
   * Retorna manifesto da base de investimentos para frontend.
   * @returns {Object}
   */
  getManifest() {
    const metrics = listMetrics();

    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      capabilities: {
        supportsCards: true,
        supportsPeriods: true,
        supportsCharts: true,
        supportsAggregations: true,
      },
      availableFilters: {
        currencies: ['BRL', 'USD', 'EUR'],
        assetClasses: ['fixed_income', 'equity', 'funds', 'crypto', 'cash'],
        statuses: ['open', 'closed', 'pending_settlement'],
        groupBy: ['day', 'month'],
        periodsMonths: [2, 3, 6, 12],
      },
      metrics,
    };
  }

  /**
   * Executa consulta de métricas sem acoplar a cards.
   * @param {Object} input
   * @param {string} input.userId
   * @param {string[]} input.metricIds
   * @param {Object} [input.filters]
   * @returns {Promise<Object>}
   */
  async queryMetrics(input) {
    const { userId, metricIds = [], filters: rawFilters = {}, traceId } = input;
    const { filters, periodsMonths, groupBy } = normalizeInvestmentsFilters(rawFilters);
    const periodWindows = buildPeriodWindows(periodsMonths, filters.asOf);

    const flog = createFinancialLogContext({
      flow: 'investments-metrics',
      traceId,
      userId,
    });

    flog.info('InvestmentsMetricsService', 'Consulta de métricas recebida', {
      metrics: metricIds.length,
      windows: periodWindows.map((item) => item.label),
      groupBy,
    });

    const metrics = await runMetrics({
      metricIds,
      filters,
      periodWindows,
      groupBy,
      context: {
        traceId,
        userId,
        repository,
        financeBridge: this.financeBridge,
      },
    });

    flog.debug('InvestmentsMetricsService', 'Execução de métricas finalizada', {
      ok: metrics.filter((m) => m.status === 'ok').length,
      errors: metrics.filter((m) => m.status === 'error').length,
      notFound: metrics.filter((m) => m.status === 'not_found').length,
    });

    return {
      success: true,
      traceId,
      generatedAt: new Date().toISOString(),
      filters,
      periods: periodWindows,
      metrics,
    };
  }

  /**
   * Executa consulta orientada a cards para o dashboard.
   *
   * @param {Object} input
   * @param {string} input.userId
   * @param {Array<{cardId:string,title?:string,metricIds:string[],presentation?:string}>} input.cards
   * @param {Object} [input.filters]
   * @param {string} [input.traceId]
   * @returns {Promise<Object>}
   */
  async queryCards(input) {
    const cards = Array.isArray(input.cards) ? input.cards : [];
    const traceId = input.traceId;

    const flog = createFinancialLogContext({
      flow: 'investments-cards',
      traceId,
      userId: input.userId,
    });

    const uniqueMetricIds = Array.from(new Set(
      cards.flatMap((card) => Array.isArray(card.metricIds) ? card.metricIds : [])
    ));

    flog.info('InvestmentsMetricsService', 'Consulta de cards recebida', {
      cards: cards.length,
      uniqueMetrics: uniqueMetricIds.length,
    });

    const metricsResult = await this.queryMetrics({
      userId: input.userId,
      metricIds: uniqueMetricIds,
      filters: input.filters,
      traceId,
    });

    const metricsById = new Map(metricsResult.metrics.map((item) => [item.metricId, item]));

    const cardResults = cards.map((card) => {
      const cardMetrics = (card.metricIds || []).map((metricId) => (
        metricsById.get(metricId) || {
          metricId,
          status: 'not_found',
          data: null,
          error: `Métrica não encontrada: ${metricId}`,
        }
      ));

      const hasError = cardMetrics.some((metric) => metric.status === 'error' || metric.status === 'not_found');
      const hasData = cardMetrics.some((metric) => metric.status === 'ok');

      return {
        cardId: card.cardId,
        title: card.title || card.cardId,
        presentation: card.presentation || 'generic',
        status: hasError ? 'partial_error' : hasData ? 'ok' : 'empty',
        filters: metricsResult.filters,
        periods: metricsResult.periods,
        metrics: cardMetrics,
        meta: {
          metricsRequested: card.metricIds?.length || 0,
          metricsResolved: cardMetrics.length,
        },
      };
    });

    return {
      success: true,
      traceId,
      generatedAt: new Date().toISOString(),
      cards: cardResults,
      summary: {
        cardsRequested: cards.length,
        cardsResolved: cardResults.length,
      },
    };
  }
}

module.exports = InvestmentsMetricsService;
