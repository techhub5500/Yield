# Base de Investimentos — Fundação (Dashboard + Métricas)

**Data:** 12/02/2026  
**Objetivo:** Preparar a infraestrutura completa para a página `client/html/invest-dash.html` receber múltiplos cards de investimentos (KPIs, gráficos, agregações por período, filtros), sem implementar ainda nenhum indicador específico.

---

## 1) Visão geral

A base de investimentos foi criada seguindo os princípios do Yield Server:

- **Lógica pura em `src/core/`**: filtros, períodos, contratos, execução e agregações (sem IA).
- **IA em `src/agents/`**: permanece isolada; não foi adicionada nenhuma decisão de IA para métricas.
- **Ferramentas em `src/tools/`**: o **Financial Bridge** continua sendo o ponto de integração com dados financeiros pessoais existentes.
- **API HTTP em `src/api/`**: novas rotas para o frontend pedir **manifesto**, **métricas** e **cards**.

O resultado é uma estrutura em que, no futuro, cada novo card tende a virar uma combinação de:

1) Configuração no frontend (layout + quais métricas compõem o card)  
2) Registro de métricas no backend (handlers)  
3) (Opcional) Integrações externas via Bridge/price feeds

---

## 2) Componentes criados (onde fica o quê)

### Backend

- `src/core/metrics/registry.js`
  - Registry escalável para registrar métricas por `metricId`.
  - Expõe lista de métricas (metadados) sem acoplar ao frontend.

- `src/core/metrics/engine.js`
  - Motor de execução: roda N métricas isoladamente, retorna resultados por `metricId`.
  - Falha de uma métrica não derruba as demais.

- `src/core/investments/filters.js`
  - Normaliza filtros e opções de agregação (`groupBy`, `periodsMonths`, etc.).

- `src/core/investments/periods.js`
  - Constrói janelas (2, 3, 6, 12 meses etc.), com datas ISO (`YYYY-MM-DD`).

- `src/core/investments/repository.js`
  - Repositório MongoDB para coleções estruturadas de investimentos (vazias por enquanto).

- `src/core/investments/service.js`
  - Serviço de alto nível para:
    - `getManifest()`
    - `queryMetrics()`
    - `queryCards()`

- `src/api/routes/investments.js`
  - Rotas HTTP autenticadas:
    - `GET  /api/investments/manifest`
    - `POST /api/investments/metrics/query`
    - `POST /api/investments/cards/query`

- `src/utils/financial-logger.js`
  - Wrapper de logging com correlação (`flow`, `traceId`, `userId`) focado em fluxo financeiro.

### Frontend

- `client/js/invest-dash.js`
  - Sem alterar UX, adiciona a base:
    - `window.YieldInvestments.api` (client HTTP autenticado)
    - `window.YieldInvestments.slots` (mapeamento de slots de card: `main-*`, `mini-*`)
    - `window.YieldInvestments.preloadManifest()` (carrega manifesto silenciosamente)

---

## 3) Estrutura de dados no MongoDB (necessária)

Como ainda não existem dados estruturados de investimentos, a base define coleções dedicadas (separadas de `transactions`, que hoje contém finanças pessoais via Financial Bridge).

### Coleções

- `investments_assets`
  - Cadastro de ativos por usuário.
  - Chave recomendada: `(userId, assetId)`.

- `investments_positions`
  - Snapshots de posição (quantidade, custo, valor, etc.) por data de referência.
  - Usada para patrimônio, alocação, exposição, etc.

- `investments_transactions`
  - Movimentações de investimentos (aportes, resgates, dividendos, compra/venda, taxas).

- `investments_prices`
  - Série histórica de preços/cotações (se e quando necessário).

### Campos mínimos recomendados (contrato de base)

Para posições/transações, a base assume (no mínimo):

- `userId` (string)
- `assetId` (string)
- `referenceDate` (string `YYYY-MM-DD`) — base para agregações por período
- `currency` (ex: `BRL`, `USD`)
- `assetClass` (ex: `fixed_income`, `equity`, `funds`, `crypto`, `cash`)
- `status` (ex: `open`, `closed`, `pending_settlement`)
- `accountId` (string opcional)
- `tags` (string[] opcional)

### Índices

Script para criar índices (opcional, recomendado quando começar a popular dados):

- `server/scripts/init-investments-indexes.js`

---

## 4) Contrato de filtros e períodos

### Normalização de filtros

O backend normaliza o input em um objeto consistente, permitindo evoluir cards sem refatoração:

