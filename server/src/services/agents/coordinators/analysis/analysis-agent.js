/**
 * Agente de Análise - Lógica Principal
 * Fase 5 - Agentes Coordenadores
 * 
 * O Agente de Análise é especialista em comportamento financeiro
 * passado e presente. Ele:
 * - Diagnostica gastos por categoria
 * - Identifica padrões de consumo
 * - Analisa fluxo de caixa
 * - Emite alertas de desvio
 */

const { BaseCoordinator } = require('../base-coordinator');
const { SpendingAnalyzer } = require('./analyzers/spending-analyzer');
const { PatternDetector } = require('./analyzers/pattern-detector');
const { CashflowAnalyzer } = require('./analyzers/cashflow-analyzer');
const { DeviationAlerter } = require('./analyzers/deviation-alerter');
const logger = require('../../../../utils/logger');

/**
 * Contrato do Agente de Análise
 */
const ANALYSIS_CONTRACT = {
  name: 'Agente de Análise',
  type: 'analysis',
  description: 'Especialista em comportamento financeiro passado e presente',
  capabilities: [
    'diagnóstico de gastos',
    'identificação de padrões',
    'análise de fluxo de caixa',
    'alertas de desvio',
    'detecção de assinaturas esquecidas',
    'comparativo de gastos entre períodos',
    'breakdown por categoria'
  ],
  doesNot: [
    'análise de ativos',
    'sugestão de investimentos',
    'criação de orçamentos futuros'
  ],
  expectedOutputs: [
    'relatório de gastos',
    'lista de padrões identificados',
    'alertas e desvios',
    'comparativo mensal'
  ]
};

/**
 * Tipos de análise suportados
 */
const ANALYSIS_TYPES = {
  SPENDING: 'spending',
  CASHFLOW: 'cashflow',
  PATTERNS: 'patterns',
  DEVIATIONS: 'deviations',
  FULL: 'full'
};

class AnalysisAgent extends BaseCoordinator {
  
  constructor(financeBridge) {
    super('analysis');
    
    this.financeBridge = financeBridge;
    
    // Inicializar analisadores
    this.spendingAnalyzer = new SpendingAnalyzer(financeBridge);
    this.patternDetector = new PatternDetector(financeBridge);
    this.cashflowAnalyzer = new CashflowAnalyzer(financeBridge);
    this.deviationAlerter = new DeviationAlerter(financeBridge);
  }

  // ==================== SOBRESCRITAS DO BASE COORDINATOR ====================

  /**
   * Retorna ferramentas disponíveis
   */
  getAvailableTools() {
    return [
      'finance_bridge',
      'spending_analyzer',
      'pattern_detector',
      'cashflow_analyzer',
      'deviation_alerter'
    ];
  }

  /**
   * Identifica dados necessários baseado no contexto
   */
  identifyDataNeeds(context) {
    const needs = ['transações do período'];
    
    // Baseado na tarefa, identificar necessidades adicionais
    const taskLower = (context.mission || '').toLowerCase();
    
    if (taskLower.includes('padrão') || taskLower.includes('assinatura')) {
      needs.push('histórico de 3+ meses');
    }
    if (taskLower.includes('fluxo') || taskLower.includes('caixa')) {
      needs.push('receitas e despesas');
    }
    if (taskLower.includes('desvio') || taskLower.includes('alerta')) {
      needs.push('médias históricas');
    }
    
    return needs;
  }

  /**
   * Define passos de execução baseado na missão
   */
  planSteps(context) {
    const steps = [];
    const taskLower = (context.mission || '').toLowerCase();
    
    // Determinar tipo de análise necessária
    const analysisType = this.determineAnalysisType(taskLower);
    
    // Passo comum: coletar dados
    steps.push({
      name: 'collect_data',
      tool: 'finance_bridge',
      priority: 1,
      description: 'Buscar transações do período'
    });

    switch (analysisType) {
      case ANALYSIS_TYPES.SPENDING:
        steps.push({
          name: 'analyze_spending',
          tool: 'spending_analyzer',
          priority: 2,
          description: 'Analisar gastos por categoria'
        });
        break;

      case ANALYSIS_TYPES.CASHFLOW:
        steps.push({
          name: 'analyze_cashflow',
          tool: 'cashflow_analyzer',
          priority: 2,
          description: 'Analisar fluxo de caixa'
        });
        break;

      case ANALYSIS_TYPES.PATTERNS:
        steps.push({
          name: 'detect_patterns',
          tool: 'pattern_detector',
          priority: 2,
          description: 'Detectar padrões de consumo'
        });
        break;

      case ANALYSIS_TYPES.DEVIATIONS:
        steps.push({
          name: 'check_deviations',
          tool: 'deviation_alerter',
          priority: 2,
          description: 'Verificar desvios da média'
        });
        break;

      case ANALYSIS_TYPES.FULL:
      default:
        steps.push(
          {
            name: 'analyze_spending',
            tool: 'spending_analyzer',
            priority: 2,
            description: 'Analisar gastos por categoria'
          },
          {
            name: 'analyze_cashflow',
            tool: 'cashflow_analyzer',
            priority: 3,
            description: 'Analisar fluxo de caixa'
          },
          {
            name: 'check_deviations',
            tool: 'deviation_alerter',
            priority: 4,
            description: 'Verificar desvios da média'
          }
        );
        break;
    }

    // Passo final: gerar relatório
    steps.push({
      name: 'generate_report',
      tool: 'internal',
      priority: 10,
      description: 'Consolidar resultados em relatório'
    });

    return steps;
  }

