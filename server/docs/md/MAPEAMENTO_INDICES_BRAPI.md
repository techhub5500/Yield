# Mapeamento de Índices × API Brapi — Resultado dos Testes

> **Data dos Testes:** 2026-02-20  
> **Token utilizado:** `6V6hGyg5UsB4hz3Kr74XBR`  
> **Tickers testados:** PETR4, ITUB4, VALE3, MGLU3, WEGE3, BBSE3, PSSA3, SULA11, HGLG11, ITSA4, TAEE11, SLCE3  
> **Base de referência:** `INDICES.md` (12 segmentos) × `API_BRAPI.MD` (documentação oficial)

---

## Sumário Executivo

| Categoria | Disponíveis | Calculáveis | Indisponíveis |
|---|:---:|:---:|:---:|
| Universais | 10 | 2 | 0 |
| Bancos | 2 | 2 | 11 |
| Seguradoras | 0 | 1 | 11 |
| Tecnologia | 2 | 1 | 16 |
| Varejo | 1 | 5 | 8 |
| Utilities | 0 | 1 | 10 |
| Petróleo/Mineração | 3 | 1 | 7 |
| Real Estate | 0 | 3 | 13 |
| Saúde | 0 | 0 | 11 |
| Indústria | 5 | 7 | 2 |
| Telecom | 1 | 1 | 9 |
| Agronegócio | 0 | 1 | 9 |

---

## 1. Índices Universais (aplicáveis a todos os segmentos)

Todos os 12 indicadores universais estão **disponíveis diretamente ou são calculáveis** a partir da API Brapi.

| # | Indicador | Status | Endpoint / Módulo | Campo(s) na API | Exemplo de Chamada |
|---|---|:---:|---|---|---|
| 1 | **P/L (Preço/Lucro)** | ✅ Direto | `defaultKeyStatistics` | `trailingPE` | `GET /api/quote/PETR4?modules=defaultKeyStatistics&token=TOKEN` |
| 2 | **P/VP (Preço/Valor Patrimonial)** | ✅ Direto | `defaultKeyStatistics` | `priceToBook` | idem |
| 3 | **ROE (Retorno sobre PL)** | ✅ Direto | `financialData` | `returnOnEquity` | `GET /api/quote/PETR4?modules=financialData&token=TOKEN` |
| 4 | **Lucro por Ação (LPA)** | ✅ Direto | `defaultKeyStatistics` | `trailingEps` | `GET /api/quote/PETR4?modules=defaultKeyStatistics&token=TOKEN` |
| 5 | **Dividend Yield** | ⚠️ Calculável | `dividends=true` + preço | Campo `dividendYield` existe no schema mas retorna `null` nos testes. **Calcular:** soma dos `rate` dos `cashDividends` dos últimos 12 meses ÷ `regularMarketPrice` | `GET /api/quote/PETR4?dividends=true&token=TOKEN` |
| 6 | **Payout** | ⚠️ Calculável | `dividends=true` + `incomeStatementHistory` | Soma dos dividendos pagos (dos `cashDividends`) ÷ `netIncome` da DRE | Combinar dividendos + DRE |
| 7 | **Market Cap** | ✅ Direto | `defaultKeyStatistics` | `marketCap` | `GET /api/quote/WEGE3?modules=defaultKeyStatistics&token=TOKEN` |
| 8 | **Crescimento de Receita (YoY)** | ✅ Direto | `financialData` | `revenueGrowth` | `GET /api/quote/PETR4?modules=financialData&token=TOKEN` |
| 9 | **Crescimento de Lucro Líquido (YoY)** | ✅ Direto | `financialData` | `earningsGrowth` | idem |
| 10 | **Margem Líquida** | ✅ Direto | `financialData` | `profitMargins` | idem |
| 11 | **P/Receita (PSR)** | ✅ Direto | `defaultKeyStatistics` | `enterpriseToRevenue` (EV/Revenue, proxy) | `GET /api/quote/PETR4?modules=defaultKeyStatistics&token=TOKEN` |
| 12 | **EV (Enterprise Value)** | ✅ Direto | `defaultKeyStatistics` | `enterpriseValue` | idem |

### Observações Técnicas — Universais

- **`marketCap`**: Retorna `null` no endpoint básico (`/api/quote/TICKER`), mas está **disponível** dentro de `defaultKeyStatistics`. Testado com WEGE3: `215.616.230.000`, ITUB4: `535.354.470.000`.
- **`priceEarnings` / `earningsPerShare`**: Os campos do endpoint básico com `fundamental=true` retornam `null` atualmente. Usar `defaultKeyStatistics.trailingPE` e `defaultKeyStatistics.trailingEps` como alternativa.
- **`dividendYield`**: O campo existe no schema de `DefaultKeyStatisticsEntry` mas retorna `null` em todos os tickers testados (PETR4, ITUB4, ITSA4, WEGE3, HGLG11). Deve ser **calculado manualmente** a partir do `dividendsData.cashDividends`.
- **`enterpriseToRevenue`**: É tecnicamente EV/Revenue (não P/S exato), mas é a melhor proxy disponível. Para P/S preciso: `marketCap / totalRevenue * sharesOutstanding`.

---

## 2. Bancos e Instituições Financeiras

> **Ticker testado:** ITUB4 (Itaú Unibanco)