- `currencies: string[]`
- `assetClasses: string[]`
- `statuses: string[]`
- `accountIds: string[]`
- `tags: string[]`
- `asOf: YYYY-MM-DD | null`

### Períodos e agregação

- `periodsMonths: number[]` (default: `[2,3,6,12]`)
- `groupBy: 'day' | 'month'` (default: `month`)

O módulo `core/investments/periods.js` produz janelas com:

```json
{ "months": 6, "start": "2026-09-01", "end": "2026-02-12", "label": "6m" }
```

---

## 5) Padrão de resposta JSON (métricas e cards)

### 5.1 `POST /api/investments/metrics/query`

**Request**
```json
{
  "metricIds": ["investments.net_worth"],
  "filters": {
    "currencies": ["BRL"],
    "assetClasses": ["equity"],
    "periodsMonths": [2, 3, 6, 12],
    "groupBy": "month"
  }
}
```

**Response** (base pronta, sem métricas registradas ainda)
- Cada item retorna `status` por métrica (`ok`, `empty`, `not_found`, `error`).

### 5.2 `POST /api/investments/cards/query`

**Request**
```json
{
  "cards": [
    {
      "cardId": "card-patrimonio",
      "title": "Patrimônio",
      "presentation": "chart",
      "metricIds": ["investments.net_worth"]
    }
  ],
  "filters": {
    "currencies": ["BRL"],
    "periodsMonths": [2, 3, 6, 12],
    "groupBy": "month"
  }
}
```

**Response**
- Retorna lista de `cards[]`, cada um contendo:
  - `status` (`ok`, `empty`, `partial_error`)
  - `filters` (echo normalizado)
  - `periods` (janelas)
  - `metrics[]` (resultados por métrica)

Esse padrão permite:
- 1 card com 1 métrica
- 1 card com múltiplas métricas relacionadas
- card com filtros específicos + filtros globais

---

## 6) Integração com Financial Bridge (preparada)

O serviço `InvestmentsMetricsService` aceita `financeBridge` por injeção (o mesmo já instanciado no bootstrap do servidor).

Uso futuro típico:
- Derivar aportes/resgates a partir de `transactions` enquanto a base estruturada ainda é parcial.
- Reaproveitar normalização de período e filtros.

Importante:
- A base NÃO insere dados manualmente.
- A base expõe rotas e contratos para **consumo**.

---

## 7) Logging (estratégico, sem poluição)

A estratégia é:
- Logar somente eventos úteis para rastrear fluxo crítico:
  - recebimento de request
  - contagem de métricas/cards
  - janelas de período usadas
  - conclusão com contagem de sucesso/erro
- Correlacionar por `traceId` e `userId`.

O wrapper `src/utils/financial-logger.js` foi criado para padronizar isso.

---

## 8) Como implementar um novo card no futuro (checklist)

Quando você pedir algo como:
> “Vamos construir um gráfico que mostra o patrimônio do usuário com filtros X, Y e Z, considerando os últimos 2, 3, 6 e 12 meses.”

O fluxo esperado é:

1) **Backend**
- Registrar a(s) métrica(s) em `core/metrics/registry.js` via `registerMetric({ id, handler, ... })`.
- No handler, buscar dados via `core/investments/repository.js` (ou `financeBridge` se aplicável).
- Produzir `data` em formato apropriado (timeseries/kpi/table) mantendo o contrato estável.

2) **API**
- O card pode chamar `cards/query` (melhor para múltiplas métricas) ou `metrics/query` (mais direto).

3) **Frontend**
- Escolher um `slotId` em `window.YieldInvestments.slots`.
- Definir uma configuração do card (id, métricas, filtros).
- Renderizar no slot (sem quebrar layout existente).

4) **Teste (obrigatório no futuro)**
- Fornecer um snippet para rodar no console do navegador, por exemplo:

```js
await window.YieldInvestments.preloadManifest();
console.log(window.YieldInvestments.state.manifest);

const res = await window.YieldInvestments.api.queryCards([
  {
    cardId: 'card-patrimonio',
    title: 'Patrimônio',
    presentation: 'chart',
    metricIds: ['investments.net_worth']
  }
], { currencies: ['BRL'], periodsMonths: [2,3,6,12], groupBy: 'month' });

console.log(res);
```

---

## 9) Fluxo completo do dado (agente → bridge → backend → banco → backend → frontend)

Esta base suporta dois fluxos, que podem coexistir:

### 9.1 Fluxo “Dashboard” (frontend → backend → mongo)

`invest-dash.html` → `invest-dash.js` → `GET manifest` / `POST cards/query` → `InvestmentsMetricsService` → `MetricsEngine` → (Repository Mongo / FinanceBridge opcional) → resposta JSON → render do card.

