/**
 * @module agents/coordinators/analysis
 * @description Agente Coordenador de Análise — O Observador de Comportamento.
 * 
 * Foco: Retrospectiva, padrões de consumo e saúde do fluxo de caixa.
 * Ferramentas: Finance Bridge, Serper, Tavily, Módulo Matemático.
 * Entregas: Relatórios analíticos, identificação de tendências, comparações.
 * 
 * Modelo: GPT-5.2 (Reasoning: High, Verbosity: Low)
 * 
 * PONTO DE IA: Análise de padrões e geração de insights financeiros.
 */

const BaseCoordinator = require('./base');
const { CONTRACTS } = require('../orchestrator/contracts');
const {
  buildCoordinatorSystemPrompt,
  ANALYSIS_TOOLS_DESCRIPTION,
} = require('./prompt-template');

/**
 * @class AnalysisCoordinator
 * Especialista em análise de padrões financeiros.
 * @extends BaseCoordinator
 */
class AnalysisCoordinator extends BaseCoordinator {
  /**
   * @param {Object} tools - Ferramentas disponíveis
   * @param {Object} [tools.financeBridge] - Finance Bridge
   * @param {Object} [tools.searchManager] - Search Manager (Serper, Tavily)
   * @param {Object} [tools.mathModule] - Módulo Matemático
   */
  constructor(tools = {}) {
    const contract = CONTRACTS.analysis;

    const systemPrompt = buildCoordinatorSystemPrompt(
      contract.name,
      contract.focus,
      contract.capabilities,
      ANALYSIS_TOOLS_DESCRIPTION
    );

    super(contract.name, 'analysis', tools, systemPrompt);
  }
}

module.exports = AnalysisCoordinator;
