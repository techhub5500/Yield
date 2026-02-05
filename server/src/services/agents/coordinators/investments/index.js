/**
 * Investments Agent - Sistema de análise de investimentos
 * Fase 5 - Agentes Coordenadores
 * 
 * Módulo público do Agente de Investimentos.
 * Gerencia consultas de cotações, análise de carteira,
 * recomendações de aporte e cálculos financeiros.
 */

const InvestmentsAgent = require('./investments-agent');
const BrapiClient = require('./market/brapi-client');
const PortfolioAnalyzer = require('./analyzers/portfolio-analyzer');
const AporteRecommender = require('./analyzers/aporte-recommender');
const InvestmentCalculator = require('./calculators/investment-calculator');

// Instância singleton do agente
let investmentsAgentInstance = null;

/**
 * Inicializa o módulo de investimentos
 * @returns {Promise<InvestmentsAgent>} Instância inicializada
 */
async function initialize() {
    if (!investmentsAgentInstance) {
        investmentsAgentInstance = new InvestmentsAgent();
        await investmentsAgentInstance.initialize();
    }
    return investmentsAgentInstance;
}

/**
 * Obtém a instância do agente (deve ser inicializado primeiro)
 * @returns {InvestmentsAgent} Instância do agente
 * @throws {Error} Se não foi inicializado
 */
function getInstance() {
    if (!investmentsAgentInstance) {
        throw new Error('InvestmentsAgent não inicializado. Chame initialize() primeiro.');
    }
    return investmentsAgentInstance;
}

/**
 * Processa uma solicitação de investimentos
 * @param {Object} request - Solicitação do usuário
 * @param {Object} context - Contexto da execução
 * @returns {Promise<Object>} Resultado do processamento
 */
async function process(request, context) {
    const agent = await initialize();
    return agent.process(request, context);
}

/**
 * Consulta cotação de um ativo
 * @param {string} ticker - Código do ativo
 * @returns {Promise<Object>} Dados da cotação
 */
async function getQuote(ticker) {
    const agent = await initialize();
    return agent.getQuote(ticker);
}

/**
 * Consulta múltiplas cotações
 * @param {string[]} tickers - Lista de códigos
 * @returns {Promise<Object[]>} Lista de cotações
 */
async function getMultipleQuotes(tickers) {
    const agent = await initialize();
    return agent.getMultipleQuotes(tickers);
}

/**
 * Analisa um portfólio de investimentos
 * @param {Object[]} portfolio - Lista de ativos
 * @param {string} investorProfile - Perfil do investidor
 * @returns {Promise<Object>} Análise completa
 */
async function analyzePortfolio(portfolio, investorProfile = 'moderate') {
    const agent = await initialize();
    return agent.analyzePortfolio(portfolio, investorProfile);
}

/**
 * Recomenda alocação de aporte
 * @param {number} amount - Valor do aporte
 * @param {Object[]} portfolio - Portfólio atual
 * @param {Object} options - Opções de recomendação
 * @returns {Promise<Object>} Recomendação de alocação
 */
async function recommendAporte(amount, portfolio, options = {}) {
    const agent = await initialize();
    return agent.recommendAporte(amount, portfolio, options);
}

/**
 * Calcula projeção de investimento
 * @param {Object} params - Parâmetros do investimento
 * @returns {Promise<Object>} Projeção calculada
 */
async function calculateInvestment(params) {
    const agent = await initialize();
    return agent.calculateInvestment(params);
}

/**
 * Compara opções de investimento
 * @param {Object[]} options - Opções a comparar
 * @param {number} amount - Valor a investir
 * @param {number} months - Prazo em meses
 * @returns {Promise<Object>} Comparativo
 */
async function compareInvestments(options, amount, months) {
    const agent = await initialize();
    return agent.compareInvestments(options, amount, months);
}

/**
 * Calcula tempo para atingir meta
 * @param {number} targetAmount - Valor alvo
 * @param {number} initialAmount - Valor inicial
 * @param {number} monthlyContribution - Aporte mensal
 * @param {number} annualRate - Taxa anual
 * @returns {Promise<Object>} Projeção de tempo
 */
async function calculateTimeToGoal(targetAmount, initialAmount, monthlyContribution, annualRate) {
    const agent = await initialize();
    return agent.calculateTimeToGoal(targetAmount, initialAmount, monthlyContribution, annualRate);
}

/**
 * Calcula contribuição necessária para meta
 * @param {number} targetAmount - Valor alvo
 * @param {number} initialAmount - Valor inicial
 * @param {number} months - Prazo em meses
 * @param {number} annualRate - Taxa anual
 * @returns {Promise<Object>} Contribuição necessária
 */
async function calculateRequiredContribution(targetAmount, initialAmount, months, annualRate) {
    const agent = await initialize();
    return agent.calculateRequiredContribution(targetAmount, initialAmount, months, annualRate);
}

/**
 * Obtém visão geral do mercado
 * @returns {Promise<Object>} Overview do mercado
 */
async function getMarketOverview() {
    const agent = await initialize();
    return agent.getMarketOverview();
}

/**
 * Shutdown do módulo
 */
async function shutdown() {
    if (investmentsAgentInstance) {
        await investmentsAgentInstance.shutdown();
        investmentsAgentInstance = null;
    }
}

module.exports = {
    // Lifecycle
    initialize,
    getInstance,
    shutdown,
    
    // Main processing
    process,
    
    // Quotations
    getQuote,
    getMultipleQuotes,
    getMarketOverview,
    
    // Portfolio Analysis
    analyzePortfolio,
    
    // Recommendations
    recommendAporte,
    
    // Calculations
    calculateInvestment,
    compareInvestments,
    calculateTimeToGoal,
    calculateRequiredContribution,
    
    // Classes (for advanced usage)
    InvestmentsAgent,
    BrapiClient,
    PortfolioAnalyzer,
    AporteRecommender,
    InvestmentCalculator
};