### 🔒 Exclusivos / Prioritários para Bancos

| # | Indicador | Status | Observação |
|---|---|:---:|---|
| 1 | Índice de Basileia | ❌ Indisponível | Dado regulatório (BACEN), não fornecido pela Brapi |
| 2 | Índice de Basileia Tier 1 | ❌ Indisponível | idem |
| 3 | NIM (Net Interest Margin) | ❌ Indisponível | Não existe campo direto na API |
| 4 | Índice de Inadimplência (NPL) | ❌ Indisponível | Dado operacional/regulatório |
| 5 | Índice de Cobertura | ❌ Indisponível | Dado operacional |
| 6 | ROAE (Return on Average Equity) | ⚠️ Calculável | Usar `returnOnEquity` da `financialData` + PL de dois períodos do `balanceSheetHistoryQuarterly` para calcular PL médio |
| 7 | ROAA (Return on Average Assets) | ⚠️ Calculável | Usar `returnOnAssets` da `financialData` (já é uma aproximação); para maior precisão: `netIncome / avgTotalAssets` com dados do BP |
| 8 | Índice de Eficiência Bancária | ❌ Indisponível | Requer separação de despesas operacionais vs receita total bancária — DRE bancária é muito simplificada na API |
| 9 | Carteira de Crédito Total | ❌ Indisponível | Dado operacional bancário |
| 10 | Crescimento da Carteira de Crédito | ❌ Indisponível | idem |
| 11 | Custo de Captação | ❌ Indisponível | Dado operacional |
| 12 | Custo do Crédito | ❌ Indisponível | Dado operacional |
| 13 | Índice de Liquidez de Curto Prazo (LCR) | ❌ Indisponível | Dado regulatório (BACEN) |
| 14 | Depósitos Totais | ✅ Parcial | `balanceSheetHistoryQuarterly` → `provisions` retorna `2.350.901.000.000` para ITUB4, que reflete passivos (inclui depósitos). Campo `thirdPartyDeposits` existe no schema mas retorna `null` |
| 15 | Margem Financeira Bruta | ✅ Parcial | `incomeStatementHistoryQuarterly` → `totalRevenue` - `costOfRevenue` = `grossProfit` (R$ 36 bi para ITUB4 Q4/2025). Para bancos, isso é a margem financeira bruta |

### Dados retornados para ITUB4 (verificados)

```
defaultKeyStatistics:
  profitMargins: 0.118
  sharesOutstanding: 11.026.869.000
  bookValue: 19.50
  priceToBook: 2.49
  trailingEps: 4.16
  trailingPE: 10.90
  marketCap: 535.354.470.000

financialData:
  totalRevenue: 387.118.000.000
  returnOnAssets: 0.015
  returnOnEquity: 0.213
  grossProfits: 138.947.000.000
  freeCashflow: 102.238.000.000
  earningsGrowth: 3.12
  revenueGrowth: 3.24
  grossMargins: 0.359
  profitMargins: 0.118
  ebitda: null (esperado para bancos)
  ebitdaMargins: null
  operatingMargins: null
  debtToEquity: null
  totalCash: null
  totalDebt: null
```

---

## 3. Seguradoras

> **Tickers testados:** BBSE3 (BB Seguridade), PSSA3 (Porto Seguro), SULA11 (SulAmérica)

### 🔒 Exclusivos / Prioritários para Seguradoras

| # | Indicador | Status | Observação |
|---|---|:---:|---|
| 1 | Índice Combinado | ❌ Indisponível | Dado operacional de seguros, não retornado |
| 2 | Índice de Sinistralidade | ❌ Indisponível | idem |
| 3 | Índice de Despesas | ❌ Indisponível | idem |
| 4 | Prêmios Emitidos (GWP) | ❌ Indisponível | Dado operacional |
| 5 | Prêmios Ganhos (NEP) | ❌ Indisponível | idem |
| 6 | Resultado de Subscrição | ❌ Indisponível | idem |
| 7 | Resultado Financeiro | ⚠️ Calculável | `financialResult` disponível na DRE para algumas empresas, mas retorna `null` para seguradoras testadas |
| 8 | Provisões Técnicas | ❌ Indisponível | Campo `technicalProvisions` existe no schema do BP mas retorna `null` para PSSA3 e BBSE3 |
| 9 | Índice de Retrocessão/Resseguro | ❌ Indisponível | Dado operacional |
| 10 | ROAE Segurador | ❌ Indisponível | Pode ser calculado com ROE + PL médio, mas não é retornado diretamente |
| 11 | Solvência II | ❌ Indisponível | Dado regulatório (SUSEP) |
| 12 | Margem de Solvência | ❌ Indisponível | idem |

### Campos do Schema que existem mas retornaram null/0

Os seguintes campos existem no schema da DRE para seguradoras mas **retornaram `0` ou `null`** nas seguradoras testadas:
- `insuranceOperations` → `0` (BBSE3), `null` (PSSA3, SULA11)
- `reinsuranceOperations` → `0` (BBSE3), `null` (PSSA3)
- `claimsAndOperationsCosts` → `0` (BBSE3), `null` (PSSA3)
- `complementaryPensionOperations` → `0` (BBSE3)
- `capitalizationOperations` → `0` (BBSE3)

