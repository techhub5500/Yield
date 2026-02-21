/**
 * @module api/routes/analise-ativos
 * @description Rotas Express exclusivas da página analise_ativos.html.
 *
 * Responsabilidades:
 *  - Persistência da última pesquisa por usuário (aa_user_searches)
 *  - CRUD de anotações por card com snapshot de dados (aa_annotations)
 *  - CRUD de resumos gerados por IA (aa_ai_summaries)
 *
 * Todos os endpoints exigem o header  Authorization: Bearer <token>.
 * A verificação do JWT é feita pelo middleware `verifyToken` deste módulo.
 *
 * Endpoints registrados:
 *  GET    /api/analise-ativos/last-search/:userId      → última pesquisa
 *  POST   /api/analise-ativos/last-search              → salvar/atualizar pesquisa
 *  GET    /api/analise-ativos/annotations/:userId      → listar anotações
 *  POST   /api/analise-ativos/annotations              → criar anotação
 *  DELETE /api/analise-ativos/annotations/:id          → excluir anotação
 *  GET    /api/analise-ativos/summaries/:userId        → listar resumos
 *  DELETE /api/analise-ativos/summaries/:id            → excluir resumo
 */

const express    = require('express');
const jwt        = require('jsonwebtoken');
const { ObjectId, MongoClient } = require('mongodb');
const config     = require('../../config');
const aaConfig   = require('../../config/analise-ativos.config');
const { COLS, validators, ensureIndexes } = require('../../tools/analise-ativos/schemas');
const logger     = require('../../utils/logger');

// ─── Conexão MongoDB (singleton) ────────────────────────────────────────────

/** @type {MongoClient|null} */
let _client = null;
/** @type {import('mongodb').Db|null} */
let _db = null;
/** @type {boolean} */
let _indexesEnsured = false;

/**
 * Retorna a instância do banco, criando-a se necessário.
 * @returns {Promise<import('mongodb').Db>}
 */
async function getDb() {
  if (_db) return _db;

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      _client = new MongoClient(config.mongodb.uri);
      await _client.connect();
      _db = _client.db(config.mongodb.dbName);
      logger.system('INFO', 'AnaliseAtivosRoute', 'Conexão com MongoDB estabelecida');
      break;
    } catch (err) {
      logger.error('AnaliseAtivosRoute', 'system', `Tentativa ${attempt}/${maxRetries} de conexão falhou`, { error: err.message });
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  // Garantir índices apenas na primeira conexão
  if (!_indexesEnsured) {
    await ensureIndexes(_db);
    _indexesEnsured = true;
  }

  return _db;
}

// ─── Middleware de autenticação ──────────────────────────────────────────────

/**
 * Middleware que verifica o JWT e injeta `req.user` com `{ userId, name, email }`.
 * Retorna 401 se o token estiver ausente, mal-formado ou expirado.
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, config.auth.jwtSecret);
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

/**
 * Middleware que garante que o `userId` da rota pertence ao usuário autenticado.
 * Evita que um usuário leia/modifique dados de outro.
 */
function ownUserOnly(req, res, next) {
  const routeUserId = req.params.userId;
  const tokenUserId = req.user?.userId;
  if (routeUserId && tokenUserId && routeUserId !== tokenUserId) {
    return res.status(403).json({ error: 'Acesso negado: userId incompatível com o token' });
  }
  next();
}

// ─── Utilitário ─────────────────────────────────────────────────────────────

/**
 * Converte string para ObjectId do MongoDB com tratamento de erro.
 * @param {string} id
 * @returns {ObjectId|null}
 */
function toObjectId(id) {
  try {
    return new ObjectId(id);
  } catch (_) {
    return null;
  }
}

// ─── Factory do router ───────────────────────────────────────────────────────

/**
 * Cria e retorna o router Express para a página analise_ativos.
 * @returns {express.Router}
 */
