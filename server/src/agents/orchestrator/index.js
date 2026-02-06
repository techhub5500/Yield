/**
 * @module agents/orchestrator/index
 * @description Agente Orquestrador — Strategic Brain do sistema.
 * 
 * Recebe tarefas complexas escaladas pelo Junior e decompõe em subtarefas
 * para os Agentes Coordenadores (Análise, Investimentos, Planejamento).
 * 
 * Modelo: GPT-5.2 (Reasoning: High, Verbosity: Low)
 * Conforme constituição — coordenação, planejamento, decisão estratégica global.
 * 
 * PONTO DE IA: Decomposição, análise de dependências e criação do DOC.
 */

const { v4: uuidv4 } = require('uuid');
const ModelFactory = require('../../utils/ai/model-factory');
const { buildOrchestratorSystemPrompt } = require('./prompt');
const { validateDOC } = require('./validators');
const logger = require('../../utils/logger');

/**
 * Planeja a execução de uma tarefa complexa.
 * Gera um DOC (Documento de Direção) com o plano de execução.
 * 
 * @param {string} query - Query do usuário
 * @param {Object} memory - Memória completa do chat
 * @returns {Promise<Object>} DOC estruturado com plano de execução
 */
async function plan(query, memory) {
  const full = ModelFactory.getFull('high', 'low');

  const systemPrompt = buildOrchestratorSystemPrompt();

  // Construir contexto de memória para o prompt
  const memoryContext = formatMemoryForOrchestrator(memory);

  const userPrompt = [
    `MEMÓRIA DO CHAT:`,
    memoryContext,
    ``,
    `QUERY DO USUÁRIO: "${query}"`,
    ``,
    `Analise esta query seguindo o processo obrigatório de 4 etapas e gere o DOC.`,
  ].join('\n');

  try {
    const doc = await full.completeJSON(systemPrompt, userPrompt, {
      maxTokens: 1500,
      temperature: 0.2,
    });

    // Garantir request_id
    if (!doc.request_id) {
      doc.request_id = uuidv4();
    }

    // Garantir original_query
    if (!doc.original_query) {
      doc.original_query = query;
    }

    // Validar estrutura do DOC
    const validation = validateDOC(doc);

    if (!validation.valid) {
      logger.warn('Orchestrator', 'ai', `DOC inválido: ${validation.errors.join('; ')}`, {
        query: query.substring(0, 80),
      });
      // Tentar reparar ou usar fallback
      return createFallbackDOC(query, memory, validation.errors);
    }

    logger.ai('INFO', 'Orchestrator', `DOC gerado com sucesso`, {
      requestId: doc.request_id,
      agentCount: doc.execution_plan.agents.length,
      agents: doc.execution_plan.agents.map(a => a.agent).join(', '),
    });

    return doc;
  } catch (error) {
    logger.error('Orchestrator', 'ai', `Falha ao gerar DOC: "${query.substring(0, 50)}..."`, {
      error: error.message,
    });

    return createFallbackDOC(query, memory, [error.message]);
  }
}

/**
 * Formata a memória para inclusão no prompt do Orquestrador.
 * LÓGICA PURA.
 * @param {Object} memory - Estrutura Memory
 * @returns {string}
 */
function formatMemoryForOrchestrator(memory) {
  if (!memory) return 'Sem memória disponível.';

  const parts = [];

  // Ciclos recentes (completos)
  if (memory.recent && memory.recent.length > 0) {
    parts.push('RECENTE:');
    for (const cycle of memory.recent) {
      parts.push(`  Usuário: ${cycle.userInput}`);
      parts.push(`  IA: ${cycle.aiResponse}`);
      parts.push('');
    }
  }

  // Resumos antigos
  if (memory.old && memory.old.length > 0) {
    parts.push('HISTÓRICO (resumido):');
    for (const summary of memory.old) {
      const content = typeof summary === 'string' ? summary : summary.content;
      parts.push(`  ${content}`);
    }
  }

  return parts.length > 0 ? parts.join('\n') : 'Sem memória disponível.';
}

/**
 * Cria DOC de fallback quando a IA falha.
 * Encaminha para o Agente de Análise como agente padrão.
 * LÓGICA PURA.
 * @param {string} query
 * @param {Object} memory
 * @param {string[]} errors
 * @returns {Object}
 */
function createFallbackDOC(query, memory, errors) {
  const doc = {
    request_id: uuidv4(),
    original_query: query,
    reasoning: `Fallback: impossível decompor automaticamente. Erros: ${errors.join('; ')}. Encaminhando para Agente de Análise como fallback.`,
    execution_plan: {
      agents: [
        {
          agent: 'analysis',
          priority: 1,
          task_description: `Analisar a seguinte solicitação do usuário: "${query}"`,
          expected_output: 'Análise e resposta à solicitação do usuário',
          memory_context: memory ? 'Memória completa disponível' : 'Sem memória',
          dependencies: [],
        },
      ],
    },
  };

  logger.warn('Orchestrator', 'ai', 'DOC de fallback gerado', {
    requestId: doc.request_id,
    errors: errors.join('; ').substring(0, 100),
  });

  return doc;
}

module.exports = { plan, formatMemoryForOrchestrator };
