/**
 * Investments Agent - Agente de Investimentos
 * Fase 5 - Agentes Coordenadores
 * 
 * Coordenador especialista em investimentos.
 * Responsável por cotações, análise de carteira,
 * recomendações de aporte e cálculos financeiros.
 */

const { BaseCoordinator, COORDINATOR_STATUS } = require('../base-coordinator');
const { logger } = require('../../../../utils/logger');
const { mathModule } = require('../math/math-module');
const fs = require('fs');
const path = require('path');

/**
 * Tipos de operações de investimento
 */
const INVESTMENT_TYPES = {
  GET_QUOTE: 'cotacao',
  ANALYZE_PORTFOLIO: 'analisar_carteira',
  RECOMMEND_APORTE: 'recomendar_aporte',
  CALCULATE_INVESTMENT: 'calcular_investimento',
  COMPARE_INVESTMENTS: 'comparar_investimentos',
  TIME_TO_GOAL: 'tempo_para_meta',
  REQUIRED_CONTRIBUTION: 'contribuicao_necessaria',
  MARKET_OVERVIEW: 'visao_mercado'
};

/**
 * Contrato do Agente de Investimentos
 */
const INVESTMENT_CONTRACT = {
  name: 'Agente de Investimentos',
  domain: 'investimentos',
  capabilities: [
    'consultar_cotacoes',
    'analisar_carteira',
    'recomendar_aportes',
    'calcular_rendimentos',
    'comparar_opcoes',
    'projetar_investimentos'
  ],
  inputs: [
    'ticker', 'portfolio', 'amount', 'period',
    'rate', 'profile', 'goals'
  ],
  outputs: [
    'quote', 'portfolio_analysis', 'aporte_recommendation',
    'investment_projection', 'comparison'
  ]
};

class InvestmentsAgent extends BaseCoordinator {
  constructor(financeBridge, brapiApiKey = null) {
    super(financeBridge);
    
    this.name = 'InvestmentsAgent';
    this.domain = 'investimentos';
    this.contract = INVESTMENT_CONTRACT;
    this.brapiApiKey = brapiApiKey || process.env.BRAPI_API_KEY;
    
    // Lazy loading dos módulos
    this._brapiClient = null;
    this._portfolioAnalyzer = null;
    this._aporteRecommender = null;
    this._investmentCalculator = null;
    
    // Carregar prompt do sistema
    this._loadSystemPrompt();
  }

  /**
   * Carrega prompt do sistema
   */
  _loadSystemPrompt() {
    try {
      const promptPath = path.join(__dirname, 'prompts', 'investments-system.txt');
      this.systemPrompt = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
      logger.warn('InvestmentsAgent: Prompt não encontrado, usando padrão');
      this.systemPrompt = this._getDefaultPrompt();
    }
  }

  /**
   * Getters lazy para módulos
   */
  get brapiClient() {
    if (!this._brapiClient) {
      const { BrapiClient } = require('./market/brapi-client');
      this._brapiClient = new BrapiClient(this.brapiApiKey);
    }
    return this._brapiClient;
  }

  get portfolioAnalyzer() {
    if (!this._portfolioAnalyzer) {
      const { PortfolioAnalyzer } = require('./analyzers/portfolio-analyzer');
      this._portfolioAnalyzer = new PortfolioAnalyzer(this.brapiClient);
    }
    return this._portfolioAnalyzer;
  }

  get aporteRecommender() {
    if (!this._aporteRecommender) {
      const { AporteRecommender } = require('./analyzers/aporte-recommender');
      this._aporteRecommender = new AporteRecommender(this.brapiClient);
    }
    return this._aporteRecommender;
  }

  get investmentCalculator() {
    if (!this._investmentCalculator) {
      const { InvestmentCalculator } = require('./calculators/investment-calculator');
      this._investmentCalculator = new InvestmentCalculator();
    }
    return this._investmentCalculator;
  }

  /**
   * Etapa de Recepção
   */
  async receptionStep(input) {
    logger.info('InvestmentsAgent: Etapa de Recepção');

    const { query, doc, memory } = input;

    // Identificar tipo de operação
    const investmentType = this._identifyInvestmentType(query, doc);

    // Extrair parâmetros
    const params = this._extractInvestmentParams(query, doc, memory);

    return {
      originalQuery: query,
      investmentType,
      params,
      userId: memory?.userId || 'unknown',
      context: {
        hasTicker: !!params.ticker,
        hasPortfolio: !!params.portfolio,
        hasAmount: !!params.amount,
        hasRate: !!params.rate
      }
    };
  }

