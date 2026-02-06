/**
 * @module core/orchestrator/input-builder
 * @description Preparador de input para Agentes Coordenadores.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 * Monta o pacote de dados que cada coordenador recebe:
 * - Contexto de memória filtrado pelo Orquestrador
 * - Descrição da tarefa
 * - Output esperado
 * - Outputs de agentes anteriores (quando há dependência)
 */

/**
 * Prepara o input para um agente coordenador.
 * @param {Object} agentSpec - Especificação do agente no DOC
 * @param {string} agentSpec.agent - Nome do agente
 * @param {string} agentSpec.task_description - Tarefa atribuída
 * @param {string} agentSpec.expected_output - Output esperado
 * @param {string} agentSpec.memory_context - Contexto de memória filtrado
 * @param {string[]} agentSpec.dependencies - Nomes dos agentes dependentes
 * @param {Map<string, Object>} results - Resultados já obtidos de outros agentes
 * @returns {Object} Input estruturado para o coordenador
 */
function prepareInput(agentSpec, results) {
  const input = {
    memory_context: agentSpec.memory_context || '',
    task_description: agentSpec.task_description,
    expected_output: agentSpec.expected_output,
    dependency_outputs: {},
  };

  // Adicionar outputs de dependências (se houver)
  if (agentSpec.dependencies && agentSpec.dependencies.length > 0) {
    for (const dep of agentSpec.dependencies) {
      if (results.has(dep)) {
        input.dependency_outputs[dep] = results.get(dep);
      }
    }
  }

  return input;
}

/**
 * Formata os outputs de dependências como texto para o prompt do coordenador.
 * @param {Object} dependencyOutputs - Outputs indexados por nome do agente
 * @returns {string} Texto formatado para inclusão no prompt
 */
function formatDependencyOutputsForPrompt(dependencyOutputs) {
  if (!dependencyOutputs || Object.keys(dependencyOutputs).length === 0) {
    return '';
  }

  const lines = ['OUTPUTS DE AGENTES ANTERIORES:'];

  for (const [agentName, output] of Object.entries(dependencyOutputs)) {
    lines.push(`\n--- Output do agente "${agentName}" ---`);
    if (typeof output === 'string') {
      lines.push(output);
    } else if (output && output.result) {
      lines.push(JSON.stringify(output.result, null, 2));
    } else {
      lines.push(JSON.stringify(output, null, 2));
    }
  }

  return lines.join('\n');
}

module.exports = { prepareInput, formatDependencyOutputsForPrompt };
