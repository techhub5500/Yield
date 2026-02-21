# Plano de Implementação — `analise_ativos.html` em Produção

> **Arquivo-alvo:** `client/html/analise_ativos.html`
> **Data:** 2026-02-20
> **Objetivo:** Evoluir o layout estático para uma página totalmente funcional em produção, integrada ao backend, banco de dados, APIs externas e sistema de login.

---

## Visão Geral da Arquitetura

```
client/
  css/    analise-ativos.css
  js/
    analise-ativos.js           ← orquestrador principal
    analise-ativos.search.js    ← barra de pesquisa + modo comparar
    analise-ativos.charts.js    ← gráficos (Chart.js)
    analise-ativos.indices.js   ← lógica de índices por segmento
    analise-ativos.workspace.js ← anotações, resumo, histórico
    analise-ativos.balanco.js   ← balanço patrimonial

server/src/
  api/routes/
    analise-ativos.js        ← rotas Express para esta página
  tools/analise-ativos/
    brapi.service.js         ← chamadas à Brapi + cache
    gemini.service.js        ← chamadas ao Gemini Flash
    tavily.service.js        ← chamadas à Tavily
    indices.engine.js        ← filtro por segmento + cálculos derivados
    benchmark.service.js     ← benchmark setorial (Tavily + Gemini, cache 3 meses)
  config/
    analise-ativos.config.js ← constantes de cache, TTLs, tokens

MongoDB collections (novas):
  aa_user_searches     ← última pesquisa por usuário
  aa_annotations       ← anotações + snapshot do card
  aa_ai_summaries      ← resumos gerados pela IA
  aa_index_cache       ← cache de índices (TTL 12h)
  aa_benchmark_cache   ← cache de benchmark setorial (TTL 3 meses)
  aa_dossie_cache      ← cache do dossiê (por ticker, TTL 7 dias)
```

**Princípio:** cada arquivo novo fica encapsulado em seus próprios diretórios (`tools/analise-ativos/` e `routes/analise-ativos.js`) para não contaminar as funcionalidades existentes.

---

## Fase 1 — Separação de Arquivos e Infraestrutura Base

### Objetivo 1.1 — Separar HTML, CSS e JS

**Tarefa 1.1.1 — Extrair CSS**
Mover todo o bloco `<style>` inline de `analise_ativos.html` para `client/css/analise-ativos.css`. Substituir o bloco pela tag `<link rel="stylesheet" href="../css/analise-ativos.css">`. Nenhuma regra deve ser alterada; apenas a separação física.

**Tarefa 1.1.2 — Extrair e modularizar o JavaScript**
Mover todo o bloco `<script>` inline para os seis arquivos JS listados na arquitetura acima. Cada arquivo é responsável por uma área funcional. O `analise-ativos.js` importa os demais com `<script type="module">` ou concatenação via `import`. Adicionar as tags `<script>` no final do `<body>` do HTML.

**Tarefa 1.1.3 — Limpar o HTML e preparar data-attributes**
Revisar `analise_ativos.html` para garantir que todos os elementos dinâmicos possuam `data-*` ou `id` adequados (ex.: `data-ticker`, `data-segment`, `data-chart-type`). Remover strings hardcoded de PETR4 do HTML — substituir por placeholders como `data-placeholder="ticker"` que o JS vai preencher.

---

### Objetivo 1.2 — Autenticação e sessão por usuário

**Tarefa 1.2.1 — Guard de autenticação**
No topo de `analise-ativos.js`, ler `localStorage.getItem('yield_token')` e `JSON.parse(localStorage.getItem('yield_user'))`, seguindo o padrão de `client/js/login.js`. Se o token não existir, redirecionar para `login.html`. Exportar `userId` e `authHeaders` como constantes reutilizáveis por todos os módulos.

**Tarefa 1.2.2 — Persistência da última pesquisa por usuário**
Ao confirmar a seleção de um ticker na barra de pesquisa, salvar `{ userId, ticker, timestamp }` na collection `aa_user_searches` via `POST /api/analise-ativos/last-search`. Ao carregar a página, fazer `GET /api/analise-ativos/last-search/:userId` e carregar o ticker salvo automaticamente, evitando que a página fique vazia.

---

