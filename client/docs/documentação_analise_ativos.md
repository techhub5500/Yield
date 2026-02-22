# Documentação Técnica — `analise_ativos.html`

> **Escopo deste documento:** Objetivos **1.2**, **1.3**, **2.1**, **2.2**, **2.3**, **3.1**, **3.2** e **3.3** do Plano de Implementação.
> **Data de implementação:** 2026-02-21
> **Versão:** 1.1.0
> **Autor:** GitHub Copilot

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Objetivo 1.2 — Autenticação e Sessão por Usuário](#2-objetivo-12--autenticação-e-sessão-por-usuário)
   - 2.1 [Tarefa 1.2.1 — Guard de Autenticação](#21-tarefa-121--guard-de-autenticação)
   - 2.2 [Tarefa 1.2.2 — Persistência da Última Pesquisa](#22-tarefa-122--persistência-da-última-pesquisa)
3. [Objetivo 1.3 — Backend: Rotas e Collections MongoDB](#3-objetivo-13--backend-rotas-e-collections-mongodb)
   - 3.1 [Tarefa 1.3.1 — Router Express](#31-tarefa-131--router-express)
   - 3.2 [Tarefa 1.3.2 — Schemas e Índices MongoDB](#32-tarefa-132--schemas-e-índices-mongodb)
   - 3.3 [Tarefa 1.3.3 — Config de Ambiente](#33-tarefa-133--config-de-ambiente)
4. [Referência de Endpoints](#4-referência-de-endpoints)
5. [Referência de Collections MongoDB](#5-referência-de-collections-mongodb)
6. [Fluxo de Dados Completo](#6-fluxo-de-dados-completo)
7. [Segurança](#7-segurança)
8. [Arquivos Criados / Modificados](#8-arquivos-criados--modificados)
9. [Fase 2 — Dados Dinâmicos Core](#9-fase-2--dados-dinâmicos-core-brapi--gráficos--índices)
10. [Fase 3 — IA, Workspace e Benchmark Setorial](#10-fase-3--ia-workspace-e-benchmark-setorial)

---

## 1. Visão Geral

Os objetivos 1.2 e 1.3 estabelecem a **infraestrutura de autenticação** e o **esqueleto do backend** que sustentará todas as funcionalidades dinâmicas da página `analise_ativos.html`. Sem esses fundamentos, as fases 2 e 3 (dados Brapi, gráficos, IA, benchmark) não podem ser implementadas de forma segura e por usuário.

### Princípios adotados

| Princípio | Descrição |
|---|---|
| **Isolamento** | Todos os arquivos novos ficam em diretórios dedicados (`tools/analise-ativos/`, `routes/analise-ativos.js`, `config/analise-ativos.config.js`) sem contaminar os módulos existentes |
| **JWT Stateless** | Autenticação idêntica ao restante do sistema — token JWT no `localStorage` verificado via `Authorization: Bearer` |
| **Segurança por ownership** | Cada endpoint verifica que o `userId` da requisição pertence ao token assinado |
| **TTL automático** | Expiração de cache gerenciada pelo daemon do MongoDB (índices TTL), sem cron jobs |
| **Fallback silencioso** | Erros não críticos (ex.: falha ao salvar última pesquisa) são apenas logados — não interrompem a experiência |

---

## 2. Objetivo 1.2 — Autenticação e Sessão por Usuário

### 2.1 Tarefa 1.2.1 — Guard de Autenticação

**Arquivo modificado:** `client/js/analise-ativos.js`

#### Funcionamento

O guard é executado via **IIFE** (Immediately Invoked Function Expression) no topo do arquivo, antes de qualquer outra lógica, garantindo que nenhum código da página seja executado sem sessão válida.

```js
(function authGuard() {
  const token   = localStorage.getItem('yield_token');
  const userRaw = localStorage.getItem('yield_user');

  if (!token || !userRaw) {
    window.location.href = '../html/login.html';
    return;
  }

  try {
    JSON.parse(userRaw); // Valida que o JSON não está corrompido
  } catch (_) {
    localStorage.removeItem('yield_token');
    localStorage.removeItem('yield_user');
    window.location.href = '../html/login.html';
  }
})();
```

**Fluxo de decisão:**

```
localStorage.yield_token existe?
  ├── NÃO → redirect para login.html
  └── SIM → localStorage.yield_user existe?
              ├── NÃO → redirect para login.html
              └── SIM → JSON.parse(userRaw) é válido?
                          ├── NÃO → limpar LS + redirect
                          └── SIM → continuar carregamento da página
```

#### Constantes globais exportadas

Após o guard, quatro constantes são declaradas no escopo global do arquivo para que **todos os módulos compartilhados** (`analise-ativos.search.js`, `analise-ativos.charts.js`, etc.) possam acessá-las sem repetir a leitura do `localStorage`:

| Constante | Tipo | Descrição |
|---|---|---|
| `YIELD_TOKEN` | `string` | JWT do usuário logado |
| `YIELD_USER` | `object` | Objeto do usuário (name, email, etc.) |
| `YIELD_USER_ID` | `string` | `_id` ou `id` do usuário no MongoDB |
| `AUTH_HEADERS` | `object` | `{ 'Content-Type': 'application/json', 'Authorization': 'Bearer <token>' }` |

> **Convenção de nomenclatura:** `YIELD_*` em maiúsculo sinaliza que são constantes globais de sessão, facilitando a localização em qualquer módulo.

#### Função `getBaseUrl()`

Detecta dinamicamente a URL base da API seguindo o mesmo padrão de `client/js/login.js`:

```js
function getBaseUrl() {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = hostname === 'localhost' || hostname === '127.0.0.1' ? '3000' : window.location.port;
  return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
}
const API_BASE = getBaseUrl();
```

Isso garante que a página funcione tanto em **desenvolvimento** (`localhost:3000`) quanto em **produção** (sem porta explícita).

---

### 2.2 Tarefa 1.2.2 — Persistência da Última Pesquisa

**Arquivo modificado:** `client/js/analise-ativos.js`

#### Motivação

Sem persistência da última pesquisa, o usuário que recarrega a página ou navega de volta encontra uma tela em branco sem nenhum ativo carregado. A funcionalidade restaura automaticamente o contexto de trabalho.

#### `saveLastSearch(ticker)`

Chamada pelo módulo `analise-ativos.search.js` após o usuário confirmar a seleção de um ticker:

```js
async function saveLastSearch(ticker) {
  if (!YIELD_USER_ID || !ticker) return;
  try {
    await fetch(`${API_BASE}/api/analise-ativos/last-search`, {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ userId: YIELD_USER_ID, ticker }),
    });
  } catch (err) {
    console.warn('[analise-ativos] Não foi possível salvar última pesquisa:', err.message);
  }
}
```

**Garantes de robustez:**
- Verificação dupla: `YIELD_USER_ID` e `ticker` devem existir antes de qualquer fetch.
- `try/catch` silencioso — falha de rede não interrompe a experiência do usuário.

#### `loadLastSearch()`

Executada no `DOMContentLoaded`, recupera e restaura o ticker salvo:

```js
async function loadLastSearch() {
  if (!YIELD_USER_ID) return;
  try {
    const res = await fetch(
      `${API_BASE}/api/analise-ativos/last-search/${YIELD_USER_ID}`,
      { headers: AUTH_HEADERS }
    );
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.ticker) {
      const searchInput = document.getElementById('search-input')
        || document.querySelector('[data-search-input]');
      if (searchInput) {
        searchInput.value = data.ticker;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  } catch (err) {
    console.warn('[analise-ativos] Não foi possível carregar última pesquisa:', err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadLastSearch();
});
```

**Lógica de restauração:**
1. Preenche o campo de pesquisa com o ticker salvo.
2. Dispara um `Event('input')` com `bubbles: true` para que o listener de autocomplete seja ativado, iniciando o carregamento de dados do ativo.
3. Suporta dois seletores de campo: `#search-input` (id direto) e `[data-search-input]` (data-attribute), preparando a integração com a Tarefa 2.1.3.

---

## 3. Objetivo 1.3 — Backend: Rotas e Collections MongoDB

### 3.1 Tarefa 1.3.1 — Router Express

**Arquivo criado:** `server/src/api/routes/analise-ativos.js`
**Registrado em:** `server/src/api/server.js`

#### Registro no servidor

```js
// server/src/api/server.js
const { createAnaliseAtivosRouter } = require('./routes/analise-ativos');
// ...
const analiseAtivosRouter = createAnaliseAtivosRouter();
app.use('/api/analise-ativos', analiseAtivosRouter);
```

#### Arquitetura do router

O router segue o padrão **Factory Function** já adotado pelo projeto (`createAuthRouter`, `createInvestmentsRouter`), retornando uma instância de `express.Router` configurada.

```
createAnaliseAtivosRouter()
  │
  ├── router.use(verifyToken)          ← middleware global do router
  │
  ├── GET  /last-search/:userId        → ownUserOnly → handler
  ├── POST /last-search                → handler
  │
  ├── GET  /annotations/:userId        → ownUserOnly → handler
  ├── POST /annotations                → handler
  ├── DELETE /annotations/:id          → handler
  │
  ├── GET  /summaries/:userId          → ownUserOnly → handler
  └── DELETE /summaries/:id            → handler
```

#### Middleware `verifyToken`

```js
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
```

Injeta `req.user = { userId, name, email }` — campos decodificados do JWT — para uso nos handlers.

#### Middleware `ownUserOnly`

```js
function ownUserOnly(req, res, next) {
  const routeUserId = req.params.userId;
  const tokenUserId = req.user?.userId;
  if (routeUserId && tokenUserId && routeUserId !== tokenUserId) {
    return res.status(403).json({ error: 'Acesso negado: userId incompatível com o token' });
  }
  next();
}
```

Garante que o usuário autenticado (`req.user.userId` do JWT) seja o mesmo que o `:userId` informado na URL. Previne **Insecure Direct Object Reference (IDOR)**: um usuário malicioso não consegue ler dados de outro passando um userId diferente na URL.

#### Conexão MongoDB (singleton)

O router mantém uma única instância de `MongoClient` e `Db`, reutilizando a conexão entre requisições — mesmo padrão de `auth.js`. Na primeira conexão, `ensureIndexes(db)` é chamado uma única vez (flag `_indexesEnsured`).

#### Upsert de última pesquisa

A operação `updateOne({ userId }, { $set: doc }, { upsert: true })` garante que cada usuário tenha apenas **um registro** de última pesquisa. Se o documento não existir, ele é criado; se existir, o ticker e o timestamp são atualizados.

#### Proteção contra IDOR nas anotações e resumos

Na exclusão de anotações e resumos, a query inclui tanto `_id` quanto `userId`:

```js
await db.collection(COLS.annotations).deleteOne({
  _id:    oid,
  userId: req.user.userId, // ← Impede exclusão de doc de outro usuário
});
```

Se o documento pertencer a outro usuário, `deletedCount === 0` e o endpoint retorna 404 — sem vazar que o documento existe.

---

### 3.2 Tarefa 1.3.2 — Schemas e Índices MongoDB

**Arquivo criado:** `server/src/tools/analise-ativos/schemas.js`

O projeto utiliza o **driver nativo do MongoDB** (sem Mongoose). Este módulo provê:
1. **Funções de validação** — equivalentes aos validators do Mongoose, retornando `{ valid, errors, doc }`.
2. **`ensureIndexes(db)`** — cria todos os índices necessários de forma idempotente.

#### Collections e schemas

##### `aa_user_searches`

Armazena a última pesquisa de cada usuário.

```
Campo       Tipo     Obrigatório  Descrição
─────────   ──────   ──────────── ──────────────────────────────
userId      string   ✅           ID do usuário MongoDB
ticker      string   ✅           Símbolo do ativo (uppercase)
timestamp   Date     auto         Data/hora da pesquisa
```

**Índice:**
```
{ userId: 1 }  →  unique: true
```
Garante um único documento por usuário e permite `upsert` eficiente O(log n).

---

##### `aa_annotations`

Anotações por card com snapshot dos dados no momento da criação.

```
Campo           Tipo     Obrigatório  Descrição
─────────────   ──────   ──────────── ──────────────────────────────────────
userId          string   ✅           ID do usuário
ticker          string   ⚠️           Símbolo do ativo (opcional)
cardId          string   ✅           ID do card anotado (ex.: "card-roe")
cardLabel       string   ✅           Rótulo legível (ex.: "ROE")
annotationText  string   ✅           Texto da anotação
cardSnapshot    object   ⚠️           Dados do card no momento (uso interno Gemini)
timestamp       Date     auto         Data/hora de criação
updatedAt       Date     auto         Data/hora de atualização
```

**Índices:**
```
{ userId: 1, timestamp: -1 }  →  listagem ordenada por usuário
{ userId: 1, cardId: 1 }      →  busca por card específico
```

> ⚠️ O campo `cardSnapshot` **nunca é retornado ao frontend** (projeção `{ cardSnapshot: 0 }` em todos os `find`). Ele é armazenado exclusivamente para fornecer contexto ao Gemini na futura rota `/summarize` (Objetivo 3.1).

---

##### `aa_ai_summaries`

Resumos gerados pelo Gemini Flash. Sem TTL — persistem indefinidamente.

```
Campo      Tipo     Obrigatório  Descrição
─────────  ──────   ──────────── ──────────────────────────────
userId     string   ✅           ID do usuário
ticker     string   ⚠️           Símbolo do ativo relacionado
content    string   ✅           Resumo em Markdown gerado pelo Gemini
model      string   auto         Modelo usado (padrão: gemini-2.0-flash)
timestamp  Date     auto         Data/hora de geração
```

**Índice:**
```
{ userId: 1, timestamp: -1 }  →  listagem ordenada
```

---

##### `aa_index_cache` — TTL 12 horas

Cache dos módulos fundamentalistas da Brapi, evitando chamadas redundantes para dados que mudam poucas vezes por dia.

```
Campo      Tipo     Descrição
─────────  ──────   ──────────────────────────────────────────────
ticker     string   Símbolo uppercase (ex.: "PETR4")
modules    string   Módulos solicitados (ex.: "defaultKeyStatistics,financialData")
data       object   Objeto JSON retornado pela Brapi
createdAt  Date     Campo TTL — expiração automática após 12h
```

**Índices:**
```
{ ticker: 1, modules: 1 }  →  unique (chave de cache)
{ createdAt: 1 }           →  TTL expireAfterSeconds: 43200 (12h)
```

A combinação `ticker + modules` como chave garante que diferentes conjuntos de módulos para o mesmo ticker sejam cachados separadamente.

---

##### `aa_benchmark_cache` — TTL 90 dias

Cache do benchmark setorial gerado pela pipeline Tavily → Gemini. O TTL longo reflete que benchmarks setoriais mudam muito lentamente.

```
Campo           Tipo     Descrição
──────────────  ──────   ──────────────────────────────────────────────
ticker          string   Símbolo do ativo (contexto da busca)
indexKey        string   Chave do índice (ex.: "ROE", "P/L", "EV/EBITDA")
sector          string   Setor da empresa no momento da geração
benchmarkValue  number   Valor numérico do benchmark
unit            string   Unidade (ex.: "%", "x")
source          string   Pipeline utilizada (padrão: "tavily+gemini")
createdAt       Date     Campo TTL — expiração após 90 dias
```

**Índices:**
```
{ ticker: 1, indexKey: 1 }  →  unique (chave de cache)
{ createdAt: 1 }            →  TTL expireAfterSeconds: 7776000 (90 dias)
```

---

##### `aa_dossie_cache` — TTL 7 dias

Cache do dossiê completo em Markdown por ticker.

```
Campo      Tipo     Descrição
─────────  ──────   ──────────────────────────────────────────
ticker     string   Símbolo uppercase
content    string   Dossiê em Markdown gerado por Tavily+Gemini
createdAt  Date     Campo TTL — expiração após 7 dias
```

**Índices:**
```
{ ticker: 1 }     →  unique
{ createdAt: 1 }  →  TTL expireAfterSeconds: 604800 (7 dias)
```

---

#### Função `ensureIndexes(db)`

```js
async function ensureIndexes(db) {
  // aa_user_searches
  await db.collection(COLS.userSearches).createIndex(
    { userId: 1 }, { unique: true, name: 'idx_aa_user_searches_userId' }
  );
  // aa_annotations
  await db.collection(COLS.annotations).createIndex(
    { userId: 1, timestamp: -1 }, { name: 'idx_aa_annotations_user_ts' }
  );
  // ...todos os índices TTL...
}
```

**Características importantes:**
- **Idempotente:** chamada a `createIndex` em um índice já existente não gera erro.
- **Chamada única:** protegida pela flag `_indexesEnsured` no router — executa apenas na primeira conexão do servidor.
- **Falha silenciosa:** erros são apenas logados; o servidor continua funcionando mesmo se a criação de um índice falhar.

---

### 3.3 Tarefa 1.3.3 — Config de Ambiente

**Arquivo criado:** `server/src/config/analise-ativos.config.js`

Centraliza todas as constantes desta página em um único ponto de configuração.

#### Estrutura

```js
const config = {
  brapi:   { token: process.env.BRAPI_API_KEY, baseUrl: 'https://brapi.dev/api' },
  gemini:  { apiKey: process.env.GEMINI_API_KEY, model: 'gemini-2.0-flash' },
  tavily:  { apiKey: process.env.TAVILY_API_KEY, searchDepth: 'advanced' },

  ttl: {
    quote:     1800,       // 30 min  — cotação e histórico intraday
    indices:   43200,      // 12h     — módulos fundamentalistas
    dossie:    604800,     // 7 dias  — dossiê por ticker
    benchmark: 7776000,    // 90 dias — benchmark setorial
  },

  brapiModules: { /* mapeamento legível → nome do módulo Brapi */ },
  chartRanges:  [ /* { label, range, interval } */ ],

  collections: {
    userSearches:   'aa_user_searches',
    annotations:    'aa_annotations',
    aiSummaries:    'aa_ai_summaries',
    indexCache:     'aa_index_cache',
    benchmarkCache: 'aa_benchmark_cache',
    dossieCache:    'aa_dossie_cache',
  },
};
```

#### Por que separar do `config/index.js`?

O arquivo `config/index.js` é carregado por **todos** os módulos do servidor. Adicionar as constantes desta página criaria acoplamento desnecessário para módulos que não têm relação com `analise_ativos`. A separação garante que:
1. Apenas os módulos de `analise-ativos` precisam de `require('../../config/analise-ativos.config')`.
2. As fases futuras podem adicionar constantes sem risco de conflito.
3. O arquivo está pronto para receber TTLs adicionais das fases 2 e 3.

#### Variáveis de ambiente necessárias

As seguintes variáveis devem estar configuradas no `.env` do servidor:

| Variável | Uso | Obrigatoriedade |
|---|---|---|
| `BRAPI_API_KEY` ou `BRAPI_TOKEN` | Autenticação na API Brapi | ✅ Fases 2 e 3 |
| `GEMINI_API_KEY` | Acesso à API do Google Gemini | ✅ Fase 3 |
| `TAVILY_API_KEY` | Acesso à API da Tavily | ✅ Fase 3 |

> As variáveis `MONGODB_URI`, `MONGODB_DB_NAME` e `JWT_SECRET` já existem no `.env` e são herdadas do `config/index.js`.

---

## 4. Referência de Endpoints

Todos os endpoints requerem `Authorization: Bearer <token>` no header.

### Última Pesquisa

#### `GET /api/analise-ativos/last-search/:userId`

Retorna o último ticker pesquisado pelo usuário.

**Parâmetros de rota:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `userId` | `string` | ID MongoDB do usuário (deve coincidir com o token) |

**Respostas:**

| Status | Body | Descrição |
|---|---|---|
| `200` | `{ userId, ticker, timestamp }` | Última pesquisa encontrada |
| `401` | `{ error }` | Token ausente ou inválido |
| `403` | `{ error }` | userId do token ≠ userId da rota |
| `404` | `{ error }` | Nenhuma pesquisa salva para este usuário |

---

#### `POST /api/analise-ativos/last-search`

Salva ou atualiza a última pesquisa do usuário (upsert).

**Body:**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "ticker": "PETR4"
}
```

**Respostas:**

| Status | Body | Descrição |
|---|---|---|
| `200` | `{ success: true, ticker }` | Pesquisa salva com sucesso |
| `400` | `{ error, details }` | Campo obrigatório ausente |
| `401` | `{ error }` | Token ausente ou inválido |
| `403` | `{ error }` | userId do body ≠ userId do token |

---

### Anotações

#### `GET /api/analise-ativos/annotations/:userId`

Lista todas as anotações do usuário, da mais recente para a mais antiga.

**Parâmetros de rota:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `userId` | `string` | ID MongoDB do usuário |

**Query strings opcionais:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `ticker` | `string` | Filtra anotações de um ativo específico |

**Respostas:**

| Status | Body | Descrição |
|---|---|---|
| `200` | `{ annotations: [...] }` | Array de anotações (sem `cardSnapshot`) |
| `401` | `{ error }` | Token ausente ou inválido |
| `403` | `{ error }` | Acesso negado |

**Estrutura de cada anotação:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "userId": "...",
  "ticker": "PETR4",
  "cardId": "card-roe",
  "cardLabel": "ROE",
  "annotationText": "ROE acima da média do setor",
  "timestamp": "2026-02-21T10:30:00.000Z",
  "updatedAt": "2026-02-21T10:30:00.000Z"
}
```

> ⚠️ O campo `cardSnapshot` é armazenado no banco mas **nunca retornado** ao frontend.

---

#### `POST /api/analise-ativos/annotations`

Cria uma nova anotação.

**Body:**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "ticker": "PETR4",
  "cardId": "card-roe",
  "cardLabel": "ROE",
  "annotationText": "ROE de 28% — acima da média setorial de ~18%",
  "cardSnapshot": {
    "value": 28.4,
    "unit": "%",
    "yoy": "+3.2pp",
    "period": "3T25"
  }
}
```

**Respostas:**

| Status | Body | Descrição |
|---|---|---|
| `201` | `{ success: true, annotationId }` | Anotação criada |
| `400` | `{ error, details }` | Campos obrigatórios ausentes |
| `401` | `{ error }` | Token ausente ou inválido |
| `403` | `{ error }` | Acesso negado |

---

#### `DELETE /api/analise-ativos/annotations/:id`

Exclui uma anotação pelo seu `_id` MongoDB.

**Parâmetros de rota:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `id` | `string` | ObjectId da anotação |

**Respostas:**

| Status | Body | Descrição |
|---|---|---|
| `200` | `{ success: true }` | Anotação excluída |
| `400` | `{ error }` | ID inválido (não é ObjectId válido) |
| `401` | `{ error }` | Token ausente ou inválido |
| `404` | `{ error }` | Anotação não encontrada ou sem permissão |

---

### Resumos IA

#### `GET /api/analise-ativos/summaries/:userId`

Lista todos os resumos gerados por IA, do mais recente ao mais antigo.

**Parâmetros de rota:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `userId` | `string` | ID MongoDB do usuário |

**Respostas:**

| Status | Body | Descrição |
|---|---|---|
| `200` | `{ summaries: [...] }` | Array de resumos |

**Estrutura de cada resumo:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "userId": "...",
  "ticker": "PETR4",
  "content": "## Análise das Anotações\n\n### ROE...",
  "model": "gemini-2.0-flash",
  "timestamp": "2026-02-21T10:30:00.000Z"
}
```

---

#### `DELETE /api/analise-ativos/summaries/:id`

Exclui um resumo pelo seu `_id` MongoDB.

**Parâmetros de rota:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `id` | `string` | ObjectId do resumo |

**Respostas:**

| Status | Body | Descrição |
|---|---|---|
| `200` | `{ success: true }` | Resumo excluído |
| `400` | `{ error }` | ID inválido |
| `401` | `{ error }` | Token ausente ou inválido |
| `404` | `{ error }` | Resumo não encontrado ou sem permissão |

---

## 5. Referência de Collections MongoDB

### Visão consolidada

| Collection | TTL | Índice Único | Descrição |
|---|---|---|---|
| `aa_user_searches` | ∞ | `userId` | Última pesquisa por usuário |
| `aa_annotations` | ∞ | nenhum | Anotações por card |
| `aa_ai_summaries` | ∞ | nenhum | Resumos gerados pelo Gemini |
| `aa_index_cache` | 12h | `ticker + modules` | Cache de índices Brapi |
| `aa_benchmark_cache` | 90 dias | `ticker + indexKey` | Cache benchmark setorial |
| `aa_dossie_cache` | 7 dias | `ticker` | Cache do dossiê |

### Mecanismo de TTL

O MongoDB possui um processo daemon chamado **TTL Monitor** que executa a cada 60 segundos verificando documentos expirados. Um documento é elegível para exclusão quando:

```
NOW()  >  doc.createdAt  +  expireAfterSeconds
```

Isso significa que a granularidade de expiração é de **±60 segundos** em relação ao TTL configurado — comportamento esperado e documentado pelo MongoDB.

---

## 6. Fluxo de Dados Completo

### Carregamento inicial da página

```
Browser                     analise-ativos.js              Backend
───────                     ─────────────────              ───────
DOMContentLoaded
    │
    ├── authGuard()
    │      ├── yield_token? ─── NÃO → redirect /login.html
    │      └── SIM → continua
    │
    ├── loadLastSearch()
    │      └── GET /api/analise-ativos/last-search/:userId
    │                │
    │                └── 200 { ticker: "PETR4" }
    │                        │
    │                        └── searchInput.value = "PETR4"
    │                            searchInput.dispatchEvent("input")
    │                                │
    │                                └── [Fase 2] carrega dados do ativo
    │
    └── [outros módulos inicializam]
```

### Criação de anotação

```
Usuário clica "Salvar anotação"
    │
    ├── analise-ativos.workspace.js coleta:
    │      { userId, cardId, cardLabel, annotationText, cardSnapshot }
    │
    ├── POST /api/analise-ativos/annotations
    │      │
    │      ├── verifyToken → decodifica JWT → req.user
    │      ├── validators.annotation() → normaliza/valida
    │      ├── userId do body == req.user.userId? SIM
    │      └── insertOne(doc) → MongoDB aa_annotations
    │
    └── Frontend exibe confirmação: "Anotação salva"
        (sem exibir cardSnapshot ao usuário)
```

---

## 7. Segurança

### Autenticação

Todos os endpoints do router `analise-ativos` são protegidos pelo middleware `verifyToken`. O token JWT usa a mesma chave secreta (`JWT_SECRET`) do restante do sistema, com expiração de 7 dias (configurado em `config/index.js`).

### Autorização por ownership

Dois mecanismos de proteção contra IDOR:

1. **`ownUserOnly`** — aplicado nas rotas `GET /:userId`. Compara `req.params.userId` com `req.user.userId` do token.

2. **Query-level check** — nas operações `DELETE`, o `userId` do token é incluído na query do MongoDB. Mesmo que um atacante forneça um `_id` válido de outro usuário, a query não encontrará o documento (`deletedCount === 0`).

### Validação de input

Cada tipo de documento possui uma função `validate*()` dedicada que:
- Verifica tipos (`typeof`)
- Rejeita valores nulos/undefined
- Normaliza strings (trim, uppercase para tickers)
- Nunca lança exceção — retorna `{ valid, errors, doc }`

### Exposição de dados sensíveis

O campo `cardSnapshot` das anotações é armazenado no banco mas nunca retornado ao frontend (projeção `{ cardSnapshot: 0 }`). Isso evita que dados financeiros históricos vazem pela API de listagem.

---

## 8. Arquivos Criados / Modificados

### Criados

| Arquivo | Tamanho | Descrição |
|---|---|---|
| `server/src/api/routes/analise-ativos.js` | ~290 linhas | Router Express com 7 endpoints |
| `server/src/tools/analise-ativos/schemas.js` | ~250 linhas | Validators e `ensureIndexes()` |
| `server/src/config/analise-ativos.config.js` | ~70 linhas | Constantes de ambiente |

### Modificados

| Arquivo | Modificação |
|---|---|
| `client/js/analise-ativos.js` | Auth guard + constantes globais + `saveLastSearch` + `loadLastSearch` adicionados no topo |
| `server/src/api/server.js` | Import e registro do `createAnaliseAtivosRouter` em `/api/analise-ativos` |

---

## Próximos Objetivos

Este documento registra apenas os Objetivos 1.2 e 1.3. Os objetivos seguintes serão documentados neste arquivo conforme forem implementados:

| Objetivo | Descrição | Status |
|---|---|---|
| **1.1** | Separação HTML, CSS e JS | ✅ Concluído (anterior) |
| **1.2** | Autenticação e sessão por usuário | ✅ Concluído |
| **1.3** | Backend: rotas e collections MongoDB | ✅ Concluído |
| **2.1** | Integração com a API Brapi | ✅ Concluído |
| **2.2** | Gráficos com Chart.js | ✅ Concluído |
| **2.3** | Balanço Patrimonial dinâmico | ✅ Concluído |
| **3.1** | Workspace: anotações, resumo e histórico | ✅ Concluído |
| **3.2** | Benchmark Setorial (Tavily + GPT-5-mini) | ✅ Concluído |
| **3.3** | Dossiê e Dados Não Disponíveis | ✅ Concluído |

---

## 9. Fase 2 — Dados Dinâmicos Core (Brapi + Gráficos + Índices)

### 9.1 Visão de Arquitetura

A Fase 2 foi implementada com separação explícita entre:

- **Camada de acesso externo**: `server/src/tools/analise-ativos/brapi.service.js`
- **Camada de domínio de índices**: `server/src/tools/analise-ativos/indices.engine.js`
- **Camada HTTP**: novas rotas em `server/src/api/routes/analise-ativos.js`
- **Camada de apresentação**: módulos cliente `analise-ativos.search.js`, `analise-ativos.indices.js`, `analise-ativos.charts.js`, `analise-ativos.balanco.js`

Fluxo principal:

```
Frontend
  └─ GET /api/analise-ativos/core/:ticker
      ├─ BrapiService.fetchQuote(...modules fundamentalistas + range=max + interval=1mo...)
      │   ├─ verifica aa_index_cache
      │   ├─ chama Brapi se cache expirado (uma única chamada retorna módulos + preço histórico)
      │   └─ retorna data + historicalDataPrice
      └─ indices.engine.buildIndicesPayload(raw, historicalPrices)
        ├─ calcula índices universais/dinâmicos
        ├─ classifica segmento
        ├─ define hiddenMetrics e unavailable
        ├─ prepara séries de Rentabilidade/Resultado/Endividamento via financialDataHistoryQuarterly
        └─ prepara séries de Valuation (PL, PVP, EVEBITDA, DY, EV, PSR) cruzando
           preço histórico mensal com dados fundamentalistas trimestrais
```

### 9.2 Serviços Criados

#### `brapi.service.js`

Responsabilidades:

- Normalizar ticker
- Construir chave de cache por tipo de consulta
- Ler/gravar `aa_index_cache`
- Aplicar TTL lógico:
  - **12h** para módulos fundamentalistas
  - **30min** para cotação/histórico/search
- Chamar `https://brapi.dev/api/*` usando token via `process.env`
- Tratar falhas de API externa com status consistente

Decisões técnicas:

- Cache físico usa `aa_index_cache` (TTL Mongo 12h) + **invalidação lógica por tipo** para suportar 30min sem criar coleção adicional.
- Busca (`/quote/list`) também reutiliza cache para reduzir latência no autocomplete.

#### `indices.engine.js`

Responsabilidades:

- Classificar segmento por `summaryProfile.sector/industry`
- Calcular índices da tela por chave (`PL`, `PVP`, `EVEBITDA`, `DY`, `EV`, `PSR`, `ROE`, `ROIC`, `ROA`, `MEBITDA`, `ML`, `RL`, `LB`, `EBITDA`, `LL`, `CREC`, `CLL`, `LPA`, `PAYOUT`, `DB`, `DL`, `ALAV`, `DPL`)
- Calcular YoY com base trimestral (`current` vs mesmo tri do ano anterior quando disponível)
- Definir `hiddenMetrics` por segmento (ex.: bancos/seguros)
- Definir lista dinâmica de “Dados não disponíveis” por segmento
- Montar séries anuais/trimestrais usadas nos gráficos
- **Montar séries históricas de Valuation** cruzando preço histórico mensal com dados fundamentalistas trimestrais

Decisões técnicas:

- **DY**: calculado por soma de dividendos dos últimos 12 meses ÷ preço atual.
- **Payout**: proxy por dividendos 12m ÷ LPA.
- **Alavancagem**: `(Dívida Líquida / EBITDA)` com fallback robusto para campos ausentes.
- Sem mock: quando não existe dado suficiente, retorna `null` para frontend renderizar fallback visual.
- **Valuation Series**: os múltiplos PL, PVP, EVEBITDA, DY, EV e PSR são calculados por trimestre cruzando o preço mensal mais próximo (tolerância de 45 dias) com os dados de `financialDataHistoryQuarterly` e `balanceSheetHistoryQuarterly`. Isso resolve a limitação anterior onde esses gráficos exibiam apenas um ponto (o valor corrente) por falta de dados históricos de preço.

  | Métrica | Cálculo por trimestre |
  |---|---|
  | **PL** | `(price × sharesOutstanding) / (totalRevenue × profitMargins)` |
  | **PVP** | `(price × sharesOutstanding) / shareholdersEquity` |
  | **EV/EBITDA** | `(price × sharesOutstanding + totalDebt - totalCash) / ebitda` |
  | **DY** | `(soma dividendos 12m / price) × 100` |
  | **EV** | `price × sharesOutstanding + totalDebt - totalCash` |
  | **PSR** | `(price × sharesOutstanding) / totalRevenue` |

- **`findClosestPrice(historicalPrices, targetDate)`**: função auxiliar que encontra o preço de fechamento mensal mais próximo de uma data-alvo, com tolerância máxima de 45 dias.

### 9.3 Endpoints da Fase 2

Adicionados em `server/src/api/routes/analise-ativos.js` (todos com JWT):

| Endpoint | Finalidade | Cache |
|---|---|---|
| `GET /api/analise-ativos/search?query=...` | Autocomplete de ativos | 30min |
| `GET /api/analise-ativos/core/:ticker` | Header + índices + séries + segmento (inclui preço histórico mensal para Valuation) | 12h |
| `GET /api/analise-ativos/history/:ticker?range=&interval=` | Histórico para gráfico | 30min |
| `GET /api/analise-ativos/balance/:ticker` | BP trimestral/anual | 12h |

Tratamento de erro:

- Ticker inválido → `400`
- Ticker inexistente → `404`
- Falha externa Brapi → `502`
- Sem `500` nos cenários esperados de entrada inválida

### 9.4 Frontend — Módulos Atualizados

#### `analise-ativos.search.js`

- Remove base local mockada
- Implementa autocomplete real (`/search`)
- Carrega ticker principal via `/core/:ticker`
- Atualiza `asset-hd` dinamicamente (nome, setor, preço, variação, timestamp)
- Persiste última pesquisa (Fase 1 preservada)
- Implementa compare mode real com segundo ticker via `/core/:ticker`

#### `analise-ativos.indices.js`

- Renderiza cards por `data-key` com payload dinâmico
- Aplica classe visual (`pos/neg/neu`) por tipo/valor
- Atualiza subtexto YoY por card
- Exibe comparação ativa no bloco `mval-compare`
- Esconde métricas por segmento (`hiddenMetrics`)
- Reconstrói seção “Dados não disponíveis” por segmento

#### `analise-ativos.charts.js`

- Remove datasets mockados
- Busca histórico real em `/history/:ticker`
- Renderiza:
  - Valor de Mercado (estimado a partir do histórico de preço e market cap atual)
  - Receita Líquida (séries anuais/trimestrais)
  - Caixa (EBITDA)
- Implementa filtros de período e ano
- Implementa comparação em duas linhas (ativo principal vs comparado)
- Mantém API global de botões (`setMktcapFilter`, `setReceitaPeriod`, etc.)

#### `analise-ativos.balanco.js`

- Remove token e ticker hardcoded
- Usa `GET /api/analise-ativos/balance/:ticker`
- Respeita modo Trimestral/Anual
- Esconde linhas cujo valor é nulo/zero em todos os períodos visíveis
- Recarrega automaticamente ao trocar ticker

### 9.5 Estratégia de Cache

#### Nível banco (TTL MongoDB)

- `aa_index_cache` com índice TTL em `createdAt`

#### Nível aplicação (frescor lógico)

- Fundamentalistas + preço histórico mensal (core): validação de frescor `<= 12h`
- Histórico/cotação/autocomplete: validação de frescor `<= 30min`

> **Nota:** O endpoint `/core/:ticker` agora inclui `range=max&interval=1mo` na chamada Brapi, retornando módulos fundamentalistas e preço histórico mensal numa única requisição. A chave de cache é distinta da chamada sem range/interval, mas ambos se beneficiam do mesmo TTL de 12h.

Isso permite:

- Reuso da mesma coleção
- Baixa latência de UI
- Menor custo de chamadas externas
- Expiração automática de documentos antigos

### 9.6 Testes de Rotas — Evidência

Validações realizadas em terminal com JWT real:

1. **Cotação + módulos fundamentalistas** (`/core/PETR4`)  
  - Primeira chamada: `cacheHit=false`  
  - Segunda chamada: `cacheHit=true`

2. **Histórico por ranges distintos** (`/history/PETR4`)  
  - `1mo/1d` retornou série com pontos  
  - `1y/1wk` retornou série com cardinalidade diferente

3. **Cache de histórico**  
  - Segunda chamada do mesmo range retornou `cacheHit=true`

4. **Ticker inválido** (`/core/XXXX99`)  
  - Retorno `404`, sem `500`

5. **Múltiplos tickers** (`PETR4`, `VALE3`, `ITUB4`)  
  - Todos com `200` e payload completo

6. **Sem erro 500 nas rotas da fase**  
  - `search`, `core`, `history`, `balance` testadas com status `200` (ou `404` esperado para inválido)

### 9.7 Arquivos Criados / Modificados na Fase 2

#### Criados

| Arquivo | Descrição |
|---|---|
| `server/src/tools/analise-ativos/brapi.service.js` | Integração Brapi + cache + tratamento de erro |
| `server/src/tools/analise-ativos/indices.engine.js` | Cálculo de índices, segmento e séries |

#### Modificados

| Arquivo | Mudança principal |
|---|---|
| `server/src/api/routes/analise-ativos.js` | Novos endpoints `search/core/history/balance` |
| `client/js/analise-ativos.js` | Estado global `AA`, formatação e restore de ticker |
| `client/js/analise-ativos.search.js` | Busca/troca de ticker/comparação dinâmicas |
| `client/js/analise-ativos.indices.js` | Render dinâmico de índices + YoY + indisponíveis |
| `client/js/analise-ativos.charts.js` | Gráficos dinâmicos + filtros + comparação |
| `client/js/analise-ativos.balanco.js` | BP dinâmico por ticker |

---

## 10. Fase 3 — IA, Workspace e Benchmark Setorial

### 10.1 Visão de Arquitetura

A Fase 3 foi implementada em três trilhas integradas:

1. **Workspace por usuário** (anotações persistentes, resumo IA e histórico)
2. **Benchmark setorial** (Tavily + GPT-5-mini com cache de 90 dias)
3. **Dossiê corporativo** (Tavily + GPT-5-mini com cache de 7 dias)

Fluxo simplificado:

```
Frontend (workspace/índices/dossiê)
  ├─ POST /annotations
  ├─ POST /summarize
  ├─ GET  /summaries/:userId
  ├─ GET  /benchmark/:ticker/:indexKey
  └─ POST /dossie

Backend (routes/analise-ativos.js)
  ├─ OpenAIService      → geração de resumo, benchmark e dossiê
  ├─ BenchmarkService   → busca Tavily + cache aa_benchmark_cache
  └─ TavilyService      → pipeline por tópico + cache aa_dossie_cache
```

### 10.2 Objetivo 3.1 — Workspace: anotações, resumo e histórico

#### 10.2.1 Anotações por card com snapshot

- O módulo `client/js/analise-ativos.workspace.js` saiu de modo mock e passou a usar API real.
- Cada anotação salva:
  - `userId`
  - `ticker`
  - `cardId`
  - `cardLabel`
  - `annotationText`
  - `cardSnapshot` (valor, tendência, YoY e timestamp do card)
- Após salvar, o frontend exibe: **"Os dados do card no momento da anotação foram salvos."**
- Exclusão implementada via `DELETE /api/analise-ativos/annotations/:id`.

#### 10.2.2 Resumo de anotações via GPT-5-mini

- Criada rota `POST /api/analise-ativos/summarize`.
- Backend coleta as anotações do usuário, envia cada item ao modelo com contexto de snapshot e gera resumo analítico em Markdown.
- O resumo é persistido em `aa_ai_summaries` com `model: gpt-5-mini`.

#### 10.2.3 Histórico de resumos com exclusão

- Aba “Histórico” no workspace passa a carregar `GET /api/analise-ativos/summaries/:userId`.
- Exclusão via `DELETE /api/analise-ativos/summaries/:id` implementada no frontend e backend.

### 10.3 Objetivo 3.2 — Benchmark Setorial

#### 10.3.1 Serviço de benchmark

- Novo arquivo: `server/src/tools/analise-ativos/benchmark.service.js`.
- Estratégia:
  1. Consulta cache `aa_benchmark_cache` por `{ ticker, indexKey }`
  2. Em cache miss, executa Tavily (`searchDepth: advanced`)
  3. Consolida com GPT-5-mini (resposta estruturada)
  4. Persiste benchmark no cache

#### 10.3.2 Exibição no frontend

- `client/js/analise-ativos.indices.js` agora busca benchmark por card visível.
- Loader textual: “Benchmark setorial: carregando...”.
- Resultado exibido abaixo do indicador principal.

### 10.4 Objetivo 3.3 — Dossiê

#### 10.4.1 Pipeline de dossiê via Tavily + GPT-5-mini

- Novo arquivo: `server/src/tools/analise-ativos/tavily.service.js`.
- Busca por tópicos:
  - Governança
  - Estrutura Societária
  - Remuneração de Diretores
  - Riscos Regulatórios
  - Processos Judiciais Relevantes
- Consolidação final em Markdown via GPT-5-mini.
- Cache em `aa_dossie_cache` com TTL de 7 dias.

#### 10.4.2 Frontend do dossiê

- `client/js/analise-ativos.js` passou a carregar dossiê dinâmico ao abrir “Ver Dossiê”.
- A seção renderiza o conteúdo retornado pelo backend e informa data/fonte.

### 10.5 Correções de Configuração (Gemini → OpenAI)

Foram aplicadas correções para garantir compatibilidade com a migração feita manualmente:

- `server/src/config/analise-ativos.config.js`
  - `openai.apiKey` agora aceita fallback: `OPENAI_API_KEY || GEMINE_API_KEY || GEMINI_API_KEY`
- `server/src/tools/analise-ativos/schemas.js`
  - `validateAiSummary` passou a usar `aaConfig.openai.model` (antes referenciava chave antiga)

### 10.6 Endpoints da Fase 3

| Endpoint | Finalidade |
|---|---|
| `POST /api/analise-ativos/summarize` | Gerar resumo das anotações do usuário |
| `GET /api/analise-ativos/benchmark/:ticker/:indexKey` | Retornar benchmark setorial por indicador |
| `POST /api/analise-ativos/dossie` | Gerar/retornar dossiê consolidado por ticker |

### 10.7 Evidências de Teste (Terminal)

Validações executadas após implementação:

1. **Testes backend**
   - `npm test` em `server/`
   - Resultado: **21/21 testes passando**

2. **Smoke test do router**
   - Carregamento de `createAnaliseAtivosRouter()` sem erro
   - Rotas registradas corretamente

3. **Validação de ambiente**
   - Leitura de chave OpenAI com fallback (`OPENAI_API_KEY`, `GEMINE_API_KEY`, `GEMINI_API_KEY`)
   - Leitura de `TAVILY_API_KEY` confirmada

### 10.8 Arquivos Criados / Modificados na Fase 3

#### Criados

| Arquivo | Descrição |
|---|---|
| `server/src/tools/analise-ativos/openai.service.js` | Camada de integração GPT-5-mini (resumo, benchmark, dossiê) |
| `server/src/tools/analise-ativos/benchmark.service.js` | Pipeline de benchmark setorial com cache |
| `server/src/tools/analise-ativos/tavily.service.js` | Pipeline de dossiê por tópicos com cache |

#### Modificados

| Arquivo | Mudança principal |
|---|---|
| `server/src/api/routes/analise-ativos.js` | Novas rotas `/summarize`, `/benchmark`, `/dossie` |
| `server/src/config/analise-ativos.config.js` | Config OpenAI + fallback de variáveis de ambiente |
| `server/src/tools/analise-ativos/schemas.js` | Ajuste do modelo padrão em `aa_ai_summaries` |
| `client/js/analise-ativos.workspace.js` | Workspace real com persistência, resumo e histórico |
| `client/js/analise-ativos.indices.js` | Exibição de benchmark setorial por card |
| `client/js/analise-ativos.js` | Dossiê dinâmico via backend |
| `client/js/analise-ativos.charts.js` | Refresh do workspace no ciclo de render global |

