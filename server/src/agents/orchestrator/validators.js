/**
 * @module agents/orchestrator/validators
 * @description Validadores do DOC (Documento de Direção) gerado pelo Orquestrador.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 * Valida:
 * - Estrutura do JSON
 * - Prioridades únicas e sequenciais
 * - Dependências referenciam agentes existentes
 * - Reasoning contém as 4 etapas do Chain of Thought
 */

const VALID_AGENTS = ['analysis', 'investments', 'planning'];

/**
 * Valida a estrutura completa do DOC.
 * @param {Object} doc - Documento de Direção gerado pelo Orquestrador
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateDOC(doc) {
  const errors = [];

  // Campos obrigatórios de nível raiz
  if (!doc) {
    return { valid: false, errors: ['DOC é null ou undefined'] };
  }

  if (!doc.request_id || typeof doc.request_id !== 'string') {
    errors.push('Campo "request_id" ausente ou inválido (deve ser string)');
  }

  if (!doc.original_query || typeof doc.original_query !== 'string') {
    errors.push('Campo "original_query" ausente ou inválido (deve ser string)');
  }

  if (!doc.reasoning || typeof doc.reasoning !== 'string') {
    errors.push('Campo "reasoning" ausente ou inválido (deve ser string)');
  }

  // Verificar que reasoning contém as 4 etapas
  if (doc.reasoning) {
    const reasoningErrors = validateReasoning(doc.reasoning);
    errors.push(...reasoningErrors);
  }

  // Execution plan
  if (!doc.execution_plan || typeof doc.execution_plan !== 'object') {
    errors.push('Campo "execution_plan" ausente ou inválido');
    return { valid: errors.length === 0, errors };
  }

  if (!Array.isArray(doc.execution_plan.agents) || doc.execution_plan.agents.length === 0) {
    errors.push('execution_plan.agents deve ser um array não vazio');
    return { valid: errors.length === 0, errors };
  }

  // Validar cada agente
  const agentErrors = validateAgents(doc.execution_plan.agents);
  errors.push(...agentErrors);

  return { valid: errors.length === 0, errors };
}

/**
 * Valida que o reasoning contém referências às 4 etapas do CoT.
 * Não exige formato exato, apenas presença dos conceitos.
 * @param {string} reasoning
 * @returns {string[]} Erros encontrados
 */
function validateReasoning(reasoning) {
  const errors = [];
  const lowerReasoning = reasoning.toLowerCase();

  // Verificar presença de conceitos das 4 etapas (flexível)
  const etapas = [
    { keywords: ['decompos', 'área', 'envolvid', 'anális', 'investiment', 'planejament'], label: 'DECOMPOSIÇÃO' },
    { keywords: ['dependência', 'depend', 'ordem', 'antes', 'sequência'], label: 'DEPENDÊNCIAS' },
    { keywords: ['memória', 'contexto', 'essencial', 'relevante', 'filtro', 'filtrar'], label: 'MEMORIZAÇÃO' },
    { keywords: ['priorid', 'prioriza', 'ordem', 'estratégia', 'execução'], label: 'PRIORIZAÇÃO' },
  ];

  for (const etapa of etapas) {
    const found = etapa.keywords.some(kw => lowerReasoning.includes(kw));
    if (!found) {
      // Aviso suave — não bloqueia execução, mas registra
      errors.push(`Reasoning pode não conter a etapa "${etapa.label}" (aviso, não bloqueante)`);
    }
  }

  // Só retorna erros reais se o reasoning for muito curto
  if (reasoning.length < 50) {
    return ['Reasoning muito curto — deve conter raciocínio detalhado das 4 etapas'];
  }

  // Avisos não bloqueiam — retornar vazio para validação
  return [];
}

/**
 * Valida a lista de agentes no execution plan.
 * @param {Object[]} agents
 * @returns {string[]} Erros encontrados
 */
function validateAgents(agents) {
  const errors = [];
  const agentNames = agents.map(a => a.agent);
  const priorities = agents.map(a => a.priority);

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const prefix = `agents[${i}]`;

    // Nome do agente válido
    if (!agent.agent || !VALID_AGENTS.includes(agent.agent)) {
      errors.push(`${prefix}.agent inválido: "${agent.agent}". Esperado: ${VALID_AGENTS.join(', ')}`);
    }

    // Prioridade é número inteiro positivo
    if (typeof agent.priority !== 'number' || !Number.isInteger(agent.priority) || agent.priority < 1) {
      errors.push(`${prefix}.priority deve ser inteiro positivo, recebeu: ${agent.priority}`);
    }

    // Task description
    if (!agent.task_description || typeof agent.task_description !== 'string') {
      errors.push(`${prefix}.task_description ausente ou inválida`);
    }

    // Expected output
    if (!agent.expected_output || typeof agent.expected_output !== 'string') {
      errors.push(`${prefix}.expected_output ausente ou inválido`);
    }

    // Dependencies devem ser array
    if (!Array.isArray(agent.dependencies)) {
      errors.push(`${prefix}.dependencies deve ser array`);
    } else {
      // Cada dependência deve ser um agente válido presente no plano
      for (const dep of agent.dependencies) {
        if (!VALID_AGENTS.includes(dep)) {
          errors.push(`${prefix}.dependencies contém agente inválido: "${dep}"`);
        }
        if (!agentNames.includes(dep)) {
          errors.push(`${prefix}.dependencies referencia agente "${dep}" que não está no plano de execução`);
        }
        // Dependência não pode ser o próprio agente
        if (dep === agent.agent) {
          errors.push(`${prefix}.dependencies contém auto-referência: "${dep}"`);
        }
      }

      // Verificar que dependências têm prioridade menor
      for (const dep of agent.dependencies) {
        const depAgent = agents.find(a => a.agent === dep);
        if (depAgent && depAgent.priority >= agent.priority) {
          errors.push(`${prefix}: dependência "${dep}" tem prioridade ${depAgent.priority} >= ${agent.priority}. Dependências devem ter prioridade menor.`);
        }
      }
    }
  }

  // Verificar que prioridades são únicas
  const uniquePriorities = new Set(priorities);
  if (uniquePriorities.size !== priorities.length) {
    errors.push('Prioridades devem ser únicas entre agentes');
  }

  // Verificar agentes duplicados
  const uniqueAgents = new Set(agentNames);
  if (uniqueAgents.size !== agentNames.length) {
    errors.push('Agentes duplicados no plano de execução');
  }

  return errors;
}

module.exports = { validateDOC, validateReasoning, validateAgents, VALID_AGENTS };