DVA possui campos `insuranceOperationsRevenue`, `claimsAndBenefits`, `variationsOfTechnicalProvisions` — todos retornaram `null`.

---

## 4. Tecnologia (Software, SaaS, Internet)

> **Nota:** Não há empresas de tecnologia pura entre as ações de teste. Os campos operacionais de SaaS/tech não existem no schema da Brapi.

### 🔒 Exclusivos / Prioritários para Tecnologia

| # | Indicador | Status | Observação |
|---|---|:---:|---|
| 1 | ARR (Annual Recurring Revenue) | ❌ Indisponível | Métrica operacional SaaS, não existe no schema |
| 2 | MRR (Monthly Recurring Revenue) | ❌ Indisponível | idem |
| 3 | Churn Rate | ❌ Indisponível | Dado operacional |
| 4 | NRR (Net Revenue Retention) | ❌ Indisponível | idem |
| 5 | LTV (Lifetime Value) | ❌ Indisponível | idem |
| 6 | CAC (Custo de Aquisição de Cliente) | ❌ Indisponível | idem |
| 7 | LTV/CAC | ❌ Indisponível | Derivado |
| 8 | Payback Period (CAC) | ❌ Indisponível | Derivado |
| 9 | Rule of 40 | ⚠️ Calculável | `revenueGrowth` + `ebitdaMargins` da `financialData` — ambos disponíveis |
| 10 | Magic Number | ❌ Indisponível | Requer dado de gasto em S&M detalhado |
| 11 | DAU / MAU | ❌ Indisponível | Dado operacional |
| 12 | DAU/MAU Ratio | ❌ Indisponível | idem |
| 13 | Burn Rate | ❌ Indisponível | Dado operacional |
| 14 | Runway | ❌ Indisponível | Derivado do Burn Rate |
| 15 | Número de Clientes Ativos | ❌ Indisponível | Dado operacional |
| 16 | ARPU (Average Revenue per User) | ❌ Indisponível | idem |
| 17 | EV/Receita | ✅ Direto | `defaultKeyStatistics.enterpriseToRevenue` |
| 18 | P/S (Price-to-Sales) | ✅ Direto | Calculável: `marketCap / totalRevenue` (ambos disponíveis) |
| 19 | Margem Bruta de Software | ❌ Indisponível | `grossMargins` existe na `financialData`, é a margem bruta geral (não específica de software) — pode servir como proxy |

---

## 5. Varejo (Retail)

> **Ticker testado:** MGLU3 (Magazine Luiza)

### 🔒 Exclusivos / Prioritários para Varejo

| # | Indicador | Status | Observação |
|---|---|:---:|---|
| 1 | SSS (Same-Store Sales) | ❌ Indisponível | Dado operacional |
| 2 | Ticket Médio | ❌ Indisponível | idem |
| 3 | Vendas por m² | ❌ Indisponível | idem |
| 4 | Número de Lojas | ❌ Indisponível | `summaryProfile` não inclui número de lojas |
| 5 | GMV (Gross Merchandise Value) | ❌ Indisponível | Dado operacional |
| 6 | Take Rate | ❌ Indisponível | idem |
| 7 | Giro de Estoque | ⚠️ Calculável | `costOfRevenue` (DRE) ÷ `inventory` (BP). MGLU3: `-9.369.597.000 / 7.611.132.000` |
| 8 | Dias de Estoque (DSI) | ⚠️ Calculável | `365 / Giro de Estoque` |
| 9 | Shrinkage | ❌ Indisponível | Dado operacional |
| 10 | EBITDA Ajustado por Loja | ❌ Indisponível | Requer número de lojas |
| 11 | Margem Bruta | ✅ Direto | `financialData.grossMargins` → `0.3057` para MGLU3 |
| 12 | Capital de Giro | ⚠️ Calculável | `totalCurrentAssets - totalCurrentLiabilities` do BP. MGLU3: `19.550.824.000 - 16.710.550.000 = 2.840.274.000` |
| 13 | Ciclo de Conversão de Caixa (CCC) | ⚠️ Calculável | Requer DSI + DSO - DPO (todos calculáveis com DRE + BP) |
| 14 | NPS (Net Promoter Score) | ❌ Indisponível | Dado operacional |

### Dados auxiliares disponíveis para varejo

```
balanceSheetHistoryQuarterly:
  inventory: 7.611.132.000 ✅
  netReceivables: 5.833.528.000 ✅
  accountsPayable: 10.283.119.000 ✅
  totalCurrentAssets: 19.550.824.000 ✅
  totalCurrentLiabilities: 16.710.550.000 ✅

incomeStatementHistoryQuarterly:
  totalRevenue: ✅
  costOfRevenue: ✅
```

---

## 6. Utilities (Energia Elétrica, Saneamento, Gás)

> **Ticker testado:** TAEE11 (Taesa)

### 🔒 Exclusivos / Prioritários para Utilities

