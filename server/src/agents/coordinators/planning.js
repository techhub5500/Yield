/**
 * @module agents/coordinators/planning
 * @description Agente Coordenador de Planejamento — O Arquiteto de Futuro.
 * 
 * Foco: Metas, orçamentos (budgets) e viabilidade financeira.
 * Ferramentas: Finance Bridge, Serper, Módulo Matemático.
 * Entregas: Planos de ação, orçamentos, roadmaps financeiros.
 * 
 * Modelo: GPT-5.2 (Reasoning: High, Verbosity: Low)
 * 
 * PONTO DE IA: Planejamento, projeções e definição de metas.
 */

const BaseCoordinator = require('./base');
const { CONTRACTS } = require('../orchestrator/contracts');
const {
  buildCoordinatorSystemPrompt,
  PLANNING_TOOLS_DESCRIPTION,
} = require('./prompt-template');

/**
 * @class PlanningCoordinator
 * Especialista em planejamento financeiro e orçamento.
 * @extends BaseCoordinator
 */
class PlanningCoordinator extends BaseCoordinator {
  /**
   * @param {Object} tools - Ferramentas disponíveis
   * @param {Object} [tools.financeBridge] - Finance Bridge
   * @param {Object} [tools.searchManager] - Search Manager (Serper)
   * @param {Object} [tools.mathModule] - Módulo Matemático
   */
  constructor(tools = {}) {
    const contract = CONTRACTS.planning;

    const systemPrompt = buildCoordinatorSystemPrompt(
      contract.name,
      contract.focus,
      contract.capabilities,
      PLANNING_TOOLS_DESCRIPTION
    );

    super(contract.name, 'planning', tools, systemPrompt);
  }
}

module.exports = PlanningCoordinator;
