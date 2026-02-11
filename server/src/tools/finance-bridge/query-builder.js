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
6.1. Se o usuário mencionar receitas/ganhos, use filters.type = "income"; se mencionar gastos/despesas, use filters.type = "expense"; se mencionar ambos, OMITA filters.type
6.2. Se o usuário perguntar sobre saldo/"quanto tenho na conta" sem citar receitas ou despesas, OMITA filters.type
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

    // Garantir estrutura mínima
    if (!result.params) {
      result.params = {};
    }
    if (!result.params.filters) {
      result.params.filters = {};
    }

    // Inferir tipo (income/expense) quando o usuário indica claramente
    const inferredType = inferTypeFromQuery(query);
    if (!result.params.filters.type && inferredType) {
      result.params.filters.type = inferredType;
    }

    // Normalizar tipo quando a IA retorna null/all/both
    const normalizedType = normalizeType(result.params.filters.type);
    if (normalizedType === null) {
      delete result.params.filters.type;
    } else if (normalizedType) {
      result.params.filters.type = normalizedType;
    }

    // Para perguntas de saldo/conta sem sinais explícitos, não force tipo
    const intentFlags = detectIntentFlags(query);
    if (intentFlags.balanceMatch && !intentFlags.incomeMatch && !intentFlags.expenseMatch) {
      delete result.params.filters.type;
    }

    // Limpar categorias inválidas
    if (Array.isArray(result.params.filters.categories)) {
      const cleaned = result.params.filters.categories
        .filter(c => typeof c === 'string')
        .map(c => c.trim())
        .filter(c => c.length > 0);

      if (cleaned.length > 0) {
        result.params.filters.categories = cleaned;
      } else {
        delete result.params.filters.categories;
      }
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

/**
 * Infere o tipo de transação a partir da query.
 * LÓGICA PURA: evita depender apenas do modelo quando há sinal explícito.
 * @param {string} query
 * @returns {'income'|'expense'|null}
 */
function inferTypeFromQuery(query) {
  const intentFlags = detectIntentFlags(query);

  if (intentFlags.incomeMatch && !intentFlags.expenseMatch) return 'income';
  if (intentFlags.expenseMatch && !intentFlags.incomeMatch) return 'expense';
  return null;
}

/**
 * Detecta sinais de intenção na query.
 * @param {string} query
 * @returns {{incomeMatch: boolean, expenseMatch: boolean, balanceMatch: boolean}}
 */
function detectIntentFlags(query) {
  const normalized = String(query || '').toLowerCase();

  const incomeMatch = /\b(receita|receitas|ganho|ganhos|ganhei|recebi|sal[aá]rio|renda|rendimentos|bonu[sx])\b/i.test(normalized);

  // "conta" isolado pode significar saldo; só conta como despesa quando for "conta de/da/do"
  const expenseMatch = /\b(despesa|despesas|gasto|gastos|gastei|paguei|pagar|compra|comprei|cart[aã]o|conta(?:s)?\s+(?:de|da|do))\b/i.test(normalized);

  const balanceMatch = /\b(saldo|saldo\s+atual|quanto\s+tenho|tenho\s+na\s+conta|meu\s+saldo|saldo\s+da\s+conta)\b/i.test(normalized);

  return { incomeMatch, expenseMatch, balanceMatch };
}

/**
 * Normaliza o tipo retornado pela IA.
 * @param {string|null|undefined} value
 * @returns {'expense'|'income'|null}
 */
function normalizeType(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (['all', 'both', 'ambos'].includes(normalized)) return null;
  if (normalized === 'expense' || normalized === 'income') return normalized;
  return normalized;
}

module.exports = { buildQuery };