function createAnaliseAtivosRouter() {
  const router = express.Router();

  // Aplicar verificação de token em todas as rotas deste router
  router.use(verifyToken);

  // ════════════════════════════════════════════════════════════
  // ÚLTIMA PESQUISA — aa_user_searches
  // ════════════════════════════════════════════════════════════

  /**
   * GET /api/analise-ativos/last-search/:userId
   *
   * Retorna o último ticker pesquisado pelo usuário informado.
   * Usado pelo frontend para restaurar o estado da página ao recarregar.
   *
   * Params:  userId (string) — ID do usuário MongoDB
   * Response 200: { userId, ticker, timestamp }
   * Response 404: { error: 'Nenhuma pesquisa encontrada' }
   */
  router.get('/last-search/:userId', ownUserOnly, async (req, res, next) => {
    try {
      const db  = await getDb();
      const doc = await db.collection(COLS.userSearches).findOne(
        { userId: req.params.userId },
        { projection: { _id: 0, userId: 1, ticker: 1, timestamp: 1 } }
      );

      if (!doc) {
        return res.status(404).json({ error: 'Nenhuma pesquisa encontrada para este usuário' });
      }

      logger.logic('DEBUG', 'AnaliseAtivosRoute', `Última pesquisa recuperada: ${doc.ticker} (user: ${req.params.userId})`);
      return res.json(doc);
    } catch (err) {
      logger.error('AnaliseAtivosRoute', 'system', `GET last-search: ${err.message}`);
      next(err);
    }
  });

  /**
   * POST /api/analise-ativos/last-search
   *
   * Salva ou atualiza (upsert) o último ticker pesquisado.
   * O par userId+ticker é único — cada usuário tem apenas um registro.
   *
   * Body: { userId: string, ticker: string }
   * Response 200: { success: true, ticker }
   */
  router.post('/last-search', async (req, res, next) => {
    try {
      const { valid, errors, doc } = validators.userSearch({
        ...req.body,
        timestamp: new Date(),
      });

      if (!valid) {
        return res.status(400).json({ error: 'Dados inválidos', details: errors });
      }

      // Verificar se o userId do body pertence ao usuário do token
      if (doc.userId !== req.user.userId) {
        return res.status(403).json({ error: 'Acesso negado: userId incompatível com o token' });
      }

      const db = await getDb();
      await db.collection(COLS.userSearches).updateOne(
        { userId: doc.userId },
        { $set: doc },
        { upsert: true }
      );

      logger.logic('INFO', 'AnaliseAtivosRoute', `Última pesquisa salva: ${doc.ticker} (user: ${doc.userId})`);
      return res.json({ success: true, ticker: doc.ticker });
    } catch (err) {
      logger.error('AnaliseAtivosRoute', 'system', `POST last-search: ${err.message}`);
      next(err);
    }
  });

  // ════════════════════════════════════════════════════════════
  // ANOTAÇÕES — aa_annotations
  // ════════════════════════════════════════════════════════════

  /**
   * GET /api/analise-ativos/annotations/:userId
   *
   * Lista todas as anotações do usuário, ordenadas da mais recente para a
   * mais antiga. O `cardSnapshot` é omitido da resposta do frontend — é
   * armazenado apenas para uso interno do Gemini na rota /summarize.
   *
   * Params:  userId (string)
   * Query:   ticker (string, opcional) — filtrar por ativo
   * Response 200: { annotations: [{ _id, cardId, cardLabel, annotationText, ticker, timestamp }] }
   */
  router.get('/annotations/:userId', ownUserOnly, async (req, res, next) => {
    try {
      const db    = await getDb();
      const query = { userId: req.params.userId };
      if (req.query.ticker) query.ticker = String(req.query.ticker).toUpperCase();

      const annotations = await db.collection(COLS.annotations)
        .find(query, {
          projection: { cardSnapshot: 0 }, // Não expor snapshot ao frontend
          sort: { timestamp: -1 },
        })
        .toArray();

      return res.json({ annotations });
    } catch (err) {
      logger.error('AnaliseAtivosRoute', 'system', `GET annotations: ${err.message}`);
      next(err);
    }
  });

  /**
   * POST /api/analise-ativos/annotations
   *
   * Cria uma nova anotação para um card específico.
   * O `cardSnapshot` contém os valores exibidos no card no momento da anotação
   * e é armazenado silenciosamente para enriquecer o contexto do Gemini.
   *
   * Body: {
   *   userId: string,
   *   ticker?: string,
   *   cardId: string,
   *   cardLabel: string,
   *   annotationText: string,
   *   cardSnapshot?: object
   * }
   * Response 201: { success: true, annotationId: string }
   */
  router.post('/annotations', async (req, res, next) => {
    try {
      const { valid, errors, doc } = validators.annotation({
        ...req.body,
        timestamp: new Date(),
        updatedAt: new Date(),
      });

      if (!valid) {
        return res.status(400).json({ error: 'Dados inválidos', details: errors });
      }

      if (doc.userId !== req.user.userId) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const db     = await getDb();
      const result = await db.collection(COLS.annotations).insertOne(doc);

      logger.logic('INFO', 'AnaliseAtivosRoute', `Anotação criada: card=${doc.cardId} (user: ${doc.userId})`);
      return res.status(201).json({ success: true, annotationId: result.insertedId.toString() });
    } catch (err) {
      logger.error('AnaliseAtivosRoute', 'system', `POST annotations: ${err.message}`);
      next(err);
    }
  });

  /**
   * DELETE /api/analise-ativos/annotations/:id
   *
   * Exclui uma anotação pelo seu `_id` MongoDB.
   * Somente o dono da anotação pode excluí-la.
   *
   * Params:  id (string) — ObjectId da anotação
   * Response 200: { success: true }
   * Response 404: { error: 'Anotação não encontrada' }
   */
  router.delete('/annotations/:id', async (req, res, next) => {
    try {
      const oid = toObjectId(req.params.id);
      if (!oid) return res.status(400).json({ error: 'ID de anotação inválido' });

      const db     = await getDb();
      const result = await db.collection(COLS.annotations).deleteOne({
        _id:    oid,
        userId: req.user.userId, // Garante que somente o dono exclui
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Anotação não encontrada ou sem permissão para excluir' });
      }

      logger.logic('INFO', 'AnaliseAtivosRoute', `Anotação excluída: ${req.params.id}`);
      return res.json({ success: true });
    } catch (err) {
      logger.error('AnaliseAtivosRoute', 'system', `DELETE annotations: ${err.message}`);
      next(err);
    }
  });

  // ════════════════════════════════════════════════════════════
  // RESUMOS IA — aa_ai_summaries
  // ════════════════════════════════════════════════════════════

  /**
   * GET /api/analise-ativos/summaries/:userId
   *
   * Lista todos os resumos gerados por IA para o usuário, ordenados do
   * mais recente para o mais antigo.
   *
   * Params:  userId (string)
   * Response 200: { summaries: [{ _id, ticker, content, model, timestamp }] }
   */
  router.get('/summaries/:userId', ownUserOnly, async (req, res, next) => {
    try {
      const db        = await getDb();
      const summaries = await db.collection(COLS.aiSummaries)
        .find(
          { userId: req.params.userId },
          { sort: { timestamp: -1 } }
        )
        .toArray();

      return res.json({ summaries });
    } catch (err) {
      logger.error('AnaliseAtivosRoute', 'system', `GET summaries: ${err.message}`);
      next(err);
    }
  });

  /**
   * DELETE /api/analise-ativos/summaries/:id
   *
   * Exclui um resumo gerado por IA pelo seu `_id` MongoDB.
   * Somente o dono do resumo pode excluí-lo.
   *
   * Params:  id (string) — ObjectId do resumo
   * Response 200: { success: true }
   * Response 404: { error: 'Resumo não encontrado' }
   */
  router.delete('/summaries/:id', async (req, res, next) => {
    try {
      const oid = toObjectId(req.params.id);
      if (!oid) return res.status(400).json({ error: 'ID de resumo inválido' });

      const db     = await getDb();
      const result = await db.collection(COLS.aiSummaries).deleteOne({
        _id:    oid,
        userId: req.user.userId,
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Resumo não encontrado ou sem permissão para excluir' });
      }

      logger.logic('INFO', 'AnaliseAtivosRoute', `Resumo excluído: ${req.params.id}`);
      return res.json({ success: true });
    } catch (err) {
      logger.error('AnaliseAtivosRoute', 'system', `DELETE summaries: ${err.message}`);
      next(err);
    }
  });

  return router;
}

module.exports = { createAnaliseAtivosRouter };