  /**
   * Etapa de Metacognição
   */
  async metacognitionStep(reception) {
    logger.info('InvestmentsAgent: Etapa de Metacognição');

    const questions = {
      understood: this._assessUnderstanding(reception),
      hasAllInfo: this._checkRequiredInfo(reception),
      approach: this._determineApproach(reception),
      risks: this._identifyRisks(reception)
    };

    return {
      ...questions,
      readyToExecute: questions.understood.confident && questions.hasAllInfo.sufficient,
      needsMoreData: !questions.hasAllInfo.sufficient,
      missingInfo: questions.hasAllInfo.missing,
      needsExternalApi: this._needsExternalApi(reception.investmentType)
    };
  }

  /**
   * Etapa de Planejamento
   */
  async planningStep(metacognition, reception) {
    logger.info('InvestmentsAgent: Etapa de Planejamento');

    const steps = [];

    switch (reception.investmentType) {
      case INVESTMENT_TYPES.GET_QUOTE:
        steps.push(
          { action: 'validate_ticker', required: true },
          { action: 'fetch_quote_brapi', required: true },
          { action: 'format_response', required: true }
        );
        break;

      case INVESTMENT_TYPES.ANALYZE_PORTFOLIO:
        steps.push(
          { action: 'load_portfolio', required: true },
          { action: 'fetch_prices', required: true },
          { action: 'classify_assets', required: true },
          { action: 'calculate_metrics', required: true },
          { action: 'generate_insights', required: true }
        );
        break;

      case INVESTMENT_TYPES.RECOMMEND_APORTE:
        steps.push(
          { action: 'validate_amount', required: true },
          { action: 'load_portfolio', required: !!reception.params.portfolio },
          { action: 'determine_strategy', required: true },
          { action: 'generate_allocation', required: true },
          { action: 'suggest_assets', required: false }
        );
        break;

      case INVESTMENT_TYPES.CALCULATE_INVESTMENT:
        steps.push(
          { action: 'validate_params', required: true },
          { action: 'calculate_projection', required: true },
          { action: 'generate_evolution', required: true }
        );
        break;

      case INVESTMENT_TYPES.COMPARE_INVESTMENTS:
        steps.push(
          { action: 'validate_investments', required: true },
          { action: 'calculate_all', required: true },
          { action: 'apply_taxes', required: true },
          { action: 'rank_results', required: true }
        );
        break;

      case INVESTMENT_TYPES.TIME_TO_GOAL:
        steps.push(
          { action: 'validate_goal', required: true },
          { action: 'calculate_time', required: true }
        );
        break;

      case INVESTMENT_TYPES.REQUIRED_CONTRIBUTION:
        steps.push(
          { action: 'validate_goal', required: true },
          { action: 'calculate_contribution', required: true }
        );
        break;

      case INVESTMENT_TYPES.MARKET_OVERVIEW:
        steps.push(
          { action: 'fetch_ibov', required: true },
          { action: 'fetch_currency', required: true },
          { action: 'fetch_trending', required: false }
        );
        break;

      default:
        steps.push({ action: 'analyze_request', required: true });
    }

    return {
      type: reception.investmentType,
      steps: steps.filter(s => s.required !== false),
      requiresApi: this._needsExternalApi(reception.investmentType)
    };
  }

