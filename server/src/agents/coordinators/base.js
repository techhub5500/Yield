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
      const result = await this.model.completeJSON(this.systemPrompt, userPrompt, {
        maxTokens: 2000,
        temperature: 0.3,
      });

      // Garantir campos obrigatórios
      result.agent = result.agent || this.agentId;
      result.task_completed = result.task_completed !== undefined ? result.task_completed : true;
      result.tools_used = result.tools_used || [];
      result.result = result.result || {};
      result.metadata = result.metadata || {};
      result.metadata.execution_time = Date.now() - startTime;
      result.metadata.confidence = result.metadata.confidence || 'medium';

      logger.ai('INFO', this.name, `Execução concluída`, {
        taskCompleted: result.task_completed,
        toolsUsed: result.tools_used.join(', ') || 'nenhuma',
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
