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

## 12) Card oficial: Alocação Real vs Planejada (implementado)

### 12.1 O que foi implementado

- Card oficial de **Alocação Real vs Planejada** integrado em:
  - `Patrimônio > Alocação Real vs Planejada`
- Novo módulo frontend dedicado:
  - `client/js/invest-dash.alocacao.js`
- Nova métrica backend registrada com aliases:
  - `investments.allocation_vs_target`
  - `investments.allocation_real_vs_plan`
  - `investments.allocation_rebalance`
  - `investments.alocacao_real_planejada`
- Integração no bootstrap de cards em:
  - `client/js/invest-dash.js`

### 12.2 Estrutura de agregação (Classe > Subclasse > Ativo)

O card usa hierarquia de 3 níveis com drill-down:

1) **Classe**
- `Renda Variável`
- `Renda Fixa`

2) **Subclasse**
- Derivada de `asset.category` (ou fallback de metadata)

3) **Ativo**
- Nó individual por `assetId`

Os filtros de visualização implementados no frontend são:

- **Classe** (raiz em nível de classe)
- **Subclasse** (raiz em nível de subclasse)
- **Ativo** (lista direta de ativos)

### 12.3 Base de cálculo e regra de patrimônio

O cálculo usa **mark-to-market** (valor atual), e não apenas capital investido:

- `Valor Atual da Posição = Quantidade × Preço Atual`
- `Preço Atual` prioriza histórico da Brapi quando disponível (equity/crypto/funds), com fallback para posição atual.
- `Patrimônio Total (base da alocação) = soma dos valores atuais das posições abertas`

Isso garante que a alocação reaja a ganho/perda de preço.

### 12.4 Fórmulas de cálculo (score e rebalanceamento)

#### Score de aderência

- `Score = 100 - (Soma dos desvios absolutos entre % Real e % Meta) / 2`
- Aplicado por modo (`class`, `subclass`, `asset`) e limitado a `[0, 100]`.

#### Rebalanceamento por aporte (sem venda)

Implementado por modo, usando o item com maior insuficiência econômica vs meta:

1. Calcula insuficiência atual por nó:
  - `Insuficiência = Valor Ideal no Patrimônio Atual - Valor Atual`
  - `Valor Ideal no Patrimônio Atual = Patrimônio Atual × Meta%`
2. Seleciona o nó com maior insuficiência positiva.
3. Calcula:
  - `Novo Total Ideal = Valor Atual do Nó / (Meta% / 100)`
4. Calcula:
  - `Aporte Necessário = max(0, Novo Total Ideal - Patrimônio Atual)`

Esse ajuste corrige casos em que o KPI podia aparecer como `R$ 0,00` mesmo com necessidade real de aporte.

#### Rebalanceamento por venda/compra (ajuste fino)

Além do valor por nó (`Valor Ajuste`), o card passa a consolidar por modo:

- `buyAmount`: soma de compras sugeridas (itens `under`)
- `sellAmount`: soma de vendas sugeridas (itens `over`)
- `netAmount = buyAmount - sellAmount`

No frontend, os dois lados (`Comprar` e `Vender`) são exibidos de forma explícita.

#### Valor de ajuste por nó

2. Calcula:
   - `Novo Total Ideal = Valor Atual do Nó / (Meta% / 100)`

- `Valor Ajuste = (Patrimônio Total × Meta%) - Valor Atual`
- `Valor Ajuste > 0`: Comprar
- `Valor Ajuste < 0`: Vender

### 12.5 Lógica das etiquetas e margem de desvio

Para cada nó (classe/subclasse/ativo):

- `Desvio = %Real - %Meta`
- `status = over` se `Desvio > Margem`
- `status = under` se `Desvio < -Margem`
- `status = on-track` caso contrário

Etiquetas exibidas:

- `Vender / Aguardar (+X%)`
- `Aportar (-X%)`
- `Manter (0%)`

### 12.6 Alerta especial (ícone info)

No nível de ativo, o alerta é exibido quando:

- Ativo está acima da meta (considerando margem), **e**
- Ajuste sugere venda (`Valor Ajuste < 0`), **e**
- Ativo está em prejuízo (`PnL não realizado < 0`)

Mensagem exibida:

> “O sistema sugere vender R$ X para rebalancear, mas você está com prejuízo de Y% neste ativo.”

### 12.7 Integração com Lançamento Manual

