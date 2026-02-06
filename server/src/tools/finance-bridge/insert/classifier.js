/**
 * @module tools/finance-bridge/insert/classifier
 * @description Classificador de tipo de transação (despesa ou receita).
 * 
 * PASSO 1 do pipeline de insert.
 * Modelo: GPT-5-nano (sem reasoning/verbosity)
 * Conforme constituição — classificação binária simples, repetitiva, alto volume.
 * 
 * PONTO DE IA: Classificação binária.
 */

const ModelFactory = require('../../../utils/ai/model-factory');
const logger = require('../../../utils/logger');

const CLASSIFIER_SYSTEM_PROMPT = `Você é um classificador de transações financeiras.

Sua ÚNICA tarefa é determinar se a transação descrita é uma DESPESA ou uma RECEITA.

DESPESA (expense): Dinheiro que SAI do bolso do usuário.
Exemplos: "Gastei R$50", "Paguei R$120 de luz", "Comprei remédio"

RECEITA (income): Dinheiro que ENTRA no bolso do usuário.
Exemplos: "Recebi R$3000 de salário", "Ganhei R$500 de freelance", "Me pagaram R$200"

Retorne EXCLUSIVAMENTE um JSON:
{ "type": "expense" }
ou
{ "type": "income" }`;

/**
 * Classifica uma transação como despesa ou receita.
 * @param {string} query - Descrição da transação em linguagem natural
 * @returns {Promise<string>} "expense" ou "income"
 */
async function classify(query) {
  const nano = ModelFactory.getNano();

  try {
    const result = await nano.completeJSON(CLASSIFIER_SYSTEM_PROMPT, query, {
      maxTokens: 30,
      temperature: 0.1,
    });

    const type = result.type;

    if (type !== 'expense' && type !== 'income') {
      logger.warn('InsertClassifier', 'ai', `Tipo inválido retornado: "${type}", usando fallback "expense"`);
      return 'expense'; // Fallback seguro: maioria das transações é despesa
    }

    logger.ai('DEBUG', 'InsertClassifier', `Transação classificada como "${type}"`, {
      query: query.substring(0, 60),
    });

    return type;
  } catch (error) {
    logger.error('InsertClassifier', 'ai', 'Falha ao classificar transação, usando fallback "expense"', {
      error: error.message,
    });
    return 'expense'; // Fallback seguro
  }
}

module.exports = { classify };
