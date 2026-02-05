/**
 * Filtro de Memória
 * Fase 4 - Camada de Orquestração
 * 
 * Responsável por extrair apenas as informações relevantes
 * da memória para contextualizar os agentes coordenadores.
 */

const logger = require('../../../utils/logger');

/**
 * Tópicos relevantes para cada agente
 */
const AGENT_TOPICS = {
  analysis: {
    keywords: ['gasto', 'gastei', 'despesa', 'receita', 'categoria', 'padrão', 
               'fluxo', 'pagamento', 'compra', 'assinatura', 'recorrente'],
    criticalDataKeys: ['spending_patterns', 'recurring_expenses', 'categories', 
                       'alerts', 'monthly_summary']
  },
  investments: {
    keywords: ['investimento', 'carteira', 'ação', 'fundo', 'rendimento', 
               'aporte', 'tesouro', 'cdb', 'fii', 'dividendo', 'bolsa'],
    criticalDataKeys: ['portfolio', 'risk_profile', 'investment_goals', 
                       'asset_preferences', 'monthly_investment']
  },
  planning: {
    keywords: ['meta', 'objetivo', 'orçamento', 'plano', 'economia', 
               'limite', 'futuro', 'sonho', 'reserva'],
    criticalDataKeys: ['financial_goals', 'preferences', 'limits', 
                       'budget', 'target_dates', 'priorities']
  }
};

/**
 * Limite de caracteres para memória filtrada (economia de tokens)
 */
const MAX_CONTEXT_SIZE = 2000;
const MAX_CYCLES_TO_INCLUDE = 5;

class MemoryFilter {
  
  constructor() {
    this.agentTopics = AGENT_TOPICS;
    this.maxContextSize = MAX_CONTEXT_SIZE;
    this.maxCycles = MAX_CYCLES_TO_INCLUDE;
  }

  /**
   * Filtra a memória para incluir apenas informações relevantes
   * 
   * @param {Object} memory - Memória completa do chat
   * @param {Array} tasks - Tarefas decompostas
   * @returns {Object} Memória filtrada
   */
  async filter(memory, tasks) {
    const startTime = Date.now();
    
    if (!memory) {
      return this.createEmptyFilteredMemory();
    }

    logger.debug('Filtrando memória', {
      tasks_count: tasks.length,
      has_recent: !!memory.recent_memory,
      has_old: !!memory.old_memory
    });

    // Extrair tópicos relevantes das tarefas
    const relevantTopics = this.extractRelevantTopics(tasks);

    // Filtrar dados críticos
    const criticalData = this.filterCriticalData(memory, tasks);

    // Filtrar contexto de conversa
    const context = this.filterConversationContext(memory, relevantTopics);

    // Extrair informações específicas por agente
    const agentContext = this.buildAgentContext(tasks, memory);

    const filteredMemory = {
      context,
      critical_data: criticalData,
      agent_context: agentContext,
      metadata: {
        filtered_at: new Date().toISOString(),
        total_cycles_reviewed: this.countCycles(memory),
        cycles_included: context.length,
        topics_used: relevantTopics
      }
    };

    const duration = Date.now() - startTime;

    logger.debug('Memória filtrada', {
      duration_ms: duration,
      context_items: context.length,
      critical_keys: Object.keys(criticalData).length
    });

    return filteredMemory;
  }

  /**
   * Extrai tópicos relevantes das tarefas
   */
  extractRelevantTopics(tasks) {
    const topics = new Set();

    for (const task of tasks) {
      const agentTopics = this.agentTopics[task.agent];
      if (agentTopics) {
        agentTopics.keywords.forEach(kw => topics.add(kw));
      }

      // Adicionar keywords encontradas na decomposição
      if (task.matchedKeywords) {
        task.matchedKeywords.forEach(kw => topics.add(kw.toLowerCase()));
      }
    }

    return Array.from(topics);
  }

  /**
   * Filtra dados críticos relevantes
   */
  filterCriticalData(memory, tasks) {
    const criticalData = {};

    if (!memory.critical_data) {
      return criticalData;
    }

    // Coletar keys relevantes para as tarefas
    const relevantKeys = new Set();
    
    for (const task of tasks) {
      const agentTopics = this.agentTopics[task.agent];
      if (agentTopics) {
        agentTopics.criticalDataKeys.forEach(key => relevantKeys.add(key));
      }
    }

    // Sempre incluir certas keys universais
    const universalKeys = ['preferences', 'user_profile', 'financial_goals'];
    universalKeys.forEach(key => relevantKeys.add(key));

    // Filtrar dados
    for (const key of relevantKeys) {
      if (memory.critical_data[key] !== undefined) {
        criticalData[key] = memory.critical_data[key];
      }
    }

    return criticalData;
  }