  /**
   * Etapa de Execução
   */
  async executeStep(plan, reception) {
    logger.info('InvestmentsAgent: Etapa de Execução', { type: plan.type });

    try {
      let result;

      switch (plan.type) {
        case INVESTMENT_TYPES.GET_QUOTE:
          result = await this.getQuote(reception.params);
          break;

        case INVESTMENT_TYPES.ANALYZE_PORTFOLIO:
          result = await this.analyzePortfolio(reception.params);
          break;

        case INVESTMENT_TYPES.RECOMMEND_APORTE:
          result = await this.recommendAporte(reception.params);
          break;

        case INVESTMENT_TYPES.CALCULATE_INVESTMENT:
          result = await this.calculateInvestment(reception.params);
          break;

        case INVESTMENT_TYPES.COMPARE_INVESTMENTS:
          result = await this.compareInvestments(reception.params);
          break;

        case INVESTMENT_TYPES.TIME_TO_GOAL:
          result = await this.calculateTimeToGoal(reception.params);
          break;

        case INVESTMENT_TYPES.REQUIRED_CONTRIBUTION:
          result = await this.calculateRequiredContribution(reception.params);
          break;

        case INVESTMENT_TYPES.MARKET_OVERVIEW:
          result = await this.getMarketOverview(reception.params);
          break;

        default:
          throw new Error(`Tipo de operação não suportado: ${plan.type}`);
      }

      return {
        success: true,
        type: plan.type,
        data: result
      };

    } catch (error) {
      logger.error('InvestmentsAgent: Erro na execução', { error: error.message });
      return {
        success: false,
        type: plan.type,
        error: error.message
      };
    }
  }

  /**
   * Etapa de Validação
   */
  async validationStep(execution) {
    logger.info('InvestmentsAgent: Etapa de Validação');

    if (!execution.success) {
      return {
        valid: false,
        reason: execution.error,
        canRetry: execution.error?.includes('API') || execution.error?.includes('network')
      };
    }

    const validations = [];
    const data = execution.data;

    switch (execution.type) {
      case INVESTMENT_TYPES.GET_QUOTE:
        validations.push({
          check: 'has_price',
          passed: !!data.price || (data.results && data.results.length > 0),
          message: 'Cotação obtida com sucesso'
        });
        break;

      case INVESTMENT_TYPES.ANALYZE_PORTFOLIO:
        validations.push({
          check: 'has_summary',
          passed: !!data.summary,
          message: 'Análise contém resumo'
        });
        validations.push({
          check: 'has_allocation',
          passed: !!data.allocation && data.allocation.length > 0,
          message: 'Alocação calculada'
        });
        break;

      case INVESTMENT_TYPES.RECOMMEND_APORTE:
        validations.push({
          check: 'has_allocation',
          passed: !!data.allocation && data.allocation.length > 0,
          message: 'Recomendação de alocação gerada'
        });
        break;

      case INVESTMENT_TYPES.CALCULATE_INVESTMENT:
        validations.push({
          check: 'has_result',
          passed: !!data.result,
          message: 'Cálculo realizado'
        });
        break;
    }

    const allPassed = validations.every(v => v.passed);

    return {
      valid: allPassed,
      validations,
      warnings: validations.filter(v => !v.passed).map(v => v.message)
    };
  }

  /**
   * Etapa de Entrega
   */
  async deliveryStep(validation, execution, reception) {
    logger.info('InvestmentsAgent: Etapa de Entrega');

    if (!validation.valid) {
      return {
        status: COORDINATOR_STATUS.ERROR,
        message: 'Resultado não passou nas validações',
        warnings: validation.warnings,
        raw: execution.data
      };
    }

    const formattedResponse = this._formatResponse(
      execution.type,
      execution.data,
      reception.originalQuery
    );

    return {
      status: COORDINATOR_STATUS.SUCCESS,
      type: execution.type,
      result: execution.data,
      response: formattedResponse,
      summary: this._generateSummary(execution.type, execution.data)
    };
  }

  // ========== Métodos de Investimento ==========

  /**
   * Obtém cotação de ativo
   */
  async getQuote(params) {
    const { ticker, options = {} } = params;
    
    if (!ticker) {
      throw new Error('Ticker não informado');
    }

    const result = await this.brapiClient.getQuote(ticker, {
      fundamental: options.fundamental || false,
      dividends: options.dividends || false,
      range: options.range
    });

    if (!result.success || result.results.length === 0) {
      throw new Error(`Não foi possível obter cotação para ${ticker}`);
    }

    return result.results[0];
  }

  /**
   * Analisa carteira de investimentos
   */
  async analyzePortfolio(params) {
    const { portfolio, profile = 'MODERADO' } = params;

    if (!portfolio || !portfolio.assets) {
      throw new Error('Portfólio não informado ou vazio');
    }

    return this.portfolioAnalyzer.analyze(portfolio, {
      fetchPrices: true,
      calculateRisk: true,
      profile
    });
  }

