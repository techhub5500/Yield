/**
 * @module core/router/dispatcher
 * @description Roteador lógico de execução.
 * Recebe a decisão do Junior e despacha para a ferramenta/agente correto.
 * 
 * LÓGICA PURA conforme constituição — sem IA neste módulo.
 * A decisão já foi tomada pela IA (Junior); aqui é execução determinística.
 */

const logger = require('../../utils/logger');

/**
 * @class Dispatcher
 * Roteia a execução para a ferramenta correta com base na decisão do Junior.
 */
class Dispatcher {
  /**
   * @param {Object} tools - Ferramentas disponíveis
   * @param {Object} tools.financeBridge - Finance Bridge (query + insert)
   * @param {Object} tools.searchManager - Gerenciador de busca (Serper, Brapi, Tavily)
   * @param {Object} [tools.orchestrator] - Orquestrador (Fase 3)
   * @param {Object} [tools.executionManager] - Gerenciador de execução (Fase 3)
   */
  constructor(tools = {}) {
    this.financeBridge = tools.financeBridge || null;
    this.searchManager = tools.searchManager || null;
    this.orchestrator = tools.orchestrator || null;
    this.executionManager = tools.executionManager || null;
    this.externalCallManager = tools.externalCallManager || null;
  }

  /**
   * Despacha a query para a ferramenta correta.
   * 
   * REGRAS DE ENVIO DE MEMÓRIA (conforme constituição):
   * - bridge_query: Envia memória COMPLETA
   * - bridge_insert: Memória NÃO enviada
   * - serper: Envia memória COMPLETA
   * - escalate: Envia memória COMPLETA + query (delegado à Fase 3)
   * 
   * @param {Object} decision - Decisão do Junior
   * @param {string} query - Query do usuário
   * @param {Object} memory - Memória completa do chat
   * @returns {Promise<Object>} Resultado da execução
   */
  async route(decision, query, memory, chatId) {
    const route = decision.decision;

    logger.logic('DEBUG', 'Dispatcher', `Roteando para "${route}"`, {
      query: query.substring(0, 60),
    });

    switch (route) {
      case 'bridge_query':
        return await this._handleBridgeQuery(query, memory, chatId);

      case 'bridge_insert':
        return await this._handleBridgeInsert(query, chatId);

      case 'serper':
        return await this._handleSerper(query, memory, chatId);

      case 'simple_response':
        return await this._handleSimpleResponse(query, memory, chatId);

      case 'escalate':
        return await this._handleEscalate(query, memory, chatId);

      default:
        logger.warn('Dispatcher', 'logic', `Rota desconhecida: "${route}", escalando`);
        return await this._handleEscalate(query, memory, chatId);
    }
  }

  /**
   * Roteia para consulta ao Finance Bridge.
   * Memória COMPLETA é enviada (conforme constituição).
   * Usa ExternalCallManager para preservação de estado.
   * @private
   */
  async _handleBridgeQuery(query, memory, chatId) {
    if (!this.financeBridge) {
      logger.error('Dispatcher', 'logic', 'Finance Bridge não disponível');
      return { success: false, error: 'Finance Bridge não configurado' };
    }

    try {
      const result = await this._executeExternal(
        'junior', chatId,
        () => this.financeBridge.query(query, memory),
        { query },
        'finance_bridge:query'
      );
      logger.logic('DEBUG', 'Dispatcher', 'Bridge query executada com sucesso');
      return { success: true, type: 'bridge_query', data: result };
    } catch (error) {
      logger.error('Dispatcher', 'logic', 'Falha no Bridge query', { error: error.message });
      return { success: false, type: 'bridge_query', error: error.message };
    }
  }

  /**
   * Roteia para insert no Finance Bridge.
   * Memória NÃO é enviada (conforme constituição).
   * Usa ExternalCallManager para preservação de estado.
   * @private
   */
  async _handleBridgeInsert(query, chatId) {
    if (!this.financeBridge) {
      logger.error('Dispatcher', 'logic', 'Finance Bridge não disponível');
      return { success: false, error: 'Finance Bridge não configurado' };
    }

    try {
      const result = await this._executeExternal(
        'junior', chatId,
        () => this.financeBridge.insert(query),
        { query },
        'finance_bridge:insert'
      );
      logger.logic('DEBUG', 'Dispatcher', 'Bridge insert executado com sucesso');
      return { success: true, type: 'bridge_insert', data: result };
    } catch (error) {
      logger.error('Dispatcher', 'logic', 'Falha no Bridge insert', { error: error.message });
      return { success: false, type: 'bridge_insert', error: error.message };
    }
  }