| # | Indicador | Status | Observação |
|---|---|:---:|---|
| 1 | RAB (Regulatory Asset Base) | ❌ Indisponível | Dado regulatório (ANEEL/reguladores) |
| 2 | WACC Regulatório | ❌ Indisponível | idem |
| 3 | EBITDA Regulatório | ❌ Indisponível | Dado de relatório regulatório |
| 4 | Cobertura de Juros (DSCR) | ⚠️ Calculável | `ebit / interestExpense` da DRE (campos disponíveis) |
| 5 | Alavancagem RAB | ❌ Indisponível | Requer RAB |
| 6 | Volume Distribuído/Gerado | ❌ Indisponível | Dado operacional |
| 7 | Perda de Rede (%) | ❌ Indisponível | Dado operacional/regulatório |
| 8 | PMSO | ❌ Indisponível | Dado regulatório |
| 9 | Inadimplência de Clientes | ❌ Indisponível | Dado operacional |
| 10 | DEC/FEC | ❌ Indisponível | Dado regulatório (ANEEL) |
| 11 | CapEx de Manutenção vs. Expansão | ❌ Indisponível | Distinção não existe na API (apenas `investmentCashFlow` agregado no DFC) |

---

## 7. Petróleo, Gás e Mineração (Commodities)

> **Tickers testados:** PETR4 (Petrobras), VALE3 (Vale)

### 🔒 Exclusivos / Prioritários

| # | Indicador | Status | Observação |
|---|---|:---:|---|
| 1 | **EV/EBITDA** | ✅ Direto | `defaultKeyStatistics.enterpriseToEbitda` → PETR4: `5.21`, WEGE3: `23.55` |
| 2 | EV/Reservas (P/NAV) | ❌ Indisponível | Dado operacional |
| 3 | Custo de Extração (Lifting Cost) | ❌ Indisponível | Dado operacional |
| 4 | Breakeven Price | ❌ Indisponível | idem |
| 5 | Reservas Provadas (1P/2P/3P) | ❌ Indisponível | Dado operacional/geológico |
| 6 | Vida Útil das Reservas | ❌ Indisponível | Derivado |
| 7 | EBITDAX | ❌ Indisponível | Requer separação de despesas de exploração |
| 8 | Produção (boe/d ou ton/ano) | ❌ Indisponível | Dado operacional |
| 9 | Índice de Reposição de Reservas | ❌ Indisponível | Dado operacional |
| 10 | **Dívida Líquida / EBITDA** | ⚠️ Calculável | `(totalDebt - totalCash) / ebitda` da `financialData`. PETR4: `(668.926 - 62.001) / 210.112 = ~2.89` |
| 11 | **CapEx de Manutenção vs. Crescimento** | ❌ Indisponível | Apenas `investmentCashFlow` agregado no DFC |

### Dados verificados para PETR4

```
defaultKeyStatistics:
  enterpriseValue: 1.094.248.000.000
  enterpriseToEbitda: 5.21
  enterpriseToRevenue: 2.23
  trailingPE: 6.81
  priceToBook: 1.15
  marketCap: 487.323.000.000

financialData:
  ebitda: 210.112.000.000
  totalDebt: 668.926.000.000
  totalCash: 62.001.000.000
  debtToEquity: 1.57
  freeCashflow: 94.680.000.000
  operatingCashflow: 193.083.000.000
  grossMargins: 0.482
  ebitdaMargins: 0.428
  operatingMargins: 0.265
  profitMargins: 0.159
  returnOnEquity: 0.184
  returnOnAssets: 0.064
```

---

## 8. Imóveis / Real Estate (FIIs, Incorporadoras)

> **Ticker testado:** HGLG11 (FII Logístico)

### 🔒 Exclusivos / Prioritários para Real Estate

| # | Indicador | Status | Observação |
|---|---|:---:|---|
| 1 | FFO (Funds from Operations) | ⚠️ Calculável | `netIncome + depreciationAndAmortization` (DRE + DFC/DVA) |
| 2 | AFFO (Adjusted FFO) | ⚠️ Calculável | FFO - CapEx de manutenção (necessita estimativa do CapEx) |
| 3 | P/FFO | ⚠️ Calculável | `marketCap / FFO` |
| 4 | Cap Rate | ❌ Indisponível | Dado operacional/avaliação |
| 5 | NOI (Net Operating Income) | ❌ Indisponível | idem |
| 6 | Vacância Física | ❌ Indisponível | Dado operacional |
| 7 | Vacância Financeira | ❌ Indisponível | idem |
| 8 | Absorção Líquida | ❌ Indisponível | idem |
| 9 | ABL (Área Bruta Locável) | ❌ Indisponível | idem |
| 10 | Renda por m² | ❌ Indisponível | idem |
| 11 | DY (Dividend Yield de FII) | ⚠️ Calculável* | Soma `cashDividends.rate` últimos 12 meses ÷ preço. HGLG11 tem 49 registros de dividendos |
| 12 | LTV (Loan-to-Value) | ❌ Indisponível | Dado operacional |
| 13 | VSO (Velocidade de Vendas) | ❌ Indisponível | Dado operacional (incorporadoras) |
| 14 | VGV (Valor Geral de Vendas) | ❌ Indisponível | idem |
| 15 | Landbank | ❌ Indisponível | idem |
| 16 | Margem de Incorporação | ❌ Indisponível | Dado operacional |

### Dados verificados para HGLG11 (FII)

```
defaultKeyStatistics:
  priceToBook: 0.94 (P/VP < 1 = desconto patrimonial)
  dividendYield: null (precisa calcular)
  
dividendsData:
  cashDividends: 49 registros históricos ✅
```

