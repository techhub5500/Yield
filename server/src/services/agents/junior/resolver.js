/**
 * Resolutor de Tarefas
 * Fase 3 - Agente Júnior
 * 
 * Responsável por resolver tarefas classificadas como triviais,
 * simples ou intermediárias, usando o Finance Bridge.
 */

const financeBridge = require('../../finance-bridge');
const logger = require('../../../utils/logger');
const { COMPLEXITY_LEVELS } = require('./classifier');

/**
 * Formata valor como moeda brasileira
 */
function formatCurrency(value) {
  if (typeof value !== 'number') return value;
  return value.toLocaleString('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  });
}

/**
 * Formata data para exibição
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
}

class Resolver {
  
  constructor() {
    this.financeBridge = financeBridge;
  }

  /**
   * Resolve uma tarefa classificada
   * 
   * @param {Object} classification - Resultado da classificação
   * @param {Object} memory - Memória do chat
   * @param {string} userMessage - Mensagem original do usuário
   * @param {Object} context - Contexto adicional (user_id, etc)
   * @returns {Object} Resultado da resolução
   */
  async resolve(classification, memory, userMessage, context = {}) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (classification.complexity) {
        case COMPLEXITY_LEVELS.TRIVIAL:
          if (classification.needsExternalInfo) {
            // Busca externa será tratada pelo SearchService
            result = {
              action: 'external_search',
              searchQuery: classification.searchQuery
            };
          } else {
            result = await this.resolveTrivial(classification, memory, userMessage, context);
          }
          break;
          
        case COMPLEXITY_LEVELS.SIMPLE:
          result = await this.resolveSimple(classification, memory, userMessage, context);
          break;
          
        case COMPLEXITY_LEVELS.INTERMEDIATE:
          result = await this.resolveIntermediate(classification, memory, userMessage, context);
          break;
          
        default:
          throw new Error(`Complexidade não suportada pelo Resolver: ${classification.complexity}`);
      }
      
      const duration = Date.now() - startTime;
      
      logger.info('Tarefa resolvida', {
        complexity: classification.complexity,
        duration_ms: duration,
        action: result.action
      });
      
      return result;
      
    } catch (error) {
      logger.error('Erro ao resolver tarefa', { 
        error: error.message,
        complexity: classification.complexity 
      });
      throw error;
    }
  }

  /**
   * Resolve consultas triviais (query simples)
   */
  async resolveTrivial(classification, memory, userMessage, context) {
    // Construir payload de query
    const queryPayload = this.buildQueryPayload(userMessage, context);
    
    // Executar query via Finance Bridge
    const bridgeResult = await this.financeBridge.process(queryPayload);
    
    if (!bridgeResult.success) {
      return {
        action: 'error',
        response: 'Desculpe, não consegui buscar os dados solicitados.',
        error: bridgeResult.error
      };
    }
    
    // Formatar resposta
    const response = this.formatQueryResponse(bridgeResult.data, userMessage);
    
    return {
      action: 'resolved',
      response: response,
      data: bridgeResult.data
    };
  }

  /**
   * Resolve lançamentos simples (insert)
   * Nota: Este método é chamado quando a transação já tem todos os dados
   */
  async resolveSimple(classification, memory, userMessage, context) {
    // Se ainda precisa de mais informação, retornar para o agente pedir
    if (classification.needsMoreInfo) {
      return {
        action: 'needs_info',
        response: classification.followUpQuestion,
        pendingContext: {
          type: 'follow_up',
          waiting_for: classification.missingFields,
          extracted: classification.extracted,
          transactionType: classification.transactionType,
          original_message: userMessage,
          timestamp: new Date().toISOString()
        }
      };
    }
    
    // Transação pronta para inserir - será processada pelo TransactionLauncher
    return {
      action: 'launch_transaction',
      transactionType: classification.transactionType,
      extracted: classification.extracted,
      originalMessage: userMessage
    };
  }

  /**
   * Resolve análises intermediárias (aggregate)
   */
  async resolveIntermediate(classification, memory, userMessage, context) {
    // Construir payload de agregação
    const aggregatePayload = this.buildAggregatePayload(userMessage, context);
    
    // Executar agregação via Finance Bridge
    const bridgeResult = await this.financeBridge.process(aggregatePayload);
    
    if (!bridgeResult.success) {
      return {
        action: 'error',
        response: 'Desculpe, não consegui realizar a análise solicitada.',
        error: bridgeResult.error
      };
    }
    
    // Formatar resposta de análise
    const response = this.formatAnalysisResponse(bridgeResult.data, userMessage);
    
    return {
      action: 'resolved',
      response: response,
      data: bridgeResult.data
    };
  }

  /**
   * Constrói payload de query baseado na mensagem
   */
  buildQueryPayload(message, context) {
    const messageLower = message.toLowerCase();
    const payload = {
      operation: 'query',
      params: {
        filters: {},
        sort: { field: 'date', order: 'desc' },
        limit: 10
      },
      context: {
        user_id: context.user_id,
        user_timezone: context.user_timezone || 'America/Sao_Paulo',
        currency: 'BRL'
      }
    };
    
    // Detectar período
    const period = this.detectPeriod(messageLower);
    if (period) {
      payload.params.filters.period = period;
    }
    
    // Detectar tipo (despesa/receita)
    if (/despesa|gasto|gastei/.test(messageLower)) {
      payload.params.filters.type = 'expense';
    } else if (/receita|ganhei|recebi/.test(messageLower)) {
      payload.params.filters.type = 'income';
    }
    
    // Detectar categoria
    const category = this.detectCategory(messageLower);
    if (category) {
      payload.params.filters.categories = [category];
    }
    
    // Ajustar limite
    if (/última|ultimo|ultima/.test(messageLower)) {
      payload.params.limit = 1;
    } else if (/últimas|ultimas|ultimos|últimos/.test(messageLower)) {
      const numMatch = messageLower.match(/(\d+)\s*(?:últimas|ultimas|ultimos|últimos)/);
      if (numMatch) {
        payload.params.limit = parseInt(numMatch[1]);
      }
    }
    
    return payload;
  }

  /**
   * Detecta período mencionado na mensagem
   */
  detectPeriod(message) {
    // Períodos nomeados
    if (/hoje/.test(message)) {
      return { named_period: 'today' };
    }
    if (/ontem/.test(message)) {
      return { named_period: 'yesterday' };
    }
    if (/essa semana|esta semana|semana atual/.test(message)) {
      return { named_period: 'this_week' };
    }
    if (/semana passada|última semana|ultima semana/.test(message)) {
      return { named_period: 'last_week' };
    }
    if (/esse mês|este mês|este mes|esse mes|mês atual|mes atual/.test(message)) {
      return { named_period: 'current_month' };
    }
    if (/mês passado|mes passado|último mês|ultimo mes/.test(message)) {
      return { named_period: 'last_month' };
    }
    if (/esse ano|este ano|ano atual/.test(message)) {
      return { named_period: 'current_year' };
    }
    
    // Últimos X dias
    const daysMatch = message.match(/(?:últimos|ultimos)\s*(\d+)\s*dias/);
    if (daysMatch) {
      return { named_period: `last_${daysMatch[1]}_days` };
    }
    
    return null;
  }

  /**
   * Detecta categoria mencionada na mensagem
   */
  detectCategory(message) {
    const categories = {
      'alimentação': ['alimentação', 'alimentacao', 'comida', 'restaurante', 'supermercado'],
      'transporte': ['transporte', 'uber', 'combustível', 'combustivel', 'gasolina'],
      'moradia': ['moradia', 'aluguel', 'condomínio', 'condominio'],
      'saúde': ['saúde', 'saude', 'médico', 'medico', 'farmácia', 'farmacia'],
      'lazer': ['lazer', 'entretenimento', 'diversão', 'diversao'],
      'educação': ['educação', 'educacao', 'curso', 'escola', 'faculdade']
    };
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(kw => message.includes(kw))) {
        return category;
      }
    }
    
    return null;
  }

  /**
   * Constrói payload de agregação
   */
  buildAggregatePayload(message, context) {
    const messageLower = message.toLowerCase();
    const payload = {
      operation: 'aggregate',
      params: {
        metric: 'sum',
        group_by: 'category',
        filters: {}
      },
      context: {
        user_id: context.user_id,
        user_timezone: context.user_timezone || 'America/Sao_Paulo',
        currency: 'BRL'
      }
    };
    
    // Detectar período
    const period = this.detectPeriod(messageLower);
    if (period) {
      payload.params.filters.period = period;
    } else {
      // Padrão: mês atual
      payload.params.filters.period = { named_period: 'current_month' };
    }
    
    // Detectar tipo
    if (/despesa|gasto/.test(messageLower)) {
      payload.params.filters.type = 'expense';
    } else if (/receita|ganho/.test(messageLower)) {
      payload.params.filters.type = 'income';
    }
    
    // Detectar métrica
    if (/média|media/.test(messageLower)) {
      payload.params.metric = 'avg';
    } else if (/total|soma/.test(messageLower)) {
      payload.params.metric = 'sum';
    } else if (/quantas|quantos|quantidade/.test(messageLower)) {
      payload.params.metric = 'count';
    }
    
    // Detectar agrupamento
    if (/por dia|diário|diario/.test(messageLower)) {
      payload.params.group_by = 'day';
    } else if (/por semana|semanal/.test(messageLower)) {
      payload.params.group_by = 'week';
    } else if (/por mês|por mes|mensal/.test(messageLower)) {
      payload.params.group_by = 'month';
    }
    
    return payload;
  }

  /**
   * Formata resposta de query para o usuário
   */
  formatQueryResponse(data, originalMessage) {
    if (!data || !data.results || data.results.length === 0) {
      return 'Não encontrei nenhuma transação com os critérios especificados.';
    }
    
    const results = data.results;
    
    // Resposta para uma única transação
    if (results.length === 1) {
      const t = results[0];
      const typeText = t.type === 'expense' ? 'Gasto' : 'Receita';
      return `${typeText} de ${formatCurrency(t.amount)} em ${t.category}${t.subcategory ? ` (${t.subcategory})` : ''} no dia ${formatDate(t.date)}.`;
    }
    
    // Resposta para múltiplas transações
    let response = `Encontrei ${results.length} transações:\n\n`;
    
    results.forEach((t, i) => {
      const typeEmoji = t.type === 'expense' ? '💸' : '💰';
      response += `${typeEmoji} ${formatDate(t.date)} - ${formatCurrency(t.amount)} em ${t.category}\n`;
    });
    
    // Adicionar total se forem despesas ou receitas
    const total = results.reduce((sum, t) => sum + t.amount, 0);
    response += `\n**Total: ${formatCurrency(total)}**`;
    
    return response;
  }

  /**
   * Formata resposta de análise para o usuário
   */
  formatAnalysisResponse(data, originalMessage) {
    if (!data || !data.results || data.results.length === 0) {
      return 'Não encontrei dados para a análise solicitada.';
    }
    
    const results = data.results;
    let response = '';
    
    // Calcular total geral
    const total = results.reduce((sum, r) => sum + (r.total || r.sum || 0), 0);
    
    // Formatar por tipo de agrupamento
    if (data.group_by === 'category') {
      response = '📊 **Análise por Categoria**\n\n';
      
      // Ordenar por valor (maior primeiro)
      const sorted = [...results].sort((a, b) => (b.total || b.sum || 0) - (a.total || a.sum || 0));
      
      sorted.forEach(r => {
        const value = r.total || r.sum || 0;
        const percentage = ((value / total) * 100).toFixed(1);
        response += `• ${r._id || r.category}: ${formatCurrency(value)} (${percentage}%)\n`;
      });
      
      response += `\n**Total: ${formatCurrency(total)}**`;
      
    } else if (data.group_by === 'month') {
      response = '📈 **Análise Mensal**\n\n';
      
      results.forEach(r => {
        const monthName = r._id?.month ? 
          new Date(2000, r._id.month - 1).toLocaleString('pt-BR', { month: 'long' }) : 
          'Mês';
        const value = r.total || r.sum || 0;
        response += `• ${monthName}: ${formatCurrency(value)}\n`;
      });
      
      response += `\n**Total: ${formatCurrency(total)}**`;
      
    } else {
      // Formato genérico
      response = '📊 **Resumo**\n\n';
      response += `Total: ${formatCurrency(total)}\n`;
      response += `Quantidade de itens: ${results.length}`;
    }
    
    return response;
  }

  /**
   * Formata resposta de sucesso de lançamento
   */
  formatInsertResponse(transaction) {
    const typeText = transaction.type === 'expense' ? 'Despesa' : 'Receita';
    const emoji = transaction.type === 'expense' ? '✅💸' : '✅💰';
    
    return `${emoji} ${typeText} registrada com sucesso!\n\n` +
      `**Valor:** ${formatCurrency(transaction.amount)}\n` +
      `**Categoria:** ${transaction.category}${transaction.subcategory ? ` > ${transaction.subcategory}` : ''}\n` +
      `**Data:** ${formatDate(transaction.date)}` +
      (transaction.description ? `\n**Descrição:** ${transaction.description}` : '');
  }
}

module.exports = { Resolver };
