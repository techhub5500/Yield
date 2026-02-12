/**
 * @module api/routes/investments
 * @description Rotas da base de investimentos (métricas e cards).
 *
 * LÓGICA PURA — sem IA.
 */

const express = require('express');
const crypto = require('crypto');
const logger = require('../../utils/logger');
const { createFinancialLogContext } = require('../../utils/financial-logger');
const { authenticateToken } = require('../middleware/auth');
const InvestmentsMetricsService = require('../../core/investments/service');

/**
 * Cria o router de investimentos.
 *
 * @param {Object} deps
 * @param {Object} [deps.financeBridge] - FinanceBridge existente (integração futura)
 * @param {InvestmentsMetricsService} [deps.investmentsService]
 * @returns {express.Router}
 */
function createInvestmentsRouter(deps = {}) {
  const router = express.Router();

  const service = deps.investmentsService || new InvestmentsMetricsService({
    financeBridge: deps.financeBridge,
  });

  // Todas as rotas requerem autenticação
  router.use(authenticateToken);

  /**
   * GET /api/investments/manifest
   * Retorna capacidades, filtros suportados e métricas registradas.
   */
  router.get('/manifest', (req, res) => {
    const traceId = crypto.randomUUID();
    const userId = req.user.userId;

    const flog = createFinancialLogContext({
      flow: 'investments-api',
      traceId,
      userId,
    });

    flog.debug('InvestmentsRoute', 'Manifesto solicitado');

    return res.json({
      success: true,
      traceId,
      userId,
      manifest: service.getManifest(),
    });
  });

  /**
   * POST /api/investments/metrics/query
   * Body: { metricIds: string[], filters?: Object }
   */
  router.post('/metrics/query', async (req, res, next) => {
    const traceId = crypto.randomUUID();
    const userId = req.user.userId;

    const flog = createFinancialLogContext({
      flow: 'investments-api',
      traceId,
      userId,
    });

    try {
      const metricIds = Array.isArray(req.body?.metricIds) ? req.body.metricIds : [];
      const filters = req.body?.filters || {};

      flog.debug('InvestmentsRoute', 'metrics/query recebido', {
        metricCount: metricIds.length,
      });

      const result = await service.queryMetrics({
        userId,
        metricIds,
        filters,
        traceId,
      });

      flog.info('InvestmentsRoute', 'metrics/query concluído', {
        metricsReturned: result.metrics?.length || 0,
      });

      return res.json(result);
    } catch (error) {
      logger.error('InvestmentsRoute', 'system', `Falha em metrics/query: ${error.message}`, {
        traceId,
        userId,
      });
      next(error);
    }
  });

  /**
   * POST /api/investments/cards/query
   * Body: { cards: [{ cardId, metricIds, title?, presentation? }], filters?: Object }
   */
  router.post('/cards/query', async (req, res, next) => {
    const traceId = crypto.randomUUID();
    const userId = req.user.userId;

    const flog = createFinancialLogContext({
      flow: 'investments-api',
      traceId,
      userId,
    });

    try {
      const cards = Array.isArray(req.body?.cards) ? req.body.cards : [];
      const filters = req.body?.filters || {};

      flog.debug('InvestmentsRoute', 'cards/query recebido', {
        cardCount: cards.length,
      });

      const result = await service.queryCards({
        userId,
        cards,
        filters,
        traceId,
      });

      flog.info('InvestmentsRoute', 'cards/query concluído', {
        cardsReturned: result.cards?.length || 0,
      });

      return res.json(result);
    } catch (error) {
      logger.error('InvestmentsRoute', 'system', `Falha em cards/query: ${error.message}`, {
        traceId,
        userId,
      });
      next(error);
    }
  });

  /**
   * POST /api/investments/assets/manual
   * Body: { assetClass, category, name, quantity, avgPrice, referenceDate, ... }
   */
  router.post('/assets/manual', async (req, res, next) => {
    const traceId = crypto.randomUUID();
    const userId = req.user.userId;

    const flog = createFinancialLogContext({
      flow: 'investments-api',
      traceId,
      userId,
    });

    try {
      const result = await service.createManualAsset({
        userId,
        payload: req.body || {},
      });

      flog.info('InvestmentsRoute', 'assets/manual criado', {
        assetId: result.asset?.assetId,
      });

      return res.status(201).json({
        success: true,
        traceId,
        ...result,
      });
    } catch (error) {
      logger.error('InvestmentsRoute', 'system', `Falha em assets/manual: ${error.message}`, {
        traceId,
        userId,
      });
      next(error);
    }
  });

  /**
   * GET /api/investments/assets/search?q=...&limit=20
   */
  router.get('/assets/search', async (req, res, next) => {
    const traceId = crypto.randomUUID();
    const userId = req.user.userId;

    try {
      const result = await service.searchUserAssets({
        userId,
        query: req.query.q || '',
        limit: req.query.limit || 20,
      });

      return res.json({
        success: true,
        traceId,
        ...result,
      });
    } catch (error) {
      logger.error('InvestmentsRoute', 'system', `Falha em assets/search: ${error.message}`, {
        traceId,
        userId,
      });
      next(error);
    }
  });

  /**
   * POST /api/investments/assets/:assetId/edit
   * Body: { operation: 'update_position'|'register_sale'|'adjust_quantity', payload: {...} }
   */
  router.post('/assets/:assetId/edit', async (req, res, next) => {
    const traceId = crypto.randomUUID();
    const userId = req.user.userId;

    try {
      const result = await service.editManualAsset({
        userId,
        assetId: req.params.assetId,
        operation: req.body?.operation,
        payload: req.body?.payload || {},
      });

      return res.json({
        success: true,
        traceId,
        ...result,
      });
    } catch (error) {
      logger.error('InvestmentsRoute', 'system', `Falha em assets/:assetId/edit: ${error.message}`, {
        traceId,
        userId,
      });
      next(error);
    }
  });

  /**
   * DELETE /api/investments/assets/:assetId
   * Remove o ativo e todos os dados relacionados.
   */
  router.delete('/assets/:assetId', async (req, res, next) => {
    const traceId = crypto.randomUUID();
    const userId = req.user.userId;

    try {
      const success = await service.deleteManualAsset({
        userId,
        assetId: req.params.assetId,
      });

      return res.json({
        success,
        traceId,
        message: success ? 'Ativo removido com sucesso' : 'Ativo não encontrado ou já removido',
      });
    } catch (error) {
      logger.error('InvestmentsRoute', 'system', `Falha em DELETE assets/:assetId: ${error.message}`, {
        traceId,
        userId,
      });
      next(error);
    }
  });

  return router;
}

module.exports = { createInvestmentsRouter };