---

## 9. Saúde (Hospitais, Operadoras, Farmacêuticas)

> **Nota:** Todos os indicadores setoriais de saúde são operacionais e **não estão disponíveis** na API Brapi.

| # | Indicador | Status | Observação |
|---|---|:---:|---|
| 1 | Sinistralidade Médica (MLR) | ❌ | Dado operacional de operadoras |
| 2 | Índice de Eficiência Assistencial | ❌ | Dado operacional hospitalar |
| 3 | Taxa de Ocupação de Leitos | ❌ | idem |
| 4 | Ticket Médio por Beneficiário | ❌ | Dado operacional |
| 5 | Número de Beneficiários | ❌ | idem |
| 6 | ARPU em Saúde | ❌ | idem |
| 7 | Pipeline de P&D | ❌ | Dado estratégico (não financeiro) |
| 8 | Revenue per Drug | ❌ | Dado operacional |
| 9 | Patent Cliff | ❌ | Dado estratégico |
| 10 | EBITDA Hospitalar | ❌ | `ebitda` está disponível na `financialData`, mas não segmentado por operação hospitalar |
| 11 | Receita por Leito | ❌ | Dado operacional |

---

## 10. Indústria / Manufatura

> **Ticker testado:** WEGE3 (WEG)

### 🔒 Exclusivos / Prioritários para Indústria

| # | Indicador | Status | Endpoint / Campo | Observação |
|---|---|:---:|---|---|
| 1 | **EBITDA** | ✅ Direto | `financialData.ebitda` | WEGE3: `9.095.752.000` |
| 2 | **EV/EBITDA** | ✅ Direto | `defaultKeyStatistics.enterpriseToEbitda` | WEGE3: `23.55` |
| 3 | Utilização da Capacidade Instalada | ❌ Indisponível | — | Dado operacional |
| 4 | **Margem EBITDA** | ✅ Direto | `financialData.ebitdaMargins` | WEGE3: `0.220` |
| 5 | **ROIC** | ⚠️ Calculável | DRE + BP | `NOPAT / (PL + Dívida Líquida)`. NOPAT = `ebit * (1 - taxa_ir)`. Dados da DRE (`ebit`, `incomeTaxExpense`) e BP (`shareholdersEquity`, dívidas) disponíveis |
| 6 | **Dívida Líquida / EBITDA** | ⚠️ Calculável | `financialData` | `(totalDebt - totalCash) / ebitda`. WEGE3: `(5.885 - 7.335) / 9.096 = -0.16` (caixa líquido) |
| 7 | **Giro do Ativo** | ⚠️ Calculável | `financialData` + BP | `totalRevenue / totalAssets` |
| 8 | **Prazo Médio de Recebimento (PMR)** | ⚠️ Calculável | BP + DRE | `(netReceivables / totalRevenue) * 365` |
| 9 | **Prazo Médio de Pagamento (PMP)** | ⚠️ Calculável | BP + DRE | `(accountsPayable / costOfRevenue) * 365` |
| 10 | **Dias de Estoque (DSI)** | ⚠️ Calculável | BP + DRE | `(inventory / costOfRevenue) * 365` |
| 11 | **Capital de Giro Operacional** | ⚠️ Calculável | BP | `totalCurrentAssets - totalCurrentLiabilities` |
| 12 | **CapEx / Receita** | ❌ Indisponível | — | CapEx direto não existe; `investmentCashFlow` inclui outros itens além de CapEx. Pode-se aproximar: `(operatingCashflow - freeCashflow) / totalRevenue` |
| 13 | **Free Cash Flow (FCF)** | ✅ Direto | `financialData.freeCashflow` | WEGE3: `2.195.190.000` |
| 14 | **FCF Yield** | ✅ Direto (calc.) | `financialData` + `defaultKeyStatistics` | `freeCashflow / marketCap`. WEGE3: `2.195.190 / 215.616.230 = ~1.02%` |

### Dados verificados para WEGE3

```
defaultKeyStatistics:
  enterpriseValue: 214.165.830.000
  trailingPE: 31.51
  priceToBook: 9.21
  enterpriseToEbitda: 23.55
  enterpriseToRevenue: 5.18
  marketCap: 215.616.230.000
  trailingEps: 1.63
  pegRatio: 0.10

financialData:
  ebitda: 9.095.752.000
  returnOnEquity: 0.292
  returnOnAssets: 0.165
  grossMargins: 0.334
  ebitdaMargins: 0.220
  operatingMargins: 0.197
  profitMargins: 0.165
  totalCash: 7.335.311.000
  totalDebt: 5.884.912.000
  debtToEquity: 0.251
  operatingCashflow: 6.820.317.000
  freeCashflow: 2.195.190.000
  currentRatio: 1.779
  quickRatio: 1.115
  earningsGrowth: 3.12
  revenueGrowth: 3.20
```

---

## 11. Telecom

> **Nota:** Indicadores de Telecom são majoritariamente operacionais.

### 🔒 Exclusivos / Prioritários para Telecom

