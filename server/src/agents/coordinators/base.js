/**
 * @module agents/coordinators/base
 * @description Classe base para todos os Agentes Coordenadores.
 * 
 * Encapsula o padrão comum:
 * - Modelo: GPT-5.2 (Reasoning: High, Verbosity: Low)
 * - Chain of Thought obrigatório (6 etapas)
 * - Acesso a ferramentas via injeção
 * - Formatação de input e parsing de output
 * 
 * PONTO DE IA: Cada coordenador herda um ponto de IA para raciocínio estratégico.
 * Justificativa do modelo: Decisões não triviais, planejamento de uso de ferramentas,
 * avaliação de qualidade, lida com ambiguidade, alto custo de erro.
 */

const ModelFactory = require('../../utils/ai/model-factory');
const { formatDependencyOutputsForPrompt } = require('../../core/orchestrator/input-builder');
const logger = require('../../utils/logger');

/**
 * @class BaseCoordinator
 * Classe base para coordenadores especializados.
 */
class BaseCoordinator {
  /**
   * @param {string} name - Nome do coordenador
   * @param {string} agentId - Identificador do agente (analysis, investments, planning)
   * @param {Object} tools - Ferramentas disponíveis
   * @param {string} systemPrompt - Prompt de sistema com CoT
   */
  constructor(name, agentId, tools, systemPrompt) {
    this.name = name;
    this.agentId = agentId;
    this.tools = tools;
    this.systemPrompt = systemPrompt;
    this.model = ModelFactory.getFull('high', 'low');
  }

  /**
   * Executa a tarefa atribuída pelo Orquestrador.
   * 
   * @param {Object} input - Input preparado pelo ExecutionManager
   * @param {string} input.memory_context - Contexto de memória filtrado
   * @param {string} input.task_description - Descrição da tarefa
   * @param {string} input.expected_output - Output esperado
   * @param {Object} input.dependency_outputs - Outputs de agentes anteriores
   * @returns {Promise<Object>} Resultado estruturado da execução
   */
  async execute(input) {
    const startTime = Date.now();

    logger.ai('INFO', this.name, `Iniciando execução: "${input.task_description.substring(0, 80)}..."`);

    const userPrompt = this._buildUserPrompt(input);

    try {
      // PASSO 1: IA planeja e solicita ferramentas (se necessário)
      const planResult = await this.model.completeJSON(this.systemPrompt, userPrompt, {
        maxTokens: 2000,
        temperature: 0.3,
      });

      // Verificar se há solicitações de ferramentas para executar
      const toolRequests = planResult.tool_requests || [];
      let toolResults = {};

      if (toolRequests.length > 0 && this._hasAvailableTools()) {
        logger.ai('INFO', this.name, `Executando ${toolRequests.length} ferramenta(s) solicitada(s)`);
        toolResults = await this._executeToolRequests(toolRequests, input.chatId);
      }

      // PASSO 2: Se ferramentas foram executadas, IA sintetiza com dados reais
      let result;
      if (Object.keys(toolResults).length > 0) {
        const synthesisPrompt = this._buildSynthesisPrompt(input, planResult, toolResults);
        result = await this.model.completeJSON(this.systemPrompt, synthesisPrompt, {
          maxTokens: 2000,
          temperature: 0.3,
        });
      } else {
        result = planResult;
      }

      // Remover tool_requests do resultado final (campo interno)
      delete result.tool_requests;

      // Garantir campos obrigatórios
      result.agent = result.agent || this.agentId;
      result.task_completed = result.task_completed !== undefined ? result.task_completed : true;
      result.tools_used = result.tools_used || [];
      result.result = result.result || {};
      result.metadata = result.metadata || {};
      result.metadata.execution_time = Date.now() - startTime;
      result.metadata.confidence = result.metadata.confidence || 'medium';
      result.metadata.tools_executed = Object.keys(toolResults).length;

      logger.ai('INFO', this.name, `Execução concluída`, {
        taskCompleted: result.task_completed,
        toolsUsed: result.tools_used.join(', ') || 'nenhuma',
        toolsExecuted: Object.keys(toolResults).length,
        confidence: result.metadata.confidence,
        elapsed: `${result.metadata.execution_time}ms`,
      });

      return result;
    } catch (error) {
      const elapsed = Date.now() - startTime;

      logger.error(this.name, 'ai', `Falha na execução`, {
        error: error.message,
        elapsed: `${elapsed}ms`,
      });

      // Retornar resultado de erro estruturado
      return this._createErrorResult(input, error, elapsed);
    }
  }

