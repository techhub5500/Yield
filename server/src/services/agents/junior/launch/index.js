/**
 * Sistema de Lançamentos - API Pública
 * Fase 3 - Agente Júnior
 * 
 * Exporta a interface do sistema de lançamentos de transações.
 */

const { TransactionLauncher } = require('./transaction-launcher');
const { CategoryLoader } = require('./category-loader');

// Instância singleton
const transactionLauncher = new TransactionLauncher();
const categoryLoader = new CategoryLoader();

/**
 * Lança uma transação a partir da mensagem do usuário
 * 
 * @param {string} userMessage - Mensagem do usuário
 * @param {Object} context - Contexto (user_id, etc)
 * @returns {Promise<Object>} Resultado do lançamento
 * 
 * @example
 * const result = await launchService.launch(
 *   'Gastei R$150 no supermercado',
 *   { user_id: 'user_123' }
 * );
 */
async function launch(userMessage, context = {}) {
  return transactionLauncher.launch(userMessage, context);
}

/**
 * Lança transação a partir de dados já extraídos
 * 
 * @param {Object} extracted - Dados extraídos (amount, category, date, etc)
 * @param {string} type - 'expense' ou 'income'
 * @param {Object} context - Contexto
 * @returns {Promise<Object>} Resultado
 * 
 * @example
 * const result = await launchService.launchFromExtracted(
 *   { amount: 150, category: 'supermercado', date: '2026-02-04' },
 *   'expense',
 *   { user_id: 'user_123' }
 * );
 */
async function launchFromExtracted(extracted, type, context = {}) {
  return transactionLauncher.launchFromExtracted(extracted, type, context);
}

/**
 * Carrega categorias de um tipo
 * 
 * @param {string} type - 'expense' ou 'income'
 * @returns {Promise<Array>} Lista de categorias
 */
async function loadCategories(type) {
  return categoryLoader.loadCategories(type);
}

/**
 * Carrega subcategorias de uma categoria
 * 
 * @param {string} type - 'expense' ou 'income'
 * @param {string} categoryId - ID da categoria
 * @returns {Promise<Array>} Lista de subcategorias
 */
async function loadSubcategories(type, categoryId) {
  return categoryLoader.loadSubcategories(type, categoryId);
}

/**
 * Health check do sistema de lançamentos
 */
async function healthCheck() {
  return transactionLauncher.healthCheck();
}

module.exports = {
  launch,
  launchFromExtracted,
  loadCategories,
  loadSubcategories,
  healthCheck,
  
  // Classes para uso avançado
  TransactionLauncher,
  CategoryLoader
};
