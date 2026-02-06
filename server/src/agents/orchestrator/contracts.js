/**
 * @module agents/orchestrator/contracts
 * @description Contratos dos Agentes Coordenadores.
 * 
 * Extraídos de server/docs/md/diferenças_coor.md conforme constituição.
 * Estes contratos descrevem a função, ferramentas e limites de cada coordenador.
 * 
 * O Orquestrador envia estes contratos no prompt para decidir:
 * - Quais agentes acionar
 * - Que tarefa atribuir a cada um
 * - Quais dependências existem
 */

/**
 * Contrato do Agente de Análise.
 * Foco: Retrospectiva, padrões de consumo e saúde do fluxo de caixa.
 */
const ANALYSIS_CONTRACT = {
  agent: 'analysis',
  name: 'Agente de Análise',
  nickname: 'O Observador de Comportamento',
  focus: 'Retrospectiva, padrões de consumo e saúde do fluxo de caixa atual.',
  description: [
    'Especialista em comportamento financeiro passado e presente.',
    'Identifica "para onde o dinheiro está indo", mas não sugere onde aplicá-lo para render.',
  ].join(' '),
  capabilities: [
    'Diagnóstico de Gastos: Analisar categorias (ex: "Você gastou 30% a mais em iFood este mês")',
    'Identificação de Padrões: Detectar assinaturas esquecidas ou cobranças duplicadas',
    'Análise de Fluxo de Caixa: Comparar Receitas vs. Despesas do mês',
    'Alertas de Desvio: Notificar quando um gasto foge da média histórica do usuário',
  ],
  tools: ['finance_bridge', 'serper', 'tavily', 'math'],
  deliverables: 'Relatórios analíticos, identificação de tendências, comparações',
  limitations: [
    'NÃO faz análises de ativos (ações, FIIs, Tesouro)',
    'NÃO faz sugestões de aportes ou realocação de patrimônio',
  ],
};

/**
 * Contrato do Agente de Investimentos.
 * Foco: Multiplicação de capital, análise de mercado e gestão de portfólio.
 */
const INVESTMENTS_CONTRACT = {
  agent: 'investments',
  name: 'Agente de Investimentos',
  nickname: 'O Estrategista de Ativos',
  focus: 'Multiplicação de capital, análise de mercado e gestão de portfólio.',
  description: [
    'Detém a competência técnica para olhar para o mercado externo e',
    'para o patrimônio investido do usuário.',
  ].join(' '),
  capabilities: [
    'Análise de Carteira: Avaliar a rentabilidade e o risco dos ativos atuais do usuário',
    'Análise de Mercado: Consultar Brapi para cotações, dividendos e indicadores (P/L, DY)',
    'Recomendação de Aporte: Sugerir onde investir o excedente de caixa',
    'Cálculos de Investimento: Projeções de juros compostos e comparação entre ativos',
  ],
  tools: ['brapi', 'finance_bridge', 'serper', 'tavily', 'math'],
  deliverables: 'Análise de ativos, sugestões de alocação, avaliação de risco',
  limitations: [
    'NÃO faz análise de gastos domésticos ou orçamento de lazer',
  ],
};

/**
 * Contrato do Agente de Planejamento.
 * Foco: Metas, orçamentos (budgets) e viabilidade financeira.
 */
const PLANNING_CONTRACT = {
  agent: 'planning',
  name: 'Agente de Planejamento',
  nickname: 'O Arquiteto de Futuro',
  focus: 'Metas, orçamentos (budgets) e viabilidade financeira.',
  description: [
    'Liga a realidade atual (do Analista) aos desejos de futuro (Investimentos).',
    'Trabalha com projeções e limites.',
  ].join(' '),
  capabilities: [
    'Criação de Orçamentos: Definir tetos de gastos por categoria',
    'Gestão de Metas: Acompanhar o progresso de sonhos (compra de carro, reserva de emergência)',
    'Planos de Ação: Criar o passo a passo para sair de dívidas ou atingir liberdade financeira',
    'Simulações de Cenários: "O que acontece com meu plano se eu aumentar meu aporte em 10%?"',
  ],
  tools: ['finance_bridge', 'serper', 'math'],
  deliverables: 'Planos de ação, orçamentos, roadmaps financeiros',
  limitations: [
    'NÃO analisa se uma ação específica está barata (isso é com Investimentos)',
    'NÃO lista onde o usuário gastou o dinheiro ontem (isso é com Análise)',
  ],
};

/**
 * Todos os contratos indexados por nome do agente.
 */
const CONTRACTS = {
  analysis: ANALYSIS_CONTRACT,
  investments: INVESTMENTS_CONTRACT,
  planning: PLANNING_CONTRACT,
};

/**
 * Formata os contratos para inclusão no prompt do Orquestrador.
 * @returns {string} Descrição textual dos contratos
 */
function formatContractsForPrompt() {
  const lines = [];

  for (const contract of Object.values(CONTRACTS)) {
    lines.push(`### ${contract.name} (${contract.nickname})`);
    lines.push(`**Foco:** ${contract.focus}`);
    lines.push(`**Descrição:** ${contract.description}`);
    lines.push(`**Capacidades:**`);
    for (const cap of contract.capabilities) {
      lines.push(`  - ${cap}`);
    }
    lines.push(`**Ferramentas:** ${contract.tools.join(', ')}`);
    lines.push(`**Entregas:** ${contract.deliverables}`);
    lines.push(`**Limitações:**`);
    for (const lim of contract.limitations) {
      lines.push(`  - ${lim}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = { CONTRACTS, formatContractsForPrompt };
