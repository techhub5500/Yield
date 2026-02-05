/**
 * Aporte Recommender - Recomendador de Aportes
 * Fase 5 - Agentes Coordenadores
 * 
 * Sugere como alocar aportes mensais baseado
 * no portfólio atual, metas e perfil do investidor.
 */

const { logger } = require('../../../../../utils/logger');
const { mathModule } = require('../../math/math-module');
const { ASSET_CLASSES, INVESTOR_PROFILES } = require('./portfolio-analyzer');

/**
 * Estratégias de aporte
 */
const APORTE_STRATEGIES = {
  REBALANCE: 'rebalanceamento',
  GROWTH: 'crescimento',
  INCOME: 'renda',
  OPPORTUNISTIC: 'oportunidade',
  SMART_DCA: 'dca_inteligente'
};

class AporteRecommender {
  constructor(brapiClient = null) {
    this.brapiClient = brapiClient;
  }

  /**
   * Recomenda alocação de aporte
   * 
   * @param {Object} options - Opções
   * @returns {Promise<Object>} Recomendação
   */
  async recommend(options) {
    const {
      amount,
      portfolio,
      profile = 'MODERADO',
      strategy = APORTE_STRATEGIES.REBALANCE,
      goals = [],
      preferences = {}
    } = options;

    logger.info('AporteRecommender: Gerando recomendação', {
      amount,
      strategy,
      profile
    });

    try {
      // Obter perfil de investidor
      const investorProfile = INVESTOR_PROFILES[profile] || INVESTOR_PROFILES.MODERADO;

      // Analisar portfólio atual
      const currentAllocation = this._analyzeCurrentAllocation(portfolio);

      // Gerar recomendação baseada na estratégia
      let recommendation;

      switch (strategy) {
        case APORTE_STRATEGIES.REBALANCE:
          recommendation = this._rebalanceStrategy(
            amount, 
            currentAllocation, 
            investorProfile
          );
          break;

        case APORTE_STRATEGIES.GROWTH:
          recommendation = this._growthStrategy(
            amount, 
            currentAllocation, 
            investorProfile,
            preferences
          );
          break;

        case APORTE_STRATEGIES.INCOME:
          recommendation = this._incomeStrategy(
            amount, 
            currentAllocation, 
            preferences
          );
          break;

        case APORTE_STRATEGIES.OPPORTUNISTIC:
          recommendation = await this._opportunisticStrategy(
            amount, 
            currentAllocation,
            preferences
          );
          break;

        case APORTE_STRATEGIES.SMART_DCA:
          recommendation = await this._smartDCAStrategy(
            amount, 
            currentAllocation, 
            investorProfile
          );
          break;

        default:
          recommendation = this._rebalanceStrategy(
            amount, 
            currentAllocation, 
            investorProfile
          );
      }

      // Considerar metas específicas
      if (goals.length > 0) {
        recommendation = this._adjustForGoals(recommendation, goals, amount);
      }

      // Formatar resultado final
      return {
        aporteAmount: {
          value: amount,
          formatted: mathModule.formatCurrency(amount)
        },
        strategy: strategy,
        profile: investorProfile.name,
        
        // Alocação recomendada
        allocation: recommendation.allocation.map(a => ({
          ...a,
          value: a.percentage * amount / 100,
          formatted: mathModule.formatCurrency(a.percentage * amount / 100)
        })),

        // Detalhamento por ativo (se disponível)
        assetSuggestions: recommendation.assetSuggestions || [],

        // Justificativa
        reasoning: recommendation.reasoning,

        // Impacto esperado
        expectedImpact: this._calculateExpectedImpact(
          recommendation.allocation,
          amount,
          currentAllocation
        ),

        // Alertas
        warnings: recommendation.warnings || [],

        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('AporteRecommender: Erro na recomendação', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Sugere ativos específicos para aporte
   * 
   * @param {Object} options - Opções
   * @returns {Promise<Object>} Sugestões de ativos
   */
  async suggestAssets(options) {
    const {
      assetClass,
      amount,
      count = 3,
      excludeTickers = [],
      preferences = {}
    } = options;

    logger.info('AporteRecommender: Sugerindo ativos', { assetClass, amount });

    const suggestions = [];

    // Sugestões por classe (em produção, usaria dados reais)
    const assetsByClass = {
      [ASSET_CLASSES.RENDA_VARIAVEL]: [
        { ticker: 'ITUB4', name: 'Itaú Unibanco', type: 'Banco', suggestion: 'Blue chip, dividend yield consistente' },
        { ticker: 'PETR4', name: 'Petrobras', type: 'Petróleo', suggestion: 'Alto dividend yield, setor energia' },
        { ticker: 'VALE3', name: 'Vale', type: 'Mineração', suggestion: 'Exposição a commodities' },
        { ticker: 'WEGE3', name: 'WEG', type: 'Indústria', suggestion: 'Growth com qualidade' },
        { ticker: 'BBAS3', name: 'Banco do Brasil', type: 'Banco', suggestion: 'Dividend yield alto, estatal' }
      ],
      [ASSET_CLASSES.IMOBILIARIO]: [
        { ticker: 'HGLG11', name: 'CSHG Logística', type: 'Logística', suggestion: 'FII de galpões, diversificado' },
        { ticker: 'XPML11', name: 'XP Malls', type: 'Shopping', suggestion: 'FII de shoppings premium' },
        { ticker: 'KNRI11', name: 'Kinea Renda', type: 'Híbrido', suggestion: 'Lajes + Galpões' },
        { ticker: 'MXRF11', name: 'Maxi Renda', type: 'Papel', suggestion: 'FII de recebíveis, alta liquidez' },
        { ticker: 'VISC11', name: 'Vinci Shopping', type: 'Shopping', suggestion: 'Diversificação geográfica' }
      ],
      [ASSET_CLASSES.RENDA_FIXA]: [
        { name: 'Tesouro Selic', type: 'Tesouro', suggestion: 'Liquidez diária, reserva' },
        { name: 'Tesouro IPCA+ 2029', type: 'Tesouro', suggestion: 'Proteção inflação médio prazo' },
        { name: 'CDB 110% CDI', type: 'CDB', suggestion: 'Retorno acima da Selic' },
        { name: 'LCI/LCA 95% CDI', type: 'LCI/LCA', suggestion: 'Isento de IR' },
        { name: 'Tesouro Prefixado 2027', type: 'Tesouro', suggestion: 'Taxa travada se cenário permite' }
      ],
      [ASSET_CLASSES.INTERNACIONAL]: [
        { ticker: 'IVVB11', name: 'iShares S&P500', type: 'ETF', suggestion: 'S&P500 em BRL' },
        { ticker: 'SPXI11', name: 'It Now S&P500', type: 'ETF', suggestion: 'Alternativa S&P500' },
        { ticker: 'NASD11', name: 'Nasdaq 100', type: 'ETF', suggestion: 'Exposição tech' },
        { ticker: 'EURP11', name: 'Trend ETF Europa', type: 'ETF', suggestion: 'Diversificação Europa' }
      ]
    };

    const classAssets = assetsByClass[assetClass] || [];
    const filtered = classAssets.filter(a => 
      !excludeTickers.includes(a.ticker)
    );

    // Distribuir valor igualmente entre sugestões
    const perAsset = amount / Math.min(count, filtered.length);

    return filtered.slice(0, count).map(asset => ({
      ...asset,
      suggestedAmount: perAsset,
      formatted: mathModule.formatCurrency(perAsset)
    }));
  }

  /**
   * Analisa alocação atual do portfólio
   */
  _analyzeCurrentAllocation(portfolio) {
    if (!portfolio || !portfolio.assets) {
      return {
        total: 0,
        byClass: {}
      };
    }

    const byClass = {};
    let total = 0;

    portfolio.assets.forEach(asset => {
      const value = asset.currentValue || asset.totalCost || 0;
      const assetClass = asset.class || ASSET_CLASSES.OUTROS;
      
      total += value;
      byClass[assetClass] = (byClass[assetClass] || 0) + value;
    });

    // Calcular percentuais
    const allocation = Object.entries(byClass).map(([assetClass, value]) => ({
      class: assetClass,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0
    }));

    return {
      total,
      byClass,
      allocation
    };
  }

  /**
   * Estratégia de Rebalanceamento
   * Aloca para aproximar do perfil ideal
   */
  _rebalanceStrategy(amount, currentAllocation, profile) {
    const allocation = [];
    const reasoning = [];
    let remaining = amount;

    // Calcular desvios do perfil
    const deviations = [];
    
    Object.entries(profile.targetAllocation).forEach(([assetClass, target]) => {
      const current = currentAllocation.allocation.find(a => a.class === assetClass);
      const currentPct = current?.percentage || 0;
      const targetMid = (target.min + target.max) / 2;
      const deviation = targetMid - currentPct;

      if (deviation > 0) {
        deviations.push({
          class: assetClass,
          deviation,
          priority: deviation // Maior desvio = maior prioridade
        });
      }
    });

    // Ordenar por maior desvio
    deviations.sort((a, b) => b.priority - a.priority);

    // Distribuir proporcionalmente
    const totalDeviation = deviations.reduce((sum, d) => sum + d.deviation, 0);

    if (totalDeviation > 0) {
      deviations.forEach(d => {
        const proportion = d.deviation / totalDeviation;
        const classAmount = amount * proportion;
        
        allocation.push({
          class: d.class,
          percentage: proportion * 100,
          reason: `Rebalancear ${d.class} (atual abaixo do perfil)`
        });

        reasoning.push(
          `Alocar ${(proportion * 100).toFixed(0)}% em ${d.class} para aproximar do perfil`
        );
      });
    } else {
      // Se já está balanceado, manter proporção do perfil
      Object.entries(profile.targetAllocation).forEach(([assetClass, target]) => {
        const targetMid = (target.min + target.max) / 2;
        allocation.push({
          class: assetClass,
          percentage: targetMid,
          reason: 'Manter perfil balanceado'
        });
      });

      reasoning.push('Portfólio já balanceado, seguindo alocação alvo do perfil');
    }

    return { allocation, reasoning };
  }

  /**
   * Estratégia de Crescimento
   * Foco em ativos com potencial de valorização
   */
  _growthStrategy(amount, currentAllocation, profile, preferences) {
    const allocation = [];
    const reasoning = ['Foco em crescimento de capital'];

    // Priorizar ações e internacional
    const growthAllocations = {
      [ASSET_CLASSES.RENDA_VARIAVEL]: 50,
      [ASSET_CLASSES.INTERNACIONAL]: 25,
      [ASSET_CLASSES.IMOBILIARIO]: 15,
      [ASSET_CLASSES.RENDA_FIXA]: 10
    };

    // Ajustar baseado no perfil (não ultrapassar limites)
    Object.entries(growthAllocations).forEach(([assetClass, pct]) => {
      const limit = profile.targetAllocation[assetClass]?.max || pct;
      const current = currentAllocation.allocation.find(a => a.class === assetClass)?.percentage || 0;
      const newTotal = current + (pct * amount / (currentAllocation.total + amount));

      // Se ultrapassaria o limite, ajustar
      let adjustedPct = pct;
      if (newTotal > limit) {
        adjustedPct = Math.max(0, (limit - current) * ((currentAllocation.total + amount) / amount));
      }

      if (adjustedPct > 0) {
        allocation.push({
          class: assetClass,
          percentage: adjustedPct,
          reason: assetClass === ASSET_CLASSES.RENDA_VARIAVEL 
            ? 'Potencial de crescimento' 
            : 'Diversificação growth'
        });
      }
    });

    // Normalizar para 100%
    const total = allocation.reduce((sum, a) => sum + a.percentage, 0);
    allocation.forEach(a => a.percentage = (a.percentage / total) * 100);

    reasoning.push('Alocação prioriza ações e ativos com maior potencial de valorização');
    reasoning.push('Respeitando limites do perfil de investidor');

    return { allocation, reasoning };
  }

  /**
   * Estratégia de Renda
   * Foco em ativos que geram renda passiva
   */
  _incomeStrategy(amount, currentAllocation, preferences) {
    const allocation = [];
    const reasoning = ['Foco em geração de renda passiva'];

    // Priorizar FIIs e ações pagadoras de dividendos
    allocation.push({
      class: ASSET_CLASSES.IMOBILIARIO,
      percentage: 40,
      reason: 'FIIs pagam rendimentos mensais isentos de IR'
    });

    allocation.push({
      class: ASSET_CLASSES.RENDA_VARIAVEL,
      percentage: 30,
      reason: 'Ações com alto dividend yield'
    });

    allocation.push({
      class: ASSET_CLASSES.RENDA_FIXA,
      percentage: 30,
      reason: 'Renda fixa com juros semestrais'
    });

    reasoning.push('Combinação de FIIs (renda mensal) + dividendos + juros');

    // Sugerir ativos específicos de renda
    const assetSuggestions = [
      { ticker: 'MXRF11', reason: 'FII de papel, dividendos consistentes' },
      { ticker: 'ITUB4', reason: 'Dividendos trimestrais, yield ~5%' },
      { name: 'Tesouro IPCA+ com Juros', reason: 'Cupons semestrais' }
    ];

    return { allocation, reasoning, assetSuggestions };
  }

  /**
   * Estratégia Oportunista
   * Identifica oportunidades de mercado
   */
  async _opportunisticStrategy(amount, currentAllocation, preferences) {
    const allocation = [];
    const reasoning = ['Buscando oportunidades de mercado'];
    const assetSuggestions = [];

    // Em produção, analisaria indicadores de mercado
    // Por ora, sugestões baseadas em cenário típico

    // Verificar se mercado está em queda (oportunidade)
    // Isso seria verificado via API Brapi
    const marketDown = false; // Simplificado

    if (marketDown) {
      allocation.push({
        class: ASSET_CLASSES.RENDA_VARIAVEL,
        percentage: 60,
        reason: 'Mercado em correção - oportunidade de entrada'
      });
      reasoning.push('Momento favorável para aumentar posição em renda variável');
    } else {
      // Estratégia balanceada com viés defensivo
      allocation.push({
        class: ASSET_CLASSES.RENDA_FIXA,
        percentage: 40,
        reason: 'Manter reserva para oportunidades'
      });
      allocation.push({
        class: ASSET_CLASSES.RENDA_VARIAVEL,
        percentage: 35,
        reason: 'Exposição gradual a ações'
      });
      allocation.push({
        class: ASSET_CLASSES.IMOBILIARIO,
        percentage: 25,
        reason: 'FIIs com desconto sobre valor patrimonial'
      });
      
      reasoning.push('Mercado estável - alocação balanceada com reserva para oportunidades');
    }

    return { allocation, reasoning, assetSuggestions };
  }

  /**
   * Estratégia DCA Inteligente
   * Dollar Cost Averaging com ajustes táticos
   */
  async _smartDCAStrategy(amount, currentAllocation, profile) {
    const allocation = [];
    const reasoning = ['DCA inteligente com ajustes baseados em mercado'];

    // Base: alocação do perfil
    Object.entries(profile.targetAllocation).forEach(([assetClass, target]) => {
      const targetMid = (target.min + target.max) / 2;
      allocation.push({
        class: assetClass,
        percentage: targetMid,
        reason: 'Alocação base do perfil'
      });
    });

    // Ajustes táticos seriam feitos baseados em:
    // - Volatilidade recente (mais volátil = aportes menores)
    // - Tendência de preços (queda = aumentar aporte)
    // - Dividend yield atual vs histórico

    reasoning.push('Alocação segue perfil com aportes regulares');
    reasoning.push('Consistência supera market timing no longo prazo');

    return { allocation, reasoning };
  }

  /**
   * Ajusta recomendação baseado em metas
   */
  _adjustForGoals(recommendation, goals, amount) {
    const adjusted = { ...recommendation };
    
    // Verificar se há metas que requerem liquidez
    const shortTermGoals = goals.filter(g => {
      if (!g.targetDate) return false;
      const monthsAway = this._monthsUntil(g.targetDate);
      return monthsAway <= 12;
    });

    if (shortTermGoals.length > 0) {
      // Aumentar renda fixa para metas de curto prazo
      const rfAllocation = adjusted.allocation.find(a => 
        a.class === ASSET_CLASSES.RENDA_FIXA
      );
      
      if (rfAllocation) {
        const boost = Math.min(20, shortTermGoals.length * 10);
        rfAllocation.percentage += boost;
        rfAllocation.reason += ` (+${boost}% para meta curto prazo)`;

        // Reduzir proporcionalmente das outras
        const others = adjusted.allocation.filter(a => 
          a.class !== ASSET_CLASSES.RENDA_FIXA
        );
        const totalOthers = others.reduce((sum, a) => sum + a.percentage, 0);
        others.forEach(a => {
          a.percentage -= (a.percentage / totalOthers) * boost;
        });

        adjusted.reasoning.push(`Ajustado para metas de curto prazo: ${shortTermGoals.map(g => g.name).join(', ')}`);
      }
    }

    return adjusted;
  }

  /**
   * Calcula impacto esperado do aporte
   */
  _calculateExpectedImpact(allocation, amount, currentAllocation) {
    const newTotal = currentAllocation.total + amount;
    
    const impact = allocation.map(a => {
      const currentValue = currentAllocation.byClass[a.class] || 0;
      const currentPct = currentAllocation.total > 0 
        ? (currentValue / currentAllocation.total) * 100 
        : 0;
      
      const addedValue = (a.percentage / 100) * amount;
      const newValue = currentValue + addedValue;
      const newPct = (newValue / newTotal) * 100;

      return {
        class: a.class,
        before: {
          value: currentValue,
          percentage: currentPct
        },
        after: {
          value: newValue,
          percentage: newPct
        },
        change: newPct - currentPct
      };
    });

    return {
      portfolioGrowth: {
        before: currentAllocation.total,
        after: newTotal,
        percentage: currentAllocation.total > 0 
          ? (amount / currentAllocation.total) * 100 
          : 100
      },
      allocationChanges: impact.filter(i => Math.abs(i.change) > 0.1)
    };
  }

  _monthsUntil(dateStr) {
    const target = new Date(dateStr);
    const now = new Date();
    return (target.getFullYear() - now.getFullYear()) * 12 + 
           (target.getMonth() - now.getMonth());
  }
}

module.exports = { 
  AporteRecommender,
  APORTE_STRATEGIES
};