Atualizações implementadas no modal manual (`client/js/invest-dash.manual-modal.js`):

- Novo campo no cadastro de ativo:
  - `Margem de Desvio (%)` (`metadata.allocationDeviationPct`)
- Campo existente mantido:
  - `Alocação Meta (%)` (`metadata.allocationTargetPct`)
- Nova operação de edição:
  - `Atualizar Meta e Margem`
  - Permite editar meta, margem, classe do ativo e subclasse

No backend (`service.editManualAsset`) foi adicionado suporte à operação:

- `update_allocation`

Após create/edit/delete, o modal continua disparando refresh de **todos os cards** registrados em `window.YieldInvestments.cards`, portanto o card de alocação recalcula sem reload manual.

### 12.8 Frequência de recálculo

- A métrica expõe política de recálculo com base mark-to-market:
  - `refreshPerDay: 3`
  - `refreshIntervalHours: 8`
- No frontend, o controller agenda refresh automático em intervalo de 8 horas enquanto a tela estiver ativa.

### 12.9 Estrutura de dados entregue pelo backend (widget)

A métrica retorna um widget com:

- `totalPatrimony`
- `kpis` por modo (`class`, `subclass`, `asset`):
  - `score`
  - `aporteRebalance` (`amount`, `basisId`, `basisName`)
- `nodes[]` com os níveis de agregação e campos de decisão:
  - `%Real`, `%Meta`, desvio, margem
  - status, etiqueta de ação
  - valor de ajuste compra/venda
  - resultado financeiro por nível (classe/subclasse/ativo), com agregação consistente
    - `financialResult = realizedResult + unrealizedPnl`
  - classe visual de lucro/prejuízo para exibição no card
  - alerta de prejuízo para venda (quando aplicável)

Isso mantém o frontend focado em renderização/filtros e centraliza a lógica de cálculo no backend.

### 12.10 Evolução estrutural do card (18/02/2026)

Implementação aplicada sem alterar o contrato base do widget e sem criar lógica paralela de métricas:

- `client/js/invest-dash.alocacao.js`
  - Reescrita do motor de decisão do card para os dois modos de rebalanceamento, preservando consumo de `investments.allocation_vs_target`.
  - Correção crítica do modo **Desbalanceamento por Aporte**, com cálculo baseado no ativo acima da banda superior:
    - `Novo Total = Valor Atual do ativo base / (Meta + Desvio)`
    - `Aporte Total = Novo Total - Patrimônio Atual`
  - Distribuição do aporte com trava de teto por ativo (não ultrapassa meta), priorização configurável e conservação de soma em centavos.
  - Rebalanceamento **Venda/Compra** com:
    - venda apenas de itens acima da banda superior até a meta,
    - compra apenas de itens abaixo da banda inferior até a meta,
    - fluxo financeiro fechado (`Total vendido = Total comprado`) e alerta discreto de possível IR quando houver venda.
  - Cálculo aplicado por nível de navegação (`Classe`, `Subclasse`, `Ativo`) respeitando o contexto atual do funil.
  - Bloqueio de rebalanceamento quando existir somente 1 item no nível:
    - "Adicione mais ativos para habilitar o rebalanceamento".
  - Persistência em sessão das preferências:
    - modo de rebalanceamento (`aporte`/`trade`)
    - prioridade (`deviation`/`profitability`/`volatility`)
  - Consumo de sinais já processados de cards existentes para prioridade da engrenagem:
    - `window.YieldInvestments.cards.rentabilidade.getCurrentModel()`
    - `window.YieldInvestments.cards.volatilidade.getCurrentModel()`
    - sem duplicar cálculo de rentabilidade/volatilidade no card de alocação.
  - Simplificação da renderização por linha para exibir apenas:
    - nome, valor atual, `% real vs % meta`, ação recomendada (comprar/vender/alocar/manter) e resultado nominal.
  - Painel `Ver Mais` com resumo de plano e tabela:
    - ativo, `% atual`, ação (com quantidade estimada quando possível), valor e `% pós-ajuste estimada`.

- `client/css/invest-dash-dados.css`
  - Ajustes visuais pontuais do card de alocação para suportar a versão simplificada e estados de botão (`Ver Mais` desabilitado), sem impacto nos demais cards.

### 12.11 Correções de bugs + refatoração UI/UX (18/02/2026)

