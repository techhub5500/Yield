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
const { ensureInvestmentsMetricsRegistered } = require('./metrics-registry');
const {
  isIsoDate,
  normalizeTicker,
  isTickerLike,
  adjustWeekendDate,
  extractDailyHistory,
  pickPriceForDate,
  toIsoDate,
} = require('./brapi-utils');

const ALLOWED_ASSET_CLASSES = ['fixed_income', 'equity', 'funds', 'crypto', 'cash'];

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
    this.brapiClient = deps.brapiClient || deps.searchManager?.brapi || null;
    ensureInvestmentsMetricsRegistered();
  }

  /**
   * @returns {void}
   */
  assertBrapiClient() {
    if (!this.brapiClient) {
      throw new Error('Cliente Brapi não configurado para investimentos');
    }
  }

  /**
   * Resolve ticker a partir de payload/metadata/nome.
   * @param {Object} payload
   * @returns {string|null}
   */
  resolveTickerFromPayload(payload = {}) {
    const candidate = normalizeTicker(
      payload.ticker
      || payload.metadata?.ticker
      || payload.name
    );

    if (!isTickerLike(candidate)) return null;
    return candidate;
  }

  /**
   * Consulta Brapi para ticker e data de referência.
   * @param {Object} input
   * @returns {Promise<Object>}
   */
  async getBrapiQuoteByTicker(input) {
    this.assertBrapiClient();

    const ticker = normalizeTicker(input?.ticker);
    const requestedDate = isIsoDate(input?.referenceDate)
      ? input.referenceDate
      : toIsoDate(new Date());

    if (!isTickerLike(ticker)) {
      throw new Error('Ticker inválido para consulta na Brapi');
    }

    const adjustedReferenceDate = adjustWeekendDate(requestedDate);

    let response;
    try {
      response = await this.brapiClient.getQuoteHistory(ticker, {
        interval: '1d',
        range: 'max',
      });
    } catch (_error) {
      response = await this.brapiClient.search(ticker);
    }

    const firstResult = response?.results?.[0]
      || response?.coins?.[0]
      || response?.currencies?.[0]
      || response
      || {};
    const regularMarketPrice = Number(firstResult.regularMarketPrice || 0);
    const history = extractDailyHistory(response);
    const matched = pickPriceForDate(history, adjustedReferenceDate);
    const priceOnReferenceDate = Number.isFinite(Number(matched?.price))
      ? Number(matched.price)
      : (Number.isFinite(regularMarketPrice) ? regularMarketPrice : 0);

    return {
      success: true,
      ticker,
      shortName: firstResult.shortName || ticker,
      longName: firstResult.longName || firstResult.shortName || ticker,
      currency: firstResult.currency || 'BRL',
      regularMarketPrice: Number.isFinite(regularMarketPrice) ? regularMarketPrice : 0,
      referenceDate: requestedDate,
      adjustedReferenceDate,
      priceOnReferenceDate,
      sourceDate: matched?.date || adjustedReferenceDate,
      hasHistory: history.length > 0,
    };
  }

  /**
   * Consulta preço para ativo já cadastrado.
   * @param {Object} input
   * @returns {Promise<Object>}
   */
  async getBrapiQuoteByAsset(input) {
    const { userId, assetId, referenceDate } = input;
    this.assertUserId(userId);
    if (!assetId) throw new Error('assetId é obrigatório');

    const asset = await repository.getAssetById({ userId, assetId });
    if (!asset) throw new Error('Ativo não encontrado para este usuário');

    const tickerCandidate = normalizeTicker(asset.ticker || asset.metadata?.ticker || asset.name);
    if (!isTickerLike(tickerCandidate)) {
      throw new Error('Ativo não possui ticker válido para consulta na Brapi');
    }

    const quote = await this.getBrapiQuoteByTicker({
      ticker: tickerCandidate,
      referenceDate,
    });

    return {
      ...quote,
      assetId,
      assetName: asset.name,
    };
  }

  /**
   * Valida userId obrigatório no fluxo manual.
   * @param {string} userId
   */
  assertUserId(userId) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('userId inválido para operação de investimentos');
    }
  }

  /**
   * Cria ativo manual e primeira posição do ativo.
   * @param {Object} input
   * @returns {Promise<Object>}
   */
  async createManualAsset(input) {
    const { userId, payload = {} } = input;
    this.assertUserId(userId);

    const name = String(payload.name || '').trim();
    const assetClass = String(payload.assetClass || '').trim();
    const category = String(payload.category || '').trim();
    const referenceDate = String(payload.referenceDate || '').trim();

    const quantity = Number(payload.quantity);
    const avgPrice = Number(payload.avgPrice);

    if (!name) throw new Error('Nome do ativo é obrigatório');
    if (!ALLOWED_ASSET_CLASSES.includes(assetClass)) throw new Error('Classe de ativo inválida');
    if (!category) throw new Error('Categoria/subtipo é obrigatório');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) throw new Error('Data inválida (YYYY-MM-DD)');
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantidade inválida');
    if (!Number.isFinite(avgPrice) || avgPrice < 0) throw new Error('Preço médio inválido');

    const currency = String(payload.currency || 'BRL').trim() || 'BRL';
    const status = String(payload.status || 'open').trim() || 'open';
    const tags = Array.isArray(payload.tags) ? payload.tags : [];
    const ticker = this.resolveTickerFromPayload(payload);

    const metadata = {
      ...(payload.metadata || {}),
      ...(ticker ? { ticker } : {}),
    };

    const createdAsset = await repository.upsertAsset({
      userId,
      name,
      ticker,
      assetClass,
      category,
      currency,
      status,
      accountId: payload.accountId || null,
      tags,
      metadata,
    });

    const position = await repository.insertPositionSnapshot({
      userId,
      assetId: createdAsset.assetId,
      referenceDate,
      currency,
      assetClass,
      status,
      accountId: payload.accountId || null,
      tags,
      quantity,
      avgPrice,
      marketPrice: payload.marketPrice,
      source: 'manual',
      actionType: 'create_asset',
    });

    await repository.insertInvestmentTransaction({
      userId,
      assetId: createdAsset.assetId,
      referenceDate,
      currency,
      assetClass,
      status,
      accountId: payload.accountId || null,
      tags,
      operation: 'manual_create',
      quantity,
      price: avgPrice,
      grossAmount: quantity * avgPrice,
      source: 'manual',
    });

    return {
      success: true,
      asset: createdAsset,
      position,
    };
  }

  /**
   * Remove um ativo manual completamente.
   * @param {Object} input
   * @returns {Promise<boolean>}
   */
  async deleteManualAsset(input) {
    const { userId, assetId } = input;
    this.assertUserId(userId);
    if (!assetId) throw new Error('assetId é obrigatório para exclusão');

    return repository.deleteAsset(userId, assetId);
  }

  /**
   * Busca ativos por texto para o usuário autenticado.
   * @param {Object} input
   * @returns {Promise<Object>}
   */
  async searchUserAssets(input) {
    const { userId, query = '', limit = 20 } = input;
    this.assertUserId(userId);

    const assets = await repository.searchAssetsByName({ userId, query, limit });
    return {
      success: true,
      assets,
      total: assets.length,
    };
  }

  /**
   * Edita ativo por operação progressiva.
   * @param {Object} input
   * @returns {Promise<Object>}
   */
  async editManualAsset(input) {
    const { userId, assetId, operation, payload = {} } = input;
    this.assertUserId(userId);

    if (!assetId) throw new Error('assetId é obrigatório');
    const asset = await repository.getAssetById({ userId, assetId });
    if (!asset) throw new Error('Ativo não encontrado para este usuário');

    const nowDate = new Date().toISOString().slice(0, 10);
    const referenceDate = /^\d{4}-\d{2}-\d{2}$/.test(payload.referenceDate || '')
      ? payload.referenceDate
      : nowDate;

    const latestPositions = await repository.listLatestPositionsByUser({
      userId,
      filters: {},
      end: null,
    });
    const current = latestPositions.find((item) => item.assetId === assetId) || {
      quantity: 0,
      avgPrice: 0,
      marketPrice: 0,
      investedAmount: 0,
      marketValue: 0,
    };

    let quantity = Number(current.quantity || 0);
    let avgPrice = Number(current.avgPrice || 0);
    let marketPrice = Number(current.marketPrice || avgPrice || 0);

    if (operation === 'add_buy') {
      const buyQuantity = Number(payload.quantity);
      const buyPrice = Number(payload.price);
      const fees = Number(payload.fees || 0);

      if (!Number.isFinite(buyQuantity) || buyQuantity <= 0) {
        throw new Error('Quantidade de compra/aporte inválida');
      }
      if (!Number.isFinite(buyPrice) || buyPrice < 0) {
        throw new Error('Preço de compra/aporte inválido');
      }
      if (!Number.isFinite(fees) || fees < 0) {
        throw new Error('Taxas inválidas na compra/aporte');
      }

      const previousInvested = quantity * avgPrice;
      const buyInvested = (buyQuantity * buyPrice) + fees;
      quantity += buyQuantity;
      avgPrice = quantity > 0 ? (previousInvested + buyInvested) / quantity : 0;

      if (Number.isFinite(Number(payload.marketPrice)) && Number(payload.marketPrice) >= 0) {
        marketPrice = Number(payload.marketPrice);
      }

      await repository.insertInvestmentTransaction({
        userId,
        assetId,
        referenceDate,
        currency: asset.currency,
        assetClass: asset.assetClass,
        status: asset.status,
        accountId: asset.accountId,
        tags: asset.tags,
        operation: 'manual_buy',
        quantity: buyQuantity,
        price: buyPrice,
        grossAmount: buyInvested,
        fees,
        source: 'manual',
      });
    } else if (operation === 'add_sell') {
      const soldQuantity = Number(payload.quantity);
      const soldPrice = Number(payload.price);
      const fees = Number(payload.fees || 0);

      if (!Number.isFinite(soldQuantity) || soldQuantity <= 0) {
        throw new Error('Quantidade de venda/resgate inválida');
      }
      if (!Number.isFinite(soldPrice) || soldPrice < 0) {
        throw new Error('Preço de venda/resgate inválido');
      }
      if (!Number.isFinite(fees) || fees < 0) {
        throw new Error('Taxas inválidas na venda/resgate');
      }
      if (soldQuantity > quantity) {
        throw new Error('Quantidade de venda maior que posição atual');
      }

      quantity = Math.max(0, quantity - soldQuantity);
      if (quantity === 0) {
        avgPrice = 0;
      }
      marketPrice = soldPrice;

      await repository.insertInvestmentTransaction({
        userId,
        assetId,
        referenceDate,
        currency: asset.currency,
        assetClass: asset.assetClass,
        status: asset.status,
        accountId: asset.accountId,
        tags: asset.tags,
        operation: 'manual_sale',
        quantity: soldQuantity,
        price: soldPrice,
        grossAmount: (soldQuantity * soldPrice) - fees,
        fees,
        source: 'manual',
      });
    } else if (operation === 'add_income') {
      const grossAmount = Number(payload.grossAmount);
      const incomeType = String(payload.incomeType || '').trim();

      if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
        throw new Error('Valor de provento inválido');
      }
      if (!incomeType) {
        throw new Error('Tipo de provento é obrigatório');
      }

      await repository.insertInvestmentTransaction({
        userId,
        assetId,
        referenceDate,
        currency: asset.currency,
        assetClass: asset.assetClass,
        status: asset.status,
        accountId: asset.accountId,
        tags: asset.tags,
        operation: 'manual_income',
        quantity: 0,
        price: 0,
        grossAmount,
        metadata: { incomeType },
        source: 'manual',
      });
    } else if (operation === 'update_balance') {
      if (asset.assetClass !== 'fixed_income') {
        throw new Error('Atualização de saldo disponível apenas para renda fixa');
      }

      const currentBalance = Number(payload.currentBalance);
      if (!Number.isFinite(currentBalance) || currentBalance < 0) {
        throw new Error('Saldo atual inválido');
      }

      const normalizedQuantity = quantity > 0 ? quantity : 1;
      quantity = normalizedQuantity;
      marketPrice = currentBalance / normalizedQuantity;

      await repository.insertInvestmentTransaction({
        userId,
        assetId,
        referenceDate,
        currency: asset.currency,
        assetClass: asset.assetClass,
        status: asset.status,
        accountId: asset.accountId,
        tags: asset.tags,
        operation: 'manual_balance_update',
        quantity: 0,
        price: marketPrice,
        grossAmount: currentBalance,
        metadata: {
          previousMarketValue: Number(current.marketValue || 0),
        },
        source: 'manual',
      });
    } else if (operation === 'update_position') {
      if (Number.isFinite(Number(payload.quantity))) quantity = Number(payload.quantity);
      if (Number.isFinite(Number(payload.avgPrice))) avgPrice = Number(payload.avgPrice);
      if (Number.isFinite(Number(payload.marketPrice))) marketPrice = Number(payload.marketPrice);
    } else if (operation === 'register_sale') {
      const soldQuantity = Number(payload.quantity);
      const soldPrice = Number(payload.price);
      if (!Number.isFinite(soldQuantity) || soldQuantity <= 0) {
        throw new Error('Quantidade de venda inválida');
      }
      quantity = Math.max(0, quantity - soldQuantity);
      if (Number.isFinite(soldPrice) && soldPrice >= 0) {
        marketPrice = soldPrice;
      }

      await repository.insertInvestmentTransaction({
        userId,
        assetId,
        referenceDate,
        currency: asset.currency,
        assetClass: asset.assetClass,
        status: asset.status,
        accountId: asset.accountId,
        tags: asset.tags,
        operation: 'manual_sale',
        quantity: soldQuantity,
        price: Number.isFinite(soldPrice) ? soldPrice : marketPrice,
        grossAmount: soldQuantity * (Number.isFinite(soldPrice) ? soldPrice : marketPrice),
        source: 'manual',
      });
    } else if (operation === 'adjust_quantity') {
      const adjustedQuantity = Number(payload.quantity);
      if (!Number.isFinite(adjustedQuantity) || adjustedQuantity < 0) {
        throw new Error('Quantidade ajustada inválida');
      }
      quantity = adjustedQuantity;
      if (Number.isFinite(Number(payload.avgPrice))) avgPrice = Number(payload.avgPrice);
      if (Number.isFinite(Number(payload.marketPrice))) marketPrice = Number(payload.marketPrice);
    } else {
      throw new Error('Operação de edição inválida');
    }

    const position = await repository.insertPositionSnapshot({
      userId,
      assetId,
      referenceDate,
      currency: asset.currency,
      assetClass: asset.assetClass,
      status: asset.status,
      accountId: asset.accountId,
      tags: asset.tags,
      quantity,
      avgPrice,
      marketPrice,
      source: 'manual',
      actionType: operation,
    });

    return {
      success: true,
      asset,
      position,
    };
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
        periodPreset: ['mtd', 'ytd', '12m', 'origin'],
        resultType: ['both', 'realized', 'unrealized'],
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
        brapiClient: this.brapiClient,
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
      metricIds: uniqueMetricIds,
    });

    const metricsResult = await this.queryMetrics({
      userId: input.userId,
      metricIds: uniqueMetricIds,
      filters: input.filters,
      traceId,
    });

    const metricsById = new Map(metricsResult.metrics.map((item) => [item.metricId, item]));
    const unresolvedMetricIds = metricsResult.metrics
      .filter((metric) => metric.status === 'not_found' || metric.status === 'error')
      .map((metric) => metric.metricId);

    if (unresolvedMetricIds.length) {
      flog.warn('InvestmentsMetricsService', 'Métricas não resolvidas na consulta de cards', {
        unresolvedMetricIds,
      });
    }

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
