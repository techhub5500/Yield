/**
 * Classificador de Complexidade
 * Fase 3 - Agente Júnior
 * 
 * Analisa mensagens do usuário e classifica a complexidade para
 * determinar se o Júnior pode resolver sozinho ou precisa escalar.
 */

const logger = require('../../../utils/logger');

/**
 * Níveis de complexidade
 */
const COMPLEXITY_LEVELS = {
  TRIVIAL: 'trivial',         // Consultas diretas simples
  SIMPLE: 'simple',           // Lançamentos com dados completos
  INTERMEDIATE: 'intermediate', // Análises básicas
  COMPLEX: 'complex'          // Múltiplas tarefas, escalar para Orquestrador
};

/**
 * Tipos de intenção
 */
const INTENT_TYPES = {
  QUERY: 'query',             // Consulta de dados
  TRANSACTION: 'transaction', // Lançamento de despesa/receita
  ANALYSIS: 'analysis',       // Análise de dados
  SEARCH: 'search',           // Busca externa
  COMPLEX: 'complex',         // Tarefa complexa
  UNKNOWN: 'unknown'          // Não identificado
};

/**
 * Palavras-chave para identificação de intenções
 */
const KEYWORDS = {
  // Consultas
  query: [
    'quanto', 'qual', 'quais', 'quando', 'onde', 'mostrar', 'mostrar',
    'listar', 'lista', 'ver', 'última', 'ultimo', 'ultimas', 'ultimos'
  ],
  
  // Despesas
  expense: [
    'gastei', 'paguei', 'comprei', 'compra', 'custo', 'custou',
    'despesa', 'gasto', 'pagamento', 'pago', 'gastar'
  ],
  
  // Receitas
  income: [
    'recebi', 'ganhei', 'entrou', 'salário', 'salario', 'receita',
    'recebimento', 'renda', 'ganho', 'entrada', 'pagaram'
  ],
  
  // Análises
  analysis: [
    'como estão', 'como está', 'analise', 'análise', 'analisar',
    'comparar', 'comparação', 'média', 'media', 'total',
    'resumo', 'balanço', 'balanco', 'evolução', 'evolucao'
  ],
  
  // Complexas (escalar para Orquestrador)
  complex: [
    'investimento', 'investimentos', 'investir', 'carteira',
    'orçamento', 'orcamento', 'meta', 'metas', 'planejamento',
    'planejar', 'sugerir', 'sugestão', 'sugestao', 'recomendação',
    'projeção', 'projecao', 'simular', 'simulação'
  ],
  
  // Busca externa
  search: [
    'selic', 'cdi', 'ipca', 'inflação', 'inflacao', 'dólar', 'dolar',
    'euro', 'cotação', 'cotacao', 'taxa', 'índice', 'indice',
    'limite do pix', 'limite pix', 'mercado'
  ]
};

/**
 * Campos obrigatórios por tipo de transação
 */
const REQUIRED_FIELDS = {
  expense: ['amount', 'category'],
  income: ['amount', 'source']
};

/**
 * Perguntas de follow-up para campos faltantes
 */
const FOLLOW_UP_QUESTIONS = {
  amount: (context = {}) => 'Qual foi o valor?',
  category: (context = {}) => {
    if (context.amount) {
      return `Você gastou em que esse R$ ${formatCurrency(context.amount)}?`;
    }
    return 'Você gastou em que?';
  },
  source: (context = {}) => {
    if (context.amount) {
      return `Qual a origem dessa receita de R$ ${formatCurrency(context.amount)}?`;
    }
    return 'Qual a origem dessa receita?';
  },
  date: () => 'Quando foi essa transação?'
};

/**
 * Formata valor como moeda
 */