  /**
   * Filtra contexto de conversa
   */
  filterConversationContext(memory, relevantTopics) {
    const context = [];
    let totalSize = 0;

    // Processar memória recente (prioridade alta)
    if (memory.recent_memory && Array.isArray(memory.recent_memory)) {
      for (const cycle of memory.recent_memory) {
        if (context.length >= this.maxCycles) break;
        if (totalSize >= this.maxContextSize) break;

        if (this.isRelevantCycle(cycle, relevantTopics)) {
          const contextItem = this.formatCycleForContext(cycle, 'recent');
          const itemSize = JSON.stringify(contextItem).length;
          
          if (totalSize + itemSize <= this.maxContextSize) {
            context.push(contextItem);
            totalSize += itemSize;
          }
        }
      }
    }

    // Processar memória antiga (se ainda tiver espaço)
    if (memory.old_memory && Array.isArray(memory.old_memory)) {
      for (const cycle of memory.old_memory) {
        if (context.length >= this.maxCycles) break;
        if (totalSize >= this.maxContextSize) break;

        if (this.isRelevantCycle(cycle, relevantTopics)) {
          const contextItem = this.formatCycleForContext(cycle, 'old');
          const itemSize = JSON.stringify(contextItem).length;
          
          if (totalSize + itemSize <= this.maxContextSize) {
            context.push(contextItem);
            totalSize += itemSize;
          }
        }
      }
    }

    return context;
  }

  /**
   * Verifica se um ciclo é relevante para os tópicos
   */
  isRelevantCycle(cycle, topics) {
    if (!cycle) return false;

    const textToSearch = [
      cycle.user_message || '',
      cycle.ai_response || '',
      cycle.summary || ''
    ].join(' ').toLowerCase();

    // Verificar se contém algum tópico relevante
    return topics.some(topic => textToSearch.includes(topic.toLowerCase()));
  }

  /**
   * Formata um ciclo para inclusão no contexto
   */
  formatCycleForContext(cycle, source) {
    const formatted = {
      source
    };

    if (source === 'recent') {
      // Memória recente: manter mensagens completas mas resumir se muito longas
      formatted.user = this.truncateIfNeeded(cycle.user_message, 200);
      formatted.ai = this.truncateIfNeeded(cycle.ai_response, 300);
    } else {
      // Memória antiga: usar resumo
      formatted.summary = cycle.summary || this.summarize(cycle);
      if (cycle.preserved_data) {
        formatted.preserved = cycle.preserved_data;
      }
    }

    return formatted;
  }

  /**
   * Trunca texto se necessário
   */
  truncateIfNeeded(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Cria resumo básico de um ciclo
   */
  summarize(cycle) {
    const userMsg = cycle.user_message || '';
    const aiMsg = cycle.ai_response || '';
    
    // Pegar primeira frase de cada
    const userFirst = userMsg.split(/[.!?]/)[0];
    const aiFirst = aiMsg.split(/[.!?]/)[0];
    
    return `Usuário: ${userFirst}. IA: ${aiFirst}`;
  }

  /**
   * Constrói contexto específico por agente
   */
  buildAgentContext(tasks, memory) {
    const agentContext = {};

    for (const task of tasks) {
      agentContext[task.agent] = {
        taskDescription: task.taskDescription,
        expectedOutput: task.expectedOutput,
        relevantData: this.extractAgentSpecificData(task.agent, memory)
      };
    }

    return agentContext;
  }

  /**
   * Extrai dados específicos para um agente
   */
  extractAgentSpecificData(agent, memory) {
    if (!memory || !memory.critical_data) {
      return {};
    }

    const agentTopics = this.agentTopics[agent];
    if (!agentTopics) return {};

    const data = {};
    for (const key of agentTopics.criticalDataKeys) {
      if (memory.critical_data[key]) {
        data[key] = memory.critical_data[key];
      }
    }

    return data;
  }

  /**
   * Conta total de ciclos na memória
   */
  countCycles(memory) {
    let count = 0;
    if (memory.recent_memory) count += memory.recent_memory.length;
    if (memory.old_memory) count += memory.old_memory.length;
    return count;
  }

  /**
   * Cria estrutura de memória filtrada vazia
   */
  createEmptyFilteredMemory() {
    return {
      context: [],
      critical_data: {},
      agent_context: {},
      metadata: {
        filtered_at: new Date().toISOString(),
        total_cycles_reviewed: 0,
        cycles_included: 0,
        topics_used: []
      }
    };
  }
}

module.exports = { MemoryFilter };
