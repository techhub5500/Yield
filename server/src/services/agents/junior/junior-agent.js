/**
 * Agente Júnior - Lógica Principal
 * Fase 3 - Sistema Multi-Agente
 * 
 * O Agente Júnior é a porta de entrada do sistema. Ele:
 * - Recebe todas as mensagens do usuário
 * - Classifica a complexidade da solicitação
 * - Resolve tarefas simples diretamente
 * - Escala tarefas complexas para o Orquestrador
 */

const { Classifier, COMPLEXITY_LEVELS } = require('./classifier');
const { Resolver } = require('./resolver');
const logger = require('../../../utils/logger');

class JuniorAgent {
  
  constructor() {
    this.classifier = new Classifier();
    this.resolver = new Resolver();
    this.transactionLauncher = null; // Lazy loading
    this.searchService = null; // Lazy loading
  }

  /**
   * Obtém o TransactionLauncher (lazy loading)
   */
  getTransactionLauncher() {
    if (!this.transactionLauncher) {
      const { TransactionLauncher } = require('./launch/transaction-launcher');
      this.transactionLauncher = new TransactionLauncher();
    }
    return this.transactionLauncher;
  }

  /**
   * Obtém o SearchService (lazy loading)
   */
  getSearchService() {
    if (!this.searchService) {
      const searchService = require('../../search');
      this.searchService = searchService;
    }
    return this.searchService;
  }

  /**
   * Processa uma mensagem do usuário
   * 
   * @param {Object} memory - Memória completa do chat
   * @param {string} userMessage - Mensagem atual do usuário
   * @param {Object} context - Contexto adicional (user_id, etc)
   * @returns {Object} Resultado do processamento
   * 
   * @example
   * const result = await juniorAgent.process(memory, 'Quanto gastei ontem?', { user_id: '123' });
   */
  async process(memory, userMessage, context = {}) {
    const startTime = Date.now();
    
    try {
      logger.info('Agente Júnior processando mensagem', {
        user_id: context.user_id,
        message_length: userMessage.length,
        has_memory: !!memory
      });

      // 1. Classificar a complexidade da mensagem
      const classification = await this.classifier.classify(memory, userMessage);
      
      logger.debug('Classificação concluída', {
        complexity: classification.complexity,
        intent: classification.intent?.type,
        needs_more_info: classification.needsMoreInfo
      });

      // 2. Se precisa de mais informações, solicitar
      if (classification.needsMoreInfo) {
        return this.requestMoreInfo(classification, memory, userMessage);
      }

      // 3. Se for complexo, escalar para Orquestrador
      if (classification.complexity === COMPLEXITY_LEVELS.COMPLEX) {
        return this.escalateToOrchestrator(memory, userMessage, classification, context);
      }

      // 4. Resolver a tarefa
      const resolution = await this.resolver.resolve(classification, memory, userMessage, context);

      // 5. Tratar resultado da resolução
      const result = await this.handleResolution(resolution, classification, memory, userMessage, context);

      const duration = Date.now() - startTime;
      
      logger.info('Agente Júnior finalizou processamento', {
        duration_ms: duration,
        action: result.action,
        complexity: classification.complexity
      });

      return result;

    } catch (error) {
      logger.error('Erro no Agente Júnior', {
        error: error.message,
        user_id: context.user_id
      });

      return {
        action: 'error',
        response: 'Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.',
        error: error.message
      };
    }
  }

  /**
   * Trata o resultado da resolução
   */
  async handleResolution(resolution, classification, memory, userMessage, context) {
    switch (resolution.action) {
      case 'resolved':
        // Tarefa resolvida com sucesso
        return {
          action: 'resolved',
          response: resolution.response,
          data: resolution.data
        };

      case 'needs_info':
        // Precisa de mais informações
        return {
          action: 'needs_info',
          response: resolution.response,
          pendingContext: resolution.pendingContext
        };

      case 'launch_transaction':
        // Lançar transação
        return this.handleTransactionLaunch(resolution, context);

      case 'external_search':
        // Busca externa
        return this.handleExternalSearch(resolution, userMessage, context);

      case 'error':
        return {
          action: 'error',
          response: resolution.response,
          error: resolution.error
        };

      default:
        logger.warn('Ação de resolução desconhecida', { action: resolution.action });
        return {
          action: 'error',
          response: 'Não consegui processar sua solicitação.',
          error: 'unknown_action'
        };
    }
  }

