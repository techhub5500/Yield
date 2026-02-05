/**
 * Portfolio Analyzer - Analisador de Portfólio
 * Fase 5 - Agentes Coordenadores
 * 
 * Analisa carteiras de investimento, calcula métricas
 * de risco/retorno e sugere otimizações.
 */

const { logger } = require('../../../../../utils/logger');
const { mathModule } = require('../../math/math-module');

/**
 * Tipos de ativos para classificação
 */
const ASSET_CLASSES = {
  RENDA_FIXA: 'renda_fixa',
  RENDA_VARIAVEL: 'renda_variavel',
  FUNDOS: 'fundos',
  IMOBILIARIO: 'imobiliario',
  INTERNACIONAL: 'internacional',
  CRIPTO: 'cripto',
  OUTROS: 'outros'
};

/**
 * Classificação de ativos por ticker
 */
const ASSET_CLASSIFICATION = {
  // Renda Fixa
  'tesouro': ASSET_CLASSES.RENDA_FIXA,
  'cdb': ASSET_CLASSES.RENDA_FIXA,
  'lci': ASSET_CLASSES.RENDA_FIXA,
  'lca': ASSET_CLASSES.RENDA_FIXA,
  'debenture': ASSET_CLASSES.RENDA_FIXA,
  
  // Sufixos de FIIs
  '11': ASSET_CLASSES.IMOBILIARIO,
  
  // Sufixos de ações
  '3': ASSET_CLASSES.RENDA_VARIAVEL,
  '4': ASSET_CLASSES.RENDA_VARIAVEL,
  '5': ASSET_CLASSES.RENDA_VARIAVEL,
  '6': ASSET_CLASSES.RENDA_VARIAVEL,
  
  // ETFs internacionais
  'ivvb': ASSET_CLASSES.INTERNACIONAL,
  'spxi': ASSET_CLASSES.INTERNACIONAL,
  'hash': ASSET_CLASSES.CRIPTO
};

/**
 * Perfis de investidor
 */
const INVESTOR_PROFILES = {
  CONSERVADOR: {
    name: 'Conservador',
    targetAllocation: {
      [ASSET_CLASSES.RENDA_FIXA]: { min: 70, max: 100 },
      [ASSET_CLASSES.RENDA_VARIAVEL]: { min: 0, max: 15 },
      [ASSET_CLASSES.IMOBILIARIO]: { min: 0, max: 10 },
      [ASSET_CLASSES.INTERNACIONAL]: { min: 0, max: 5 },
      [ASSET_CLASSES.CRIPTO]: { min: 0, max: 0 }
    }
  },
  MODERADO: {
    name: 'Moderado',
    targetAllocation: {
      [ASSET_CLASSES.RENDA_FIXA]: { min: 40, max: 60 },
      [ASSET_CLASSES.RENDA_VARIAVEL]: { min: 20, max: 40 },
      [ASSET_CLASSES.IMOBILIARIO]: { min: 5, max: 20 },
      [ASSET_CLASSES.INTERNACIONAL]: { min: 5, max: 15 },
      [ASSET_CLASSES.CRIPTO]: { min: 0, max: 5 }
    }
  },
  ARROJADO: {
    name: 'Arrojado',
    targetAllocation: {
      [ASSET_CLASSES.RENDA_FIXA]: { min: 10, max: 30 },
      [ASSET_CLASSES.RENDA_VARIAVEL]: { min: 40, max: 60 },
      [ASSET_CLASSES.IMOBILIARIO]: { min: 10, max: 25 },
      [ASSET_CLASSES.INTERNACIONAL]: { min: 10, max: 25 },
      [ASSET_CLASSES.CRIPTO]: { min: 0, max: 10 }
    }
  }
};

class PortfolioAnalyzer {
  constructor(brapiClient) {
    this.brapiClient = brapiClient;
  }

