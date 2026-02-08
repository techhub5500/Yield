/**
 * @module api/routes/message
 * @description Rotas de mensagens e histórico de chat.
 * 
 * LÓGICA PURA — orquestra o fluxo completo sem tomar decisões de IA.
 * A IA é chamada via módulos injetados (Junior, ResponseAgent, etc.).
 * 
 * Endpoints:
 * - POST /api/message — Fluxo completo de processamento de mensagem
 * - GET /api/chat/:chatId/history — Histórico de memória do chat
 * 
 * Fluxo completo (POST /api/message):
 * 1. Carregar memória (lógica)
 * 2. Junior classifica (IA)
 * 3. Se needs_followup → retornar pergunta
 * 4. Dispatcher roteia (lógica)
 * 5. Se escalou → Orquestrador + Coordenadores + Resposta
 * 6. Se rota direta → ResponseAgent formata
 * 7. Atualizar memória (lógica + IA nano)
 * 8. Retornar resposta
 */

const express = require('express');
const logger = require('../../utils/logger');

/**
 * Cria o router de mensagens com dependências injetadas.
 * 
 * @param {Object} deps - Dependências
 * @param {Object} deps.memoryManager - MemoryManager
 * @param {Object} deps.junior - Agente Junior (analyze)
 * @param {Object} deps.dispatcher - Dispatcher (route)
 * @param {Object} deps.responseAgent - ResponseAgent (synthesize, formatDirectResponse)
 * @returns {express.Router}
 */
