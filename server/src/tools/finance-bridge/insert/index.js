/**
 * @module tools/finance-bridge/insert/index
 * @description Orquestrador do pipeline de insert do Finance Bridge.
 * 
 * Pipeline de 3 passos conforme constituição:
 *   1. Classificar tipo (nano) → expense ou income
 *   2. Selecionar categoria (mini) → análise contextual
 *   3. Montar lançamento (nano) → extração e formatação
 * 
 * Cada passo de IA é isolado em seu módulo.
 * A lógica entre passos (carregar JSON, extrair categorias) é pura.
 */

const fs = require('fs');
const { classify } = require('./classifier');
const { selectCategory } = require('./category-selector');
const { assemble } = require('./assembler');
const { validateInsert } = require('../validators');
const { executeInsert } = require('../executor');
const config = require('../../../config');
const logger = require('../../../utils/logger');

/**
 * Executa o pipeline completo de insert.
 * 
 * @param {string} query - Descrição da transação em linguagem natural
 * @returns {Promise<Object>} Resultado do insert
 */
async function insert(query) {
  logger.logic('INFO', 'FinanceBridgeInsert', `Iniciando pipeline de insert para: "${query.substring(0, 60)}..."`);

  // ============================================
  // PASSO 1: Classificar tipo (IA — nano)
  // ============================================
  const type = await classify(query);
  logger.logic('DEBUG', 'FinanceBridgeInsert', `Passo 1 concluído: tipo = "${type}"`);

  // ============================================
  // LÓGICA: Carregar JSON de categorias
  // ============================================
  const jsonData = loadCategoryJSON(type);
  if (!jsonData) {
    return { success: false, error: 'Falha ao carregar categorias' };
  }

  // LÓGICA: Extrair apenas nomes de categorias (sem subcategorias)
  const categories = extractCategoryNames(jsonData);
  logger.logic('DEBUG', 'FinanceBridgeInsert', `${categories.length} categorias carregadas para "${type}"`);

  // ============================================
  // PASSO 2: Selecionar categoria (IA — mini)
  // ============================================
  const category = await selectCategory(categories, query);
  logger.logic('DEBUG', 'FinanceBridgeInsert', `Passo 2 concluído: categoria = "${category}"`);

  // ============================================
  // LÓGICA: Buscar subcategorias da categoria
  // ============================================
  const subcategories = extractSubcategories(jsonData, category);
  logger.logic('DEBUG', 'FinanceBridgeInsert', `${subcategories.length} subcategorias encontradas para "${category}"`);

  // ============================================
  // PASSO 3: Montar lançamento (IA — nano)
  // ============================================
  const transaction = await assemble(subcategories, query, type, category);
  logger.logic('DEBUG', 'FinanceBridgeInsert', `Passo 3 concluído: lançamento montado`);

  // ============================================
  // LÓGICA: Validar lançamento
  // ============================================
  const validation = validateInsert(transaction);
  if (!validation.valid) {
    logger.logic('WARN', 'FinanceBridgeInsert', `Validação falhou: ${validation.errors.join('; ')}`);
    return {
      success: false,
      error: `Validação falhou: ${validation.errors.join('; ')}`,
      transaction,
    };
  }

  // ============================================
  // LÓGICA: Executar insert no MongoDB
  // ============================================
  const result = await executeInsert(transaction);

  logger.logic('INFO', 'FinanceBridgeInsert', 'Pipeline de insert concluído com sucesso', {
    type,
    category,
    subcategory: transaction.subcategory,
    amount: transaction.amount,
  });

  return result;
}

/**
 * Carrega o JSON de categorias apropriado (despesas ou receitas).
 * LÓGICA PURA.
 * @param {string} type - "expense" ou "income"
 * @returns {Object|null}
 */
function loadCategoryJSON(type) {
  try {
    const filePath = type === 'expense'
      ? config.paths.despesasJson
      : config.paths.receitasJson;

    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    logger.error('FinanceBridgeInsert', 'logic', `Falha ao carregar JSON de categorias (${type})`, {
      error: error.message,
    });
    return null;
  }
}

/**
 * Extrai apenas os nomes das categorias de um JSON de categorias.
 * LÓGICA PURA.
 * @param {Object} jsonData - JSON de categorias (despesas.json ou receitas.json)
 * @returns {string[]}
 */
function extractCategoryNames(jsonData) {
  if (!jsonData || !Array.isArray(jsonData.categorias)) return [];
  return jsonData.categorias.map(cat => cat.nome);
}

/**
 * Extrai subcategorias de uma categoria específica.
 * LÓGICA PURA.
 * @param {Object} jsonData - JSON de categorias
 * @param {string} categoryName - Nome da categoria
 * @returns {string[]}
 */
function extractSubcategories(jsonData, categoryName) {
  if (!jsonData || !Array.isArray(jsonData.categorias)) return [];

  const cat = jsonData.categorias.find(
    c => c.nome.toLowerCase() === categoryName.toLowerCase()
  );

  return cat && Array.isArray(cat.subcategorias) ? cat.subcategorias : [];
}

module.exports = {
  insert,
  loadCategoryJSON,
  extractCategoryNames,
  extractSubcategories,
};