  /**
   * Recomenda alocação de aporte
   */
  async recommendAporte(params) {
    const {
      amount,
      portfolio = null,
      profile = 'MODERADO',
      strategy = 'rebalanceamento',
      goals = []
    } = params;

    if (!amount || amount <= 0) {
      throw new Error('Valor de aporte inválido');
    }

    return this.aporteRecommender.recommend({
      amount,
      portfolio,
      profile,
      strategy,
      goals
    });
  }

  /**
   * Calcula projeção de investimento
   */
  async calculateInvestment(params) {
    const {
      initialAmount = 0,
      monthlyContribution = 0,
      annualRate,
      period,
      inflationAdjusted = false
    } = params;

    if (!annualRate) {
      throw new Error('Taxa de rendimento não informada');
    }

    if (!period) {
      throw new Error('Período não informado');
    }

    return this.investmentCalculator.calculate({
      initialAmount,
      monthlyContribution,
      annualRate,
      period,
      inflationAdjusted
    });
  }

  /**
   * Compara investimentos
   */
  async compareInvestments(params) {
    const {
      initialAmount = 0,
      monthlyContribution = 0,
      period,
      investments = []
    } = params;

    if (investments.length < 2) {
      // Comparar com benchmarks
      return this.investmentCalculator.compareWithBenchmarks({
        initialAmount,
        monthlyContribution,
        period,
        annualRate: investments[0]?.annualRate || 10
      });
    }

    return this.investmentCalculator.compare({
      initialAmount,
      monthlyContribution,
      period,
      investments
    });
  }

  /**
   * Calcula tempo para atingir meta
   */
  async calculateTimeToGoal(params) {
    const {
      targetAmount,
      initialAmount = 0,
      monthlyContribution,
      annualRate
    } = params;

    if (!targetAmount) {
      throw new Error('Meta não informada');
    }

    return this.investmentCalculator.timeToGoal({
      targetAmount,
      initialAmount,
      monthlyContribution,
      annualRate: annualRate || 10
    });
  }

  /**
   * Calcula contribuição necessária
   */
  async calculateRequiredContribution(params) {
    const {
      targetAmount,
      initialAmount = 0,
      period,
      annualRate
    } = params;

    if (!targetAmount || !period) {
      throw new Error('Meta e período são obrigatórios');
    }

    return this.investmentCalculator.requiredContribution({
      targetAmount,
      initialAmount,
      period,
      annualRate: annualRate || 10
    });
  }

  /**
   * Obtém visão geral do mercado
   */
  async getMarketOverview(params) {
    const [ibov, dolar, btc] = await Promise.all([
      this.brapiClient.getQuote('^BVSP').catch(() => null),
      this.brapiClient.getExchangeRate('USD', 'BRL').catch(() => null),
      this.brapiClient.getCryptoQuote('BTC').catch(() => null)
    ]);

    return {
      ibovespa: ibov?.results?.[0] ? {
        value: ibov.results[0].price,
        change: ibov.results[0].changePercent,
        formatted: ibov.results[0].price?.toLocaleString('pt-BR')
      } : null,
      dolar: dolar ? {
        value: dolar.rate,
        formatted: mathModule.formatCurrency(dolar.rate)
      } : null,
      bitcoin: btc?.results?.[0] ? {
        value: btc.results[0].price,
        change: btc.results[0].changePercent24h,
        formatted: mathModule.formatCurrency(btc.results[0].price)
      } : null,
      timestamp: new Date().toISOString()
    };
  }

  // ========== Métodos Auxiliares ==========