| # | Indicador | Status | Observação |
|---|---|:---:|---|
| 1 | ARPU | ❌ Indisponível | Dado operacional |
| 2 | Churn Rate | ❌ Indisponível | idem |
| 3 | EBITDA | ✅ Direto | `financialData.ebitda` |
| 4 | EBITDA Margin | ✅ Direto (implícito) | `financialData.ebitdaMargins` |
| 5 | CapEx / Receita | ❌ Indisponível | CapEx direto não segregado |
| 6 | Número de Assinantes | ❌ Indisponível | Dado operacional |
| 7 | RGU | ❌ Indisponível | idem |
| 8 | NPS | ❌ Indisponível | idem |
| 9 | Cobertura de Rede | ❌ Indisponível | idem |
| 10 | Dívida Líquida / EBITDA | ⚠️ Calculável | `(totalDebt - totalCash) / ebitda` |
| 11 | EV/EBITDA | ✅ Direto | `defaultKeyStatistics.enterpriseToEbitda` |

---

## 12. Agronegócio

> **Ticker testado:** SLCE3 (SLC Agrícola)

### 🔒 Exclusivos / Prioritários para Agronegócio

| # | Indicador | Status | Observação |
|---|---|:---:|---|
| 1 | Produtividade (sc/ha) | ❌ Indisponível | Dado operacional agrícola |
| 2 | Custo de Produção por Saca | ❌ Indisponível | idem |
| 3 | Área Plantada / Colhida | ❌ Indisponível | idem |
| 4 | Preço de Venda Realizado | ❌ Indisponível | idem |
| 5 | Hedge (% da produção hedgeada) | ❌ Indisponível | idem |
| 6 | EBITDA Ajustado (ex-variação biológica) | ❌ Indisponível | EBITDA disponível na `financialData`, mas ajuste por variação biológica não é separado |
| 7 | **Variação do Valor Justo de Ativos Biológicos** | ⚠️ Calculável | `balanceSheetHistoryQuarterly.biologicalAssets` retorna valores para SLCE3: `789.930.000`. Comparando dois períodos pode-se calcular a variação |
| 8 | Dívida Agrícola / Total de Dívida | ❌ Indisponível | Não há separação por tipo de dívida agrícola |
| 9 | Landbank (hectares) | ❌ Indisponível | Dado operacional |
| 10 | Custo de Arrendamento | ❌ Indisponível | idem |

### Campos relevantes verificados para SLCE3

```
balanceSheetHistoryQuarterly:
  biologicalAssets: 789.930.000 ✅
  longTermBiologicalAssets: 86.776.000 ✅
  investmentProperties: 53.182.000 ✅
  inventory: 5.181.966.000 ✅
```

---

## Referência Rápida — Todos os Campos Úteis por Módulo

### `GET /api/quote/{ticker}` (básico)

| Campo | Indicador |
|---|---|
| `regularMarketPrice` | Preço atual |
| `regularMarketChange` | Variação absoluta |
| `regularMarketChangePercent` | Variação % |
| `regularMarketVolume` | Volume |
| `fiftyTwoWeekHigh` / `Low` | Máx/Mín 52 semanas |

### `?fundamental=true`

| Campo | Indicador | Status Atual |
|---|---|---|
| `priceEarnings` | P/L | ⚠️ Retorna `null` — usar `defaultKeyStatistics.trailingPE` |
| `earningsPerShare` | LPA | ⚠️ Retorna `null` — usar `defaultKeyStatistics.trailingEps` |
| `marketCap` | Market Cap | ⚠️ Retorna `null` — usar `defaultKeyStatistics.marketCap` |

### `?modules=defaultKeyStatistics`

| Campo | Indicador Mapeado |
|---|---|
| `trailingPE` | P/L |
| `priceToBook` | P/VP |
| `bookValue` | VPA (Valor Patrimonial por Ação) |
| `enterpriseValue` | EV (Enterprise Value) |
| `enterpriseToEbitda` | EV/EBITDA |
| `enterpriseToRevenue` | EV/Receita |
| `marketCap` | Market Cap |
| `trailingEps` | LPA (TTM) |
| `profitMargins` | Margem Líquida |
| `sharesOutstanding` | Ações em Circulação |
| `pegRatio` | PEG Ratio |
| `netIncomeToCommon` | Lucro Líquido (atribuível a controladores) |
| `dividendYield` | Dividend Yield (**retorna `null` — calcular**) |

### `?modules=financialData`

| Campo | Indicador Mapeado |
|---|---|
| `ebitda` | EBITDA (null para bancos) |
| `ebitdaMargins` | Margem EBITDA |
| `grossMargins` | Margem Bruta |
| `operatingMargins` | Margem Operacional |
| `profitMargins` | Margem Líquida |
| `returnOnEquity` | ROE |
| `returnOnAssets` | ROA |
| `totalRevenue` | Receita Total |
| `grossProfits` | Lucro Bruto |
| `totalCash` | Caixa Total |
| `totalDebt` | Dívida Bruta |
| `debtToEquity` | Dívida/PL |
| `freeCashflow` | Free Cash Flow (FCF) |
| `operatingCashflow` | Fluxo de Caixa Operacional |
| `earningsGrowth` | Crescimento de Lucro (YoY) |
| `revenueGrowth` | Crescimento de Receita (YoY) |
| `currentRatio` | Liquidez Corrente |
| `quickRatio` | Liquidez Seca |

### `?modules=incomeStatementHistoryQuarterly`

