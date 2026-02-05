/**
 * Coordinators - Agentes Coordenadores Especializados
 * Fase 5 - Sistema Multi-Agente Financeiro
 * 
 * Este módulo exporta os três agentes coordenadores especializados:
 * - Analysis Agent: Análise de gastos, padrões e fluxo de caixa
 * - Planning Agent: Orçamentos, metas e planejamento financeiro
 * - Investments Agent: Cotações, carteira e projeções
 * 
 * Cada coordenador implementa o protocolo de 6 passos:
 * Recepção → Metacognição → Planejamento → Execução → Validação → Entrega
 */

const AnalysisAgent = require('./analysis');
const PlanningAgent = require('./planning');
const InvestmentsAgent = require('./investments');
const BaseCoordinator = require('./base-coordinator');
const MathModule = require('./math/math-module');

/**
 * Mapeamento de tipos de coordenador
 */
const COORDINATOR_TYPES = {
    ANALYSIS: 'analysis',
    PLANNING: 'planning',
    INVESTMENTS: 'investments'
};

/**
 * Cache de instâncias inicializadas
 */
const instances = {};

/**
 * Inicializa todos os coordenadores
 * @returns {Promise<Object>} Objeto com todos os agentes inicializados
 */
async function initializeAll() {
    const [analysis, planning, investments] = await Promise.all([
        AnalysisAgent.initialize(),
        PlanningAgent.initialize(),
        InvestmentsAgent.initialize()
    ]);
    
    instances.analysis = analysis;
    instances.planning = planning;
    instances.investments = investments;
    
    return { analysis, planning, investments };
}

/**
 * Inicializa um coordenador específico
 * @param {string} type - Tipo do coordenador
 * @returns {Promise<Object>} Instância inicializada
 */
async function initialize(type) {
    switch (type) {
        case COORDINATOR_TYPES.ANALYSIS:
            instances.analysis = await AnalysisAgent.initialize();
            return instances.analysis;
            
        case COORDINATOR_TYPES.PLANNING:
            instances.planning = await PlanningAgent.initialize();
            return instances.planning;
            
        case COORDINATOR_TYPES.INVESTMENTS:
            instances.investments = await InvestmentsAgent.initialize();
            return instances.investments;
            
        default:
            throw new Error(`Tipo de coordenador desconhecido: ${type}`);
    }
}

/**
 * Obtém instância de um coordenador
 * @param {string} type - Tipo do coordenador
 * @returns {Object} Instância do coordenador
 */
function getInstance(type) {
    switch (type) {
        case COORDINATOR_TYPES.ANALYSIS:
            return AnalysisAgent.getInstance();
            
        case COORDINATOR_TYPES.PLANNING:
            return PlanningAgent.getInstance();
            
        case COORDINATOR_TYPES.INVESTMENTS:
            return InvestmentsAgent.getInstance();
            
        default:
            throw new Error(`Tipo de coordenador desconhecido: ${type}`);
    }
}

/**
 * Roteia uma solicitação para o coordenador apropriado
 * @param {Object} request - Solicitação do usuário
 * @param {Object} context - Contexto da execução
 * @returns {Promise<Object>} Resultado do processamento
 */
async function routeRequest(request, context) {
    const { coordinatorType } = request;
    
    if (!coordinatorType) {
        throw new Error('Tipo de coordenador não especificado na solicitação');
    }
    
    // Garante que o coordenador está inicializado
    if (!instances[coordinatorType]) {
        await initialize(coordinatorType);
    }
    
    // Roteia para o coordenador apropriado
    switch (coordinatorType) {
        case COORDINATOR_TYPES.ANALYSIS:
            return AnalysisAgent.process(request, context);
            
        case COORDINATOR_TYPES.PLANNING:
            return PlanningAgent.process(request, context);
            
        case COORDINATOR_TYPES.INVESTMENTS:
            return InvestmentsAgent.process(request, context);
            
        default:
            throw new Error(`Tipo de coordenador desconhecido: ${coordinatorType}`);
    }
}

/**
 * Determina o tipo de coordenador baseado na solicitação
 * @param {string} userQuery - Query do usuário
 * @returns {string} Tipo do coordenador sugerido
 */
function detectCoordinatorType(userQuery) {
    const query = userQuery.toLowerCase();
    
    // Keywords de investimentos
    const investmentKeywords = [
        'cotação', 'ação', 'ações', 'fii', 'fiis', 'fundo',
        'carteira', 'investimento', 'investir', 'aporte',
        'tesouro', 'cdb', 'renda fixa', 'dividendo', 'crypto',
        'bitcoin', 'ibovespa', 'dólar', 'câmbio'
    ];
    
    // Keywords de planejamento
    const planningKeywords = [
        'orçamento', 'budget', 'meta', 'objetivo', 'plano',
        'planejamento', 'economia', 'economizar', 'poupar',
        'cenário', 'simular', 'previsão', 'reserva'
    ];
    
    // Keywords de análise
    const analysisKeywords = [
        'analisar', 'análise', 'gasto', 'despesa', 'receita',
        'padrão', 'tendência', 'fluxo', 'caixa', 'categoria',
        'comparar mês', 'quanto gastei', 'onde foi'
    ];
    
    // Pontuação por tipo
    let scores = {
        [COORDINATOR_TYPES.INVESTMENTS]: 0,
        [COORDINATOR_TYPES.PLANNING]: 0,
        [COORDINATOR_TYPES.ANALYSIS]: 0
    };
    
    investmentKeywords.forEach(kw => {
        if (query.includes(kw)) scores[COORDINATOR_TYPES.INVESTMENTS]++;
    });
    
    planningKeywords.forEach(kw => {
        if (query.includes(kw)) scores[COORDINATOR_TYPES.PLANNING]++;
    });
    
    analysisKeywords.forEach(kw => {
        if (query.includes(kw)) scores[COORDINATOR_TYPES.ANALYSIS]++;
    });
    
    // Retorna o tipo com maior pontuação
    const maxScore = Math.max(...Object.values(scores));
    
    if (maxScore === 0) {
        // Default para análise se nenhum padrão detectado
        return COORDINATOR_TYPES.ANALYSIS;
    }
    
    return Object.keys(scores).find(key => scores[key] === maxScore);
}

/**
 * Shutdown de todos os coordenadores
 */
async function shutdownAll() {
    await Promise.all([
        AnalysisAgent.shutdown?.(),
        PlanningAgent.shutdown?.(),
        InvestmentsAgent.shutdown?.()
    ]);
    
    Object.keys(instances).forEach(key => delete instances[key]);
}

module.exports = {
    // Lifecycle
    initializeAll,
    initialize,
    getInstance,
    shutdownAll,
    
    // Routing
    routeRequest,
    detectCoordinatorType,
    
    // Types
    COORDINATOR_TYPES,
    
    // Individual agents
    AnalysisAgent,
    PlanningAgent,
    InvestmentsAgent,
    
    // Base classes
    BaseCoordinator,
    MathModule
};
