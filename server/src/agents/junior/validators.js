/**
 * @module agents/junior/validators
 * @description Validadores de completude para decisões do Junior.
 * LÓGICA PURA — verifica estrutura e campos obrigatórios.
 * 
 * Valida a saída JSON da IA e a completude de dados para cada rota.
 * 
 * ATUALIZAÇÃO 07/02/2026: Adicionada rota 'simple_response'.
 */

const VALID_DECISIONS = ['bridge_query', 'bridge_insert', 'serper', 'simple_response', 'escalate'];

/**
 * Valida a estrutura do JSON de decisão retornado pela IA.
 * @param {Object} decision - JSON retornado pelo Junior
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateDecisionStructure(decision) {
  const errors = [];

  if (!decision || typeof decision !== 'object') {
    return { valid: false, errors: ['Decisão não é um objeto válido'] };
  }

  if (!decision.decision || !VALID_DECISIONS.includes(decision.decision)) {
    errors.push(`Decisão inválida: "${decision.decision}". Esperado: ${VALID_DECISIONS.join(', ')}`);
  }

  if (!decision.reasoning || typeof decision.reasoning !== 'string') {
    errors.push('Campo "reasoning" ausente ou inválido');
  }

  if (typeof decision.needs_followup !== 'boolean') {
    errors.push('Campo "needs_followup" deve ser boolean');
  }

  if (decision.needs_followup && !decision.followup_question) {
    errors.push('Campo "followup_question" obrigatório quando needs_followup = true');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida completude de dados para bridge_insert.
 * Verifica presença de valor monetário e descrição/categoria.
 * @param {string} query - Query do usuário
 * @returns {{ complete: boolean, missing: string[] }}
 */
function validateInsertCompleteness(query) {
  const missing = [];

  if (!query || typeof query !== 'string') {
    return { complete: false, missing: ['query'] };
  }

  // Verificar presença de valor monetário
  const hasAmount = /r\$\s*[\d.,]+|[\d.,]+\s*reais|[\d]+[.,][\d]{2}/i.test(query)
    || /\d+/.test(query);

  if (!hasAmount) {
    missing.push('amount');
  }

  // Verificar presença de descrição/categoria (pelo menos 2 palavras além do valor)
  const wordsWithoutNumbers = query.replace(/r\$\s*[\d.,]+|[\d.,]+/gi, '').trim();
  const meaningfulWords = wordsWithoutNumbers.split(/\s+/).filter(w => w.length > 2);

  if (meaningfulWords.length < 1) {
    missing.push('description');
  }

  return { complete: missing.length === 0, missing };
}

/**
 * Valida completude de dados para bridge_query.
 * Verifica se a consulta tem clareza mínima.
 * @param {string} query - Query do usuário
 * @returns {{ complete: boolean, missing: string[] }}
 */
function validateQueryCompleteness(query) {
  const missing = [];

  if (!query || typeof query !== 'string' || query.trim().length < 3) {
    missing.push('query_clarity');
  }

  return { complete: missing.length === 0, missing };
}

module.exports = {
  validateDecisionStructure,
  validateInsertCompleteness,
  validateQueryCompleteness,
  VALID_DECISIONS,
};
