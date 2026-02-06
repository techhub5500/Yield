/**
 * @module tools/finance-bridge/query-builder
 * @description Conversor de linguagem natural para JSON estruturado (queries).
 * 
 * Modelo: GPT-5-nano (sem reasoning/verbosity)
 * Conforme constituição — conversão NL→JSON, tarefa simples e repetitiva.
 * 
 * PONTO DE IA: Conversão de formato.
 */

const ModelFactory = require('../../utils/ai/model-factory');
const { getSchemaForPrompt } = require('./schema');
const logger = require('../../utils/logger');

const QUERY_BUILDER_SYSTEM_PROMPT = `Você é um conversor de linguagem natural para JSON.

Sua tarefa é converter uma consulta financeira em linguagem natural para um JSON estruturado seguindo o schema fornecido.

SCHEMA DO FINANCE BRIDGE:
${getSchemaForPrompt()}

REGRAS:
1. O campo "operation" DEVE ser "query"
2. Use "named_period" quando o usuário mencionar períodos como "este mês", "mês passado", "últimos 6 dias"
3. Para datas específicas, use "start" e "end" no formato YYYY-MM-DD
4. Valores monetários devem ser convertidos para números (sem R$, sem pontos de milhar)
5. Categorias devem ser escritas exatamente como no sistema (primeira letra maiúscula)
6. Se o usuário mencionar exclusão ("exceto", "menos", "sem"), use o campo "exclude"
7. Ordene por data decrescente por padrão se não especificado
8. Limite padrão: 50 resultados se não especificado
9. Lógica padrão: AND se não especificado

Retorne EXCLUSIVAMENTE o JSON, sem explicações.`;

/**
 * Converte uma query em linguagem natural para JSON do Finance Bridge.
 * @param {string} query - Query em linguagem natural
 * @returns {Promise<Object>} JSON estruturado para o Finance Bridge
 */
async function buildQuery(query) {
  const nano = ModelFactory.getNano();

  const userPrompt = `Converta esta consulta financeira para JSON:\n\n"${query}"`;

  try {
    const result = await nano.completeJSON(QUERY_BUILDER_SYSTEM_PROMPT, userPrompt, {
      maxTokens: 500,
      temperature: 0.1,
    });

    // Garantir que a operação é query
    if (result.operation !== 'query') {
      result.operation = 'query';
    }

    // Garantir contexto padrão
    if (!result.context) {
      result.context = {
        user_timezone: 'America/Sao_Paulo',
        currency: 'BRL',
      };
    }

    logger.ai('DEBUG', 'QueryBuilder', 'Query NL convertida para JSON', {
      query: query.substring(0, 60),
    });

    return result;
  } catch (error) {
    logger.error('QueryBuilder', 'ai', `Falha ao converter query: "${query.substring(0, 50)}..."`, {
      error: error.message,
    });
    throw error;
  }
}

module.exports = { buildQuery };
