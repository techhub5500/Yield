/**
 * @module utils/financial-logger
 * @description Wrapper de logging focado em fluxo crítico de dados financeiros.
 *
 * Objetivo: logs estratégicos (correlação, baixo ruído, rastreio de ponta a ponta).
 *
 * LÓGICA PURA — sem IA.
 */

const logger = require('./logger');

/**
 * Cria um contexto de log para um fluxo financeiro.
 *
 * @param {Object} input
 * @param {string} input.flow - Nome do fluxo (ex: 'investments-dashboard')
 * @param {string} [input.traceId]
 * @param {string} [input.userId]
 * @param {string} [input.chatId]
 * @returns {{debug:Function,info:Function,warn:Function,error:Function}}
 */
function createFinancialLogContext(input) {
  const baseMeta = {
    flow: input.flow,
    traceId: input.traceId,
    userId: input.userId,
    chatId: input.chatId,
  };

  function mergeMeta(meta) {
    const cleanBase = Object.fromEntries(
      Object.entries(baseMeta).filter(([, value]) => value !== undefined && value !== null)
    );

    if (!meta || typeof meta !== 'object') return cleanBase;
    return { ...cleanBase, ...meta };
  }

  return {
    debug(component, message, meta) {
      logger.logic('DEBUG', component, message, mergeMeta(meta));
    },
    info(component, message, meta) {
      logger.logic('INFO', component, message, mergeMeta(meta));
    },
    warn(component, message, meta) {
      logger.logic('WARN', component, message, mergeMeta(meta));
    },
    error(component, message, meta) {
      logger.logic('ERROR', component, message, mergeMeta(meta));
    },
  };
}

module.exports = {
  createFinancialLogContext,
};