| Campo | Indicador Mapeado |
|---|---|
| `totalRevenue` | Receita Líquida |
| `costOfRevenue` | CPV/CSP |
| `grossProfit` | Lucro Bruto |
| `operatingIncome` | Lucro Operacional |
| `ebit` | EBIT |
| `netIncome` | Lucro Líquido |
| `interestExpense` | Despesas Financeiras |
| `financialResult` | Resultado Financeiro |
| `basicEarningsPerCommonShare` | LPA Básico (ON) |
| `sellingGeneralAdministrative` | Despesas SG&A |

### `?modules=balanceSheetHistoryQuarterly`

| Campo | Indicador/Cálculo |
|---|---|
| `totalAssets` | Ativo Total |
| `totalCurrentAssets` | Ativo Circulante |
| `inventory` | Estoques (Giro de Estoque) |
| `netReceivables` | Contas a Receber (PMR) |
| `cash` | Caixa |
| `shareholdersEquity` | Patrimônio Líquido |
| `totalCurrentLiabilities` | Passivo Circulante (Capital de Giro) |
| `accountsPayable` / `providers` | Fornecedores (PMP) |
| `loansAndFinancing` | Empréstimos CP |
| `longTermLoansAndFinancing` | Empréstimos LP |
| `biologicalAssets` | Ativos Biológicos (Agro) |
| `financialAssets` | Ativos Financeiros (Bancos) |
| `propertyPlantEquipment` | Imobilizado |
| `intangibleAssets` | Intangível |

### `?modules=cashflowHistoryQuarterly`

| Campo | Indicador Mapeado |
|---|---|
| `operatingCashFlow` | FCO |
| `investmentCashFlow` | FCI (proxy CapEx) |
| `financingCashFlow` | FCF (Financiamento) |
| `freeCashFlow` | FCF |
| `increaseOrDecreaseInCash` | Variação de Caixa |

### `?dividends=true`

| Campo | Indicador Mapeado |
|---|---|
| `cashDividends[].rate` | Valor por ação do provento |
| `cashDividends[].label` | Tipo: DIVIDENDO / JCP |
| `cashDividends[].paymentDate` | Data de pagamento |
| `cashDividends[].lastDatePrior` | Data Com (Ex-Date) |

### `?modules=summaryProfile`

| Campo | Indicador Mapeado |
|---|---|
| `sector` | Setor (para classificação automática) |
| `industry` | Indústria/Subsetor |
| `fullTimeEmployees` | Número de funcionários |
| `longBusinessSummary` | Descrição do negócio |

---

## Resumo Final — Indicadores por Disponibilidade

### ✅ Diretamente Disponíveis na API (sem cálculo)

| # | Indicador | Módulo | Campo |
|---|---|---|---|
| 1 | P/L | `defaultKeyStatistics` | `trailingPE` |
| 2 | P/VP | `defaultKeyStatistics` | `priceToBook` |
| 3 | VPA | `defaultKeyStatistics` | `bookValue` |
| 4 | LPA | `defaultKeyStatistics` | `trailingEps` |
| 5 | EV | `defaultKeyStatistics` | `enterpriseValue` |
| 6 | EV/EBITDA | `defaultKeyStatistics` | `enterpriseToEbitda` |
| 7 | EV/Receita | `defaultKeyStatistics` | `enterpriseToRevenue` |
| 8 | Market Cap | `defaultKeyStatistics` | `marketCap` |
| 9 | PEG Ratio | `defaultKeyStatistics` | `pegRatio` |
| 10 | ROE | `financialData` | `returnOnEquity` |
| 11 | ROA | `financialData` | `returnOnAssets` |
| 12 | EBITDA | `financialData` | `ebitda` |
| 13 | Margem Bruta | `financialData` | `grossMargins` |
| 14 | Margem EBITDA | `financialData` | `ebitdaMargins` |
| 15 | Margem Operacional | `financialData` | `operatingMargins` |
| 16 | Margem Líquida | `financialData` | `profitMargins` |
| 17 | Dívida/PL | `financialData` | `debtToEquity` |
| 18 | Liquidez Corrente | `financialData` | `currentRatio` |
| 19 | Liquidez Seca | `financialData` | `quickRatio` |
| 20 | FCF | `financialData` | `freeCashflow` |
| 21 | FCO | `financialData` | `operatingCashflow` |
| 22 | Crescimento Receita YoY | `financialData` | `revenueGrowth` |
| 23 | Crescimento Lucro YoY | `financialData` | `earningsGrowth` |
| 24 | Receita Total | `financialData` | `totalRevenue` |
| 25 | Lucro Bruto | `financialData` | `grossProfits` |
| 26 | Caixa Total | `financialData` | `totalCash` |
| 27 | Dívida Total | `financialData` | `totalDebt` |

### ⚠️ Calculáveis a partir de dados da API

