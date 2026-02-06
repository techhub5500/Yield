/**
 * @module tools/finance-bridge/insert/assembler
 * @description Montador de lançamento financeiro.
 * 
 * PASSO 3 do pipeline de insert.
 * Modelo: GPT-5-nano (sem reasoning/verbosity)
 * Conforme constituição — extração de dados + formatação JSON, tarefa direta.
 * 
 * PONTO DE IA: Extração e montagem de dados estruturados.
 */

const ModelFactory = require('../../../utils/ai/model-factory');
const logger = require('../../../utils/logger');

const ASSEMBLER_SYSTEM_PROMPT = `Você é um montador de lançamentos financeiros.

Sua tarefa é extrair informações de uma transação e montar um JSON de lançamento completo.

REGRAS:
1. Extraia o VALOR (amount) como número positivo (sem R$, sem separadores de milhar)
2. Extraia ou infira a DATA (date) no formato YYYY-MM-DD. Se não mencionada, use a data de hoje.
3. Selecione a SUBCATEGORIA mais adequada da lista fornecida
4. Extraia uma DESCRIÇÃO concisa
5. Tente inferir o MÉTODO DE PAGAMENTO (credit_card, debit_card, pix, cash, transfer). Se não mencionado, use null.

DATA DE HOJE: ${new Date().toISOString().split('T')[0]}

Retorne EXCLUSIVAMENTE um JSON:
{
  "amount": 150.00,
  "date": "2026-02-05",
  "subcategory": "Subcategoria Exata",
  "description": "Descrição concisa",
  "payment_method": "credit_card" ou null
}`;

/**
 * Monta o JSON de lançamento a partir da query e subcategorias.
 * @param {string[]} subcategories - Subcategorias da categoria selecionada
 * @param {string} query - Descrição completa da transação
 * @param {string} type - "expense" ou "income"
 * @param {string} category - Categoria principal já selecionada
 * @returns {Promise<Object>} JSON de lançamento
 */
async function assemble(subcategories, query, type, category) {
  const nano = ModelFactory.getNano();

  const userPrompt = [
    `SUBCATEGORIAS DISPONÍVEIS:`,
    subcategories.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    ``,
    `TRANSAÇÃO: "${query}"`,
    ``,
    `Monte o JSON de lançamento.`,
  ].join('\n');

  try {
    const result = await nano.completeJSON(ASSEMBLER_SYSTEM_PROMPT, userPrompt, {
      maxTokens: 200,
      temperature: 0.1,
    });

    // Enriquecer com dados já conhecidos
    result.type = type;
    result.category = category;
    result.status = result.status || 'completed';

    // Validar subcategoria
    if (result.subcategory) {
      const match = subcategories.find(s => s.toLowerCase() === result.subcategory.toLowerCase());
      if (match) {
        result.subcategory = match;
      } else {
        // Tentar match parcial
        const partial = subcategories.find(s =>
          s.toLowerCase().includes(result.subcategory.toLowerCase())
          || result.subcategory.toLowerCase().includes(s.toLowerCase()));
        result.subcategory = partial || subcategories[0];
      }
    } else {
      result.subcategory = subcategories[0];
    }

    // Garantir data padrão
    if (!result.date) {
      result.date = new Date().toISOString().split('T')[0];
    }

    logger.ai('DEBUG', 'InsertAssembler', 'Lançamento montado com sucesso', {
      amount: result.amount,
      category,
      subcategory: result.subcategory,
    });

    return result;
  } catch (error) {
    logger.error('InsertAssembler', 'ai', 'Falha ao montar lançamento, usando fallback', {
      error: error.message,
    });

    // Fallback: tentar extrair valor manualmente
    return createFallbackTransaction(query, type, category, subcategories);
  }
}

/**
 * Cria uma transação de fallback extraindo dados básicos.
 * LÓGICA PURA.
 * @param {string} query
 * @param {string} type
 * @param {string} category
 * @param {string[]} subcategories
 * @returns {Object}
 */
function createFallbackTransaction(query, type, category, subcategories) {
  // Tentar extrair valor
  const amountMatch = query.match(/r?\$?\s*([\d.,]+)/i);
  const amount = amountMatch
    ? parseFloat(amountMatch[1].replace('.', '').replace(',', '.'))
    : 0;

  return {
    amount,
    date: new Date().toISOString().split('T')[0],
    type,
    category,
    subcategory: subcategories[0] || 'Não categorizado',
    description: query.substring(0, 200),
    payment_method: null,
    status: 'completed',
  };
}

module.exports = { assemble, createFallbackTransaction };
