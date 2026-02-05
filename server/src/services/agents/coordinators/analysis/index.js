/**
 * Agente de Análise - API Pública
 * Fase 5 - Agentes Coordenadores
 * 
 * Exporta o Agente de Análise e seus componentes.
 */

const { AnalysisAgent, ANALYSIS_CONTRACT, ANALYSIS_TYPES } = require('./analysis-agent');
const { SpendingAnalyzer } = require('./analyzers/spending-analyzer');
const { PatternDetector } = require('./analyzers/pattern-detector');
const { CashflowAnalyzer } = require('./analyzers/cashflow-analyzer');
const { DeviationAlerter } = require('./analyzers/deviation-alerter');

// Instância singleton (será inicializada com financeBridge)
let analysisAgentInstance = null;

/**
 * Inicializa o agente com o Finance Bridge
 * 
 * @param {Object} financeBridge - Instância do Finance Bridge
 * @returns {AnalysisAgent} Instância do agente
 */
function initialize(financeBridge) {
  analysisAgentInstance = new AnalysisAgent(financeBridge);
  return analysisAgentInstance;
}

/**
 * Obtém a instância do agente
 * 
 * @returns {AnalysisAgent} Instância do agente
 */
function getInstance() {
  if (!analysisAgentInstance) {
    throw new Error('AnalysisAgent não foi inicializado. Chame initialize() primeiro.');
  }
  return analysisAgentInstance;
}

/**
 * Processa uma tarefa de análise
 * 
 * @param {Object} memory - Memória do chat
 * @param {string} query - Query do usuário
 * @param {Object} doc - DOC do Orquestrador
 * @param {Object} taskInfo - Informações da tarefa
 * @returns {Promise<Object>} Resultado da análise
 */
async function process(memory, query, doc, taskInfo) {
  const agent = getInstance();
  return agent.process(memory, query, doc, taskInfo);
}

/**
 * Analisa gastos do período
 * 
 * @param {Object} options - Opções de análise
 * @returns {Promise<Object>} Resultado
 */
async function analyzeSpending(options) {
  const agent = getInstance();
  return agent.analyzeSpending(options);
}

/**
 * Analisa fluxo de caixa
 * 
 * @param {Object} options - Opções de análise
 * @returns {Promise<Object>} Resultado
 */
async function analyzeCashflow(options) {
  const agent = getInstance();
  return agent.analyzeCashflow(options);
}

/**
 * Detecta padrões de consumo
 * 
 * @param {Object} options - Opções de análise
 * @returns {Promise<Object>} Resultado
 */
async function detectPatterns(options) {
  const agent = getInstance();
  return agent.detectPatterns(options);
}

/**
 * Verifica desvios da média
 * 
 * @param {Object} options - Opções de análise
 * @returns {Promise<Object>} Resultado
 */
async function checkDeviations(options) {
  const agent = getInstance();
  return agent.checkDeviations(options);
}

/**
 * Retorna contrato do agente
 */
function getContract() {
  return ANALYSIS_CONTRACT;
}

/**
 * Health check
 */
async function healthCheck() {
  if (!analysisAgentInstance) {
    return {
      status: 'not_initialized',
      message: 'Agente não foi inicializado'
    };
  }
  return analysisAgentInstance.healthCheck();
}

module.exports = {
  // Inicialização
  initialize,
  getInstance,
  
  // Classe para uso avançado
  AnalysisAgent,
  
  // Analisadores individuais
  SpendingAnalyzer,
  PatternDetector,
  CashflowAnalyzer,
  DeviationAlerter,
  
  // Funções principais
  process,
  analyzeSpending,
  analyzeCashflow,
  detectPatterns,
  checkDeviations,
  
  // Informações
  getContract,
  healthCheck,
  
  // Constantes
  ANALYSIS_CONTRACT,
  ANALYSIS_TYPES
};
