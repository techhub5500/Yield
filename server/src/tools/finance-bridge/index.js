/**
 * @module tools/finance-bridge/index
 * @description Ponto de entrada do Finance Bridge.
 * Interface unificada para queries e inserts financeiros.
 * 
 * Integra:
 * - Query: NL→JSON (IA nano) → Validação (lógica) → Execução MongoDB (lógica)
 * - Insert: Pipeline de 3 passos (nano → mini → nano) → Validação → MongoDB
 */

const { buildQuery } = require('./query-builder');
const { validateQuery } = require('./validators');
const { executeQuery } = require('./executor');
const insertPipeline = require('./insert');
const logger = require('../../utils/logger');

/**
 * @class FinanceBridge
 * Interface unificada para operações financeiras.
 */
class FinanceBridge {
  /**
   * Executa uma consulta financeira.
   * Fluxo: NL → JSON (IA) → Validação (lógica) → MongoDB (lógica) → Dados brutos
   * 
   * @param {string} query - Consulta em linguagem natural
   * @param {Object} memory - Memória do chat (contexto)
   * @returns {Promise<Object>} Resultados da consulta
   */
  async query(query, memory) {
    logger.logic('INFO', 'FinanceBridge', `Processando query: "${query.substring(0, 60)}..."`);

    // IA (nano): Converter NL para JSON
    const queryJson = await buildQuery(query);

    // LÓGICA: Validar JSON
    const validation = validateQuery(queryJson);
    if (!validation.valid) {
      logger.logic('WARN', 'FinanceBridge', `Query inválida: ${validation.errors.join('; ')}`);
      return {
        success: false,
        error: `Validação falhou: ${validation.errors.join('; ')}`,
        query: queryJson,
      };
    }

    // LÓGICA: Executar no MongoDB
    const results = await executeQuery(queryJson);

    logger.logic('INFO', 'FinanceBridge', `Query retornou ${results.length} resultados`);

    return {
      success: true,
      data: results,
      count: results.length,
      query: queryJson,
    };
  }

  /**
   * Executa um insert financeiro (pipeline de 3 passos).
   * Fluxo: Classificar (nano) → Categorizar (mini) → Montar (nano) → Validar → MongoDB
   * 
   * Conforme constituição: memória NÃO é enviada para inserts.
   * 
   * @param {string} query - Descrição da transação em linguagem natural
   * @returns {Promise<Object>} Resultado do insert
   */
  async insert(query) {
    logger.logic('INFO', 'FinanceBridge', `Processando insert: "${query.substring(0, 60)}..."`);

    const result = await insertPipeline.insert(query);

    if (result.success) {
      logger.logic('INFO', 'FinanceBridge', 'Insert concluído com sucesso', {
        category: result.document?.category,
        amount: result.document?.amount,
      });
    }

    return result;
  }
}

module.exports = FinanceBridge;