### Objetivo 1.3 — Backend: rotas e collections MongoDB

**Tarefa 1.3.1 — Criar o router Express**
Criar `server/src/api/routes/analise-ativos.js` com os endpoints base:
- `GET /api/analise-ativos/last-search/:userId`
- `POST /api/analise-ativos/last-search`
- `GET /api/analise-ativos/annotations/:userId`
- `POST /api/analise-ativos/annotations`
- `DELETE /api/analise-ativos/annotations/:id`
- `GET /api/analise-ativos/summaries/:userId`
- `DELETE /api/analise-ativos/summaries/:id`

Registrar o router em `server/src/api/server.js` com `app.use('/api/analise-ativos', require('./routes/analise-ativos'))`.

**Tarefa 1.3.2 — Definir schemas MongoDB e criar indices TTL**
Criar `server/src/tools/analise-ativos/` com schemas Mongoose para as cinco collections novas. Configurar TTL index em `aa_index_cache` (12h), `aa_benchmark_cache` (90 dias) e `aa_dossie_cache` (7 dias) diretamente no schema, para que a expiração seja automática e não exija cron.

**Tarefa 1.3.3 — `analise-ativos.config.js` com constantes de ambiente**
Centralizar em `server/src/config/analise-ativos.config.js`: token da Brapi (`BRAPI_TOKEN`), chave do Gemini (`GEMINI_API_KEY`), chave da Tavily (`TAVILY_API_KEY`), TTLs numéricos e a lista de módulos Brapi usados por esta página. Consumir via `process.env` para não vazar tokens no código.

---

## Fase 2 — Dados Dinâmicos Core (Brapi + Gráficos + Índices)

### Objetivo 2.1 — Integração com a API Brapi

**Tarefa 2.1.1 — `brapi.service.js`: camada de acesso à Brapi com cache**
Implementar `fetchQuote(ticker, modules)` que constrói a URL `https://brapi.dev/api/quote/{ticker}?modules={modules}&token={BRAPI_TOKEN}`, cacheia a resposta em `aa_index_cache` por 12h para módulos fundamentalistas e por 30min para cotação e histórico. Na abertura da página, o cache é verificado primeiro; a chamada real só ocorre se expirado.

Módulos necessários por chamada:
- `defaultKeyStatistics` → P/L, P/VP, LPA, Market Cap, EV, PSR, EV/EBITDA
- `financialData` → ROE, Margem Líquida, Crescimento Receita/Lucro
- `incomeStatementHistoryQuarterly` + `balanceSheetHistoryQuarterly` → Balanço Patrimonial e índices calculáveis
- `dividends=true` → Dividend Yield calculado manualmente (soma `cashDividends` últimos 12m ÷ `regularMarketPrice`)
- `range` + `interval` → histórico para os gráficos

**Tarefa 2.1.2 — `indices.engine.js`: filtro por segmento e cálculos derivados**
Mapear o segmento da empresa com base em `summaryProfile.sector` retornado pela Brapi. Com base em `INDICES.md` e `MAPEAMENTO_INDICES_BRAPI.md`, implementar um objeto de configuração por segmento que define:
- Quais índices universais exibir (todos os 12, todos disponíveis ou calculáveis)
- Quais índices exclusivos do segmento exibir (somente os marcados ✅ ou ⚠️ calculável no mapeamento)
- Quais excluir (ex.: EBITDA para Bancos e Seguradoras; Índice de Basileia para todos exceto Bancos)
- Lógica de cálculo para os ⚠️ Calculáveis (ex.: Dividend Yield, Payout, ROAE, Giro de Estoque, Capital de Giro, CCC)

Índices com status ❌ Indisponível que sejam relevantes para o segmento devem ir para a seção **"Dados não disponíveis"** da página.

**Tarefa 2.1.3 — Dinamizar `asset-hd`, barra de pesquisa e tag de comparação YoY**
Conectar o `asset-hd` aos campos `regularMarketPrice`, `regularMarketChangePercent`, `longName`, `sector`, `industry` da Brapi. Implementar a barra de pesquisa do header usando `GET https://brapi.dev/api/quote/list?search={query}&token=TOKEN` e exibir resultados em dropdown. Para cada card de índice: buscar o valor do mesmo trimestre do ano anterior (`incomeStatementHistoryQuarterly[4]`), comparar com o atual, e atribuir classe CSS `tag-green` / `tag-red` / `tag-yellow`. Exibir data e hora da última atualização (timestamp do cache).