Implementação complementar aplicada em `client/js/invest-dash.alocacao.js` + template/CSS do card, mantendo contrato backend intacto:

- Correção de meta no nível **Classe** (modo venda/compra)
  - A meta da classe deixou de usar fallback aproximado e passou a ser derivada da soma de metas dos ativos descendentes.
  - Regra aplicada:
    - `metaClasseAbs = soma(targetPct dos ativos filhos)`
  - Se a soma das metas no contexto de classe for inexistente (`0`), o card exibe aviso para configurar metas dos ativos.

- Correção de drill-down com metas internas proporcionais
  - Em níveis internos (quando o usuário entra em uma classe/subclasse), o cálculo agora usa escala interna do grupo:
    - `metaInterna = metaAbsItem / somaMetasAbsGrupo`
    - `% real interno = valorItem / totalGrupo`
  - Bandas e ações (`Vender` / `Alocar` / `Manter`) passam a respeitar essa escala interna.

- Herança de aporte entre níveis
  - Ao navegar para dentro de um grupo, o aporte recomendado no nível superior é propagado para o nível interno como `aporteHerdado`.
  - O card passa a exibir explicitamente:
    - "Distribuição do aporte sugerido no nível superior".

- UI/UX: cenários simultâneos e detalhe com 1 clique
  - Removidas as tabs de modo no topo.
  - O card passa a calcular e exibir simultaneamente os dois cenários:
    - `Desbalanceamento por Aporte`
    - `Rebalanceamento por Venda/Compra`
  - Cada cenário ganhou botão independente `Ver Detalhes`/`Ocultar`, com painel próprio e abertura em um único clique.
  - Os dois painéis podem permanecer abertos ao mesmo tempo.

- UI/UX: hierarquia visual e ação por item
  - `Score` isolado no topo.
  - Cada linha da lista exibe ação objetiva e imediata por estado:
    - `Vender R$ X` (over)
    - `Alocar R$ X` (under)
    - `Manter` (on-track)
  - Label de ação foi alinhado ao lado direito da barra (associação direta barra ↔ ação).
  - Termo `Ver Mais` substituído por `Ver Detalhes` nos pontos de expansão do card de alocação.

---

## 13) Card oficial: Volatilidade Anualizada (implementado)

### 13.1 O que foi implementado

- Card oficial de **Volatilidade Anualizada** integrado em:
  - `Volatilidade > Volatilidade do Portfólio`
- Novo módulo frontend dedicado:
  - `client/js/invest-dash.volatilidade.js`
- Nova métrica backend registrada com aliases:
  - `investments.volatility_annualized`
  - `investments.volatility`
  - `investments.volatilidade_anualizada`
  - `investments.portfolio_volatility`
- Integração no bootstrap de cards em:
  - `client/js/invest-dash.js`

### 13.2 Filtros suportados

O card aplica recálculo completo ao trocar qualquer filtro:

- **Período** (`periodPreset`):
  - `MTD`, `YTD`, `12M`, `origin`
  - Padrão: `origin`
- **Escopo** (`volatilityScope`):
  - `consolidated` (Consol.)
  - `classes`
- **Benchmark** (`volatilityBenchmark`):
  - `ibov`
  - `cdi`

Esses filtros foram adicionados à normalização (`core/investments/filters.js`) e expostos no manifesto (`service.getManifest()`).

### 13.3 Métricas calculadas (regra de negócio)

As métricas seguem a especificação técnica de `card_volati.md`:

- **Volatilidade Anualizada**
  - Desvio padrão dos retornos diários anualizado por `√252`
- **Máximo Drawdown**
  - Maior queda entre pico e vale subsequente na série de valor
- **Índice Sharpe**
  - `(Retorno do período - retorno livre de risco) / volatilidade anualizada`
  - Taxa livre de risco baseada em CDI acumulado do período
- **Beta**
  - `Cov(Rp, Rm) / Var(Rm)` com alinhamento temporal diário entre carteira e benchmark selecionado

### 13.4 Benchmarks e fonte dos dados

- `IBOV` e `CDI` são consumidos no backend a partir de:
  - `server/docs/md_sistema/ibov.json`
  - `server/docs/md_sistema/taxa_cdi.json`
