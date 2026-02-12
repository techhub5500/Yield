/**
 * @module core/metrics/engine
 * @description Motor de execução de métricas com contrato estável para frontend.
 *
 * LÓGICA PURA — sem IA.
 */

const logger = require('../../utils/logger');
const { getMetric } = require('./registry');

/**
 * Executa múltiplas métricas de forma isolada (falha de uma não derruba outras).
 *
 * @param {Object} input
 * @param {string[]} input.metricIds - Lista de métricas solicitadas
 * @param {Object} input.context - Contexto de execução (userId, traceId, serviços)
 * @param {Object} input.filters - Filtros normalizados
 * @param {Object[]} input.periodWindows - Janelas de período normalizadas
 * @param {string} [input.groupBy='month'] - Granularidade temporal
 * @returns {Promise<Object[]>}
 */
async function runMetrics(input) {
  const {
    metricIds = [],
    context,
    filters,
    periodWindows,
    groupBy = 'month',
  } = input;

  const results = [];

  for (const metricId of metricIds) {
    const metric = getMetric(metricId);

    if (!metric) {
      results.push({
        metricId,
        status: 'not_found',
        data: null,
        error: `Métrica não registrada: ${metricId}`,
      });
      continue;
    }

    const startedAt = Date.now();

    try {
      const data = await metric.handler({
        metricId,
        filters,
        periodWindows,
        groupBy,
        context,
      });

      results.push({
        metricId,
        status: data?.status || 'ok',
        data: data?.data ?? null,
        meta: {
          elapsed: Date.now() - startedAt,
          output: metric.output,
          version: metric.version,
          ...(data?.meta || {}),
        },
      });
    } catch (error) {
      logger.logic('WARN', 'MetricsEngine', `Falha ao executar métrica ${metricId}`, {
        traceId: context?.traceId,
        error: error.message,
      });

      results.push({
        metricId,
        status: 'error',
        data: null,
        error: error.message,
      });
    }
  }

  return results;
}

module.exports = { runMetrics };
