/**
 * @module agents/response/format-selector
 * @description Seletor de formato de resposta.
 * 
 * LÓGICA PURA — pré-seleciona formato baseado em heurísticas.
 * A IA no Agente de Resposta faz a decisão final de formato/tom,
 * mas este módulo oferece uma sugestão baseada em regras determinísticas.
 * 
 * Formatos:
 * - conversational: Padrão para queries simples e casuais
 * - structured: Para análises pedidas explicitamente
 * - report: Para solicitações formais e detalhadas
 * - quick: Para perguntas diretas com resposta curta
 */

const logger = require('../../utils/logger');

/**
 * Palavras-chave que indicam formato de relatório.
 */
const REPORT_KEYWORDS = [
  'relatório', 'análise completa', 'análise detalhada',
  'detalhe', 'explique detalhadamente', 'em detalhes',
  'avaliação completa', 'panorama',
];

/**
 * Palavras-chave que indicam formato estruturado (listas, comparações).
 */
const STRUCTURED_KEYWORDS = [
  'compare', 'comparação', 'lista', 'enumere',
  'passo a passo', 'etapas', 'diferenças entre',
  'prós e contras', 'vantagens e desvantagens',
];

/**
 * Palavras-chave que indicam resposta rápida.
 */
const QUICK_KEYWORDS = [
  'quanto', 'qual', 'quando', 'quantos',
  'sim ou não', 'é verdade', 'confirme',
];

/**
 * Sugere o formato de resposta baseado na query e contexto.
 * 
 * @param {string} query - Query original do usuário
 * @param {string} routeType - Tipo de rota (bridge_query, escalate, etc.)
 * @param {number} agentCount - Número de agentes que processaram (0 para rotas diretas)
 * @returns {Object} Sugestão de formato
 * @returns {string} returns.suggestedFormat - Formato sugerido
 * @returns {string} returns.reason - Justificativa da sugestão
 */
function suggestFormat(query, routeType, agentCount = 0) {
  const queryLower = query.toLowerCase();

  // Rotas diretas sem escalada → conversational ou quick
  if (routeType !== 'escalate') {
    if (routeType === 'bridge_insert') {
      return { suggestedFormat: 'quick', reason: 'Confirmação de lançamento' };
    }
    if (routeType === 'math_direct') {
      return { suggestedFormat: 'quick', reason: 'Cálculo direto' };
    }

    const isQuick = QUICK_KEYWORDS.some(kw => queryLower.startsWith(kw));
    if (isQuick) {
      return { suggestedFormat: 'quick', reason: 'Pergunta direta' };
    }

    return { suggestedFormat: 'conversational', reason: 'Rota direta sem escalada' };
  }

  // Escalada — verificar palavras-chave
  const isReport = REPORT_KEYWORDS.some(kw => queryLower.includes(kw));
  if (isReport) {
    return { suggestedFormat: 'report', reason: 'Query pede análise detalhada/relatório' };
  }

  const isStructured = STRUCTURED_KEYWORDS.some(kw => queryLower.includes(kw));
  if (isStructured) {
    return { suggestedFormat: 'structured', reason: 'Query pede comparação/lista estruturada' };
  }

  // Múltiplos agentes → structured ou report dependendo da complexidade
  if (agentCount >= 3) {
    return { suggestedFormat: 'report', reason: '3+ agentes — resposta complexa' };
  }
  if (agentCount === 2) {
    return { suggestedFormat: 'structured', reason: '2 agentes — integração de outputs' };
  }

  return { suggestedFormat: 'conversational', reason: 'Padrão' };
}

module.exports = { suggestFormat };