function formatCurrency(value) {
  if (typeof value !== 'number') return value;
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

class Classifier {
  
  constructor() {
    this.keywords = KEYWORDS;
  }

  /**
   * Classifica a mensagem do usuário
   * 
   * @param {Object} memory - Memória do chat
   * @param {string} userMessage - Mensagem do usuário
   * @returns {Object} Classificação com complexidade, intenção e dados extraídos
   */
  async classify(memory, userMessage) {
    const startTime = Date.now();
    
    try {
      const messageLower = userMessage.toLowerCase();
      
      // Verificar se é continuação de follow-up
      if (memory?.pending_context?.type === 'follow_up') {
        return this.classifyFollowUp(memory, userMessage);
      }
      
      // Identificar intenção principal
      const intent = this.identifyIntent(messageLower);
      
      // Classificar complexidade baseada na intenção
      let classification;
      
      switch (intent.type) {
        case INTENT_TYPES.TRANSACTION:
          classification = await this.classifyTransaction(messageLower, intent);
          break;
          
        case INTENT_TYPES.QUERY:
          classification = this.classifyQuery(messageLower);
          break;
          
        case INTENT_TYPES.ANALYSIS:
          classification = this.classifyAnalysis(messageLower);
          break;
          
        case INTENT_TYPES.SEARCH:
          classification = this.classifySearch(messageLower);
          break;
          
        case INTENT_TYPES.COMPLEX:
          classification = this.classifyComplex(messageLower);
          break;
          
        default:
          classification = this.classifyDefault(messageLower);
      }
      
      const duration = Date.now() - startTime;
      
      logger.info('Mensagem classificada', {
        complexity: classification.complexity,
        intent: intent.type,
        duration_ms: duration
      });
      
      return {
        ...classification,
        intent: intent,
        originalMessage: userMessage,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Erro ao classificar mensagem', { error: error.message });
      throw error;
    }
  }

  /**
   * Identifica a intenção principal da mensagem
   */
  identifyIntent(messageLower) {
    // Verificar complexas primeiro (tem prioridade)
    if (this.hasKeywords(messageLower, this.keywords.complex)) {
      return { type: INTENT_TYPES.COMPLEX, confidence: 0.9 };
    }
    
    // Verificar busca externa
    if (this.hasKeywords(messageLower, this.keywords.search)) {
      return { type: INTENT_TYPES.SEARCH, confidence: 0.85 };
    }
    
    // Verificar transações (despesa ou receita)
    const isExpense = this.hasKeywords(messageLower, this.keywords.expense);
    const isIncome = this.hasKeywords(messageLower, this.keywords.income);
    
    if (isExpense || isIncome) {
      return {
        type: INTENT_TYPES.TRANSACTION,
        subtype: isExpense ? 'expense' : 'income',
        confidence: 0.9
      };
    }
    
    // Verificar análises
    if (this.hasKeywords(messageLower, this.keywords.analysis)) {
      return { type: INTENT_TYPES.ANALYSIS, confidence: 0.8 };
    }
    
    // Verificar consultas
    if (this.hasKeywords(messageLower, this.keywords.query)) {
      return { type: INTENT_TYPES.QUERY, confidence: 0.75 };
    }
    
    return { type: INTENT_TYPES.UNKNOWN, confidence: 0.5 };
  }

  /**
   * Verifica se a mensagem contém palavras-chave
   */
  hasKeywords(message, keywords) {
    return keywords.some(kw => message.includes(kw));
  }

  /**
   * Classifica mensagens de transação (despesa/receita)
   */
  async classifyTransaction(messageLower, intent) {
    const type = intent.subtype; // 'expense' ou 'income'
    const extracted = this.extractTransactionInfo(messageLower, type);
    const missingFields = this.detectMissingFields(extracted, type);
    
    if (missingFields.length > 0) {
      return {
        complexity: COMPLEXITY_LEVELS.SIMPLE,
        needsMoreInfo: true,
        missingFields: missingFields,
        extracted: extracted,
        transactionType: type,
        followUpQuestion: this.buildFollowUpQuestion(missingFields, extracted)
      };
    }
    
    return {
      complexity: COMPLEXITY_LEVELS.SIMPLE,
      needsMoreInfo: false,
      extracted: extracted,
      transactionType: type
    };
  }

  /**
   * Extrai informações de transação da mensagem
   */
  extractTransactionInfo(message, type) {
    const extracted = {};
    
    // Extrair valor
    const amountMatch = message.match(/r?\$?\s*(\d+(?:[.,]\d{1,2})?)/i) ||
                        message.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:reais|real)/i);
    
    if (amountMatch) {
      extracted.amount = parseFloat(amountMatch[1].replace(',', '.'));
    }
    
    // Extrair data (se mencionada)
    const datePatterns = {
      'hoje': new Date(),
      'ontem': (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; })(),
      'anteontem': (() => { const d = new Date(); d.setDate(d.getDate() - 2); return d; })()
    };
    
    for (const [pattern, date] of Object.entries(datePatterns)) {
      if (message.includes(pattern)) {
        extracted.date = date.toISOString().split('T')[0];
        break;
      }
    }
    
    // Se não encontrou data, usar hoje
    if (!extracted.date) {
      extracted.date = new Date().toISOString().split('T')[0];
    }
    
    // Extrair categoria/local (para despesas)
    if (type === 'expense') {
      extracted.category = this.extractCategory(message);
    }
    
    // Extrair fonte (para receitas)
    if (type === 'income') {
      extracted.source = this.extractSource(message);
    }
    
    // Tentar extrair descrição
    extracted.description = this.extractDescription(message);
    
    return extracted;
  }

  /**
   * Extrai categoria da mensagem
   */
  extractCategory(message) {
    // Padrões comuns para identificar onde gastou
    const patterns = [
      /(?:no|na|em|do|da)\s+(\w+(?:\s+\w+)?)/i,
      /(?:gastei|paguei|comprei)\s+(?:.*?)\s+(?:no|na|em)\s+(\w+(?:\s+\w+)?)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const category = match[1].trim();
        // Ignorar palavras muito curtas ou números
        if (category.length > 2 && !/^\d+$/.test(category)) {
          return category;
        }
      }
    }
    
    return null;
  }

  /**
   * Extrai fonte da receita
   */
  extractSource(message) {
    const patterns = [
      /(?:do|da|de)\s+(\w+(?:\s+\w+)?)/i,
      /(?:salário|salario|pagamento)\s+(?:do|da)?\s*(\w+(?:\s+\w+)?)?/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Verificar se menciona salário
    if (/sal[aá]rio/i.test(message)) {
      return 'Salário';
    }
    
    return null;
  }

  /**
   * Extrai descrição da mensagem
   */
  extractDescription(message) {
    // Remover valor e palavras-chave, manter o resto como descrição
    let description = message
      .replace(/r?\$?\s*\d+(?:[.,]\d{1,2})?/gi, '')
      .replace(/gastei|paguei|comprei|recebi|ganhei/gi, '')
      .replace(/no|na|em|do|da/gi, '')
      .trim();
    
    if (description.length > 3) {
      return description.charAt(0).toUpperCase() + description.slice(1);
    }
    
    return null;
  }

  /**
   * Detecta campos faltantes para uma transação
   */
  detectMissingFields(extracted, type) {
    const required = REQUIRED_FIELDS[type] || [];
    const missing = [];
    
    for (const field of required) {
      if (!extracted[field]) {
        missing.push(field);
      }
    }
    
    return missing;
  }

  /**
   * Constrói pergunta de follow-up
   */
  buildFollowUpQuestion(missingFields, context = {}) {
    if (missingFields.length === 0) return null;
    
    // Priorizar: primeiro valor, depois categoria/fonte
    const priority = ['amount', 'category', 'source', 'date'];
    const sortedFields = missingFields.sort((a, b) => 
      priority.indexOf(a) - priority.indexOf(b)
    );
    
    const firstMissing = sortedFields[0];
    const questionBuilder = FOLLOW_UP_QUESTIONS[firstMissing];
    
    if (questionBuilder) {
      return questionBuilder(context);
    }
    
    return 'Pode me dar mais detalhes sobre essa transação?';
  }

  /**
   * Classifica consultas simples
   */
  classifyQuery(messageLower) {
    // Verificar se é uma consulta complexa (múltiplos filtros)
    const multipleFilters = this.countFilters(messageLower);
    
    if (multipleFilters > 2) {
      return {
        complexity: COMPLEXITY_LEVELS.INTERMEDIATE,
        needsMoreInfo: false
      };
    }
    
    return {
      complexity: COMPLEXITY_LEVELS.TRIVIAL,
      needsMoreInfo: false
    };
  }

  /**
   * Conta quantidade de filtros na mensagem
   */
  countFilters(message) {
    let count = 0;
    
    // Período
    if (/ontem|hoje|semana|mês|mes|ano|dias|últimos|ultimos/.test(message)) count++;
    
    // Categoria
    if (/alimentação|alimentacao|transporte|lazer|saúde|saude|moradia/.test(message)) count++;
    
    // Valor
    if (/maior|menor|acima|abaixo|entre|mais que|menos que/.test(message)) count++;
    
    // Tipo
    if (/despesa|receita|gasto|ganho/.test(message)) count++;
    
    return count;
  }

  /**
   * Classifica análises
   */
  classifyAnalysis(messageLower) {
    // Análises simples podem ser resolvidas pelo Júnior
    const simplePatterns = [
      'como estão meus gastos',
      'quanto gastei esse mês',
      'total de gastos',
      'média de gastos'
    ];
    
    if (simplePatterns.some(p => messageLower.includes(p))) {
      return {
        complexity: COMPLEXITY_LEVELS.INTERMEDIATE,
        needsMoreInfo: false
      };
    }
    
    // Análises mais complexas escalam para Orquestrador
    return {
      complexity: COMPLEXITY_LEVELS.COMPLEX,
      needsMoreInfo: false
    };
  }

  /**
   * Classifica buscas externas
   */
  classifySearch(messageLower) {
    return {
      complexity: COMPLEXITY_LEVELS.TRIVIAL, // Busca é simples de executar
      needsMoreInfo: false,
      needsExternalInfo: true,
      searchQuery: this.optimizeSearchQuery(messageLower)
    };
  }

  /**
   * Otimiza query para busca externa
   */
  optimizeSearchQuery(message) {
    // Remover palavras desnecessárias
    const stopWords = ['qual', 'quanto', 'como', 'está', 'esta', 'atual', 'hoje', 'o', 'a', 'de', 'do', 'da'];
    
    let query = message
      .split(' ')
      .filter(word => !stopWords.includes(word.toLowerCase()))
      .join(' ');
    
    // Adicionar data atual para contexto
    const now = new Date();
    const month = now.toLocaleString('pt-BR', { month: 'long' });
    const year = now.getFullYear();
    
    // Se perguntar sobre taxa/índice, adicionar mês/ano
    if (/taxa|índice|indice|selic|cdi|ipca/.test(message)) {
      query += ` ${month} ${year}`;
    }
    
    return query.trim();
  }

  /**
   * Classifica tarefas complexas
   */
  classifyComplex(messageLower) {
    return {
      complexity: COMPLEXITY_LEVELS.COMPLEX,
      needsMoreInfo: false,
      shouldEscalate: true
    };
  }

  /**
   * Classificação padrão quando não identifica intenção
   */
  classifyDefault(messageLower) {
    // Tentar inferir se é uma pergunta
    if (messageLower.includes('?') || /^(o que|como|quanto|qual|quais|onde|quando)/.test(messageLower)) {
      return {
        complexity: COMPLEXITY_LEVELS.TRIVIAL,
        needsMoreInfo: false
      };
    }
    
    return {
      complexity: COMPLEXITY_LEVELS.SIMPLE,
      needsMoreInfo: true,
      missingFields: ['intent'],
      followUpQuestion: 'Não entendi bem. Você quer registrar uma transação, consultar dados ou fazer uma análise?'
    };
  }

  /**
   * Classifica resposta de follow-up
   */
  classifyFollowUp(memory, userMessage) {
    const pendingContext = memory.pending_context;
    const waitingFor = pendingContext.waiting_for || [];
    
    // Extrair informação da resposta
    const extracted = { ...pendingContext.extracted };
    
    // Tentar extrair o que estava faltando
    if (waitingFor.includes('amount')) {
      const amountMatch = userMessage.match(/r?\$?\s*(\d+(?:[.,]\d{1,2})?)/i);
      if (amountMatch) {
        extracted.amount = parseFloat(amountMatch[1].replace(',', '.'));
      }
    }
    
    if (waitingFor.includes('category')) {
      // A resposta toda provavelmente é a categoria
      extracted.category = userMessage.trim();
    }
    
    if (waitingFor.includes('source')) {
      extracted.source = userMessage.trim();
    }
    
    // Verificar se ainda falta algo
    const type = pendingContext.transactionType || 'expense';
    const stillMissing = this.detectMissingFields(extracted, type);
    
    if (stillMissing.length > 0) {
      return {
        complexity: COMPLEXITY_LEVELS.SIMPLE,
        needsMoreInfo: true,
        missingFields: stillMissing,
        extracted: extracted,
        transactionType: type,
        followUpQuestion: this.buildFollowUpQuestion(stillMissing, extracted),
        isFollowUp: true
      };
    }
    
    return {
      complexity: COMPLEXITY_LEVELS.SIMPLE,
      needsMoreInfo: false,
      extracted: extracted,
      transactionType: type,
      isFollowUp: true,
      readyToProcess: true
    };
  }
}

module.exports = { Classifier, COMPLEXITY_LEVELS, INTENT_TYPES };