---

### Objetivo 2.2 — Gráficos com Chart.js

**Tarefa 2.2.1 — Implementar os três gráficos com filtros de tempo**
Em `analise-ativos.charts.js`, inicializar Chart.js para os três gráficos da página. Para cada gráfico, usar `GET /api/quote/{ticker}?range={range}&interval={interval}&token=TOKEN` com os valores de range/interval correspondentes ao filtro selecionado pelo usuário (1d/5d/1mo/3mo/6mo/1y/2y/5y). Mapear os cliques nos botões de filtro para disparar nova chamada (respeitando cache de 30min).

**Tarefa 2.2.2 — Modo comparação (duas linhas)**
Ao ativar o botão "Comparar", mostrar a segunda barra de pesquisa (mesma lógica da barra principal). Ao confirmar o segundo ticker, adicionar um segundo `dataset` em cada Chart.js com cor diferente (usar `--terra` do CSS). No modo comparação, o `indices.engine.js` deve processar os dois tickers em paralelo com `Promise.all`. Ao fechar o modo comparação, remover o segundo dataset e retornar ao estado padrão.

---

### Objetivo 2.3 — Balanço Patrimonial dinâmico

**Tarefa 2.3.1 — Conectar balanço aos módulos `balanceSheetHistory` e `incomeStatementHistory`**
Em `analise-ativos.balanco.js`, consumir os módulos `balanceSheetHistoryQuarterly` e `balanceSheetHistory` (anual) da Brapi. Mapear cada linha existente no HTML para seu campo correspondente na API. Respeitar os filtros de período já existentes (trimestral/anual). Para campos que retornam `null` ou `0` para o segmento atual, ocultar a linha inteira (remover do DOM), mantendo apenas as descrições que possuem valor real.

---

## Fase 3 — IA, Workspace e Benchmark Setorial

### Objetivo 3.1 — Workspace: anotações, resumo e histórico

**Tarefa 3.1.1 — Anotações por card com snapshot de dados**
Em `analise-ativos.workspace.js`, ao clicar no ícone de caneta de um card, abrir um `<textarea>` inline. Ao salvar, enviar `POST /api/analise-ativos/annotations` com `{ userId, cardId, cardLabel, annotationText, cardSnapshot: { ...dadosDoCardNoMomento }, timestamp }`. O `cardSnapshot` é armazenado no banco mas não exibido no frontend — exibir apenas a mensagem: *"Os dados do card no momento da anotação foram salvos."* Implementar botão de exclusão que dispara `DELETE /api/analise-ativos/annotations/:id`.

**Tarefa 3.1.2 — Resumir Anotações via Gemini Flash**
Ao clicar em "Resumir Anotações", coletar todas as anotações do usuário via `GET /api/analise-ativos/annotations/:userId`. No backend, criar rota `POST /api/analise-ativos/summarize` que usa `@google/genai` com modelo `gemini-3-flash-preview`. Cada anotação deve ser enviada como uma entrada separada no array `contents` do prompt (ex.: `{ role: 'user', parts: [{ text: 'Anotação sobre {{cardLabel}}:\n{{annotationText}}\n\nDados do card:\n{{JSON.stringify(cardSnapshot)}}' }] }`), seguida por uma instrução `{ role: 'user', parts: [{ text: 'Gere um resumo completo e analítico de todas as anotações acima, por tópico.' }] }`. Salvar o resumo gerado em `aa_ai_summaries` e retornar ao frontend.

**Tarefa 3.1.3 — Histórico de resumos com exclusão**
Na aba "Histórico" do Workspace, carregar resumos via `GET /api/analise-ativos/summaries/:userId` ordenados por `timestamp` decrescente. Exibir cada resumo com data de geração e botão de exclusão (`DELETE /api/analise-ativos/summaries/:id`). Os resumos persistem indefinidamente (sem TTL).

---

### Objetivo 3.2 — Benchmark Setorial (Tavily + Gemini, cache 3 meses)