  /**
   * Processa lançamento de transação
   */
  async handleTransactionLaunch(resolution, context) {
    try {
      const launcher = this.getTransactionLauncher();
      
      const result = await launcher.launchFromExtracted(
        resolution.extracted,
        resolution.transactionType,
        context
      );

      if (result.success) {
        return {
          action: 'resolved',
          response: result.response,
          data: result.transaction
        };
      } else {
        return {
          action: 'error',
          response: result.response || 'Erro ao registrar transação.',
          error: result.error
        };
      }

    } catch (error) {
      logger.error('Erro ao lançar transação', { error: error.message });
      return {
        action: 'error',
        response: 'Desculpe, não consegui registrar a transação.',
        error: error.message
      };
    }
  }

  /**
   * Processa busca externa
   */
  async handleExternalSearch(resolution, userMessage, context) {
    try {
      const searchService = this.getSearchService();
      
      const searchResults = await searchService.search(resolution.searchQuery);
      
      // Formatar resposta com os resultados
      const response = this.formatSearchResponse(searchResults, userMessage);
      
      return {
        action: 'resolved',
        response: response,
        data: { searchResults }
      };

    } catch (error) {
      logger.error('Erro na busca externa', { error: error.message });
      return {
        action: 'error',
        response: 'Desculpe, não consegui buscar essa informação no momento.',
        error: error.message
      };
    }
  }

  /**
   * Solicita mais informações do usuário
   */
  requestMoreInfo(classification, memory, userMessage) {
    const pendingContext = {
      type: 'follow_up',
      waiting_for: classification.missingFields,
      extracted: classification.extracted || {},
      transactionType: classification.transactionType,
      original_message: userMessage,
      original_intent: classification.intent,
      timestamp: new Date().toISOString()
    };

    logger.debug('Solicitando mais informações', {
      missing_fields: classification.missingFields,
      transaction_type: classification.transactionType
    });

    return {
      action: 'needs_info',
      response: classification.followUpQuestion,
      pendingContext: pendingContext
    };
  }

  /**
   * Escala tarefa para o Orquestrador
   */
  escalateToOrchestrator(memory, userMessage, classification, context) {
    logger.info('Escalando para Orquestrador', {
      user_id: context.user_id,
      intent: classification.intent?.type
    });

    return {
      action: 'escalate',
      target: 'orchestrator',
      payload: {
        memory: memory,
        query: userMessage,
        classification: classification,
        context: context
      }
    };
  }

  /**
   * Formata resposta de busca externa
   */
  formatSearchResponse(results, originalQuery) {
    if (!results || results.length === 0) {
      return 'Não encontrei informações sobre isso no momento.';
    }

    // Se tiver uma resposta direta (answer box)
    const answerResult = results.find(r => r.type === 'answer');
    if (answerResult) {
      return `📌 **Resposta:** ${answerResult.content}`;
    }

    // Formatar resultados orgânicos
    let response = '🔍 **Resultados encontrados:**\n\n';
    
    const organicResults = results.filter(r => r.type === 'organic').slice(0, 3);
    
    organicResults.forEach((r, i) => {
      response += `${i + 1}. **${r.title}**\n`;
      response += `   ${r.snippet}\n\n`;
    });

    return response;
  }

  /**
   * Retorna informações sobre o agente
   */
  getInfo() {
    return {
      name: 'Agente Júnior',
      version: '1.0.0',
      description: 'Porta de entrada do sistema. Classifica e resolve tarefas simples.',
      capabilities: [
        'Classificar complexidade de mensagens',
        'Resolver consultas triviais',
        'Processar lançamentos simples',
        'Executar análises intermediárias',
        'Escalar tarefas complexas para Orquestrador'
      ],
      complexity_levels: Object.values(COMPLEXITY_LEVELS)
    };
  }

  /**
   * Health check do agente
   */
  async healthCheck() {
    try {
      // Verificar classificador
      const testClassification = await this.classifier.classify({}, 'teste');
      
      return {
        status: 'healthy',
        classifier: 'ok',
        resolver: 'ok',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = { JuniorAgent };
