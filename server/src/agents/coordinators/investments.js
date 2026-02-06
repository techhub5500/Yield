/**
 * @module agents/coordinators/investments
 * @description Agente Coordenador de Investimentos — O Estrategista de Ativos.
 * 
 * Foco: Multiplicação de capital, análise de mercado e gestão de portfólio.
 * Ferramentas: Brapi, Finance Bridge, Serper, Tavily, Módulo Matemático.
 * Entregas: Análise de ativos, sugestões de alocação, avaliação de risco.
 * 
 * Modelo: GPT-5.2 (Reasoning: High, Verbosity: Low)
 * 
 * PONTO DE IA: Análise de mercado e recomendações de investimento.
 */

const BaseCoordinator = require('./base');
const { CONTRACTS } = require('../orchestrator/contracts');
const {
  buildCoordinatorSystemPrompt,
  INVESTMENTS_TOOLS_DESCRIPTION,
} = require('./prompt-template');

/**
 * @class InvestmentsCoordinator
 * Especialista em análise de investimentos e mercado.
 * @extends BaseCoordinator
 */
class InvestmentsCoordinator extends BaseCoordinator {
  /**
   * @param {Object} tools - Ferramentas disponíveis
   * @param {Object} [tools.financeBridge] - Finance Bridge
   * @param {Object} [tools.searchManager] - Search Manager (Brapi, Serper, Tavily)
   * @param {Object} [tools.mathModule] - Módulo Matemático
   */
  constructor(tools = {}) {
    const contract = CONTRACTS.investments;

    const systemPrompt = buildCoordinatorSystemPrompt(
      contract.name,
      contract.focus,
      contract.capabilities,
      INVESTMENTS_TOOLS_DESCRIPTION
    );

    super(contract.name, 'investments', tools, systemPrompt);
  }
}

module.exports = InvestmentsCoordinator;