### 9.2 Fluxo “Agente” (chat → tools → backend)

Usuário (chat) → `POST /api/message` → Junior/Dispatcher → Coordenador de Investimentos → tool request (FinanceBridge/Search/Math) → dados reais → síntese → resposta.

No futuro, cards e agente podem compartilhar as mesmas métricas (mesma fonte e agregação), reduzindo duplicação.

---

## 10) Card oficial: Rentabilidade Consolidada (implementado)

### 10.1 O que foi implementado

- Card oficial de **Rentabilidade Consolidada** em `client/html/invest-dash.html` (aba Rentabilidade).
- Novo módulo frontend dedicado: `client/js/invest-dash.rentabilidade.js`.
- Nova métrica backend registrada: `investments.profitability` em `src/core/investments/metrics-registry.js`.
- Integração no bootstrap do dashboard em `client/js/invest-dash.js`.

### 10.2 Estrutura de cálculo (reaproveitamento da base)

Para evitar duplicação de regra de negócio, a métrica reaproveita a mesma base transacional do card de patrimônio:

- Estados por ativo são derivados de `investments_transactions` (operações manuais como compra, venda, proventos).
- Cálculo temporal usa as mesmas funções de evolução de estado por data (`buildStateUntilDate`, custos, realizado, posição aberta).
- O card de rentabilidade calcula série temporal de retorno do portfólio sobre o período selecionado:
  - `retorno_portfolio(t) = (valor_total(t) / valor_total(início_período) - 1) * 100`
  - `valor_total = valor_em_aberto + caixa_realizado`

### 10.3 Contribuição para rentabilidade total

A regra foi mantida e dinamizada:

- **Contribuição (p.p.) = Retorno do ativo (%) × Peso no patrimônio (fração)**

No backend:

- Retorno do ativo é medido entre início e fim do período selecionado.
- Peso considera participação do ativo no patrimônio ao final do período.
- O card apresenta contribuições agrupadas em Renda Variável e Renda Fixa, com drill-down por ativo.

### 10.4 Persistência e fonte de dados

Todos os dados do card são dinâmicos e vinculados ao usuário autenticado, via MongoDB:

- `investments_transactions`
- `investments_positions`
- `investments_assets`

Não há dados fixos no frontend para o card oficial.

### 10.5 Períodos suportados (primeiro nível)

Filtro implementado no card e enviado ao backend por `periodPreset`:

- `mtd`: 1º dia do mês atual até hoje.
- `ytd`: 1º dia útil de janeiro até hoje.
- `12m`: últimos 12 meses móveis.
- `origin`: desde o início da carteira (primeiro evento do usuário).

Essas regras são aplicadas no backend (`metrics-registry`), garantindo consistência do cálculo para gráfico, KPI e benchmarks.

### 10.6 Benchmarks (fontes e organização)

Implementado em `src/core/investments/benchmarks.js`:

- **CDI**: JSON local `server/docs/md_sistema/taxa_cdi.json`
- **Ibovespa**: JSON local `server/docs/md_sistema/ibov.json`
- **Selic**: BRAPI (`/api/v2/prime-rate`) via `BrapiClient.getPrimeRateHistory()`
- **IFIX**: BRAPI via histórico de cotação (`getQuoteHistory('IFIX')`)

Regras adotadas:

- JSONs permanecem em arquivo dedicado para atualização por edição de dados, sem hardcode no JS do frontend.
- Benchmark é calculado por ponto temporal da série, não apenas no fechamento.

### 10.7 Regra crítica de alinhamento temporal

Para cada ponto exibido no gráfico:

- O valor do portfólio e os valores dos benchmarks usam a **mesma data âncora**.
- Tooltip exibe benchmark correspondente exatamente ao ponto selecionado pelo usuário.

Isso elimina desalinhamento temporal entre rentabilidade e comparação de referência.

### 10.8 Estrutura do frontend (separação de responsabilidades)

- `client/js/invest-dash.rentabilidade.js`
  - Renderiza card em Shadow DOM
  - Aplica filtros MTD/YTD/12M/Origem
  - Consome `window.YieldInvestments.api.queryCards(...)`
  - Renderiza gráfico, tooltip e benchmarks sincronizados por ponto
  - Navegação de drill-down sem acoplar regras de negócio

- `client/js/invest-dash.js`
  - Instancia o controller de rentabilidade e mantém integração com os demais cards

- `client/js/invest-dash.manual-modal.js`
  - Após `create/edit/delete` no Lançamento Manual, executa refresh de **todos** os cards registrados em `window.YieldInvestments.cards` (não apenas Patrimônio), mantendo Rentabilidade e demais cards sincronizados com as movimentações.

