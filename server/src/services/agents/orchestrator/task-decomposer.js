/**
 * Decompositor de Tarefas
 * Fase 4 - Camada de Orquestração
 * 
 * Responsável por analisar a query do usuário e identificar
 * quais agentes coordenadores são necessários para atendê-la.
 */

const logger = require('../../../utils/logger');

/**
 * Padrões de palavras-chave para identificar necessidades
 */
const KEYWORD_PATTERNS = {
  analysis: {
    keywords: [
      'gastos', 'gastei', 'gastando', 'despesas', 'despesa',
      'padrão', 'padrões', 'comportamento',
      'fluxo', 'caixa',
      'analise', 'analisar', 'análise', 'diagnóstico',
      'categorias', 'categoria',
      'assinatura', 'assinaturas', 'recorrente', 'recorrentes',
      'comparar gastos', 'comparativo', 'evolução'
    ],
    phrases: [
      'como estão meus gastos',
      'onde estou gastando',
      'quanto gastei',
      'para onde vai meu dinheiro',
      'analisar meus gastos',
      'padrão de consumo'
    ]
  },
  investments: {
    keywords: [
      'investimento', 'investimentos', 'investir',
      'carteira', 'portfolio', 'portfólio',
      'ações', 'ação', 'fundo', 'fundos',
      'rendimento', 'rendimentos', 'rentabilidade',
      'aporte', 'aportes', 'aplicar', 'aplicação',
      'tesouro', 'cdb', 'fii', 'fiis',
      'dividendo', 'dividendos',
      'bolsa', 'mercado', 'cotação'
    ],
    phrases: [
      'onde investir',
      'melhor investimento',
      'analisar carteira',
      'quanto rende',
      'projeção de rendimento',
      'sugerir investimento'
    ]
  },
  planning: {
    keywords: [
      'orçamento', 'orçamentos', 'budget',
      'meta', 'metas', 'objetivo', 'objetivos',
      'plano', 'planejar', 'planejamento',
      'economizar', 'economia', 'poupar',
      'limite', 'limites', 'teto',
      'simulação', 'simular', 'cenário', 'cenários',
      'futuro', 'próximo mês', 'próximos meses'
    ],
    phrases: [
      'criar orçamento',
      'definir meta',
      'como economizar',
      'plano de ação',
      'quanto preciso',
      'sugerir ajustes'
    ]
  }
};

/**
 * Tipos de output esperados por agente
 */
const EXPECTED_OUTPUTS = {
  analysis: {
    diagnosis: 'Relatório com breakdown por categoria, identificação de padrões',
    comparison: 'Comparativo entre períodos com variações percentuais',
    alerts: 'Lista de alertas e desvios identificados',
    patterns: 'Padrões de consumo e assinaturas detectadas'
  },
  investments: {
    portfolio: 'Análise da carteira atual com rentabilidade e risco',
    recommendation: 'Recomendações de aporte com justificativa',
    projection: 'Projeção de rendimentos futuros',
    market: 'Análise de mercado e oportunidades'
  },
  planning: {
    budget: 'Orçamento por categoria com limites sugeridos',
    goals: 'Plano de metas com prazos e valores',
    action: 'Passos de ação para atingir objetivos',
    simulation: 'Cenários simulados com diferentes variáveis'
  }
};

class TaskDecomposer {
  
  constructor(agentContracts) {
    this.agentContracts = agentContracts;
    this.patterns = KEYWORD_PATTERNS;
    this.expectedOutputs = EXPECTED_OUTPUTS;
  }