**Tarefa 3.2.1 — `benchmark.service.js`: busca e geração do benchmark**
No backend, criar `server/src/tools/analise-ativos/benchmark.service.js`. Para cada índice que deve exibir benchmark setorial (conforme `MAPEAMENTO_INDICES_BRAPI.md`), verificar primeiro `aa_benchmark_cache` com chave `{ ticker, indexKey }`. Se não estiver em cache ou expirado (90 dias), usar `@tavily/core` com query como `"benchmark setorial {indexKey} setor {sector} Brasil 2025 2026"` — `searchDepth: 'advanced'`. Passar os resultados da Tavily como contexto para `gemini-3-flash-preview` com instrução: *"Com base nos dados abaixo, informe o benchmark médio do setor para o indicador {indexKey}. Retorne apenas o valor numérico e a unidade."* Salvar resultado em `aa_benchmark_cache`.

**Tarefa 3.2.2 — Exibir benchmarks nos cards de índices**
No frontend (`analise-ativos.indices.js`), após renderizar o valor do índice em cada card, fazer `GET /api/analise-ativos/benchmark/:ticker/:indexKey` para cada card que possui benchmark. Exibir o valor retornado abaixo do valor do índice, com label "Benchmark setorial". Se o serviço estiver processando (primeira execução), exibir um skeleton loader.

---

### Objetivo 3.3 — Dossiê e Dados Não Disponíveis

**Tarefa 3.3.1 — `tavily.service.js`: geração do dossiê via Tavily + Gemini**
Criar `server/src/tools/analise-ativos/tavily.service.js`. Ao clicar em "Ver Dossiê" no frontend, disparar `POST /api/analise-ativos/dossie` com `{ ticker }`. Verificar `aa_dossie_cache` (TTL 7 dias). Se expirado, usar `@tavily/core` com queries para cada dado do dossiê (governança, estrutura societária, histórico de remuneração de diretores, riscos regulatórios, processos judiciais relevantes). Usar `searchDepth: 'advanced'`. Consolidar as respostas da Tavily e enviar para `gemini-3-flash-preview` como contexto, solicitando um dossiê estruturado em Markdown. Salvar em `aa_dossie_cache` e retornar ao frontend.

**Tarefa 3.3.2 — Seção "Dados não disponíveis" por segmento**
Em `analise-ativos.indices.js`, após detectar o segmento da empresa, gerar dinamicamente a seção "Dados não disponíveis" com os índices marcados como ❌ Indisponível no `MAPEAMENTO_INDICES_BRAPI.md` que sejam relevantes para o segmento (ex.: para Bancos: Índice de Basileia, NIM, NPL, Índice de Cobertura, Eficiência Bancária, etc.; para Petróleo: EV/Reservas, Lifting Cost, Breakeven). Cada segmento terá sua própria lista estática configurada no `indices.engine.js`, garantindo que a seção reflita exatamente os dados que seriam úteis mas não estão disponíveis na API.

---

## Resumo por Fase

| Fase | Foco | Resultado Entregável |
|---|---|---|
| **1** | Separação + infraestrutura + auth | HTML/CSS/JS separados, rotas backend criadas, auth integrado, collections MongoDB definidas |
| **2** | Dados dinâmicos core | Asset header dinâmico, barra de pesquisa funcional, gráficos com filtros e modo comparação, índices por segmento com tags YoY, balanço patrimonial dinamizado |
| **3** | IA, workspace e benchmark | Anotações persistentes, resumo via Gemini, histórico, benchmark setorial via Tavily+Gemini, dossiê público, seção de dados indisponíveis por segmento |

---

## Referências Técnicas

| Recurso | Caminho |
|---|---|
| Documentação Brapi | `server/docs/md/API_BRAPI.MD` |
| Documentação Gemini | `server/docs/md/gemini.md` (modelo: `gemini-3-flash-preview`) |
| Documentação Tavily | `server/docs/md/API_travily.md` (pacote: `@tavily/core`) |
| Índices por segmento | `server/docs/md/INDICES.md` |
| Disponibilidade na API | `server/docs/md/MAPEAMENTO_INDICES_BRAPI.md` |
| Autenticação | `client/js/login.js` (token: `yield_token`, user: `yield_user`) |
| Padrão de arquitetura | `server/src/tools/finance-bridge/` |
