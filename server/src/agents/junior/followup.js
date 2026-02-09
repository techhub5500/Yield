/**
 * @module agents/junior/followup
 * @description Sistema de follow-up contextual do Junior.
 * 
 * Quando a IA detecta informação faltante, este módulo:
 * 1. Analisa a memória recente para inferir contexto (IA)
 * 2. Gera pergunta contextualizada ao usuário
 * 3. Marca na memória como "continuação de contexto"
 * 
 * PONTO DE IA: Inferência de contexto via memória recente.
 * Modelo: GPT-5-mini (mesmo do Junior — Reasoning: Medium, Verbosity: Low)
 */

const ModelFactory = require('../../utils/ai/model-factory');
const logger = require('../../utils/logger');

const FOLLOWUP_SYSTEM_PROMPT = `Você é um assistente financeiro fazendo uma pergunta de follow-up ao usuário.

Contexto: O usuário quer registrar uma transação financeira, mas faltam informações.

Sua tarefa:
1. Analisar a memória recente para inferir contexto
2. Gerar uma pergunta natural e contextualizada
3. Se possível, sugerir opções com base no histórico

REGRAS:
- Seja direto e cordial
- Mencione o que VOCÊ JÁ SABE (valor, etc.)
- Pergunte apenas o que FALTA
- Se a memória recente tem pistas, use-as para sugerir
- Responda APENAS com a pergunta (texto puro, sem JSON)

Exemplo: Se o usuário disse "gastei 200" e na memória recente ele mencionou supermercado:
"Você gastou R$ 200,00 no supermercado novamente, ou foi em outro lugar?"`;

/**
 * Gera uma pergunta de follow-up contextualizada.
 * @param {string} query - Query original do usuário
 * @param {string[]} missingFields - Campos faltantes
 * @param {Object} memory - Memória completa do chat
 * @returns {Promise<string>} Pergunta de follow-up
 */
async function generateFollowup(query, missingFields, memory) {
  const mini = ModelFactory.getMini('medium', 'low');

  // Construir contexto da memória recente
  const recentContext = memory.recent && memory.recent.length > 0
    ? memory.recent.map(c =>
        `[${c.timestamp}] Usuário: ${c.userInput} | IA: ${c.aiResponse}`
      ).join('\n')
    : 'Sem histórico recente.';

  const userPrompt = [
    `QUERY DO USUÁRIO: "${query}"`,
    ``,
    `INFORMAÇÕES FALTANTES: ${missingFields.join(', ')}`,
    ``,
    `MEMÓRIA RECENTE:`,
    recentContext,
    ``,
    `Gere uma pergunta de follow-up contextualizada.`,
  ].join('\n');

  try {
    const followup = await mini.complete(FOLLOWUP_SYSTEM_PROMPT, userPrompt, {
      maxTokens: 150,
      temperature: 0.4,
    });

    logger.ai('DEBUG', 'JuniorFollowup', 'Follow-up gerado', {
      missingFields,
      queryPreview: query.substring(0, 50),
    });

    return followup.trim();
  } catch (error) {
    logger.error('JuniorFollowup', 'ai', 'Falha ao gerar follow-up, usando fallback', {
      error: error.message,
    });

    // Fallback: pergunta genérica baseada nos campos faltantes
    return generateFallbackQuestion(query, missingFields);
  }
}

/**
 * Gera pergunta de fallback quando a IA falha.
 * LÓGICA PURA.
 * @param {string} query - Query original
 * @param {string[]} missingFields - Campos faltantes
 * @returns {string}
 */
function generateFallbackQuestion(query, missingFields) {
  if (missingFields.includes('amount') && missingFields.includes('description')) {
    return 'Qual o valor e a descrição dessa transação?';
  }
  if (missingFields.includes('amount')) {
    return 'Qual o valor dessa transação?';
  }
  if (missingFields.includes('description') || missingFields.includes('category')) {
    return 'Em que você gastou/recebeu?';
  }
  return 'Pode dar mais detalhes sobre essa transação?';
}

/**
 * Concatena a resposta de follow-up com a query original.
 * Usado quando o usuário responde ao follow-up.
 * LÓGICA PURA.
 * @param {string} originalQuery - Query original do usuário
 * @param {string} followupResponse - Resposta do usuário ao follow-up
 * @returns {string} Query concatenada
 */
function mergeFollowupResponse(originalQuery, followupResponse) {
  return `${originalQuery}. Complemento: ${followupResponse}`;
}

/**
 * Verifica se uma resposta do usuario contem dados para completar o follow-up.
 * LÓGICA PURA.
 * @param {Object} pendingFollowup - Estado pendente do follow-up
 * @param {string} followupResponse - Resposta do usuario ao follow-up
 * @returns {boolean}
 */
function shouldMergeFollowupResponse(pendingFollowup, followupResponse) {
  if (!pendingFollowup || !followupResponse) return false;

  const response = followupResponse.trim();
  if (response.length === 0) return false;

  const missingFields = (pendingFollowup.missingFields || []).map(field => String(field).toLowerCase());
  const hasAmount = /\d/.test(response);
  const hasDescription = /[A-Za-z]/.test(response);

  const needsAmount = missingFields.includes('amount') || missingFields.includes('valor');
  const needsDescription = missingFields.includes('description')
    || missingFields.includes('descricao')
    || missingFields.includes('categoria')
    || missingFields.includes('category');

  if (needsAmount && !hasAmount) return false;
  if (needsDescription && !hasDescription) return false;

  return true;
}

module.exports = {
  generateFollowup,
  generateFallbackQuestion,
  mergeFollowupResponse,
  shouldMergeFollowupResponse,
};
