/**
 * @module agents/junior/index
 * @description Agente Junior — First Responder do sistema.
 * 
 * Primeiro ponto de contato com a query do usuário.
 * Classifica a intenção e roteia para a ferramenta/agente adequado.
 * 
 * Modelo: GPT-5-mini (Reasoning: Medium, Verbosity: Low)
 * Conforme constituição — raciocínio local, escopo bem definido.
 * 
 * PONTO DE IA: Classificação e roteamento inteligente.
 */

const ModelFactory = require('../../utils/ai/model-factory');
const { JUNIOR_SYSTEM_PROMPT } = require('./prompt');
const { validateDecisionStructure } = require('./validators');
const { generateFollowup } = require('./followup');
const logger = require('../../utils/logger');

/**
 * Analisa a query do usuário e retorna uma decisão de roteamento.
 * 
 * @param {string} query - Mensagem do usuário
 * @param {Object} memory - Memória completa do chat (estrutura Memory)
 * @returns {Promise<Object>} Decisão estruturada
 * @returns {string} returns.decision - Rota escolhida
 * @returns {string} returns.reasoning - Justificativa
 * @returns {string[]} returns.missing_info - Campos faltantes
 * @returns {boolean} returns.needs_followup - Se precisa de mais informação
 * @returns {string|null} returns.followup_question - Pergunta de follow-up
 */
async function analyze(query, memory) {
  const mini = ModelFactory.getMini('medium', 'low');

  // Construir contexto de memória para o prompt
  const memoryContext = formatMemoryForPrompt(memory);

  const userPrompt = [
    `MEMÓRIA DO CHAT:`,
    memoryContext,
    ``,
    `QUERY DO USUÁRIO: "${query}"`,
    ``,
    `Analise e classifique esta query.`,
  ].join('\n');

  try {
    const decision = await mini.completeJSON(JUNIOR_SYSTEM_PROMPT, userPrompt, {
      maxTokens: 300,
      temperature: 0.2,
    });

    // Validar estrutura da resposta
    const validation = validateDecisionStructure(decision);

    if (!validation.valid) {
      logger.warn('Junior', 'ai', `Resposta inválida da IA: ${validation.errors.join('; ')}`, {
        query: query.substring(0, 80),
      });
      // Fallback para escalate se a IA não retornou estrutura válida
      return createFallbackDecision(query, validation.errors);
    }

    // Se precisa de follow-up, enriquecer com pergunta contextualizada
    if (decision.needs_followup && !decision.followup_question) {
      decision.followup_question = await generateFollowup(
        query,
        decision.missing_info || [],
        memory
      );
    }

    logger.ai('INFO', 'Junior', `Query classificada como "${decision.decision}"`, {
      reasoning: decision.reasoning.substring(0, 100),
      needsFollowup: decision.needs_followup,
    });

    return decision;
  } catch (error) {
    logger.error('Junior', 'ai', `Falha ao analisar query: "${query.substring(0, 50)}..."`, {
      error: error.message,
    });

    // Fallback: escalar para o orquestrador em caso de falha
    return createFallbackDecision(query, [error.message]);
  }
}

/**
 * Formata a memória para inclusão no prompt do Junior.
 * LÓGICA PURA.
 * @param {Object} memory - Estrutura Memory
 * @returns {string}
 */
function formatMemoryForPrompt(memory) {
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
 * Cria decisão de fallback quando a IA falha.
 * LÓGICA PURA.
 * @param {string} query - Query original
 * @param {string[]} errors - Erros encontrados
 * @returns {Object}
 */
function createFallbackDecision(query, errors) {
  return {
    decision: 'escalate',
    reasoning: `Fallback: impossível classificar automaticamente. Erros: ${errors.join('; ')}`,
    missing_info: [],
    needs_followup: false,
    followup_question: null,
  };
}

module.exports = { analyze, formatMemoryForPrompt };