  /**
   * Identifica tipo de operação
   */
  _identifyInvestmentType(query, doc) {
    const queryLower = query.toLowerCase();

    if (doc?.taskType) {
      const typeMap = {
        'cotacao': INVESTMENT_TYPES.GET_QUOTE,
        'analisar_carteira': INVESTMENT_TYPES.ANALYZE_PORTFOLIO,
        'recomendar_aporte': INVESTMENT_TYPES.RECOMMEND_APORTE,
        'calcular': INVESTMENT_TYPES.CALCULATE_INVESTMENT,
        'comparar': INVESTMENT_TYPES.COMPARE_INVESTMENTS
      };
      if (typeMap[doc.taskType]) return typeMap[doc.taskType];
    }

    // Detecção por palavras-chave
    if (queryLower.includes('cotação') || queryLower.includes('cotacao') ||
        queryLower.includes('preço') || queryLower.includes('preco') ||
        queryLower.match(/\b[a-z]{4}\d{1,2}\b/i)) {
      return INVESTMENT_TYPES.GET_QUOTE;
    }

    if (queryLower.includes('carteira') || queryLower.includes('portfólio')) {
      return INVESTMENT_TYPES.ANALYZE_PORTFOLIO;
    }

    if (queryLower.includes('aporte') || queryLower.includes('investir') && 
        queryLower.includes('como')) {
      return INVESTMENT_TYPES.RECOMMEND_APORTE;
    }

    if (queryLower.includes('comparar') || queryLower.includes('versus') ||
        queryLower.includes(' x ') || queryLower.includes(' vs ')) {
      return INVESTMENT_TYPES.COMPARE_INVESTMENTS;
    }

    if (queryLower.includes('quanto tempo') || queryLower.includes('quando')) {
      return INVESTMENT_TYPES.TIME_TO_GOAL;
    }

    if (queryLower.includes('quanto preciso') || queryLower.includes('quanto investir')) {
      return INVESTMENT_TYPES.REQUIRED_CONTRIBUTION;
    }

    if (queryLower.includes('mercado') || queryLower.includes('ibov') ||
        queryLower.includes('bolsa')) {
      return INVESTMENT_TYPES.MARKET_OVERVIEW;
    }

    if (queryLower.includes('render') || queryLower.includes('juros') ||
        queryLower.includes('calcular')) {
      return INVESTMENT_TYPES.CALCULATE_INVESTMENT;
    }

    return INVESTMENT_TYPES.GET_QUOTE; // Default
  }

  /**
   * Extrai parâmetros de investimento
   */
  _extractInvestmentParams(query, doc, memory) {
    const params = {
      userId: memory?.userId || 'unknown'
    };

    // Extrair tickers (PETR4, VALE3, etc)
    const tickerPattern = /\b([A-Za-z]{4}\d{1,2})\b/gi;
    const tickers = query.match(tickerPattern);
    if (tickers) {
      params.ticker = tickers[0].toUpperCase();
      if (tickers.length > 1) {
        params.tickers = tickers.map(t => t.toUpperCase());
      }
    }

    // Extrair valores monetários
    const moneyPattern = /R\$\s*([\d.,]+)|(\d+(?:\.\d{3})*(?:,\d{2})?)\s*(?:reais|mil)/gi;
    const moneyMatches = query.match(moneyPattern);
    if (moneyMatches) {
      const values = moneyMatches.map(m => 
        parseFloat(m.replace(/[R$\s.]/g, '').replace(',', '.'))
      );
      if (values.length > 0) {
        params.amount = values[0];
        if (values.length > 1) {
          params.targetAmount = values[1];
        }
      }
    }

    // Extrair taxas
    const ratePattern = /(\d+(?:[.,]\d+)?)\s*%/g;
    const rates = query.match(ratePattern);
    if (rates) {
      params.annualRate = parseFloat(rates[0].replace(',', '.'));
    }

    // Extrair períodos
    const periodPatterns = [
      { pattern: /(\d+)\s*anos?/i, multiplier: 12 },
      { pattern: /(\d+)\s*meses?/i, multiplier: 1 }
    ];

    for (const { pattern, multiplier } of periodPatterns) {
      const match = query.match(pattern);
      if (match) {
        params.period = parseInt(match[1]) * multiplier;
        break;
      }
    }

    // Dados do DOC se disponível
    if (doc) {
      params.portfolio = doc.portfolio || params.portfolio;
      params.profile = doc.profile || params.profile;
    }

    return params;
  }

  _assessUnderstanding(reception) {
    return {
      confident: reception.investmentType !== null,
      investmentType: reception.investmentType,
      clarity: reception.context.hasTicker || reception.context.hasAmount ? 'high' : 'medium'
    };
  }

  _checkRequiredInfo(reception) {
    const missing = [];
    const { investmentType, params, context } = reception;

    switch (investmentType) {
      case INVESTMENT_TYPES.GET_QUOTE:
        if (!context.hasTicker) missing.push('ticker');
        break;
      case INVESTMENT_TYPES.RECOMMEND_APORTE:
        if (!context.hasAmount) missing.push('valor_aporte');
        break;
      case INVESTMENT_TYPES.CALCULATE_INVESTMENT:
        if (!context.hasRate) missing.push('taxa_rendimento');
        if (!params.period) missing.push('periodo');
        break;
    }

    return {
      sufficient: missing.length === 0,
      missing
    };
  }