- Os JSONs permanecem em arquivo (sem hardcode no frontend), permitindo atualização contínua de dados sem mudança no JS do card.
- Para cálculo diário de risco (vol/beta), o backend converte a base mensal dos JSONs em série diária útil (dias úteis), mantendo compatibilidade com novos meses inseridos nesses arquivos.

### 13.5 Estrutura do widget retornado

A métrica retorna `widget` com:

- `rootView` (`total` ou `classes-root`)
- `period`, `scope`, `benchmark`
- `views` hierárquicas com drill-down por classe:
  - KPIs principais (vol portfólio, vol benchmark)
  - KPIs secundários (drawdown, sharpe, beta)
  - `chartData` (linha central, banda de desvio e linha benchmark)
  - `details[]` (lista lateral com métricas por classe/ativo)

### 13.6 Integração com Lançamento Manual

O card participa do mesmo ciclo global de refresh dos demais cards:

- Após create/edit/delete no modal manual (`invest-dash.manual-modal.js`), todos os controllers registrados em `window.YieldInvestments.cards` executam `fetchAndRenderLiveData()`.
- Com isso, a Volatilidade recalcula automaticamente após novas movimentações, sem reload manual da página.

---

## 14) Ajustes oficiais: Lançamento Manual + Renda Fixa por Indexador (implementado)

### 14.1 Interface do Lançamento Manual

Atualizações aplicadas em `client/js/invest-dash.manual-modal.js` e `client/css/invest-dash.css`:

- **Seletores de data** do modal receberam padronização visual da identidade do sistema.
- **Dropdowns** do modal receberam padronização visual (mesma linguagem dos inputs).
- Padronização aplicada com contraste fixo (sem dependência de `hover`) para:
  - `Tipo de operação` (Renda Variável)
  - `Indexador` e `Liquidez` (Renda Fixa)
  - Demais `select` do modal de lançamento manual
- No campo **Tipo de operação** (cadastro de renda variável), opções reduzidas para:
  - `Comprar`
  - `Vender`
- **Confirmação de preço via Brapi** foi movida para imediatamente abaixo do campo de preço:
  - Cadastro: abaixo de `Preço unitário`
  - Movimentação (`add_buy` / `add_sell`): abaixo de `Preço unitário` / `Preço de venda`
- Texto de ajuda de **Alocação Meta (%)** passou a ser dinâmico por classe:
  - “Quanto você planeja ter deste ativo na carteira de renda variável.”
  - “Quanto você planeja ter deste ativo na carteira de renda fixa.”
- Texto de ajuda de **Taxa do ativo** (renda fixa) passou a ser dinâmico por indexador:
  - Prefixado: “Informe a taxa fixa anual do ativo.”
  - CDI: “Informe o percentual do CDI. Ex: 110 significa 110% do CDI.”
  - IPCA: “Informe a taxa adicional acima do IPCA. Ex: 6.5 significa IPCA + 6,5%.”

### 14.2 Indexadores suportados em Renda Fixa

Atualizações aplicadas no fluxo manual (`createManualAsset`):

- Indexadores válidos:
  - `Prefixado`
  - `CDI`
  - `IPCA`
- `Selic` foi removido do cadastro manual e rejeitado na validação backend.
- O backend normaliza variações legadas de texto para `PREFIXADO`, `CDI`, `IPCA`.

### 14.3 Regra de cálculo de rendimento por indexador (backend)

Implementado em `src/core/investments/metrics-registry.js` com apoio de `src/core/investments/benchmarks.js`:

1) **Prefixado**
- Entrada: taxa anual fixa (`metadata.rate`).
- Base obrigatória: **252 dias úteis/ano**.
- Cálculo com capitalização composta e pro rata de dias úteis:
  - `Vb = P * (1 + i)^(n/252)`
  - `i = taxa anual decimal`
  - `n = dias úteis do período (exclui a data inicial e inclui os dias úteis até a data de referência)`

2) **CDI**
- Entrada: percentual do CDI (`metadata.rate`, ex.: `110` = `110% CDI`).
- Fonte: `server/docs/md_sistema/taxa_cdi.json` (leitura direta; sem hardcode no JS).
- Base obrigatória: **252 dias úteis/ano** com capitalização diária composta.
- Cálculo ANBIMA implementado via taxa diária derivada da série mensal:
  - `Vb = P * Π(i=1..n)[1 + (CDI_diario_i * K)]`
  - `K = percentual contratado em decimal (ex.: 1,10)`
