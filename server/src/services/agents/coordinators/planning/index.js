/**
 * Agente de Planejamento - API Pública
 * Fase 5 - Agentes Coordenadores
 * 
 * Exporta o Agente de Planejamento e seus componentes.
 */

const { PlanningAgent, PLANNING_CONTRACT, PLANNING_TYPES } = require('./planning-agent');
const { BudgetCreator, BUDGET_STRATEGIES, EXPENSE_CLASSIFICATION } = require('./planners/budget-creator');
const { BudgetTracker, EXECUTION_STATUS } = require('./planners/budget-tracker');
const { GoalManager, GOAL_TYPES, GOAL_PRIORITY, GOAL_STATUS } = require('./planners/goal-manager');
const { ScenarioSimulator, SCENARIO_TYPES } = require('./planners/scenario-simulator');
const { ActionPlanner, ACTION_TYPES, ACTION_URGENCY } = require('./planners/action-planner');

// Instância singleton
let planningAgentInstance = null;

/**
 * Inicializa o agente com o Finance Bridge
 * 
 * @param {Object} financeBridge - Instância do Finance Bridge
 * @returns {PlanningAgent} Instância do agente
 */
function initialize(financeBridge) {
  planningAgentInstance = new PlanningAgent(financeBridge);
  return planningAgentInstance;
}

/**
 * Obtém a instância do agente
 * 
 * @returns {PlanningAgent} Instância do agente
 */
function getInstance() {
  if (!planningAgentInstance) {
    throw new Error('PlanningAgent não foi inicializado. Chame initialize() primeiro.');
  }
  return planningAgentInstance;
}

/**
 * Processa uma tarefa de planejamento
 * 
 * @param {Object} memory - Memória do chat
 * @param {string} query - Query do usuário
 * @param {Object} doc - DOC do Orquestrador
 * @param {Object} taskInfo - Informações da tarefa
 * @returns {Promise<Object>} Resultado do planejamento
 */
async function process(memory, query, doc, taskInfo) {
  const agent = getInstance();
  return agent.process(memory, query, doc, taskInfo);
}

/**
 * Cria orçamento
 * 
 * @param {Object} options - Opções de criação
 * @returns {Promise<Object>} Orçamento criado
 */
async function createBudget(options) {
  const agent = getInstance();
  return agent.createBudget(options);
}

/**
 * Acompanha orçamento
 * 
 * @param {Object} options - Opções
 * @returns {Promise<Object>} Status do orçamento
 */
async function trackBudget(options) {
  const agent = getInstance();
  return agent.trackBudget(options);
}

/**
 * Cria meta financeira
 * 
 * @param {Object} goalData - Dados da meta
 * @returns {Object} Meta criada
 */
async function createGoal(goalData) {
  const agent = getInstance();
  return agent.createGoal(goalData);
}

/**
 * Avalia progresso de meta
 * 
 * @param {Object} options - Opções
 * @returns {Promise<Object>} Avaliação
 */
async function evaluateGoal(options) {
  const agent = getInstance();
  return agent.evaluateGoal(options);
}

/**
 * Sugere metas
 * 
 * @param {Object} options - Opções
 * @returns {Promise<Object>} Sugestões
 */
async function suggestGoals(options) {
  const agent = getInstance();
  return agent.suggestGoals(options);
}

/**
 * Simula cenário
 * 
 * @param {Object} scenario - Configuração do cenário
 * @returns {Promise<Object>} Resultado da simulação
 */
async function simulateScenario(scenario) {
  const agent = getInstance();
  return agent.simulateScenario(scenario);
}

/**
 * Gera plano de ação
 * 
 * @param {Object} context - Contexto
 * @returns {Promise<Object>} Plano de ação
 */
async function generateActionPlan(context) {
  const agent = getInstance();
  return agent.generateActionPlan(context);
}

/**
 * Cria plano financeiro completo
 * 
 * @param {Object} params - Parâmetros
 * @returns {Promise<Object>} Plano completo
 */
async function createFinancialPlan(params) {
  const agent = getInstance();
  return agent.createFinancialPlan(params);
}

/**
 * Retorna contrato do agente
 */
function getContract() {
  return PLANNING_CONTRACT;
}

/**
 * Health check
 */
async function healthCheck() {
  if (!planningAgentInstance) {
    return {
      status: 'not_initialized',
      message: 'Agente não foi inicializado'
    };
  }
  return planningAgentInstance.healthCheck();
}

module.exports = {
  // Inicialização
  initialize,
  getInstance,
  
  // Classe para uso avançado
  PlanningAgent,
  
  // Planejadores individuais
  BudgetCreator,
  BudgetTracker,
  GoalManager,
  ScenarioSimulator,
  ActionPlanner,
  
  // Funções principais
  process,
  createBudget,
  trackBudget,
  createGoal,
  evaluateGoal,
  suggestGoals,
  simulateScenario,
  generateActionPlan,
  createFinancialPlan,
  
  // Informações
  getContract,
  healthCheck,
  
  // Constantes - Planejamento
  PLANNING_CONTRACT,
  PLANNING_TYPES,
  
  // Constantes - Orçamento
  BUDGET_STRATEGIES,
  EXPENSE_CLASSIFICATION,
  EXECUTION_STATUS,
  
  // Constantes - Metas
  GOAL_TYPES,
  GOAL_PRIORITY,
  GOAL_STATUS,
  
  // Constantes - Cenários
  SCENARIO_TYPES,
  
  // Constantes - Ações
  ACTION_TYPES,
  ACTION_URGENCY
};
