/**
 * @module agents/response/integrator
 * @description Integrador de outputs de múltiplos coordenadores.
 * 
 * LÓGICA PURA conforme constituição — sem IA.
 * Prepara e estrutura os outputs dos coordenadores para o Agente de Resposta.
 * 
 * Responsabilidades:
 * - Coletar outputs de todos os coordenadores
 * - Identificar outputs válidos vs falhos
 * - Estruturar dados para consumo pelo prompt de síntese
 * - Gerar contexto de integração (quais agentes contribuíram)
 */

const logger = require('../../utils/logger');

/**
 * Integra outputs de múltiplos coordenadores em um contexto estruturado
 * para o Agente de Resposta.
 * 
 * @param {Object} outputs - Outputs dos coordenadores (chave: agentName_output)
 * @param {Object} doc - DOC original do Orquestrador
 * @returns {Object} Contexto integrado para o prompt de síntese
 */
function integrateOutputs(outputs, doc) {
  const successful = [];
  const failed = [];

  for (const [key, output] of Object.entries(outputs)) {
    const agentName = key.replace('_output', '');

    if (output && output.task_completed !== false) {
      successful.push({
        agent: agentName,
        result: output.result || output,
        confidence: output.metadata?.confidence || 'unknown',
        tools_used: output.tools_used || [],
        reasoning: output.reasoning || '',
      });
    } else {
      failed.push({
        agent: agentName,
        error: output?.error || output?.reasoning || 'Tarefa não concluída',
      });
    }
  }

  logger.logic('DEBUG', 'OutputIntegrator', `Outputs integrados: ${successful.length} sucesso, ${failed.length} falha(s)`, {
    successful: successful.map(s => s.agent).join(', '),
    failed: failed.map(f => f.agent).join(', ') || 'nenhuma',
  });

  return {
    successful,
    failed,
    totalAgents: successful.length + failed.length,
    allSuccessful: failed.length === 0,
  };
}

/**
 * Formata o contexto integrado como texto para o prompt de síntese.
 * 
 * @param {Object} integrated - Resultado de integrateOutputs()
 * @param {string} query - Query original do usuário
 * @param {Object} doc - DOC do Orquestrador
 * @returns {string} Texto formatado para o prompt
 */
function formatIntegratedContext(integrated, query, doc) {
  const parts = [];

  parts.push(`QUERY ORIGINAL: "${query}"`);
  parts.push('');

  if (doc && doc.reasoning) {
    parts.push(`ESTRATÉGIA DO ORQUESTRADOR:`);
    parts.push(doc.reasoning);
    parts.push('');
  }

  // Outputs bem-sucedidos
  if (integrated.successful.length > 0) {
    parts.push(`OUTPUTS DOS AGENTES (${integrated.successful.length} agente(s)):`);
    parts.push('');

    for (const output of integrated.successful) {
      parts.push(`--- ${output.agent.toUpperCase()} ---`);
      parts.push(`Confiança: ${output.confidence}`);

      if (output.tools_used.length > 0) {
        parts.push(`Ferramentas usadas: ${output.tools_used.join(', ')}`);
      }

      // Resultado pode ser objeto ou string
      const resultStr = typeof output.result === 'string'
        ? output.result
        : JSON.stringify(output.result, null, 2);
      parts.push(`Resultado: ${resultStr}`);
      parts.push('');
    }
  }

  // Outputs falhos
  if (integrated.failed.length > 0) {
    parts.push(`AGENTES COM FALHA (${integrated.failed.length}):`);
    for (const fail of integrated.failed) {
      parts.push(`- ${fail.agent}: ${fail.error}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Formata resultado direto (sem escalada) para o prompt de resposta.
 * Usado quando o Junior resolve diretamente via bridge_query, bridge_insert ou serper.
 * 
 * @param {string} type - Tipo de rota (bridge_query, bridge_insert, serper)
 * @param {Object} data - Dados retornados pela ferramenta
 * @param {string} query - Query original do usuário
 * @returns {string} Texto formatado para o prompt
 */
function formatDirectResult(type, data, query) {
  const parts = [];

  parts.push(`QUERY DO USUÁRIO: "${query}"`);
  parts.push(`TIPO DE CONSULTA: ${type}`);
  parts.push('');

  switch (type) {
    case 'bridge_query':
      parts.push('DADOS FINANCEIROS RETORNADOS:');
      parts.push(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
      break;

    case 'bridge_insert':
      parts.push('RESULTADO DO LANÇAMENTO:');
      parts.push(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
      break;

    case 'serper':
      parts.push('RESULTADOS DE PESQUISA:');
      parts.push(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
      break;

    default:
      parts.push('RESULTADO:');
      parts.push(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }

  return parts.join('\n');
}

module.exports = { integrateOutputs, formatIntegratedContext, formatDirectResult };
