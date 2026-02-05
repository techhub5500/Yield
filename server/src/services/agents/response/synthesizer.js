/**
 * Synthesizer - Sintetizador de Resultados
 * Fase 6 - Sistema Multi-Agente Financeiro
 * 
 * Responsável por:
 * - Combinar resultados de múltiplos agentes coordenadores
 * - Extrair insights principais
 * - Priorizar informações por relevância
 * - Resolver conflitos entre agentes
 * - Gerar estrutura da resposta
 */

const logger = require('../../../utils/logger');

/**
 * Tipos de insight que podem ser extraídos
 */
const INSIGHT_TYPES = {
  DATA: 'data',              // Dados numéricos (valores, percentuais)
  TREND: 'trend',            // Tendências (aumento, redução, estável)
  ALERT: 'alert',            // Alertas e avisos
  RECOMMENDATION: 'recommendation', // Recomendações e sugestões
  SUMMARY: 'summary',        // Resumos executivos
  ACTION: 'action'           // Ações a tomar
};

/**
 * Prioridades de conteúdo
 */
const CONTENT_PRIORITY = {
  CRITICAL: 1,     // Alertas críticos, problemas
  HIGH: 2,         // Dados diretamente relacionados à query
  MEDIUM: 3,       // Informações complementares
  LOW: 4           // Detalhes adicionais
};

class Synthesizer {
  
  constructor() {
    this.insightExtractors = {
      analysis: this.extractAnalysisInsights.bind(this),
      planning: this.extractPlanningInsights.bind(this),
      investments: this.extractInvestmentInsights.bind(this)
    };
  }

  /**
   * Combina resultados de múltiplos agentes
   * 
   * @param {Object} coordinatorResults - Resultados dos coordenadores {agent: result}
   * @returns {Object} Resultados combinados
   */
  combineResults(coordinatorResults) {
    const combined = {
      agents: [],
      allData: {},
      allSummaries: [],
      allAlerts: [],
      allRecommendations: [],
      timestamp: new Date().toISOString()
    };

    for (const [agent, resultData] of Object.entries(coordinatorResults)) {
      combined.agents.push(agent);
      
      const result = resultData.result || resultData;
      
      // Extrair dados estruturados
      if (result.content?.structuredData || result.structuredData) {
        combined.allData[agent] = result.content?.structuredData || result.structuredData;
      }

      // Extrair sumários
      if (result.content?.summary || result.summary) {
        combined.allSummaries.push({
          agent,
          summary: result.content?.summary || result.summary
        });
      }

      // Extrair alertas de qualidade
      if (result.quality?.warnings) {
        combined.allAlerts.push(...result.quality.warnings.map(w => ({
          agent,
          type: 'warning',
          message: w
        })));
      }
    }

    logger.debug('Resultados combinados', {
      agents: combined.agents,
      summaries: combined.allSummaries.length,
      alerts: combined.allAlerts.length
    });

    return combined;
  }

  /**
   * Extrai insights principais dos resultados
   * 
   * @param {Object} combinedResults - Resultados combinados
   * @returns {Array} Lista de insights
   */
  extractKeyInsights(combinedResults) {
    const insights = [];

    for (const agent of combinedResults.agents) {
      const extractor = this.insightExtractors[agent];
      if (extractor) {
        const agentData = combinedResults.allData[agent];
        if (agentData) {
          const agentInsights = extractor(agentData);
          insights.push(...agentInsights.map(i => ({ ...i, source: agent })));
        }
      }
    }

    // Adicionar sumários como insights
    for (const summaryInfo of combinedResults.allSummaries) {
      insights.push({
        type: INSIGHT_TYPES.SUMMARY,
        content: summaryInfo.summary,
        source: summaryInfo.agent,
        priority: CONTENT_PRIORITY.MEDIUM
      });
    }

    // Adicionar alertas como insights
    for (const alert of combinedResults.allAlerts) {
      insights.push({
        type: INSIGHT_TYPES.ALERT,
        content: alert.message,
        source: alert.agent,
        priority: CONTENT_PRIORITY.HIGH
      });
    }

    logger.debug('Insights extraídos', { count: insights.length });

    return insights;
  }