function createMessageRouter(deps = {}) {
  const router = express.Router();

  const {
    memoryManager,
    junior,
    dispatcher,
    responseAgent,
    externalCallManager,
  } = deps;

  /**
   * POST /api/message
   * Fluxo completo de processamento de uma mensagem do usuário.
   * 
   * Body: { chatId: string, message: string, userId?: string }
   * Response: { response: string, chatId: string, timestamp: number, metadata?: Object }
   */
  router.post('/message', async (req, res, next) => {
    const startTime = Date.now();

    try {
      // --- Validação de input ---
      const { chatId, message, userId } = req.body;

      if (!chatId || typeof chatId !== 'string') {
        return res.status(400).json({ error: 'chatId é obrigatório e deve ser string' });
      }

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'message é obrigatória e não pode ser vazia' });
      }

      const query = message.trim();

      logger.logic('INFO', 'MessageRoute', `Nova mensagem recebida`, {
        chatId,
        queryLength: query.length,
      });

      // --- 1. Carregar memória (LÓGICA) ---
      if (!memoryManager) {
        return res.status(503).json({ error: 'Sistema de memória não disponível' });
      }

      const memory = await memoryManager.load(chatId);

      // --- 2. Junior classifica (IA) ---
      if (!junior) {
        return res.status(503).json({ error: 'Agente Junior não disponível' });
      }

      const decision = await junior.analyze(query, memory);

      logger.logic('DEBUG', 'MessageRoute', `Junior decidiu: "${decision.decision}"`, {
        chatId,
        needsFollowup: decision.needs_followup,
      });

      // --- 3. Se needs_followup → retornar pergunta ao usuário ---
      if (decision.needs_followup && decision.followup_question) {
        logger.logic('DEBUG', 'MessageRoute', 'Retornando follow-up ao usuário');

        // Atualizar memória com o ciclo de follow-up
        await memoryManager.updateAfterCycle(chatId, query, decision.followup_question);

        return res.json({
          response: decision.followup_question,
          chatId,
          timestamp: Date.now(),
          metadata: {
            type: 'followup',
            decision: decision.decision,
            elapsed: Date.now() - startTime,
          },
        });
      }

      // --- 4. Dispatcher roteia (LÓGICA) ---
      if (!dispatcher) {
        return res.status(503).json({ error: 'Dispatcher não disponível' });
      }

      const routeResult = await dispatcher.route(decision, query, memory, chatId);

      // --- 5/6. Gerar resposta final ---
      let finalResponse;

      if (decision.decision === 'escalate' && routeResult.success && routeResult.data?.doc) {
        // --- 5. Escalada completa: Orquestrador + Coordenadores → ResponseAgent sintetiza ---
        if (responseAgent) {
          const synthesized = await responseAgent.synthesize(
            query,
            memory,
            routeResult.data.doc,
            routeResult.data.outputs
          );
          finalResponse = synthesized.response;
        } else {
          // Fallback sem ResponseAgent
          finalResponse = formatEscalateResultFallback(routeResult.data);
        }
      } else if (decision.decision === 'simple_response' && routeResult.success) {
        // --- 5.5. Resposta social/trivial → ResponseAgent formata via Mini ---
        if (responseAgent) {
          const formatted = await responseAgent.formatSimpleResponse(
            query,
            memory
          );
          finalResponse = formatted.response;
        } else {
          // Fallback sem ResponseAgent
          finalResponse = "Olá! Como posso ajudar você com suas finanças hoje?";
        }
      } else if (routeResult.success) {
        // --- 6. Rota direta → ResponseAgent formata ---
        if (responseAgent) {
          const formatted = await responseAgent.formatDirectResponse(
            query,
            routeResult.type,
            routeResult.data,
            memory
          );
          finalResponse = formatted.response;
        } else {
          // Fallback sem ResponseAgent
          finalResponse = formatDirectResultFallback(routeResult);
        }
      } else {
        // Erro no processamento
        const errorMsg = routeResult.error || 'erro desconhecido';
        finalResponse = `Desculpe, encontrei um problema ao processar sua solicitação: ${errorMsg}. Por favor, tente novamente ou reformule a pergunta.`;
        logger.warn('MessageRoute', 'logic', `Rota falhou: ${errorMsg}`, { chatId });
      }

      // --- 7. Atualizar memória (LÓGICA + IA nano para resumo) ---
      await memoryManager.updateAfterCycle(chatId, query, finalResponse);

      // --- Cleanup de estados de chamadas externas ---
      if (externalCallManager) {
        externalCallManager.clearChatStates(chatId);
      }

      // --- 8. Retornar resposta ---
      const elapsed = Date.now() - startTime;

      logger.logic('INFO', 'MessageRoute', `Ciclo completo`, {
        chatId,
        decision: decision.decision,
        elapsed: `${elapsed}ms`,
      });

      return res.json({
        response: finalResponse,
        chatId,
        timestamp: Date.now(),
        metadata: {
          type: decision.decision,
          elapsed,
        },
      });
    } catch (error) {
      logger.error('MessageRoute', 'system', `Erro no processamento de mensagem: ${error.message}`, {
        chatId: req.body?.chatId,
      });
      next(error);
    }
  });

  /**
   * GET /api/chat/:chatId/history
   * Retorna o histórico de memória do chat.
   * 
   * Response: { recent: [], summary: string }
   */
  router.get('/chat/:chatId/history', async (req, res, next) => {
    try {
      const { chatId } = req.params;

      if (!chatId) {
        return res.status(400).json({ error: 'chatId é obrigatório' });
      }

      if (!memoryManager) {
        return res.status(503).json({ error: 'Sistema de memória não disponível' });
      }

      const memory = await memoryManager.load(chatId);

      // Formatar ciclos recentes
      const recent = (memory.recent || []).map(cycle => ({
        userInput: cycle.userInput,
        aiResponse: cycle.aiResponse,
        timestamp: cycle.timestamp,
        id: cycle.id,
      }));

      // Formatar resumo de memória antiga
      const summaries = (memory.old || []).map(item => {
        return typeof item === 'string' ? item : item.content || '';
      });
      const summary = summaries.join('\n\n') || 'Sem histórico anterior.';

      logger.logic('DEBUG', 'MessageRoute', `Histórico consultado`, {
        chatId,
        recentCycles: recent.length,
        oldSummaries: memory.old?.length || 0,
      });

      return res.json({
        chatId,
        recent,
        summary,
        wordCount: memory.wordCount || 0,
      });
    } catch (error) {
      logger.error('MessageRoute', 'system', `Erro ao consultar histórico: ${error.message}`, {
        chatId: req.params?.chatId,
      });
      next(error);
    }
  });

  return router;
}

/**
 * Fallback para resposta de escalada sem ResponseAgent.
 * LÓGICA PURA.
 * @param {Object} data
 * @returns {string}
 */
function formatEscalateResultFallback(data) {
  if (!data || !data.outputs) return 'Análise concluída.';

  const parts = [];
  for (const [key, output] of Object.entries(data.outputs)) {
    const agentName = key.replace('_output', '');
    if (output && output.result) {
      const resultStr = typeof output.result === 'string'
        ? output.result
        : JSON.stringify(output.result);
      parts.push(`${agentName}: ${resultStr.substring(0, 300)}`);
    }
  }

  return parts.length > 0
    ? parts.join('\n\n')
    : 'Análise concluída, mas não foi possível formatar a resposta.';
}

/**
 * Fallback para resultado direto sem ResponseAgent.
 * LÓGICA PURA.
 * @param {Object} routeResult
 * @returns {string}
 */
function formatDirectResultFallback(routeResult) {
  if (!routeResult.data) return 'Operação concluída.';

  const data = routeResult.data;
  return typeof data === 'string' ? data : JSON.stringify(data);
}

module.exports = { createMessageRouter };