  /**
   * Roteia para busca na internet (Serper).
   * Memória COMPLETA é enviada (conforme constituição).
   * Usa ExternalCallManager para preservação de estado.
   * @private
   */
  async _handleSerper(query, memory, chatId) {
    if (!this.searchManager) {
      logger.error('Dispatcher', 'logic', 'Search Manager não disponível');
      return { success: false, error: 'Search Manager não configurado' };
    }

    try {
      const result = await this._executeExternal(
        'junior', chatId,
        () => this.searchManager.search(query, 'serper'),
        { query },
        'search:serper'
      );
      logger.logic('DEBUG', 'Dispatcher', 'Serper search executada com sucesso');
      return { success: true, type: 'serper', data: result };
    } catch (error) {
      logger.error('Dispatcher', 'logic', 'Falha na busca Serper', { error: error.message });
      return { success: false, type: 'serper', error: error.message };
    }
  }

  /**
   * Roteia para resposta social/trivial (simple_response).
   * Delega para ResponseAgent formatar resposta contextual via IA (Mini).
   * Memória é enviada para contextualização.
   * ADICIONADO: 07/02/2026
   * @private
   */
  async _handleSimpleResponse(query, memory, chatId) {
    logger.logic('DEBUG', 'Dispatcher', 'Resposta social via ResponseAgent');
    
    return {
      success: true,
      type: 'simple_response',
      data: { query, memory },
    };
  }

  /**
   * Escalada para o Orquestrador.
   * Memória COMPLETA + query são enviados.
   * O Orquestrador gera o DOC e o ExecutionManager executa os coordenadores.
   * @private
   */
  async _handleEscalate(query, memory, chatId) {
    if (!this.orchestrator || !this.executionManager) {
      logger.warn('Dispatcher', 'logic', 'Orquestrador ou ExecutionManager não disponíveis, retornando indicador de escalada');
      return {
        success: true,
        type: 'escalate',
        data: {
          query,
          memory,
          message: 'Escalado para Orquestrador — módulos não configurados',
        },
      };
    }

    try {
      // 1. Orquestrador gera o DOC (plano de execução)
      logger.logic('INFO', 'Dispatcher', 'Escalando para Orquestrador');
      const doc = await this.orchestrator.plan(query, memory);

      // 2. ExecutionManager executa os coordenadores conforme DOC
      logger.logic('INFO', 'Dispatcher', `Executando DOC ${doc.request_id} com ${doc.execution_plan.agents.length} agente(s)`);
      const results = await this.executionManager.execute(doc, chatId);

      // 3. Converter Map para objeto para serialização
      const outputs = {};
      for (const [agentName, result] of results) {
        outputs[`${agentName}_output`] = result;
      }

      logger.logic('INFO', 'Dispatcher', 'Escalada concluída com sucesso', {
        requestId: doc.request_id,
        agentsExecuted: results.size,
      });

      return {
        success: true,
        type: 'escalate',
        data: {
          doc,
          outputs,
          query,
          memory,
        },
      };
    } catch (error) {
      logger.error('Dispatcher', 'logic', 'Falha na escalada para Orquestrador', { error: error.message });
      return { success: false, type: 'escalate', error: error.message };
    }
  }

  /**
   * Executa uma chamada externa com preservação de estado via ExternalCallManager.
   * Fallback transparente para execução direta se ExternalCallManager não disponível.
   * LÓGICA PURA.
   * @private
   * @param {string} agentId - ID do agente que faz a chamada
   * @param {string} chatId - ID do chat
   * @param {Function} fn - Função async a executar
   * @param {Object} params - Parâmetros para logging/estado
   * @param {string} systemName - Nome do sistema externo
   * @returns {Promise<*>} Resultado da chamada
   */
  async _executeExternal(agentId, chatId, fn, params, systemName) {
    if (this.externalCallManager && chatId) {
      return this.externalCallManager.executeWithState(
        agentId, chatId, async () => fn(), params, systemName
      );
    }
    return fn();
  }
}

module.exports = Dispatcher;
