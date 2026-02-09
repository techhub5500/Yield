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
const { authenticateToken } = require('../middleware/auth');
const { mergeFollowupResponse, shouldMergeFollowupResponse } = require('../../agents/junior/followup');

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
   * **REQUER AUTENTICAÇÃO**
   * 
   * Body: { chatId: string, message: string }
   * Headers: Authorization: Bearer <token>
   * Response: { response: string, chatId: string, timestamp: number, metadata?: Object }
   */
  router.post('/message', authenticateToken, async (req, res, next) => {
    const startTime = Date.now();

    try {
      // --- Validação de input ---
      const { chatId, message } = req.body;
      const userId = req.user.userId; // Extraído do JWT pelo middleware

      if (!chatId || typeof chatId !== 'string') {
        return res.status(400).json({ error: 'chatId é obrigatório e deve ser string' });
      }

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'message é obrigatória e não pode ser vazia' });
      }

      const query = message.trim();

      logger.logic('INFO', 'MessageRoute', `Nova mensagem recebida`, {
        chatId,
        userId,
        queryLength: query.length,
      });

      // --- 1. Carregar memória (LÓGICA) com validação de ownership ---
      if (!memoryManager) {
        return res.status(503).json({ error: 'Sistema de memória não disponível' });
      }

      const memory = await memoryManager.load(chatId, userId);

      let effectiveQuery = query;
      const pendingFollowup = memory.pendingFollowup;
      const shouldMerge = shouldMergeFollowupResponse(pendingFollowup, query);

      if (pendingFollowup && shouldMerge) {
        effectiveQuery = mergeFollowupResponse(pendingFollowup.originalQuery, query);
        logger.logic('DEBUG', 'MessageRoute', 'Resposta de follow-up detectada; query mesclada', {
          chatId,
        });
      } else if (pendingFollowup) {
        logger.logic('DEBUG', 'MessageRoute', 'Follow-up pendente ignorado: resposta nao reconhecida', {
          chatId,
        });
      }

      // --- 2. Junior classifica (IA) ---
      if (!junior) {
        return res.status(503).json({ error: 'Agente Junior não disponível' });
      }

      const decision = await junior.analyze(effectiveQuery, memory);

      logger.logic('DEBUG', 'MessageRoute', `Junior decidiu: "${decision.decision}"`, {
        chatId,
        needsFollowup: decision.needs_followup,
      });

      // --- 3. Se needs_followup → retornar pergunta ao usuário ---
      if (decision.needs_followup && decision.followup_question) {
        logger.logic('DEBUG', 'MessageRoute', 'Retornando follow-up ao usuário');

        // Atualizar memória com o ciclo de follow-up
        await memoryManager.updateAfterCycle(chatId, query, decision.followup_question, userId, {
          pendingFollowup: {
            originalQuery: pendingFollowup?.originalQuery || query,
            missingFields: decision.missing_info || [],
            decision: decision.decision,
            createdAt: new Date().toISOString(),
          },
        });

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

      const routeResult = await dispatcher.route(decision, effectiveQuery, memory, chatId);

      // --- 5/6. Gerar resposta final ---
      let finalResponse;

      if (decision.decision === 'escalate' && routeResult.success && routeResult.data?.doc) {
        // --- 5. Escalada completa: Orquestrador + Coordenadores → ResponseAgent sintetiza ---
        if (responseAgent) {
          const synthesized = await responseAgent.synthesize(
            effectiveQuery,
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
            effectiveQuery,
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
            effectiveQuery,
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
      await memoryManager.updateAfterCycle(chatId, query, finalResponse, userId, {
        clearPendingFollowup: true,
      });

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
   * Retorna o histórico completo de mensagens do chat.
   * **REQUER AUTENTICAÇÃO**
   * 
   * Headers: Authorization: Bearer <token>
   * Response: { messages: [], wordCount: number }
   */
  router.get('/chat/:chatId/history', authenticateToken, async (req, res, next) => {
    try {
      const { chatId } = req.params;
      const userId = req.user.userId; // Extraído do JWT

      if (!chatId) {
        return res.status(400).json({ error: 'chatId é obrigatório' });
      }

      if (!memoryManager) {
        return res.status(503).json({ error: 'Sistema de memória não disponível' });
      }

      // Carregar memória com validação de ownership
      const memory = await memoryManager.load(chatId, userId);

      // Retornar histórico completo (todas as mensagens reais)
      const messages = memory.fullHistory || [];

      logger.logic('DEBUG', 'MessageRoute', `Histórico consultado`, {
        chatId,
        totalMessages: messages.length,
      });

      return res.json({
        chatId,
        messages,
        wordCount: memory.wordCount || 0,
      });
    } catch (error) {
      logger.error('MessageRoute', 'system', `Erro ao consultar histórico: ${error.message}`, {
        chatId: req.params?.chatId,
      });
      next(error);
    }
  });

  /**
   * GET /api/chats
   * Lista todos os chats salvos ordenados por data de atualização.
   * **REQUER AUTENTICAÇÃO** - retorna apenas chats do usuário logado.
   * 
   * Headers: Authorization: Bearer <token>
   * Query params: ?limit=50 (opcional)
   * Response: { chats: [{ chatId, preview, lastMessage, timestamp, messageCount }] }
   */
  router.get('/chats', authenticateToken, async (req, res, next) => {
    try {
      if (!memoryManager) {
        return res.status(503).json({ error: 'Sistema de memória não disponível' });
      }

      const limit = parseInt(req.query.limit) || 50;
      const userId = req.user.userId; // Extraído do JWT
      
      // Buscar apenas chats do usuário logado
      const chats = await memoryManager.getAllChats(limit, userId);

      logger.logic('DEBUG', 'MessageRoute', `Lista de chats consultada`, {
        userId,
        count: chats.length,
        limit,
      });

      return res.json({
        chats,
        count: chats.length,
      });
    } catch (error) {
      logger.error('MessageRoute', 'system', `Erro ao listar chats: ${error.message}`);
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