  _determineApproach(reception) {
    return {
      primary: reception.investmentType,
      willUseApi: this._needsExternalApi(reception.investmentType),
      estimatedSteps: 3
    };
  }

  _identifyRisks(reception) {
    const risks = [];

    if (this._needsExternalApi(reception.investmentType)) {
      risks.push({
        type: 'external_dependency',
        description: 'Depende de API externa (Brapi)'
      });
    }

    return risks;
  }

  _needsExternalApi(type) {
    return [
      INVESTMENT_TYPES.GET_QUOTE,
      INVESTMENT_TYPES.ANALYZE_PORTFOLIO,
      INVESTMENT_TYPES.MARKET_OVERVIEW
    ].includes(type);
  }

  _formatResponse(type, data, query) {
    switch (type) {
      case INVESTMENT_TYPES.GET_QUOTE:
        if (data.price) {
          const changeEmoji = data.changePercent >= 0 ? '📈' : '📉';
          return `${changeEmoji} **${data.symbol}** (${data.shortName || data.longName})\n` +
                 `Preço: ${mathModule.formatCurrency(data.price)}\n` +
                 `Variação: ${data.changePercent >= 0 ? '+' : ''}${data.changePercent?.toFixed(2)}%`;
        }
        return 'Cotação não disponível';

      case INVESTMENT_TYPES.ANALYZE_PORTFOLIO:
        return `📊 Análise do Portfólio\n` +
               `Valor Total: ${data.summary?.totalValue?.formatted}\n` +
               `Ganho/Perda: ${data.summary?.totalGain?.formatted} (${data.summary?.totalGain?.percentage?.toFixed(2)}%)\n` +
               `${data.insights?.length || 0} insights gerados`;

      case INVESTMENT_TYPES.RECOMMEND_APORTE:
        return `💰 Recomendação de Aporte: ${data.aporteAmount?.formatted}\n` +
               `Estratégia: ${data.strategy}\n` +
               data.allocation.map(a => 
                 `• ${a.class}: ${a.percentage.toFixed(0)}% (${a.formatted})`
               ).join('\n');

      case INVESTMENT_TYPES.CALCULATE_INVESTMENT:
        return `📈 Projeção de Investimento\n` +
               `Valor Final: ${data.result?.finalBalance?.formatted}\n` +
               `Total Investido: ${data.result?.totalContributed?.formatted}\n` +
               `Rendimento: ${data.result?.totalEarnings?.formatted} (${data.result?.returnPercentage?.total?.toFixed(2)}%)`;

      default:
        return 'Operação concluída com sucesso.';
    }
  }

  _generateSummary(type, data) {
    switch (type) {
      case INVESTMENT_TYPES.GET_QUOTE:
        return {
          ticker: data.symbol,
          price: data.price,
          change: data.changePercent
        };

      case INVESTMENT_TYPES.ANALYZE_PORTFOLIO:
        return {
          totalValue: data.summary?.totalValue?.value,
          assetCount: data.summary?.assetCount,
          profile: data.summary?.profile
        };

      default:
        return { completed: true };
    }
  }

  _getDefaultPrompt() {
    return `Você é o Agente de Investimentos.

Sua especialidade é ajudar usuários com:
- Consulta de cotações de ações, FIIs, ETFs e cripto
- Análise de carteiras de investimento
- Recomendações de alocação de aportes
- Cálculos de rendimentos e projeções
- Comparação de opções de investimento

Sempre seja preciso com números e claro sobre riscos.
Investimentos têm riscos - deixe isso claro.`;
  }

  /**
   * Health check
   */
  async healthCheck() {
    const brapiStatus = await this.brapiClient.healthCheck().catch(() => ({ status: 'error' }));
    
    return {
      status: brapiStatus.status === 'healthy' ? 'healthy' : 'degraded',
      name: this.name,
      domain: this.domain,
      externalApis: {
        brapi: brapiStatus
      }
    };
  }
}

module.exports = { 
  InvestmentsAgent, 
  INVESTMENT_TYPES,
  INVESTMENT_CONTRACT
};
