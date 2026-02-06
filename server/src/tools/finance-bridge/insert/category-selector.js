/**
 * @module tools/finance-bridge/insert/category-selector
 * @description Seletor de categoria para transações.
 * 
 * PASSO 2 do pipeline de insert.
 * Modelo: GPT-5-mini (Reasoning: Medium, Verbosity: Low)
 * Conforme constituição — exige raciocínio contextual para casos ambíguos.
 * 
 * PONTO DE IA: Análise contextual para seleção de categoria.
 */

const ModelFactory = require('../../../utils/ai/model-factory');
const logger = require('../../../utils/logger');

const CATEGORY_SELECTOR_SYSTEM_PROMPT = `Você é um especialista em categorização de transações financeiras.

Sua tarefa é analisar a descrição de uma transação e selecionar a categoria mais adequada da lista fornecida.

REGRAS DE CATEGORIZAÇÃO:
1. Analise o CONTEXTO da transação (exemplo: "Uber Eats" é Alimentação, não Transporte)
2. Considere a intenção principal do gasto/receita
3. Em caso de AMBIGUIDADE, escolha a categoria que melhor representa a finalidade principal
4. Se nenhuma categoria se encaixar perfeitamente, escolha a mais próxima

EXEMPLOS DE ANÁLISE CONTEXTUAL:
- "Uber" → Transporte (App de Transporte)
- "Uber Eats" → Alimentação (Delivery)
- "iFood" → Alimentação (Delivery)
- "Netflix" → Lazer e Entretenimento (Streaming)
- "Farmácia" → Farmácia e Drogaria
- "Luz" → Contas Domésticas
- "Aluguel" → Moradia

Retorne EXCLUSIVAMENTE um JSON:
{ "category": "Nome da Categoria Exata" }`;

/**
 * Seleciona a categoria mais adequada para uma transação.
 * @param {string[]} categories - Lista de categorias disponíveis
 * @param {string} query - Descrição da transação
 * @returns {Promise<string>} Nome da categoria selecionada
 */
async function selectCategory(categories, query) {
  const mini = ModelFactory.getMini('medium', 'low');

  const userPrompt = [
    `CATEGORIAS DISPONÍVEIS:`,
    categories.map((c, i) => `${i + 1}. ${c}`).join('\n'),
    ``,
    `TRANSAÇÃO: "${query}"`,
    ``,
    `Selecione a categoria mais adequada.`,
  ].join('\n');

  try {
    const result = await mini.completeJSON(CATEGORY_SELECTOR_SYSTEM_PROMPT, userPrompt, {
      maxTokens: 50,
      temperature: 0.2,
    });

    const selected = result.category;

    // Validar que a categoria existe na lista (case-insensitive)
    const match = categories.find(c => c.toLowerCase() === selected.toLowerCase());

    if (!match) {
      logger.warn('CategorySelector', 'ai', `Categoria "${selected}" não existe na lista, buscando mais próxima`);
      // Tentar match parcial
      const partial = categories.find(c => c.toLowerCase().includes(selected.toLowerCase())
        || selected.toLowerCase().includes(c.toLowerCase()));
      
      if (partial) {
        logger.ai('DEBUG', 'CategorySelector', `Match parcial encontrado: "${partial}"`);
        return partial;
      }

      // Fallback: primeira categoria (genérica)
      logger.warn('CategorySelector', 'ai', `Nenhum match encontrado, usando primeira categoria`);
      return categories[0];
    }

    logger.ai('DEBUG', 'CategorySelector', `Categoria selecionada: "${match}"`, {
      query: query.substring(0, 60),
    });

    return match;
  } catch (error) {
    logger.error('CategorySelector', 'ai', 'Falha ao selecionar categoria, usando primeira disponível', {
      error: error.message,
    });
    return categories[0]; // Fallback
  }
}

module.exports = { selectCategory };