  /**
   * Constrói o prompt do usuário com tarefa, memória e dependências.
   * LÓGICA PURA.
   * @param {Object} input
   * @returns {string}
   * @protected
   */
  _buildUserPrompt(input) {
    const parts = [];

    // Contexto de memória
    if (input.memory_context) {
      parts.push('CONTEXTO DE MEMÓRIA:');
      parts.push(input.memory_context);
      parts.push('');
    }

    // Outputs de dependências
    if (input.dependency_outputs && Object.keys(input.dependency_outputs).length > 0) {
      parts.push(formatDependencyOutputsForPrompt(input.dependency_outputs));
      parts.push('');
    }

    // Tarefa
    parts.push('TAREFA ATRIBUÍDA:');
    parts.push(input.task_description);
    parts.push('');

    // Output esperado
    parts.push('OUTPUT ESPERADO:');
    parts.push(input.expected_output);
    parts.push('');

    parts.push('Execute seguindo o processo obrigatório de 6 etapas e retorne o resultado em JSON.');

    return parts.join('\n');
  }

  /**
   * Constrói o prompt de síntese com dados reais das ferramentas (Passo 2).
   * LÓGICA PURA.
   * @param {Object} input - Input original
   * @param {Object} planResult - Resultado do planejamento (passo 1)
   * @param {Object} toolResults - Resultados das ferramentas executadas
   * @returns {string}
   * @protected
   */
  _buildSynthesisPrompt(input, planResult, toolResults) {
    const parts = [];

    // Contexto original
    if (input.memory_context) {
      parts.push('CONTEXTO DE MEMÓRIA:');
      parts.push(input.memory_context);
      parts.push('');
    }

    // Outputs de dependências
    if (input.dependency_outputs && Object.keys(input.dependency_outputs).length > 0) {
      parts.push(formatDependencyOutputsForPrompt(input.dependency_outputs));
      parts.push('');
    }

    // Tarefa original
    parts.push('TAREFA ATRIBUÍDA:');
    parts.push(input.task_description);
    parts.push('');

    // Output esperado
    parts.push('OUTPUT ESPERADO:');
    parts.push(input.expected_output);
    parts.push('');

    // Raciocínio do passo 1
    if (planResult.reasoning) {
      parts.push('SEU RACIOCÍNIO ANTERIOR:');
      parts.push(planResult.reasoning);
      parts.push('');
    }

    // Dados reais das ferramentas
    parts.push('DADOS REAIS DAS FERRAMENTAS EXECUTADAS:');
    for (const [key, result] of Object.entries(toolResults)) {
      parts.push(`\n--- ${key} ---`);
      if (result.success) {
        parts.push(JSON.stringify(result.data, null, 2));
      } else {
        parts.push(`ERRO: ${result.error}`);
      }
    }
    parts.push('');

    parts.push('INSTRUÇÕES: Com base nos DADOS REAIS acima, complete sua análise final.');
    parts.push('Use APENAS os dados reais — NÃO invente valores. Retorne o resultado em JSON.');
    parts.push('NÃO inclua "tool_requests" nesta resposta — os dados já foram obtidos.');

    return parts.join('\n');
  }

  /**
   * Verifica se existem ferramentas disponíveis para execução.
   * LÓGICA PURA.
   * @returns {boolean}
   * @protected
   */
  _hasAvailableTools() {
    return !!(
      this.tools.financeBridge ||
      this.tools.searchManager ||
      this.tools.mathModule
    );
  }