  /**
   * Determina tipo de análise baseado na missão
   */
  determineAnalysisType(taskLower) {
    if (taskLower.includes('gasto') && !taskLower.includes('fluxo') && !taskLower.includes('padrão')) {
      return ANALYSIS_TYPES.SPENDING;
    }
    if (taskLower.includes('fluxo') || taskLower.includes('caixa') || taskLower.includes('receita')) {
      return ANALYSIS_TYPES.CASHFLOW;
    }
    if (taskLower.includes('padrão') || taskLower.includes('assinatura') || taskLower.includes('recorrente')) {
      return ANALYSIS_TYPES.PATTERNS;
    }
    if (taskLower.includes('desvio') || taskLower.includes('alerta') || taskLower.includes('anormal')) {
      return ANALYSIS_TYPES.DEVIATIONS;
    }
    return ANALYSIS_TYPES.FULL;
  }

  /**
   * Define critérios de conclusão
   */
  defineCompletionCriteria(context) {
    return 'Análise completa com dados por categoria, totais calculados e insights gerados';
  }

  /**
   * Define mínimo aceitável
   */
  defineMinimumAcceptable(context) {
    return 'Ao menos totais por categoria ou fluxo de caixa básico';
  }

  /**
   * Executa um passo específico
   */
  async executeStep(step, previousResults) {
    const userId = this.context?.doc?.context?.user_id || 'default_user';
    const period = this.extractPeriod(this.context?.query) || 'current_month';

    switch (step.name) {
      case 'collect_data':
        // Coleta inicial já será feita pelos analisadores
        return { collected: true, period, userId };

      case 'analyze_spending':
        return await this.spendingAnalyzer.analyze({ period, userId });

      case 'analyze_cashflow':
        return await this.cashflowAnalyzer.analyze({ period, userId });

      case 'detect_patterns':
        return await this.patternDetector.detectAll({ userId, months: 3 });

      case 'check_deviations':
        return await this.deviationAlerter.generateAlerts({ userId, historicalMonths: 3 });

      case 'generate_report':
        return this.consolidateReport(previousResults);

      default:
        return { step: step.name, status: 'unknown_step' };
    }
  }

  /**
   * Extrai período da query
   */
  extractPeriod(query) {
    if (!query) return 'current_month';
    
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('mês passado') || queryLower.includes('mes passado') || queryLower.includes('último mês')) {
      return 'last_month';
    }
    if (queryLower.includes('últimos 3 meses') || queryLower.includes('3 meses')) {
      return 'last_3_months';
    }
    if (queryLower.includes('últimos 6 meses') || queryLower.includes('6 meses')) {
      return 'last_6_months';
    }
    if (queryLower.includes('este ano') || queryLower.includes('ano atual')) {
      return 'current_year';
    }
    if (queryLower.includes('ontem')) {
      return 'yesterday';
    }
    if (queryLower.includes('hoje')) {
      return 'today';
    }
    if (queryLower.includes('semana')) {
      return 'current_week';
    }
    