  /**
   * Analisa um portfólio completo
   * 
   * @param {Object} portfolio - Portfólio do usuário
   * @param {Object} options - Opções de análise
   * @returns {Promise<Object>} Análise completa
   */
  async analyze(portfolio, options = {}) {
    const {
      fetchPrices = true,
      calculateRisk = true,
      profile = 'MODERADO'
    } = options;

    logger.info('PortfolioAnalyzer: Analisando portfólio', {
      assetCount: portfolio.assets?.length
    });

    try {
      let enrichedAssets = portfolio.assets || [];

      // 1. Buscar preços atuais
      if (fetchPrices && this.brapiClient) {
        enrichedAssets = await this._enrichWithPrices(enrichedAssets);
      }

      // 2. Classificar ativos
      const classifiedAssets = this._classifyAssets(enrichedAssets);

      // 3. Calcular totais e alocação
      const totals = this._calculateTotals(classifiedAssets);

      // 4. Calcular métricas de risco
      let riskMetrics = null;
      if (calculateRisk && enrichedAssets.some(a => a.historicalPrices)) {
        riskMetrics = this._calculateRiskMetrics(enrichedAssets);
      }

      // 5. Comparar com perfil
      const profileAnalysis = this._analyzeVsProfile(
        totals.allocation,
        INVESTOR_PROFILES[profile]
      );

      // 6. Gerar insights
      const insights = this._generateInsights(
        classifiedAssets,
        totals,
        riskMetrics,
        profileAnalysis
      );

      // 7. Sugerir rebalanceamento
      const rebalancing = this._suggestRebalancing(
        totals.allocation,
        INVESTOR_PROFILES[profile],
        totals.totalValue
      );

      return {
        summary: {
          totalValue: {
            value: totals.totalValue,
            formatted: mathModule.formatCurrency(totals.totalValue)
          },
          totalCost: {
            value: totals.totalCost,
            formatted: mathModule.formatCurrency(totals.totalCost)
          },
          totalGain: {
            value: totals.totalValue - totals.totalCost,
            formatted: mathModule.formatCurrency(totals.totalValue - totals.totalCost),
            percentage: totals.totalCost > 0 
              ? ((totals.totalValue - totals.totalCost) / totals.totalCost) * 100 
              : 0
          },
          assetCount: classifiedAssets.length,
          profile
        },

        allocation: totals.allocation,
        allocationChart: this._formatForChart(totals.allocation),

        assets: classifiedAssets.map(a => ({
          ...a,
          weight: (a.currentValue / totals.totalValue) * 100,
          gain: {
            value: a.currentValue - a.totalCost,
            percentage: a.totalCost > 0 
              ? ((a.currentValue - a.totalCost) / a.totalCost) * 100 
              : 0
          }
        })),

        risk: riskMetrics,
        profileAnalysis,
        insights,
        rebalancing,

        analyzedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('PortfolioAnalyzer: Erro na análise', { error: error.message });
      throw error;
    }
  }

  /**
   * Calcula rentabilidade do portfólio
   * 
   * @param {Object} portfolio - Portfólio
   * @param {string} period - Período (1m, 3m, 6m, 1y, ytd)
   * @returns {Promise<Object>} Rentabilidade
   */
  async calculateReturns(portfolio, period = '1m') {
    const assets = portfolio.assets || [];
    const returns = [];
    
    for (const asset of assets) {
      if (asset.type !== ASSET_CLASSES.RENDA_FIXA) {
        try {
          // Buscar dados históricos
          const data = await this.brapiClient.getQuote(asset.ticker, {
            range: period
          });

          if (data.success && data.results[0]?.historicalData) {
            const history = data.results[0].historicalData;
            const startPrice = history[0]?.close;
            const endPrice = history[history.length - 1]?.close;
            
            if (startPrice && endPrice) {
              const returnPct = ((endPrice - startPrice) / startPrice) * 100;
              returns.push({
                ticker: asset.ticker,
                startPrice,
                endPrice,
                returnPercent: returnPct,
                contribution: returnPct * (asset.weight || 0) / 100
              });
            }
          }
        } catch (error) {
          logger.warn('PortfolioAnalyzer: Erro ao buscar retorno', {
            ticker: asset.ticker,
            error: error.message
          });
        }
      }
    }

    const totalReturn = returns.reduce((sum, r) => sum + r.contribution, 0);

    return {
      period,
      assets: returns,
      totalReturn: {
        percentage: totalReturn,
        formatted: `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`
      }
    };
  }

  /**
   * Enriquece ativos com preços atuais
   */
  async _enrichWithPrices(assets) {
    const tickers = assets
      .filter(a => a.ticker && a.type !== ASSET_CLASSES.RENDA_FIXA)
      .map(a => a.ticker);

    if (tickers.length === 0) return assets;

    try {
      const quotes = await this.brapiClient.getQuote(tickers);
      const priceMap = new Map(
        quotes.results?.map(q => [q.symbol, q]) || []
      );

      return assets.map(asset => {
        const quote = priceMap.get(asset.ticker);
        if (quote) {
          return {
            ...asset,
            currentPrice: quote.price,
            currentValue: quote.price * asset.quantity,
            change: quote.change,
            changePercent: quote.changePercent,
            lastUpdate: quote.updatedAt
          };
        }
        return {
          ...asset,
          currentValue: asset.currentValue || asset.totalCost
        };
      });
    } catch (error) {
      logger.warn('PortfolioAnalyzer: Erro ao buscar preços', {
        error: error.message
      });
      return assets;
    }
  }

  /**
   * Classifica ativos por classe
   */
  _classifyAssets(assets) {
    return assets.map(asset => {
      let assetClass = asset.class || ASSET_CLASSES.OUTROS;

      if (!asset.class && asset.ticker) {
        const ticker = asset.ticker.toLowerCase();
        
        // Verificar sufixo numérico
        const lastTwo = ticker.slice(-2);
        if (lastTwo === '11') {
          assetClass = ASSET_CLASSES.IMOBILIARIO;
        } else if (['3', '4', '5', '6'].includes(ticker.slice(-1))) {
          assetClass = ASSET_CLASSES.RENDA_VARIAVEL;
        }

        // Verificar prefixos conhecidos
        Object.entries(ASSET_CLASSIFICATION).forEach(([key, value]) => {
          if (ticker.includes(key)) {
            assetClass = value;
          }
        });
      }

      return {
        ...asset,
        class: assetClass
      };
    });
  }

  /**
   * Calcula totais e alocação
   */
  _calculateTotals(assets) {
    const byClass = {};
    let totalValue = 0;
    let totalCost = 0;

    assets.forEach(asset => {
      const value = asset.currentValue || asset.totalCost || 0;
      const cost = asset.totalCost || 0;
      
      totalValue += value;
      totalCost += cost;

      if (!byClass[asset.class]) {
        byClass[asset.class] = {
          class: asset.class,
          value: 0,
          cost: 0,
          assets: []
        };
      }

      byClass[asset.class].value += value;
      byClass[asset.class].cost += cost;
      byClass[asset.class].assets.push(asset);
    });

    // Calcular percentuais
    const allocation = Object.values(byClass).map(group => ({
      ...group,
      percentage: totalValue > 0 ? (group.value / totalValue) * 100 : 0,
      formatted: {
        value: mathModule.formatCurrency(group.value),
        percentage: `${((group.value / totalValue) * 100).toFixed(1)}%`
      }
    }));

    return {
      totalValue,
      totalCost,
      allocation
    };
  }

  /**
   * Calcula métricas de risco
   */
  _calculateRiskMetrics(assets) {
    // Coletar retornos históricos
    const returns = [];
    
    assets.forEach(asset => {
      if (asset.historicalPrices) {
        const prices = asset.historicalPrices;
        for (let i = 1; i < prices.length; i++) {
          const ret = (prices[i] - prices[i-1]) / prices[i-1];
          returns.push(ret);
        }
      }
    });

    if (returns.length < 2) {
      return null;
    }

    // Calcular métricas
    const volatility = mathModule.calculateVolatility(returns);
    const sharpe = mathModule.calculateSharpeRatio(
      returns.reduce((a, b) => a + b, 0) / returns.length * 252, // Anualizado
      volatility * Math.sqrt(252), // Volatilidade anualizada
      0.1075 // Selic aproximada
    );

    // VaR simplificado (95%)
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const varIndex = Math.floor(returns.length * 0.05);
    const var95 = sortedReturns[varIndex];

    return {
      volatility: {
        daily: volatility,
        annualized: volatility * Math.sqrt(252),
        formatted: `${(volatility * Math.sqrt(252) * 100).toFixed(2)}% a.a.`
      },
      sharpeRatio: {
        value: sharpe,
        interpretation: sharpe > 1 ? 'Bom' : sharpe > 0.5 ? 'Adequado' : 'Baixo'
      },
      valueAtRisk: {
        var95: var95,
        formatted: `${(var95 * 100).toFixed(2)}%`,
        interpretation: 'Perda máxima esperada em 95% dos dias'
      }
    };
  }

  /**
   * Analisa alocação vs perfil de investidor
   */
  _analyzeVsProfile(currentAllocation, profile) {
    const analysis = {
      profile: profile.name,
      deviations: [],
      aligned: true
    };

    Object.entries(profile.targetAllocation).forEach(([assetClass, target]) => {
      const current = currentAllocation.find(a => a.class === assetClass);
      const currentPct = current?.percentage || 0;

      const deviation = {
        class: assetClass,
        current: currentPct,
        target: { min: target.min, max: target.max },
        status: 'aligned'
      };

      if (currentPct < target.min) {
        deviation.status = 'below';
        deviation.adjustment = target.min - currentPct;
        analysis.aligned = false;
      } else if (currentPct > target.max) {
        deviation.status = 'above';
        deviation.adjustment = currentPct - target.max;
        analysis.aligned = false;
      }

      analysis.deviations.push(deviation);
    });

    return analysis;
  }

  /**
   * Gera insights sobre o portfólio
   */
  _generateInsights(assets, totals, riskMetrics, profileAnalysis) {
    const insights = [];

    // Concentração excessiva
    const topAsset = assets.reduce((max, a) => 
      (a.currentValue || 0) > (max.currentValue || 0) ? a : max
    , assets[0]);

    if (topAsset && totals.totalValue > 0) {
      const concentration = ((topAsset.currentValue || 0) / totals.totalValue) * 100;
      if (concentration > 20) {
        insights.push({
          type: 'warning',
          title: 'Concentração elevada',
          message: `${topAsset.ticker || topAsset.name} representa ${concentration.toFixed(1)}% do portfólio`,
          recommendation: 'Considere diversificar para reduzir risco específico'
        });
      }
    }

    // Poucas classes de ativos
    const classCount = totals.allocation.filter(a => a.percentage > 5).length;
    if (classCount < 3) {
      insights.push({
        type: 'info',
        title: 'Diversificação limitada',
        message: `Portfólio concentrado em ${classCount} classe(s) de ativos`,
        recommendation: 'Considere adicionar outras classes para melhor diversificação'
      });
    }

    // Desalinhamento com perfil
    if (!profileAnalysis.aligned) {
      const mainDeviations = profileAnalysis.deviations
        .filter(d => d.status !== 'aligned')
        .slice(0, 2);

      mainDeviations.forEach(d => {
        insights.push({
          type: 'attention',
          title: `Alocação de ${d.class} ${d.status === 'below' ? 'abaixo' : 'acima'} do perfil`,
          message: `Atual: ${d.current.toFixed(1)}%, Alvo: ${d.target.min}-${d.target.max}%`,
          recommendation: d.status === 'below' 
            ? `Considere aumentar exposição em ${d.class}` 
            : `Considere reduzir exposição em ${d.class}`
        });
      });
    }

    // Retorno positivo
    if (totals.totalValue > totals.totalCost) {
      const gainPct = ((totals.totalValue - totals.totalCost) / totals.totalCost) * 100;
      insights.push({
        type: 'positive',
        title: 'Portfólio valorizado',
        message: `Ganho de ${gainPct.toFixed(2)}% (${mathModule.formatCurrency(totals.totalValue - totals.totalCost)})`,
        recommendation: 'Continue monitorando e rebalanceando periodicamente'
      });
    }

    return insights;
  }

  /**
   * Sugere rebalanceamento
   */
  _suggestRebalancing(currentAllocation, profile, totalValue) {
    const suggestions = [];

    Object.entries(profile.targetAllocation).forEach(([assetClass, target]) => {
      const current = currentAllocation.find(a => a.class === assetClass);
      const currentPct = current?.percentage || 0;
      const targetMid = (target.min + target.max) / 2;

      if (currentPct < target.min) {
        const neededPct = targetMid - currentPct;
        const neededValue = (neededPct / 100) * totalValue;
        
        suggestions.push({
          action: 'comprar',
          class: assetClass,
          currentPercentage: currentPct,
          targetPercentage: targetMid,
          amount: neededValue,
          formatted: mathModule.formatCurrency(neededValue)
        });
      } else if (currentPct > target.max) {
        const excessPct = currentPct - targetMid;
        const excessValue = (excessPct / 100) * totalValue;
        
        suggestions.push({
          action: 'vender',
          class: assetClass,
          currentPercentage: currentPct,
          targetPercentage: targetMid,
          amount: excessValue,
          formatted: mathModule.formatCurrency(excessValue)
        });
      }
    });

    return {
      needed: suggestions.length > 0,
      suggestions,
      summary: suggestions.length > 0
        ? `${suggestions.length} ajuste(s) sugeridos para alinhar ao perfil ${profile.name}`
        : 'Portfólio alinhado ao perfil'
    };
  }

  /**
   * Formata dados para gráfico
   */
  _formatForChart(allocation) {
    return allocation.map(a => ({
      name: this._getClassLabel(a.class),
      value: a.percentage,
      color: this._getClassColor(a.class)
    }));
  }

  _getClassLabel(assetClass) {
    const labels = {
      [ASSET_CLASSES.RENDA_FIXA]: 'Renda Fixa',
      [ASSET_CLASSES.RENDA_VARIAVEL]: 'Ações',
      [ASSET_CLASSES.FUNDOS]: 'Fundos',
      [ASSET_CLASSES.IMOBILIARIO]: 'FIIs',
      [ASSET_CLASSES.INTERNACIONAL]: 'Internacional',
      [ASSET_CLASSES.CRIPTO]: 'Cripto',
      [ASSET_CLASSES.OUTROS]: 'Outros'
    };
    return labels[assetClass] || assetClass;
  }

  _getClassColor(assetClass) {
    const colors = {
      [ASSET_CLASSES.RENDA_FIXA]: '#4CAF50',
      [ASSET_CLASSES.RENDA_VARIAVEL]: '#2196F3',
      [ASSET_CLASSES.FUNDOS]: '#9C27B0',
      [ASSET_CLASSES.IMOBILIARIO]: '#FF9800',
      [ASSET_CLASSES.INTERNACIONAL]: '#00BCD4',
      [ASSET_CLASSES.CRIPTO]: '#F44336',
      [ASSET_CLASSES.OUTROS]: '#607D8B'
    };
    return colors[assetClass] || '#9E9E9E';
  }
}

module.exports = { 
  PortfolioAnalyzer,
  ASSET_CLASSES,
  INVESTOR_PROFILES
};
