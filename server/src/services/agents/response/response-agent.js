/**
 * Response Agent - Agente de Resposta Final
 * Fase 6 - Sistema Multi-Agente Financeiro
 * 
 * Responsável por:
 * - Receber resultados de todos os coordenadores
 * - Sintetizar informações de múltiplas fontes
 * - Formatar resposta final para o usuário
 * - Garantir respostas acionáveis e claras
 */

const logger = require('../../../utils/logger');
const Synthesizer = require('./synthesizer');
const Formatter = require('./formatter');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

/**
 * Status do Agente de Resposta
 */
const RESPONSE_STATUS = {
  IDLE: 'idle',
  RECEIVING: 'receiving',
  SYNTHESIZING: 'synthesizing',
  FORMATTING: 'formatting',
  DELIVERING: 'delivering',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Tipos de resposta que o agente pode gerar
 */
const RESPONSE_TYPES = {
  SINGLE_AGENT: 'single_agent',      // Resposta de um único coordenador
  MULTI_AGENT: 'multi_agent',        // Resposta combinada de múltiplos coordenadores
  PARTIAL: 'partial',                // Resposta parcial (alguns agentes falharam)
  ERROR: 'error',                    // Resposta de erro
  CONFIRMATION: 'confirmation'       // Confirmação de ação (lançamentos)
};

class ResponseAgent {
  
  constructor() {
    this.status = RESPONSE_STATUS.IDLE;
    this.synthesizer = new Synthesizer();
    this.formatter = new Formatter();
    this.systemPrompt = null;
    this.openai = null;
    this.executionLog = [];
    this.startTime = null;
  }

  /**
   * Inicializa o agente de resposta
   */
  async initialize() {
    try {
      // Carregar prompt de sistema
      const promptPath = path.join(__dirname, 'prompts', 'response-system.txt');
      if (fs.existsSync(promptPath)) {
        this.systemPrompt = fs.readFileSync(promptPath, 'utf-8');
      } else {
        this.systemPrompt = this.getDefaultSystemPrompt();
      }

      // Inicializar OpenAI se disponível
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
      }

      logger.info('Response Agent inicializado');
      return this;
    } catch (error) {
      logger.error('Erro ao inicializar Response Agent', { error: error.message });
      throw error;
    }
  }

  /**
   * Processa os resultados e gera a resposta final
   * 
   * @param {Object} memory - Memória do chat
   * @param {string} originalQuery - Query original do usuário
   * @param {Object} doc - DOC do Orquestrador
   * @param {Object} coordinatorResults - Resultados dos coordenadores
   * @returns {Promise<Object>} Resposta final formatada
   */
  async process(memory, originalQuery, doc, coordinatorResults) {
    this.startTime = Date.now();
    this.executionLog = [];
    
    try {
      // 1. RECEPÇÃO
      this.status = RESPONSE_STATUS.RECEIVING;
      this.log('step', 'Recebendo resultados dos coordenadores');
      
      const context = await this.receive(memory, originalQuery, doc, coordinatorResults);
      
      // 2. SÍNTESE
      this.status = RESPONSE_STATUS.SYNTHESIZING;
      this.log('step', 'Sintetizando resultados');
      
      const synthesized = await this.synthesize(context);
      
      // 3. FORMATAÇÃO
      this.status = RESPONSE_STATUS.FORMATTING;
      this.log('step', 'Formatando resposta');
      
      const formatted = await this.format(synthesized, context);
      
      // 4. ENTREGA
      this.status = RESPONSE_STATUS.DELIVERING;
      this.log('step', 'Preparando entrega');
      
      const response = await this.deliver(formatted, context);
      
      this.status = RESPONSE_STATUS.COMPLETED;
      
      const duration = Date.now() - this.startTime;
      this.log('completed', `Processamento concluído em ${duration}ms`);

      return {
        success: true,
        response,
        metadata: {
          duration_ms: duration,
          response_type: context.responseType,
          agents_used: context.agentsUsed,
          execution_log: this.executionLog
        }
      };

    } catch (error) {
      this.status = RESPONSE_STATUS.FAILED;
      this.log('error', `Erro: ${error.message}`);

      logger.error('Erro no Response Agent', {
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message,
        response: this.generateErrorResponse(error, originalQuery),
        metadata: {
          duration_ms: Date.now() - this.startTime,
          execution_log: this.executionLog
        }
      };
    }
  }

  /**
   * Etapa 1: Recepção - Prepara o contexto
   */
  async receive(memory, originalQuery, doc, coordinatorResults) {
    // Analisar resultados dos coordenadores
    const completed = coordinatorResults.completed || {};
    const failed = coordinatorResults.failed || {};
    const pending = coordinatorResults.pending || {};

    const agentsUsed = Object.keys(completed);
    const agentsFailed = Object.keys(failed);

    // Determinar tipo de resposta
    let responseType;
    if (agentsUsed.length === 0) {
      responseType = RESPONSE_TYPES.ERROR;
    } else if (agentsFailed.length > 0) {
      responseType = RESPONSE_TYPES.PARTIAL;
    } else if (agentsUsed.length === 1) {
      responseType = RESPONSE_TYPES.SINGLE_AGENT;
    } else {
      responseType = RESPONSE_TYPES.MULTI_AGENT;
    }

    this.log('receive', `Tipo de resposta: ${responseType}, Agentes: ${agentsUsed.join(', ')}`);

    return {
      memory,
      originalQuery,
      doc,
      coordinatorResults: completed,
      failedAgents: failed,
      pendingAgents: pending,
      agentsUsed,
      agentsFailed,
      responseType,
      userContext: this.extractUserContext(memory),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Etapa 2: Síntese - Combina resultados
   */
  async synthesize(context) {
    // Usar o Synthesizer para combinar resultados
    const combinedResults = this.synthesizer.combineResults(context.coordinatorResults);
    
    // Extrair insights principais
    const keyInsights = this.synthesizer.extractKeyInsights(combinedResults);
    
    // Priorizar por relevância à query
    const prioritizedInsights = this.synthesizer.prioritizeContent(keyInsights, context.originalQuery);
    
    // Resolver conflitos se houver
    const resolvedInsights = this.synthesizer.resolveConflicts(prioritizedInsights);
    
    // Gerar estrutura da resposta
    const responseStructure = this.synthesizer.generateResponseStructure(resolvedInsights, context);

    this.log('synthesize', `Insights extraídos: ${keyInsights.length}, Priorizados: ${prioritizedInsights.length}`);

    return {
      combinedResults,
      keyInsights: prioritizedInsights,
      resolvedInsights,
      responseStructure,
      hasWarnings: context.agentsFailed.length > 0,
      warnings: context.agentsFailed.map(agent => `Agente ${agent} não conseguiu completar sua tarefa`)
    };
  }

  /**
   * Etapa 3: Formatação - Aplica formatação final
   */
  async format(synthesized, context) {
    // Aplicar formatação baseada na estrutura
    let formattedContent = '';

    // Título/Resumo
    if (synthesized.responseStructure.title) {
      formattedContent += `${synthesized.responseStructure.title}\n\n`;
    }

    // Resumo executivo
    if (synthesized.responseStructure.summary) {
      formattedContent += `${synthesized.responseStructure.summary}\n\n`;
    }

    // Seções principais
    for (const section of synthesized.responseStructure.sections || []) {
      formattedContent += this.formatter.formatSection(section);
    }

    // Alertas/Avisos
    if (synthesized.responseStructure.alerts?.length > 0) {
      formattedContent += '\n' + this.formatter.formatAlerts(synthesized.responseStructure.alerts);
    }

    // Sugestões/Próximos passos
    if (synthesized.responseStructure.suggestions?.length > 0) {
      formattedContent += '\n' + this.formatter.formatSuggestions(synthesized.responseStructure.suggestions);
    }

    // Avisos de erros parciais
    if (synthesized.hasWarnings) {
      formattedContent += '\n\n---\n';
      formattedContent += this.formatter.formatWarnings(synthesized.warnings);
    }

    // Tornar resposta acionável
    formattedContent = this.formatter.makeActionable(formattedContent, context.originalQuery);

    this.log('format', `Resposta formatada com ${formattedContent.length} caracteres`);

    return {
      content: formattedContent.trim(),
      rawData: synthesized.responseStructure,
      hasActions: synthesized.responseStructure.suggestions?.length > 0
    };
  }

  /**
   * Etapa 4: Entrega - Prepara resposta final
   */
  async deliver(formatted, context) {
    // Truncar se muito longa
    const maxLength = 4000; // Limite razoável para resposta
    let finalContent = formatted.content;
    
    if (finalContent.length > maxLength) {
      finalContent = this.formatter.truncateIfNeeded(finalContent, maxLength);
    }

    // Estrutura final da resposta
    return {
      // Texto formatado para exibição
      text: finalContent,
      
      // Dados estruturados para frontend
      structured: {
        type: context.responseType,
        agents: context.agentsUsed,
        timestamp: context.timestamp,
        hasActions: formatted.hasActions,
        rawData: formatted.rawData
      },
      
      // Metadados
      metadata: {
        query: context.originalQuery,
        docId: context.doc?.id,
        confidence: this.calculateConfidence(context),
        truncated: formatted.content.length > maxLength
      }
    };
  }

  /**
   * Gera resposta de erro
   */
  generateErrorResponse(error, originalQuery) {
    const errorMessage = `Desculpe, encontrei um problema ao processar sua solicitação.

❌ **Erro:** ${error.message}

Por favor, tente novamente ou reformule sua pergunta. Se o problema persistir, entre em contato com o suporte.

---
*Sua pergunta original: "${originalQuery}"*`;

    return {
      text: errorMessage,
      structured: {
        type: RESPONSE_TYPES.ERROR,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      metadata: {
        query: originalQuery,
        confidence: 0
      }
    };
  }

  /**
   * Extrai contexto relevante do usuário a partir da memória
   */
  extractUserContext(memory) {
    if (!memory) return {};

    return {
      recentCycles: memory.recent?.length || 0,
      hasPreferences: !!memory.compressed?.criticalInfo,
      userName: memory.compressed?.userName || null
    };
  }

  /**
   * Calcula nível de confiança da resposta
   */
  calculateConfidence(context) {
    let confidence = 1.0;

    // Penalidade por agentes que falharam
    const totalAgents = context.agentsUsed.length + context.agentsFailed.length;
    if (totalAgents > 0) {
      confidence = context.agentsUsed.length / totalAgents;
    }

    // Penalidade por resposta parcial
    if (context.responseType === RESPONSE_TYPES.PARTIAL) {
      confidence *= 0.8;
    }

    // Bonus por múltiplos agentes concordando
    if (context.responseType === RESPONSE_TYPES.MULTI_AGENT && context.agentsUsed.length >= 2) {
      confidence = Math.min(1.0, confidence * 1.1);
    }

    return Math.round(confidence * 100) / 100;
  }

  /**
   * Prompt de sistema padrão
   */
  getDefaultSystemPrompt() {
    return `Você é o Agente de Resposta do sistema Yield, um assistente financeiro inteligente.

Sua função é sintetizar os resultados de análises financeiras e apresentá-los de forma clara e acionável ao usuário.

REGRAS DE FORMATAÇÃO:
1. Use emojis relevantes para destacar seções (📊, 💰, ⚠️, ✅, etc.)
2. Formate valores monetários como R$ 1.234,56
3. Use bullets e listas para organizar informações
4. Destaque pontos importantes em **negrito**
5. Sempre termine com sugestões práticas quando aplicável

REGRAS DE CONTEÚDO:
1. Seja objetivo e direto
2. Priorize informações mais relevantes para a pergunta do usuário
3. Inclua números e dados específicos sempre que disponível
4. Se houver alertas ou problemas, destaque-os claramente
5. Sempre que possível, sugira próximos passos`;
  }

  /**
   * Adiciona entrada ao log de execução
   */
  log(type, message) {
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      message
    };
    this.executionLog.push(entry);
    logger.debug(`[ResponseAgent] ${type}: ${message}`);
  }

  /**
   * Health check do agente
   */
  async healthCheck() {
    return {
      status: 'healthy',
      agent: 'response',
      currentStatus: this.status,
      hasOpenAI: !!this.openai,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Obtém capacidades do agente
   */
  getCapabilities() {
    return {
      name: 'Response Agent',
      description: 'Sintetiza resultados e gera respostas finais formatadas',
      responseTypes: Object.values(RESPONSE_TYPES),
      features: [
        'Síntese de múltiplos resultados',
        'Formatação monetária BR',
        'Respostas acionáveis',
        'Tratamento de erros parciais'
      ]
    };
  }
}

// Singleton
let instance = null;

module.exports = {
  ResponseAgent,
  RESPONSE_STATUS,
  RESPONSE_TYPES,
  
  /**
   * Inicializa e retorna instância singleton
   */
  async initialize() {
    if (!instance) {
      instance = new ResponseAgent();
      await instance.initialize();
    }
    return instance;
  },

  /**
   * Retorna instância existente
   */
  getInstance() {
    if (!instance) {
      instance = new ResponseAgent();
    }
    return instance;
  },

  /**
   * Processa resultados e gera resposta
   */
  async process(memory, query, doc, results) {
    const agent = await module.exports.initialize();
    return agent.process(memory, query, doc, results);
  }
};