  /**
   * Extrai insights de resultados de análise
   */
  extractAnalysisInsights(data) {
    const insights = [];

    // Análise de gastos
    if (data.spending) {
      if (data.spending.total) {
        insights.push({
          type: INSIGHT_TYPES.DATA,
          category: 'spending_total',
          content: data.spending.total,
          label: 'Total de gastos',
          priority: CONTENT_PRIORITY.HIGH
        });
      }

      if (data.spending.byCategory) {
        insights.push({
          type: INSIGHT_TYPES.DATA,
          category: 'spending_categories',
          content: data.spending.byCategory,
          label: 'Gastos por categoria',
          priority: CONTENT_PRIORITY.HIGH
        });
      }

      if (data.spending.topCategories) {
        insights.push({
          type: INSIGHT_TYPES.DATA,
          category: 'top_categories',
          content: data.spending.topCategories,
          label: 'Principais categorias',
          priority: CONTENT_PRIORITY.HIGH
        });
      }
    }

    // Padrões detectados
    if (data.patterns) {
      if (data.patterns.subscriptions?.length > 0) {
        insights.push({
          type: INSIGHT_TYPES.DATA,
          category: 'subscriptions',
          content: data.patterns.subscriptions,
          label: 'Assinaturas identificadas',
          priority: CONTENT_PRIORITY.MEDIUM
        });
      }

      if (data.patterns.trend) {
        insights.push({
          type: INSIGHT_TYPES.TREND,
          category: 'spending_trend',
          content: data.patterns.trend,
          label: 'Tendência de gastos',
          priority: CONTENT_PRIORITY.HIGH
        });
      }
    }

    // Alertas
    if (data.alerts?.length > 0) {
      for (const alert of data.alerts) {
        insights.push({
          type: INSIGHT_TYPES.ALERT,
          category: alert.type || 'general',
          content: alert.message || alert,
          priority: CONTENT_PRIORITY.CRITICAL
        });
      }
    }

    // Fluxo de caixa
    if (data.cashflow) {
      insights.push({
        type: INSIGHT_TYPES.DATA,
        category: 'cashflow',
        content: {
          income: data.cashflow.totalIncome,
          expenses: data.cashflow.totalExpenses,
          balance: data.cashflow.balance
        },
        label: 'Fluxo de caixa',
        priority: CONTENT_PRIORITY.HIGH
      });
    }

    return insights;
  }

  /**
   * Extrai insights de resultados de planejamento
   */
  extractPlanningInsights(data) {
    const insights = [];

    // Orçamento
    if (data.budget) {
      if (data.budget.limits) {
        insights.push({
          type: INSIGHT_TYPES.DATA,
          category: 'budget_limits',
          content: data.budget.limits,
          label: 'Limites de orçamento',
          priority: CONTENT_PRIORITY.HIGH
        });
      }

      if (data.budget.progress) {
        insights.push({
          type: INSIGHT_TYPES.DATA,
          category: 'budget_progress',
          content: data.budget.progress,
          label: 'Progresso do orçamento',
          priority: CONTENT_PRIORITY.HIGH
        });
      }
    }

    // Metas
    if (data.goals?.length > 0) {
      insights.push({
        type: INSIGHT_TYPES.DATA,
        category: 'goals',
        content: data.goals,
        label: 'Metas financeiras',
        priority: CONTENT_PRIORITY.HIGH
      });
    }

    // Plano de ação
    if (data.actionPlan) {
      insights.push({
        type: INSIGHT_TYPES.ACTION,
        category: 'action_plan',
        content: data.actionPlan,
        label: 'Plano de ação',
        priority: CONTENT_PRIORITY.HIGH
      });
    }

    // Recomendações
    if (data.recommendations?.length > 0) {
      for (const rec of data.recommendations) {
        insights.push({
          type: INSIGHT_TYPES.RECOMMENDATION,
          category: 'planning_recommendation',
          content: rec,
          priority: CONTENT_PRIORITY.MEDIUM
        });
      }
    }

    // Cenários
    if (data.scenarios) {
      insights.push({
        type: INSIGHT_TYPES.DATA,
        category: 'scenarios',
        content: data.scenarios,
        label: 'Simulação de cenários',
        priority: CONTENT_PRIORITY.MEDIUM
      });
    }

    return insights;
  }

