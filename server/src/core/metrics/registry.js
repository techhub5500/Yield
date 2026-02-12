/**
 * @module core/metrics/registry
 * @description Registry central de métricas para suportar expansão escalável.
 *
 * LÓGICA PURA — sem IA.
 */

const logger = require('../../utils/logger');

/** @type {Map<string, Object>} */
const METRICS = new Map();

/**
 * Registra uma métrica no registry.
 *
 * @param {Object} definition - Definição da métrica
 * @param {string} definition.id - Identificador único da métrica
 * @param {string} definition.title - Título humano da métrica
 * @param {Function} definition.handler - Função que executa a métrica
 */
function registerMetric(definition) {
  if (!definition || typeof definition !== 'object') {
    throw new Error('Definição de métrica inválida');
  }

  if (!definition.id || typeof definition.id !== 'string') {
    throw new Error('Métrica deve possuir id string');
  }

  if (typeof definition.handler !== 'function') {
    throw new Error(`Métrica "${definition.id}" deve possuir handler`);
  }

  METRICS.set(definition.id, {
    version: definition.version || '1.0.0',
    title: definition.title || definition.id,
    description: definition.description || '',
    supportedFilters: definition.supportedFilters || [],
    output: definition.output || { kind: 'unknown' },
    tags: definition.tags || [],
    handler: definition.handler,
  });

  logger.logic('DEBUG', 'MetricsRegistry', `Métrica registrada: ${definition.id}`);
}

/**
 * Retorna uma métrica pelo id.
 * @param {string} metricId
 * @returns {Object|null}
 */
function getMetric(metricId) {
  return METRICS.get(metricId) || null;
}

/**
 * Lista metadados de métricas sem expor handlers.
 * @returns {Object[]}
 */
function listMetrics() {
  return Array.from(METRICS.entries()).map(([id, metric]) => ({
    id,
    version: metric.version,
    title: metric.title,
    description: metric.description,
    supportedFilters: metric.supportedFilters,
    output: metric.output,
    tags: metric.tags,
  }));
}

/**
 * Limpa o registry (uso em testes).
 */
function clearRegistry() {
  METRICS.clear();
}

module.exports = {
  registerMetric,
  getMetric,
  listMetrics,
  clearRegistry,
};
