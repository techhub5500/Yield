/**
 * @module core/state/context-recovery
 * @description Recuperação de contexto após chamadas externas.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 * 
 * Responsabilidades:
 * - Reconstruir contexto completo do agente após retorno de sistema externo
 * - Mesclar resultado externo com contexto existente
 * - Preparar dados para continuação do fluxo
 */

const logger = require('../../utils/logger');

/**
 * Reconstrói o contexto completo do agente após retorno de chamada externa.
 * 
 * @param {Object} agentState - Estado atual do agente (AgentState)
 * @param {Object} memory - Memória do chat
 * @returns {Object} Contexto reconstruído pronto para continuar execução
 */
function recoverContext(agentState, memory) {
  const recovered = {
    agentId: agentState.agentId,
    chatId: agentState.chatId,
    currentTask: agentState.currentTask,
    memory,
    externalResults: agentState.results,
    lastExternalResult: agentState.context.lastExternalResult || null,
    previousContext: agentState.context,
    recoveredAt: Date.now(),
  };

  logger.logic('DEBUG', 'ContextRecovery', `Contexto recuperado para agente "${agentState.agentId}"`, {
    chatId: agentState.chatId,
    externalResultsCount: agentState.results.length,
    hasTask: !!agentState.currentTask,
  });

  return recovered;
}

/**
 * Mescla resultado de uma chamada externa no contexto existente do agente.
 * Útil quando o agente faz múltiplas chamadas sequenciais.
 * 
 * @param {Object} existingContext - Contexto atual do agente
 * @param {string} systemName - Nome do sistema que retornou
 * @param {Object} result - Resultado do sistema externo
 * @returns {Object} Contexto atualizado
 */
function mergeExternalResult(existingContext, systemName, result) {
  const updated = { ...existingContext };

  // Inicializar mapa de resultados externos se não existir
  if (!updated.externalResults) {
    updated.externalResults = {};
  }

  updated.externalResults[systemName] = result;
  updated.lastExternalResult = result;
  updated.lastExternalSystem = systemName;
  updated.updatedAt = Date.now();

  return updated;
}

/**
 * Verifica se o contexto do agente está consistente para continuar execução.
 * 
 * @param {Object} agentState - Estado do agente
 * @returns {Object} Resultado da verificação
 * @returns {boolean} returns.valid - Se o contexto é válido
 * @returns {string[]} returns.issues - Lista de problemas encontrados
 */
function validateContextIntegrity(agentState) {
  const issues = [];

  if (!agentState.agentId) issues.push('agentId ausente');
  if (!agentState.chatId) issues.push('chatId ausente');
  if (agentState.status === 'error') issues.push(`Agente em estado de erro: ${agentState.context.lastError}`);
  if (agentState.pendingExternalCalls.length > 0) {
    issues.push(`${agentState.pendingExternalCalls.length} chamada(s) externa(s) pendente(s)`);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

module.exports = { recoverContext, mergeExternalResult, validateContextIntegrity };