---

## 11) Card oficial: Resultado Financeiro (implementado)

### 11.1 O que foi implementado

- Card oficial de **Resultado Financeiro** integrado em `client/html/invest-dash.html` na navegação:
  - `Patrimônio > Resultado Financeiro`
- Novo módulo frontend dedicado: `client/js/invest-dash.resultado.js`.
- Nova métrica backend registrada com aliases:
  - `investments.financial_result`
  - `investments.resultado_financeiro`
  - `investments.financial_result_consolidated`
- Integração de bootstrap em `client/js/invest-dash.js` com alternância entre os slots de Patrimônio Total e Resultado Financeiro sem quebrar o layout existente.

### 11.2 Estrutura hierárquica (3 níveis)

O card segue a hierarquia definida no layout oficial:

1) **Consolidado**
- Resultado por classe (`Renda Variável` / `Renda Fixa`)
- Contribuição percentual da classe para o total do período

2) **Classe de Ativo**
- Lista os ativos da classe selecionada
- Mostra status contextual por ativo (`Realizado`, `Não Realizado`, `Parcial`)

3) **Ativo Individual**
- Decomposição de resultado em:
  - Ganho bruto
  - Custos
  - Resultado líquido estimado (quando houver configuração de imposto)

### 11.3 Indicadores e fórmulas

- **Resultado Bruto**
  - Mede **geração de valor**, não patrimônio.
  - Fórmula consolidada:
    - `Resultado Bruto = Resultado Realizado + Resultado Não Realizado + Proventos`
  - Para posição em custódia, o componente não realizado é calculado por lucro/prejuízo:
    - `Não Realizado = (Valor de Mercado - Custo das posições abertas)`
  - Em períodos (`MTD`, `YTD`, `12M`, `origin`), o não realizado usa a variação de PnL (delta de lucro), sem tratar principal/aporte como ganho.

- **Resultado Líquido (Est.)**
  - Quando há configuração de imposto no ativo (metadata), aplica provisão interna de IR sobre resultado positivo.
  - Sem configuração de imposto:
    - `Resultado Líquido = Resultado Bruto`

- **ROI Nominal**
  - `ROI Nominal (%) = (Resultado Bruto / Base Investida) * 100`

- **ROI Real**
  - Fórmula de Fisher:
    - `ROI Real (%) = (((1 + ROI_Nominal_decimal) / (1 + Inflacao_decimal)) - 1) * 100`

### 11.4 Filtros suportados

- **Período** (mesmo padrão da Rentabilidade):
  - `MTD`, `YTD`, `12M`
  - `origin` (desde o primeiro aporte)
- **Tipo de Resultado**:
  - `both` (Ambos)
  - `realized` (Realizado)
  - `unrealized` (Não Realizado)

O filtro foi incorporado ao contrato de normalização em `core/investments/filters.js` e exposto no manifesto (`availableFilters.resultType`).

### 11.5 Fontes Brapi utilizadas

- **Dividendos/Proventos por ativo**:
  - `BrapiClient.getDividendsHistory(ticker)`
- **Inflação (Brasil)**:
  - `BrapiClient.getInflationHistory({ country: 'brazil', ... })`

Obs.: foram adicionados métodos dedicados no cliente Brapi (`server/src/tools/search/brapi.js`) para manter consistência de integração e reutilização futura.

### 11.6 Frontend e integração com cards existentes

- `client/js/invest-dash.resultado.js`
  - Renderiza card em Shadow DOM mantendo a identidade visual oficial do layout de referência
  - Implementa filtros de período/tipo de resultado
  - Exibe proventos (Dividendos/JCP) junto ao bloco de resultado líquido
  - Renderiza gráfico waterfall dinâmico por nível
  - Navegação entre níveis com histórico (back)
  - Consome `window.YieldInvestments.api.queryCards(...)`

- `client/js/invest-dash.js`
  - Registra o controller em `window.YieldInvestments.cards.resultado`
  - Faz toggle entre os slots `patrimonio-card-slot` e `resultado-card-slot`

- `client/js/invest-dash.manual-modal.js`
  - Permanece com refresh global de cards; Resultado Financeiro participa automaticamente desse ciclo

### 11.7 Persistência e escopo de dados

Todos os cálculos usam dados por usuário autenticado em MongoDB, reaproveitando a mesma base estrutural:

- `investments_transactions`
- `investments_positions`
- `investments_assets`

Sem hardcode de valores no card oficial.

---