  /**
   * Executa múltiplas solicitações de ferramentas.
   * LÓGICA PURA — despacha para a ferramenta correta.
   * @param {Array} toolRequests - Solicitações de ferramentas da IA
   * @param {string} [chatId] - ID do chat para ExternalCallManager
   * @returns {Promise<Object>} Resultados indexados por chave
   * @protected
   */
  async _executeToolRequests(toolRequests, chatId) {
    const results = {};

    for (const request of toolRequests) {
      const key = `${request.tool}:${request.action || 'default'}`;
      try {
        const result = await this._executeSingleTool(request, chatId);
        results[key] = { success: true, data: result };
        logger.logic('DEBUG', this.name, `Ferramenta "${key}" executada com sucesso`);
      } catch (error) {
        results[key] = { success: false, error: error.message };
        logger.warn(this.name, 'logic', `Ferramenta "${key}" falhou: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Executa uma única solicitação de ferramenta.
   * Usa ExternalCallManager quando disponível para preservação de estado.
   * LÓGICA PURA.
   * @param {Object} request - { tool, action, params }
   * @param {string} [chatId] - ID do chat
   * @returns {Promise<*>} Resultado da ferramenta
   * @protected
   */
  async _executeSingleTool(request, chatId) {
    const { tool, action, params } = request;

    const execFn = async () => {
      switch (tool) {
        case 'finance_bridge': {
          if (!this.tools.financeBridge) throw new Error('Finance Bridge não disponível');
          if (action === 'query') {
            return await this.tools.financeBridge.query(params.query || '', {});
          }
          throw new Error(`Ação desconhecida para finance_bridge: ${action}`);
        }

        case 'search': {
          if (!this.tools.searchManager) throw new Error('SearchManager não disponível');
          return await this.tools.searchManager.search(params.query || '', action || 'serper');
        }

        case 'math': {
          if (!this.tools.mathModule) throw new Error('MathModule não disponível');
          return this._executeMathTool(action, params);
        }

        default:
          throw new Error(`Ferramenta desconhecida: ${tool}`);
      }
    };

    // Usar ExternalCallManager para preservação de estado quando disponível
    if (this.tools.externalCallManager && chatId) {
      return this.tools.externalCallManager.executeWithState(
        this.agentId, chatId, async () => execFn(), { tool, action, ...params }, `${tool}:${action}`
      );
    }

    return execFn();
  }

  /**
   * Executa uma operação do Módulo Matemático.
   * LÓGICA PURA.
   * @param {string} action - Nome da função matemática
   * @param {Object} params - Parâmetros da função
   * @returns {*} Resultado do cálculo
   * @protected
   */
  _executeMathTool(action, params) {
    const math = this.tools.mathModule;

    switch (action) {
      case 'compoundInterest':
        return math.compoundInterest(params.principal, params.rate, params.periods);
      case 'netPresentValue':
        return math.netPresentValue(params.rate, params.cashFlows);
      case 'internalRateOfReturn':
        return math.internalRateOfReturn(params.cashFlows);
      case 'sharpeRatio':
        return math.sharpeRatio(params.returns, params.riskFreeRate);
      case 'valueAtRisk':
        return math.valueAtRisk(params.returns, params.confidence);
      case 'projectionWithContributions':
        return math.projectionWithContributions(
          params.monthlyPayment, params.monthlyRate, params.months, params.initialAmount
        );
      default:
        throw new Error(`Função matemática desconhecida: ${action}`);
    }
  }

  /**
   * Cria resultado de erro estruturado.
   * LÓGICA PURA.
   * @param {Object} input
   * @param {Error} error
   * @param {number} elapsed
   * @returns {Object}
   * @protected
   */
  _createErrorResult(input, error, elapsed) {
    return {
      agent: this.agentId,
      task_completed: false,
      reasoning: `Falha na execução: ${error.message}. Tarefa: "${input.task_description}"`,
      tools_used: [],
      result: {
        error: error.message,
        task_attempted: input.task_description,
      },
      metadata: {
        execution_time: elapsed,
        confidence: 'none',
      },
    };
  }
}

module.exports = BaseCoordinator;
