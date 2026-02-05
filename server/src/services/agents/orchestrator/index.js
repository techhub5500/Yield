/**
 * Agente Orquestrador - API Pública
 * Fase 4 - Camada de Orquestração
 * 
 * Exporta a interface pública do Agente Orquestrador para uso por outros módulos.
 * O Orquestrador é o "cérebro estratégico" que coordena tarefas complexas
 * entre os agentes coordenadores.
 */

const { OrchestratorAgent } = require('./orchestrator-agent');
const { TaskDecomposer } = require('./task-decomposer');
const { DependencyResolver } = require('./dependency-resolver');
const { MemoryFilter } = require('./memory-filter');
const { PriorityManager } = require('./priority-manager');
const { DocBuilder } = require('./doc-builder');
const { ExecutionController } = require('./execution-controller');

// Instância singleton do orquestrador
const orchestrator = new OrchestratorAgent();

/**
 * Processa uma tarefa complexa delegada pelo Agente Júnior
 * 
 * @param {Object} memory - Memória completa do chat
 * @param {string} query - Query original do usuário
 * @param {Object} context - Contexto adicional (user_id, etc)
 * @returns {Promise<Object>} DOC gerado e resultado do processamento
 * 
 * @example
 * const result = await processComplexTask(
 *   memory,
 *   'Analise meus gastos e sugira um orçamento',
 *   { user_id: 'user_123' }
 * );
 */
async function processComplexTask(memory, query, context = {}) {
  return orchestrator.process(memory, query, context);
}

/**
 * Gera apenas o DOC sem executar
 * Útil para debug e visualização do plano de execução
 * 
 * @param {Object} memory - Memória completa do chat
 * @param {string} query - Query original do usuário
 * @returns {Promise<Object>} DOC gerado
 */
async function generateDoc(memory, query) {
  return orchestrator.generateDocOnly(memory, query);
}

/**
 * Executa um DOC já gerado
 * 
 * @param {Object} doc - DOC previamente gerado
 * @param {Object} coordinatorAgents - Mapa de agentes coordenadores
 * @returns {Promise<Object>} Resultados da execução
 */
async function executeDoc(doc, coordinatorAgents) {
  const controller = new ExecutionController();
  return controller.execute(doc, coordinatorAgents);
}

/**
 * Obtém informações sobre o Agente Orquestrador
 * 
 * @returns {Object} Informações do agente
 */
function getAgentInfo() {
  return orchestrator.getInfo();
}

/**
 * Verifica a saúde do Agente Orquestrador
 * 
 * @returns {Promise<Object>} Status de saúde
 */
async function healthCheck() {
  return orchestrator.healthCheck();
}

/**
 * Obtém os contratos dos agentes coordenadores
 * 
 * @returns {Object} Contratos dos agentes
 */
function getAgentContracts() {
  return orchestrator.getAgentContracts();
}

module.exports = {
  // Funções principais
  processComplexTask,
  generateDoc,
  executeDoc,
  getAgentInfo,
  healthCheck,
  getAgentContracts,
  
  // Classes (para uso avançado)
  OrchestratorAgent,
  TaskDecomposer,
  DependencyResolver,
  MemoryFilter,
  PriorityManager,
  DocBuilder,
  ExecutionController
};