  /**
   * Extrai insights de resultados de investimentos
   */
  extractInvestmentInsights(data) {
    const insights = [];

    // Cotações
    if (data.quotes) {
      insights.push({
        type: INSIGHT_TYPES.DATA,
        category: 'quotes',
        content: data.quotes,
        label: 'Cotações',
        priority: CONTENT_PRIORITY.HIGH
      });
    }

    // Portfolio
    if (data.portfolio) {
      if (data.portfolio.totalValue) {
        insights.push({
          type: INSIGHT_TYPES.DATA,
          category: 'portfolio_value',
          content: data.portfolio.totalValue,
          label: 'Valor total da carteira',
          priority: CONTENT_PRIORITY.HIGH
        });
      }

      if (data.portfolio.performance) {
        insights.push({
          type: INSIGHT_TYPES.DATA,
          category: 'portfolio_performance',
          content: data.portfolio.performance,
          label: 'Rentabilidade da carteira',
          priority: CONTENT_PRIORITY.HIGH
        });
      }

      if (data.portfolio.distribution) {
        insights.push({
          type: INSIGHT_TYPES.DATA,
          category: 'portfolio_distribution',
          content: data.portfolio.distribution,
          label: 'Distribuição da carteira',
          priority: CONTENT_PRIORITY.MEDIUM
        });
      }
    }

    // Recomendações de aporte
    if (data.recommendations) {
      insights.push({
        type: INSIGHT_TYPES.RECOMMENDATION,
        category: 'investment_recommendation',
        content: data.recommendations,
        label: 'Recomendações de investimento',
        priority: CONTENT_PRIORITY.HIGH
      });
    }

    // Projeções
    if (data.projections) {
      insights.push({
        type: INSIGHT_TYPES.DATA,
        category: 'projections',
        content: data.projections,
        label: 'Projeções de investimento',
        priority: CONTENT_PRIORITY.MEDIUM
      });
    }

    // Indicadores de mercado
    if (data.marketIndicators) {
      insights.push({
        type: INSIGHT_TYPES.DATA,
        category: 'market_indicators',
        content: data.marketIndicators,
        label: 'Indicadores de mercado',
        priority: CONTENT_PRIORITY.LOW
      });
    }

    return insights;
  }

  /**
   * Prioriza conteúdo por relevância à query
   * 
   * @param {Array} insights - Lista de insights
   * @param {string} query - Query original do usuário
   * @returns {Array} Insights priorizados e ordenados
   */
  prioritizeContent(insights, query) {
    const queryLower = query.toLowerCase();
    
    // Palavras-chave para boosting de prioridade
    const boostKeywords = {
      spending: ['gasto', 'gastei', 'despesa', 'quanto', 'valor'],
      cashflow: ['fluxo', 'caixa', 'receita', 'entrada', 'saída'],
      budget: ['orçamento', 'limite', 'meta', 'plano'],
      goals: ['meta', 'objetivo', 'economizar', 'poupar'],
      investments: ['investimento', 'carteira', 'ação', 'fundo', 'cotação'],
      alerts: ['alerta', 'problema', 'atenção', 'cuidado']
    };

    // Calcular score de relevância para cada insight
    const scoredInsights = insights.map(insight => {
      let score = 5 - (insight.priority || CONTENT_PRIORITY.MEDIUM);
      
      // Boost baseado em keywords da query
      for (const [category, keywords] of Object.entries(boostKeywords)) {
        if (insight.category?.includes(category)) {
          for (const kw of keywords) {
            if (queryLower.includes(kw)) {
              score += 2;
              break;
            }
          }
        }
      }

      // Boost para alertas e recomendações
      if (insight.type === INSIGHT_TYPES.ALERT) score += 2;
      if (insight.type === INSIGHT_TYPES.RECOMMENDATION) score += 1;

      return { ...insight, relevanceScore: score };
    });

    // Ordenar por score (maior primeiro)
    scoredInsights.sort((a, b) => b.relevanceScore - a.relevanceScore);

    logger.debug('Insights priorizados', {
      total: scoredInsights.length,
      topScore: scoredInsights[0]?.relevanceScore
    });

    return scoredInsights;
  }

  /**
   * Resolve conflitos entre insights de diferentes agentes
   * 
   * @param {Array} insights - Lista de insights
   * @returns {Array} Insights com conflitos resolvidos
   */
  resolveConflicts(insights) {
    // Agrupar por categoria
    const byCategory = new Map();
    
    for (const insight of insights) {
      const key = insight.category || 'general';
      if (!byCategory.has(key)) {
        byCategory.set(key, []);
      }
      byCategory.get(key).push(insight);
    }

    const resolved = [];

    for (const [category, categoryInsights] of byCategory) {
      if (categoryInsights.length === 1) {
        // Sem conflito
        resolved.push(categoryInsights[0]);
      } else {
        // Possível conflito - priorizar por score e fonte
        const sorted = categoryInsights.sort((a, b) => {
          // Primeiro por score de relevância
          const scoreDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
          if (scoreDiff !== 0) return scoreDiff;
          
          // Depois por prioridade
          return (a.priority || 3) - (b.priority || 3);
        });

        // Manter o primeiro (mais relevante) e marcar se há discordância
        const primary = { ...sorted[0] };
        
        if (sorted.length > 1 && this.hasConflictingData(sorted[0], sorted[1])) {
          primary.hasAlternative = true;
          primary.alternativeSources = sorted.slice(1).map(i => i.source);
        }

        resolved.push(primary);
      }
    }

    return resolved;
  }