- Regras aplicadas:
  - sem juros simples
  - sem soma linear de taxas
  - sem arredondamento intermediário (apenas no valor final exibido)
  - meses parciais respeitados por dias úteis do intervalo

3) **IPCA + taxa adicional**
- Entrada: taxa adicional (`metadata.rate`, ex.: `6.5` para `IPCA + 6,5%`).
- Fonte: BRAPI (`/api/v2/inflation`) via cliente backend.
- Cálculo composto estrito (IPCA acumulado real do período + spread anual em base 252), sem soma linear de componentes:
  - `fator_total = fator_ipca_composto * fator_spread_composto`
  - `rendimento = fator_total - 1`
- Regra de referência mensal:
  - até dia 15: considera mês anterior
  - após dia 15: considera mês atual
- Regra estrutural:
  - composição multiplicativa com semântica de VNA (fatores acumulados por janela)
  - pro rata em dias úteis para períodos parciais
  - sem atalho aditivo entre inflação e spread

### 14.4 Liquidação automática + mês completo (renda fixa)

Regra estrutural aplicada na camada central de valuation (`metrics-registry`), reutilizada por todos os cards:

- Todo ativo de `fixed_income` é automaticamente **liquidado no vencimento** (`metadata.maturityDate`).
- O ativo para de render **exatamente** na data de vencimento.
- Não há projeção até fim do mês quando vence antes.
- No vencimento:
  - posição aberta vai para zero
  - valor final é transferido para `Realizado (Em caixa)`
  - resultado realizado é atualizado de forma consistente com custo base
- Regra de mês parcial:
  - só considera mês cheio quando o ativo permanece ativo até o último dia útil considerado
  - caso contrário aplica pro rata por dia útil até a data efetiva (inclusive vencimento)

### 14.5 Cards impactados e integração

A nova precificação de renda fixa indexada foi integrada na base de valuation compartilhada e passou a alimentar os cards oficiais que dependem de valor de posição no tempo:

- `investments.net_worth` (Patrimônio)
- `investments.profitability` (Rentabilidade)
- `investments.allocation_vs_target` (Alocação)
- `investments.volatility_annualized` (Volatilidade)
- `investments.financial_result` (Resultado Financeiro)

Com isso, ativos de renda fixa indexados (Prefixado, %CDI, IPCA+taxa) refletem rendimento acumulado no cálculo dos widgets/cards, em vez de depender apenas de atualização manual de saldo/preço.

### 14.6 Patrimônio Total: novo nível por ativo

O card `investments.net_worth` passa a expor terceiro nível de drill-down além de Consolidado e Classe:

- **Nível 3: Por Ativo**
  - Data de início do investimento (primeiro aporte)
  - Quantidade comprada (posição aberta)
  - Preço médio pago
  - Preço atual
  - Capital investido
  - Patrimônio atual
  - Realizado em caixa
  - Quebra por aporte (`Aporte 1`, `Aporte 2`, ...) com cálculo independente por lote aberto:
    - data do aporte
    - quantidade remanescente do lote
    - valor investido do lote
    - valor atualizado do lote
    - rentabilidade individual do lote
  - Gráfico temporal do ativo

Implementação reaproveita a mesma estrutura de `views` e `chart` do widget, sem lógica paralela no frontend.

### 14.7 Patrimônio: segregação realizado x não realizado (complemento)

A camada central de `investments.net_worth` passa a separar explicitamente ativos abertos e ativos realizados no modelo do widget:

- **Resultado Não Realizado**
  - visão navegável própria (`nao-realizado`) com somente posições abertas.
- **Resultado Realizado**
  - visão navegável própria (`realizado`) com ativos encerrados e eventos de realização.
- **Detalhe de ativo realizado**
  - data de liquidação
  - valor investido no trecho realizado
  - valor final realizado
  - resultado realizado em valor e percentual
  - tipo de fechamento (`Venda parcial`, `Venda total`, `Vencimento`)
- **Venda parcial (obrigatório)**
  - o evento é exibido como parcial, com quantidade vendida, percentual vendido e data.
  - apenas a fração vendida entra no realizado; o saldo remanescente continua no não realizado.
- **Consistência de ativos de renda fixa liquidados**
  - ativo liquidado por vencimento não permanece em listas/contagens de ativos ativos da classe.
  - o valor migra para realizado em caixa e deixa de compor patrimônio ativo.

---