  /**
   * Decompõe a query em tarefas para cada agente necessário
   * 
   * @param {string} query - Query do usuário
   * @param {Object} memory - Memória do chat (para contexto adicional)
   * @returns {Object} Decomposição com tarefas identificadas
   */
  async decompose(query, memory = {}) {
    const startTime = Date.now();
    const queryLower = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    logger.debug('Iniciando decomposição de tarefa', { query_length: query.length });

    // Identificar necessidades baseado em palavras-chave e frases
    const needs = this.identifyNeeds(queryLower);
    
    // Construir tarefas para cada agente necessário
    const tasks = [];
    
    for (const need of needs) {
      const task = this.buildTask(need, query, memory);
      if (task) {
        tasks.push(task);
      }
    }

    // Analisar intenção geral
    const intent = this.analyzeIntent(query, tasks);

    const duration = Date.now() - startTime;
    
    logger.debug('Decomposição concluída', {
      duration_ms: duration,
      tasks_count: tasks.length,
      agents: tasks.map(t => t.agent)
    });

    return {
      originalQuery: query,
      intent,
      tasks,
      confidence: this.calculateConfidence(tasks, query),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Identifica necessidades baseado em padrões
   */
  identifyNeeds(queryLower) {
    const needs = [];

    for (const [agent, patterns] of Object.entries(this.patterns)) {
      const score = this.calculateMatchScore(queryLower, patterns);
      
      if (score > 0) {
        needs.push({
          agent,
          score,
          matchedKeywords: this.getMatchedKeywords(queryLower, patterns.keywords),
          matchedPhrases: this.getMatchedPhrases(queryLower, patterns.phrases)
        });
      }
    }

    // Ordenar por score (maior primeiro)
    needs.sort((a, b) => b.score - a.score);

    return needs;
  }

  /**
   * Calcula score de match
   */
  calculateMatchScore(query, patterns) {
    let score = 0;

    // Palavras-chave (peso 1 cada)
    for (const keyword of patterns.keywords) {
      if (query.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    // Frases (peso 3 cada - mais específicas)
    for (const phrase of patterns.phrases) {
      if (query.includes(phrase.toLowerCase())) {
        score += 3;
      }
    }

    return score;
  }

  /**
   * Retorna keywords que deram match
   */
  getMatchedKeywords(query, keywords) {
    return keywords.filter(kw => query.includes(kw.toLowerCase()));
  }

  /**
   * Retorna frases que deram match
   */
  getMatchedPhrases(query, phrases) {
    return phrases.filter(p => query.includes(p.toLowerCase()));
  }

  /**
   * Constrói uma tarefa para um agente
   */
  buildTask(need, originalQuery, memory) {
    const contract = this.agentContracts[need.agent];
    if (!contract) return null;

    // Determinar tipo de output esperado
    const outputType = this.determineOutputType(need, originalQuery);

    // Extrair descrição da tarefa
    const taskDescription = this.extractTaskDescription(need, originalQuery, contract);

    return {
      agent: need.agent,
      agentName: contract.name,
      taskDescription,
      expectedOutput: outputType,
      matchScore: need.score,
      matchedKeywords: need.matchedKeywords,
      context: this.extractRelevantContext(memory, need.agent)
    };
  }

  /**
   * Determina o tipo de output esperado
   */
  determineOutputType(need, query) {
    const queryLower = query.toLowerCase();
    const outputs = this.expectedOutputs[need.agent];
    
    // Mapeamento de keywords para tipos de output
    const outputMappings = {
      analysis: {
        'comparar': 'comparison',
        'comparativo': 'comparison',
        'evolução': 'comparison',
        'padrão': 'patterns',
        'assinatura': 'patterns',
        'alerta': 'alerts',
        'desvio': 'alerts'
      },
      investments: {
        'carteira': 'portfolio',
        'portfolio': 'portfolio',
        'investir': 'recommendation',
        'aporte': 'recommendation',
        'projeção': 'projection',
        'render': 'projection',
        'mercado': 'market'
      },
      planning: {
        'orçamento': 'budget',
        'budget': 'budget',
        'limite': 'budget',
        'meta': 'goals',
        'objetivo': 'goals',
        'plano': 'action',
        'simul': 'simulation',
        'cenário': 'simulation'
      }
    };

    const mappings = outputMappings[need.agent] || {};
    
    for (const [keyword, outputType] of Object.entries(mappings)) {
      if (queryLower.includes(keyword)) {
        return {
          type: outputType,
          description: outputs[outputType]
        };
      }
    }

    // Output padrão por agente
    const defaultOutputs = {
      analysis: 'diagnosis',
      investments: 'recommendation',
      planning: 'budget'
    };

    const defaultType = defaultOutputs[need.agent];
    return {
      type: defaultType,
      description: outputs[defaultType]
    };
  }

  /**
   * Extrai descrição da tarefa
   */
  extractTaskDescription(need, originalQuery, contract) {
    const agent = need.agent;
    
    // Construir descrição baseada nas keywords encontradas
    if (need.matchedPhrases.length > 0) {
      return `${need.matchedPhrases[0]} conforme solicitado: "${originalQuery}"`;
    }

    // Descrições padrão por agente
    const defaultDescriptions = {
      analysis: `Analisar comportamento financeiro do usuário baseado na solicitação: "${originalQuery}"`,
      investments: `Fornecer orientação sobre investimentos baseado na solicitação: "${originalQuery}"`,
      planning: `Criar planejamento financeiro baseado na solicitação: "${originalQuery}"`
    };

    return defaultDescriptions[agent] || `Executar tarefa: ${originalQuery}`;
  }

  /**
   * Extrai contexto relevante da memória
   */
  extractRelevantContext(memory, agent) {
    if (!memory || !memory.critical_data) {
      return {};
    }

    const contextMappings = {
      analysis: ['spending_patterns', 'recurring_expenses', 'categories'],
      investments: ['portfolio', 'risk_profile', 'investment_goals'],
      planning: ['financial_goals', 'preferences', 'limits']
    };

    const relevantKeys = contextMappings[agent] || [];
    const context = {};

    for (const key of relevantKeys) {
      if (memory.critical_data[key]) {
        context[key] = memory.critical_data[key];
      }
    }

    return context;
  }

  /**
   * Analisa a intenção geral da query
   */
  analyzeIntent(query, tasks) {
    const agents = tasks.map(t => t.agent);
    
    // Identificar tipo de intenção
    let intentType = 'single_task';
    let description = '';

    if (agents.length === 0) {
      intentType = 'unclear';
      description = 'Não foi possível identificar uma tarefa específica';
    } else if (agents.length === 1) {
      intentType = 'single_task';
      description = `Tarefa única para ${tasks[0].agentName}`;
    } else if (agents.includes('analysis') && agents.includes('planning')) {
      intentType = 'analysis_then_planning';
      description = 'Análise de situação atual seguida de planejamento';
    } else if (agents.includes('analysis') && agents.includes('investments')) {
      intentType = 'analysis_then_investments';
      description = 'Análise de situação para recomendação de investimentos';
    } else {
      intentType = 'multi_task';
      description = `Múltiplas tarefas para: ${agents.join(', ')}`;
    }

    return {
      type: intentType,
      description,
      agents,
      complexity: agents.length > 2 ? 'high' : agents.length > 1 ? 'medium' : 'low'
    };
  }

  /**
   * Calcula confiança da decomposição
   */
  calculateConfidence(tasks, query) {
    if (tasks.length === 0) return 0;

    // Média dos scores normalizados
    const totalScore = tasks.reduce((sum, t) => sum + t.matchScore, 0);
    const maxPossibleScore = query.split(' ').length * 2; // Estimativa
    
    const confidence = Math.min(totalScore / maxPossibleScore, 1);
    
    return Math.round(confidence * 100) / 100;
  }
}

module.exports = { TaskDecomposer };