  /**
   * Verifica se dois insights têm dados conflitantes
   */
  hasConflictingData(insight1, insight2) {
    if (!insight1.content || !insight2.content) return false;
    
    // Se são valores numéricos diferentes
    if (typeof insight1.content === 'number' && typeof insight2.content === 'number') {
      const diff = Math.abs(insight1.content - insight2.content);
      const avg = (insight1.content + insight2.content) / 2;
      // Considera conflito se diferença > 10%
      return diff / avg > 0.1;
    }

    return false;
  }

  /**
   * Gera estrutura da resposta final
   * 
   * @param {Array} insights - Insights resolvidos
   * @param {Object} context - Contexto da requisição
   * @returns {Object} Estrutura da resposta
   */
  generateResponseStructure(insights, context) {
    const structure = {
      title: this.generateTitle(context),
      summary: this.generateSummary(insights),
      sections: [],
      alerts: [],
      suggestions: []
    };

    // Separar insights por tipo
    const dataInsights = insights.filter(i => i.type === INSIGHT_TYPES.DATA);
    const trendInsights = insights.filter(i => i.type === INSIGHT_TYPES.TREND);
    const alertInsights = insights.filter(i => i.type === INSIGHT_TYPES.ALERT);
    const recommendationInsights = insights.filter(i => 
      i.type === INSIGHT_TYPES.RECOMMENDATION || i.type === INSIGHT_TYPES.ACTION
    );

    // Criar seção de dados principais
    if (dataInsights.length > 0) {
      structure.sections.push({
        type: 'data',
        title: '📊 Dados',
        items: dataInsights.slice(0, 5).map(i => ({
          label: i.label || i.category,
          value: i.content,
          source: i.source
        }))
      });
    }

    // Criar seção de tendências
    if (trendInsights.length > 0) {
      structure.sections.push({
        type: 'trends',
        title: '📈 Tendências',
        items: trendInsights.map(i => ({
          label: i.label || 'Tendência',
          value: i.content,
          source: i.source
        }))
      });
    }

    // Alertas
    structure.alerts = alertInsights.map(i => ({
      level: i.priority === CONTENT_PRIORITY.CRITICAL ? 'critical' : 'warning',
      message: typeof i.content === 'string' ? i.content : i.label,
      source: i.source
    }));

    // Sugestões e recomendações
    structure.suggestions = recommendationInsights.map(i => ({
      text: typeof i.content === 'string' ? i.content : JSON.stringify(i.content),
      source: i.source,
      category: i.category
    }));

    return structure;
  }

  /**
   * Gera título baseado no contexto
   */
  generateTitle(context) {
    const agents = context.agentsUsed || [];
    
    if (agents.length === 0) return '';
    
    if (agents.includes('analysis') && agents.length === 1) {
      return '📊 **Análise Financeira**';
    }
    
    if (agents.includes('planning') && agents.length === 1) {
      return '📋 **Planejamento Financeiro**';
    }
    
    if (agents.includes('investments') && agents.length === 1) {
      return '💰 **Análise de Investimentos**';
    }
    
    if (agents.length > 1) {
      return '📊 **Relatório Financeiro Completo**';
    }
    
    return '';
  }

  /**
   * Gera resumo executivo
   */
  generateSummary(insights) {
    // Usar o primeiro insight de sumário se existir
    const summaryInsight = insights.find(i => i.type === INSIGHT_TYPES.SUMMARY);
    if (summaryInsight) {
      return typeof summaryInsight.content === 'string' 
        ? summaryInsight.content 
        : '';
    }

    // Gerar resumo básico a partir dos dados
    const dataCount = insights.filter(i => i.type === INSIGHT_TYPES.DATA).length;
    const alertCount = insights.filter(i => i.type === INSIGHT_TYPES.ALERT).length;
    const recCount = insights.filter(i => i.type === INSIGHT_TYPES.RECOMMENDATION).length;

    let summary = '';
    if (dataCount > 0) summary += `Analisei ${dataCount} indicadores financeiros. `;
    if (alertCount > 0) summary += `Encontrei ${alertCount} ponto(s) de atenção. `;
    if (recCount > 0) summary += `Tenho ${recCount} sugestão(ões) para você.`;

    return summary.trim();
  }
}

module.exports = Synthesizer;