    return 'current_month';
  }

  /**
   * Consolida resultados em relatório final
   */
  consolidateReport(stepResults) {
    const report = {
      type: 'analysis_report',
      timestamp: new Date().toISOString(),
      sections: []
    };

    for (const stepResult of stepResults) {
      if (!stepResult.success || !stepResult.result) continue;

      const result = stepResult.result;

      // Adicionar seção de gastos
      if (stepResult.step === 'analyze_spending' && result.data) {
        report.sections.push({
          title: 'Análise de Gastos',
          type: 'spending',
          content: {
            total: result.data.totalFormatted,
            transactionCount: result.data.transactionCount,
            topCategories: result.data.topCategories?.map(c => ({
              name: c.name,
              total: c.totalFormatted,
              percentage: `${c.percentage}%`
            }))
          }
        });
      }

      // Adicionar seção de fluxo de caixa
      if (stepResult.step === 'analyze_cashflow' && result.summary) {
        report.sections.push({
          title: 'Fluxo de Caixa',
          type: 'cashflow',
          content: {
            income: result.summary.totalIncomeFormatted,
            expense: result.summary.totalExpenseFormatted,
            balance: result.summary.balanceFormatted,
            status: result.summary.status,
            savingsRate: `${result.summary.savingsRate}%`
          },
          insights: result.insights
        });
      }

      // Adicionar seção de padrões
      if (stepResult.step === 'detect_patterns' && result.patterns) {
        report.sections.push({
          title: 'Padrões Detectados',
          type: 'patterns',
          content: {
            subscriptions: result.patterns.subscriptions?.slice(0, 5),
            duplicates: result.patterns.duplicates?.slice(0, 3),
            trends: result.patterns.trends?.slice(0, 5)
          },
          summary: result.summary
        });
      }

      // Adicionar seção de alertas
      if (stepResult.step === 'check_deviations' && result.alerts) {
        report.sections.push({
          title: 'Alertas de Desvio',
          type: 'deviations',
          content: {
            alertCount: result.alertCount,
            alerts: result.alerts.slice(0, 5)
          },
          summary: result.summary,
          recommendations: result.recommendations
        });
      }
    }

    return report;
  }

  /**
   * Retorna tipo de output
   */
  getOutputType() {
    return 'analysis_report';
  }

  /**
   * Formata conteúdo para entrega
   */
  formatContent(result) {
    if (!result.steps) return result;

    // Encontrar o relatório consolidado
    const reportStep = result.steps.find(s => s.step === 'generate_report');
    
    if (reportStep?.result?.sections) {
      return reportStep.result;
    }

    // Fallback: retornar primeiro resultado válido
    for (const step of result.steps) {
      if (step.success && step.result?.data) {
        return step.result;
      }
    }

    return result;
  }

  /**
   * Extrai dados estruturados
   */
  extractStructuredData(result) {
    const structured = {
      totals: {},
      categories: [],
      alerts: [],
      patterns: {}
    };

    for (const step of result.steps || []) {
      if (!step.success || !step.result) continue;

      // Gastos
      if (step.step === 'analyze_spending' && step.result.data) {
        structured.totals.expenses = step.result.data.total;
        structured.categories = step.result.data.categories || [];
      }

      // Fluxo de caixa
      if (step.step === 'analyze_cashflow' && step.result.summary) {
        structured.totals.income = step.result.summary.totalIncome;
        structured.totals.balance = step.result.summary.balance;
        structured.totals.savingsRate = step.result.summary.savingsRate;
      }

      // Alertas
      if (step.step === 'check_deviations' && step.result.alerts) {
        structured.alerts = step.result.alerts.slice(0, 5);
      }

      // Padrões
      if (step.step === 'detect_patterns' && step.result.patterns) {
        structured.patterns = step.result.patterns;
      }
    }

    return structured;
  }

  /**
   * Gera resumo executivo
   */
  generateSummary(result) {
    const parts = [];

    for (const step of result.steps || []) {
      if (!step.success) continue;

      if (step.step === 'analyze_spending' && step.result?.data) {
        parts.push(`Gastos: ${step.result.data.totalFormatted}`);
      }
      if (step.step === 'analyze_cashflow' && step.result?.summary) {
        parts.push(`Saldo: ${step.result.summary.balanceFormatted} (${step.result.summary.status})`);
      }
      if (step.step === 'check_deviations' && step.result?.alertCount > 0) {
        parts.push(`${step.result.alertCount} alertas detectados`);
      }
    }

    return parts.length > 0 
      ? parts.join(' | ')
      : `Análise concluída: ${result.successfulSteps}/${result.totalSteps} etapas`;
  }

  /**
   * Retorna contrato do agente
   */
  getContract() {
    return ANALYSIS_CONTRACT;
  }

  /**
   * Retorna capacidades
   */
  getCapabilities() {
    return ANALYSIS_CONTRACT.capabilities;
  }

  // ==================== MÉTODOS PÚBLICOS DIRETOS ====================

  /**
   * Analisa gastos (acesso direto)
   */
  async analyzeSpending(options = {}) {
    return this.spendingAnalyzer.analyze(options);
  }

  /**
   * Analisa fluxo de caixa (acesso direto)
   */
  async analyzeCashflow(options = {}) {
    return this.cashflowAnalyzer.analyze(options);
  }

  /**
   * Detecta padrões (acesso direto)
   */
  async detectPatterns(options = {}) {
    return this.patternDetector.detectAll(options);
  }

  /**
   * Gera alertas de desvio (acesso direto)
   */
  async checkDeviations(options = {}) {
    return this.deviationAlerter.generateAlerts(options);
  }

  /**
   * Health check do agente
   */
  async healthCheck() {
    const base = await super.healthCheck();
    
    return {
      ...base,
      analyzers: {
        spending: !!this.spendingAnalyzer,
        patterns: !!this.patternDetector,
        cashflow: !!this.cashflowAnalyzer,
        deviations: !!this.deviationAlerter
      }
    };
  }
}

module.exports = { AnalysisAgent, ANALYSIS_CONTRACT, ANALYSIS_TYPES };