| # | Indicador | Fórmula | Dados Necessários |
|---|---|---|---|
| 1 | Dividend Yield | Σ dividendos 12 meses ÷ preço | `dividends=true` + `regularMarketPrice` |
| 2 | Payout | Σ dividendos ÷ lucro líquido | `dividends=true` + `incomeStatementHistory` |
| 3 | Dívida Líquida / EBITDA | (totalDebt - totalCash) ÷ ebitda | `financialData` |
| 4 | FCF Yield | freeCashflow ÷ marketCap | `financialData` + `defaultKeyStatistics` |
| 5 | ROIC | NOPAT ÷ Capital Investido | DRE (`ebit`, `incomeTaxExpense`) + BP |
| 6 | Giro do Ativo | totalRevenue ÷ totalAssets | `financialData` + BP |
| 7 | Capital de Giro | Ativo Circ. - Passivo Circ. | `balanceSheetHistoryQuarterly` |
| 8 | Giro de Estoque | CPV ÷ Estoque | DRE (`costOfRevenue`) + BP (`inventory`) |
| 9 | Dias de Estoque (DSI) | 365 ÷ Giro de Estoque | DRE + BP |
| 10 | PMR (Prazo Médio de Recebimento) | (Recebíveis ÷ Receita) × 365 | BP + DRE |
| 11 | PMP (Prazo Médio de Pagamento) | (Fornecedores ÷ CPV) × 365 | BP + DRE |
| 12 | CCC (Ciclo Conversão Caixa) | DSI + PMR - PMP | BP + DRE |
| 13 | Cobertura de Juros (DSCR) | EBIT ÷ Despesas Financeiras | DRE (`ebit`, `interestExpense`) |
| 14 | FFO | Lucro Líquido + D&A | DRE + DFC/DVA |
| 15 | P/S (Price-to-Sales) | marketCap ÷ totalRevenue | `defaultKeyStatistics` + `financialData` |
| 16 | Rule of 40 | revenueGrowth + ebitdaMargins | `financialData` |
| 17 | Variação Ativos Biológicos | Δ biologicalAssets entre períodos | `balanceSheetHistoryQuarterly` |
| 18 | ROAE | Lucro Líquido ÷ PL médio | DRE + BP (dois períodos) |

### ❌ Indisponíveis na API (dados operacionais / regulatórios)

| Segmento | Indicadores Indisponíveis |
|---|---|
| **Bancos** | Basileia, Basileia Tier 1, NIM, NPL, Carteira de Crédito, LCR, Custo Captação/Crédito, Eficiência Bancária, Depósitos (parcial), Crescimento Carteira |
| **Seguradoras** | Índice Combinado, Sinistralidade, Prêmios (GWP/NEP), Resultado Subscrição, Solvência, Margem Solvência, ROAE Segurador, Retrocessão |
| **Tecnologia** | ARR, MRR, Churn, NRR, LTV, CAC, DAU/MAU, Burn Rate, Runway, Clientes Ativos, ARPU, Magic Number |
| **Varejo** | SSS, Ticket Médio, Vendas/m², Número de Lojas, GMV, Take Rate, Shrinkage, NPS |
| **Utilities** | RAB, WACC Regulatório, EBITDA Regulatório, Volume Distribuído, Perda Rede, PMSO, DEC/FEC, Alavancagem RAB |
| **Petróleo/Mineração** | Reservas (1P/2P/3P), Lifting Cost, Breakeven, EBITDAX, Produção, Vida Útil Reservas, Índice Reposição |
| **Real Estate** | Cap Rate, NOI, Vacância, ABL, Renda/m², LTV, VSO, VGV, Landbank, Margem Incorporação |
| **Saúde** | MLR, Taxa Ocupação, Pipeline P&D, Beneficiários, Revenue/Drug, Patent Cliff, Eficiência Assistencial |
| **Telecom** | ARPU, Churn, Assinantes, RGU, NPS, Cobertura Rede |
| **Agronegócio** | Produtividade, Custo/Saca, Área Plantada, Preço Realizado, Hedge, Dívida Agrícola, Landbank, Arrendamento |

---

## Notas Finais

1. **Dados operacionais vs. financeiros:** A API Brapi fornece dados financeiros derivados de demonstrativos contábeis (BP, DRE, DFC, DVA) reportados à CVM. Indicadores operacionais (Basileia, Churn, SSS, Vacância, etc.) são divulgados pelas empresas em relatórios de gestão (Release de Resultados, Formulário de Referência) e **não são extraíveis** da Brapi.

2. **`dividendYield` retorna null:** O campo existe no schema mas não está populado para nenhum ticker testado. Deve ser calculado manualmente.

3. **`fundamental=true` com limitações:** Os campos `marketCap`, `priceEarnings`, `earningsPerShare` retornam `null` no endpoint básico. Os mesmos dados estão disponíveis via módulo `defaultKeyStatistics`.

4. **Bancos e Seguradoras:** A API retém a estrutura de dados da CVM, mas muitos campos específicos desses setores retornam `null`. Os demonstrativos financeiros de bancos (COSIF) e seguradoras (SUSEP) possuem planos contábeis diferentes que a API mapeia de forma parcial.

5. **CapEx direto:** Não existe campo `capitalExpenditures` separado. Pode ser aproximado como `operatingCashflow - freeCashflow` da `financialData`, ou usar `investmentCashFlow` do DFC (que inclui outros investimentos).

6. **Periodicidade:** Os módulos `*History` retornam dados anuais; `*HistoryQuarterly` retornam trimestrais. Módulos sem sufixo (ex: `financialData`, `defaultKeyStatistics`) retornam TTM (Trailing Twelve Months).

---

*Documento gerado automaticamente via testes reais na API Brapi. Versão 1.0 — 2026-02-20*
