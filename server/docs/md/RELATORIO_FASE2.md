# Relatório de Implementação — Fase 2: Camadas de Roteamento e Ferramentas

**Data:** 05/02/2026  
**Versão:** 1.0  
**Status:** Implementação concluída

---

## 1. O que foi implementado

A Fase 2 foi implementada integralmente conforme o plano de implementação (`plano_implementação.md`), respeitando rigorosamente a constituição do sistema (`visao_geral.md`) e mantendo continuidade com as decisões técnicas da Fase 1.

### Estrutura de diretórios criada (Fase 2)

```
server/
├── src/
│   ├── agents/
│   │   └── junior/
│   │       ├── index.js              # Agente Junior (First Responder)
│   │       ├── prompt.js             # Prompt system do Junior
│   │       ├── validators.js         # Validadores de completude
│   │       └── followup.js           # Sistema de follow-up contextual
│   ├── core/
│   │   └── router/
│   │       └── dispatcher.js         # Roteador lógico de execução
│   ├── tools/
│   │   ├── finance-bridge/
│   │   │   ├── index.js              # Ponto de entrada (query + insert)
│   │   │   ├── schema.js             # Schema do Finance Bridge
│   │   │   ├── query-builder.js      # Conversor NL→JSON (IA nano)
│   │   │   ├── validators.js         # Validadores de query e insert
│   │   │   ├── executor.js           # Executor MongoDB
│   │   │   └── insert/
│   │   │       ├── index.js          # Orquestrador do pipeline de insert
│   │   │       ├── classifier.js     # Classificador despesa/receita (IA nano)
│   │   │       ├── category-selector.js  # Seletor de categoria (IA mini)
│   │   │       └── assembler.js      # Montador de lançamento (IA nano)
│   │   └── search/
│   │       ├── index.js              # Abstração de busca (SearchManager)
│   │       ├── serper.js             # Cliente Serper (Google Search)
│   │       ├── brapi.js              # Cliente Brapi (mercado financeiro)
│   │       └── tavily.js             # Cliente Tavily (pesquisa profunda)
│   └── config/
│       └── index.js                  # Atualizado com APIs da Fase 2
└── src/
    └── index.js                      # Atualizado com exports da Fase 2
```

---

## 2. Como cada objetivo da Fase 2 foi atendido

### Objetivo 2.1: Agente Junior (First Responder)

| Tarefa | Status | Detalhes |
|--------|--------|----------|
| Estrutura do Junior (`agents/junior/index.js`) | ✅ | GPT-5-mini (Reasoning: Medium, Verbosity: Low), JSON de saída validado |
| Prompt system (`agents/junior/prompt.js`) | ✅ | 4 rotas definidas (bridge_query, bridge_insert, serper, escalate), regras de decisão claras |
| Validador de completude (`agents/junior/validators.js`) | ✅ | Valida estrutura JSON, bridge_insert requer valor+descrição, bridge_query requer clareza |
| Sistema de follow-up (`agents/junior/followup.js`) | ✅ | IA analisa memória recente para inferir contexto, fallback genérico se IA falhar |
| Roteador lógico (`core/router/dispatcher.js`) | ✅ | `switch` determinístico, respeita regras de envio de memória da constituição |

### Objetivo 2.2: Finance Bridge — Camada de Query

| Tarefa | Status | Detalhes |
|--------|--------|----------|
| Schema do Finance Bridge (`tools/finance-bridge/schema.js`) | ✅ | Todos os campos, tipos, períodos inteligentes; exportado como constante para IA |
| Conversor NL→JSON (`tools/finance-bridge/query-builder.js`) | ✅ | GPT-5-nano, prompt com schema completo, fallback para garantir campo operation |
| Validador de query (`tools/finance-bridge/validators.js`) | ✅ | Validação de tipos, ranges, datas ISO 8601, sanitização contra injection |
| Executor de query (`tools/finance-bridge/executor.js`) | ✅ | Resolve períodos inteligentes, aplica lógica booleana (AND/OR/NOT), query no MongoDB |
| Schema de períodos inteligentes | ✅ | current_month, last_month, last_quarter, last_6_days, fiscal_year, since_last_payday |

### Objetivo 2.3: Finance Bridge — Camada de Insert

| Tarefa | Status | Detalhes |
|--------|--------|----------|
| Classificador de tipo (`insert/classifier.js`) | ✅ | GPT-5-nano, classificação binária expense/income, fallback para "expense" |
| Seletor de categoria (`insert/category-selector.js`) | ✅ | GPT-5-mini (Reasoning: Medium, Verbosity: Low), análise contextual ("Uber Eats"→Alimentação) |
| Montador de lançamento (`insert/assembler.js`) | ✅ | GPT-5-nano, extrai valor/data/descrição/pagamento, valida subcategoria |
| Orquestrador de insert (`insert/index.js`) | ✅ | Pipeline: classify → loadJSON → selectCategory → extractSubcategories → assemble → validate → insert |
| Validação de lançamento | ✅ | Campos obrigatórios (amount, date, category), data futura bloqueada para despesas |

### Objetivo 2.4: APIs Externas (Serper, Brapi, Tavily)

| Tarefa | Status | Detalhes |
|--------|--------|----------|
| Cliente Serper (`tools/search/serper.js`) | ✅ | POST para Google Search via Serper, timeout configurável, error handling robusto |
| Cliente Brapi (`tools/search/brapi.js`) | ✅ | Endpoints: cotações, fundamentos, cripto, moedas; detecção automática de tipo de query |
| Cliente Tavily (`tools/search/tavily.js`) | ✅ | Deep search com contexto, timeout 2x para pesquisas longas, parsing estruturado |
| Abstração de busca (`tools/search/index.js`) | ✅ | `SearchManager` com `search(query, source)` — centraliza acesso |

---

## 3. Decisões técnicas relevantes

### 3.1 Separação IA vs Lógica mantida

- **`core/router/dispatcher.js`** — LÓGICA PURA: `switch` determinístico, sem chamada a IA
- **`agents/junior/index.js`** — PONTO DE IA: classificação via mini
- **`agents/junior/followup.js`** — PONTO DE IA: inferência de contexto via mini
- **`tools/finance-bridge/query-builder.js`** — PONTO DE IA: conversão NL→JSON via nano
- **`tools/finance-bridge/insert/classifier.js`** — PONTO DE IA: classificação binária via nano
- **`tools/finance-bridge/insert/category-selector.js`** — PONTO DE IA: categorização via mini
- **`tools/finance-bridge/insert/assembler.js`** — PONTO DE IA: extração de dados via nano
- **`tools/finance-bridge/validators.js`** — LÓGICA PURA: validação de tipos/ranges
- **`tools/finance-bridge/executor.js`** — LÓGICA PURA: execução no MongoDB
- **`tools/search/*.js`** — LÓGICA PURA: chamadas HTTP às APIs externas

### 3.2 Modelos de IA conforme constituição

| Componente | Modelo | Reasoning | Verbosity | Justificativa |
|------------|--------|-----------|-----------|---------------|
| Junior (classificação) | Mini | Medium | Low | Raciocínio local, escopo bem definido |
| Junior (follow-up) | Mini | Medium | Low | Inferência contextual de memória |
| Query Builder (NL→JSON) | Nano | — | — | Conversão de formato, tarefa repetitiva |
| Insert Classifier | Nano | — | — | Classificação binária simples |
| Category Selector | Mini | Medium | Low | Raciocínio contextual (Uber vs Uber Eats) |
| Insert Assembler | Nano | — | — | Extração de dados + formatação JSON |

### 3.3 Regras de envio de memória

Conforme constituição:
- **bridge_query** → Memória COMPLETA enviada
- **bridge_insert** → Memória NÃO enviada
- **serper** → Memória COMPLETA enviada
- **escalate** → Memória COMPLETA + query (delegado à Fase 3)

Implementadas no `Dispatcher.route()` com separação clara nos métodos `_handleBridgeQuery`, `_handleBridgeInsert`, `_handleSerper` e `_handleEscalate`.

### 3.4 Fallbacks robustos

| Componente | Falha | Fallback |
|------------|-------|----------|
| Junior (classificação) | IA retorna JSON inválido | Escalata para Orquestrador |
| Junior (follow-up) | IA falha | Pergunta genérica baseada em campos faltantes |
| Query Builder | IA não retorna JSON | Exceção propagada (query não executada) |
| Insert Classifier | IA retorna tipo inválido | Default: "expense" (maioria das transações) |
| Category Selector | Categoria não existe na lista | Match parcial → primeira categoria |
| Insert Assembler | IA falha | Extração manual de valor via regex |
| APIs externas | Timeout ou erro HTTP | Exceção propagada com log de erro |

### 3.5 Logging — Continuidade com Fase 1

- Todo log da Fase 2 passa pelo `logger.js` da Fase 1 (sem modificações)
- Tipos de log usados: `logic` para lógica pura, `ai` para pontos de IA, `system` para infraestrutura
- Nenhum módulo novo escreve logs diretamente em arquivos
- Logs são estratégicos: cada entrada responde "o que tentou?", "que decisão?", ou "o que deu errado?"
- O arquivo `.md` de logs é único e contínuo — Fase 2 adiciona entradas ao histórico existente

### 3.6 Períodos inteligentes

Seis períodos nomeados implementados no `executor.js`:
- `current_month` → 01/mês até hoje
- `last_month` → Mês anterior completo
- `last_quarter` → Últimos 3 meses fechados
- `last_6_days` → 6 dias anteriores
- `fiscal_year` → 01/01 até hoje
- `since_last_payday` → Desde dia 5 do mês (padrão refinável com dados reais)

### 3.7 APIs externas — diferenças respeitadas

Conforme `diferenças_API.md`:
- **Serper** → Canivete suíço: buscas rápidas, notícias, fatos imediatos
- **Brapi** → Especialista em mercado: cotações, indicadores, fundamentos. Regra de Ouro: se há ticker, usar Brapi
- **Tavily** → Analista estratégico: pesquisa profunda, contexto limpo, sem spam SEO

A detecção automática no `BrapiClient.search()` identifica tickers, criptos, moedas e indicadores.

---

## 4. Como a Fase 2 respeita a visão geral

| Princípio da Constituição | Como foi implementado |
|---|---|
| "IA Decide, Lógica Executa" | Junior (IA) classifica → Dispatcher (lógica) roteia → Ferramentas (lógica) executam |
| Agente Junior: GPT-5-mini | `ModelFactory.getMini('medium', 'low')` em `agents/junior/index.js` |
| Finance Bridge Query: GPT-5-nano | `ModelFactory.getNano()` em `query-builder.js` |
| Insert Pipeline: 3 passos (nano→mini→nano) | `classifier.js` (nano) → `category-selector.js` (mini) → `assembler.js` (nano) |
| Memória NÃO enviada para inserts | `Dispatcher._handleBridgeInsert(query)` — sem parâmetro memory |
| Memória COMPLETA para queries | `Dispatcher._handleBridgeQuery(query, memory)` — memory completa |
| Follow-up contextual | `followup.js` analisa memória recente via IA para inferir contexto faltante |
| Validação em camadas | IA gera → lógica valida estrutura/tipos → lógica executa no MongoDB |
| Resiliência | Fallbacks em todos os pontos de IA, timeout em APIs, sanitização contra injection |

---

## 5. Como a Fase 2 se integra com a Fase 1

| Módulo Fase 1 | Uso na Fase 2 |
|---|---|
| `logger.js` | Usado por TODOS os módulos novos — sem modificação |
| `config/index.js` | Estendido com `apis` (Serper, Brapi, Tavily) — sem quebrar existente |
| `ModelFactory` | Usado pelo Junior (getMini), QueryBuilder (getNano), Insert Pipeline (getNano, getMini) |
| `AIClient` / `OpenAIClient` | Base para todas as chamadas de IA da Fase 2 |
| `Memory` / `Cycle` | Memória passada ao Junior e ao Dispatcher conforme regras da constituição |
| `index.js` (entry point) | Estendido com exports da Fase 2 — sem quebrar exports da Fase 1 |

Nenhum módulo da Fase 1 foi modificado (exceto `config/index.js` e `index.js`, que foram estendidos).

---

## 6. Pontos de atenção para fases futuras

### Fase 3 — Orquestração
- O `Dispatcher._handleEscalate()` retorna indicador de escalada — precisa ser conectado ao `core/orchestrator/`
- Os Coordenadores vão usar `SearchManager` com todas as 3 APIs (Serper, Brapi, Tavily)
- O `FinanceBridge` está pronto para ser usado como ferramenta dos Coordenadores
- Os contratos dos coordenadores devem ser extraídos de `diferenças_coor.md`

### Fase 4 — API HTTP e Resposta
- O `junior.analyze()` + `Dispatcher.route()` formam o pipeline principal para o endpoint de mensagem
- O `FinanceBridge` expõe `query()` e `insert()` já preparados para o fluxo HTTP
- O `SearchManager` centraliza acesso a APIs externas

### Atenção especial
- **API Keys**: Serper, Brapi e Tavily requerem variáveis de ambiente configuradas (`.env`)
- **Concorrência MongoDB**: o executor do Finance Bridge abre conexão separada do MemoryStorage — considerar pool compartilhado na Fase 4
- **Rate limiting**: APIs externas podem ter limites — considerar cache de resultados (especialmente Brapi para cotações)
- **Timeout do Tavily**: configurado com 2x do timeout padrão (`search * 2`) por ser naturalmente mais lento

---

## 7. Bateria de Testes Funcionais (15 testes manuais)

Estes testes devem ser executados no chat do frontend quando a integração estiver completa (Fase 4). Para a Fase 2, validam-se via chamadas diretas aos módulos.

### Teste 1 — Junior classifica consulta financeira simples
- **Entrada:** "Quanto gastei este mês?"
- **Comportamento esperado:** Junior retorna `{ decision: "bridge_query" }` com reasoning claro
- **Qualidade esperada:** Classificação instantânea, JSON válido
- **Deve aparecer nos logs:** `[INFO] ai | Junior — Query classificada como "bridge_query"`
- **Não deve aparecer:** Logs de follow-up ou escalada

### Teste 2 — Junior classifica lançamento completo
- **Entrada:** "Gastei R$50 no almoço"
- **Comportamento esperado:** Junior retorna `{ decision: "bridge_insert", needs_followup: false }`
- **Qualidade esperada:** Reconhece valor (50) e descrição (almoço)
- **Deve aparecer nos logs:** `[INFO] ai | Junior — Query classificada como "bridge_insert"`
- **Não deve aparecer:** Logs de follow-up

### Teste 3 — Junior detecta lançamento incompleto
- **Entrada:** "Gastei 200"
- **Comportamento esperado:** Junior retorna `{ decision: "bridge_insert", needs_followup: true, followup_question: "..." }`
- **Qualidade esperada:** Follow-up pergunta "em quê?" de forma contextualizada
- **Deve aparecer nos logs:** `[INFO] ai | Junior — Query classificada como "bridge_insert"` + `[DEBUG] ai | JuniorFollowup — Follow-up gerado`
- **Não deve aparecer:** Classificação como bridge_query

### Teste 4 — Junior classifica busca externa
- **Entrada:** "Qual a taxa Selic atual?"
- **Comportamento esperado:** Junior retorna `{ decision: "serper" }`
- **Qualidade esperada:** Reconhece que é informação pública
- **Deve aparecer nos logs:** `[INFO] ai | Junior — Query classificada como "serper"`
- **Não deve aparecer:** Logs de Finance Bridge

### Teste 5 — Junior escala tarefa complexa
- **Entrada:** "Analise meus investimentos e sugira ajustes no orçamento"
- **Comportamento esperado:** Junior retorna `{ decision: "escalate" }` com reasoning explicando multi-agente
- **Qualidade esperada:** Reconhece necessidade de múltiplas áreas (investimentos + planejamento)
- **Deve aparecer nos logs:** `[INFO] ai | Junior — Query classificada como "escalate"` + `[INFO] logic | Dispatcher — Query escalada para Orquestrador`
- **Não deve aparecer:** Tentativa de execução direta

### Teste 6 — Dispatcher roteia para Finance Bridge (query)
- **Entrada:** Decisão `{ decision: "bridge_query" }` com query "Gastos do mês"
- **Comportamento esperado:** Dispatcher chama `financeBridge.query()` com memória completa
- **Qualidade esperada:** Resultado com dados do MongoDB
- **Deve aparecer nos logs:** `[DEBUG] logic | Dispatcher — Roteando para "bridge_query"` + `[INFO] logic | FinanceBridge — Query retornou N resultados`
- **Não deve aparecer:** Logs de insert ou busca externa

### Teste 7 — Finance Bridge converte NL para JSON
- **Entrada:** "Busque gastos de alimentação entre R$120 e R$145 nos últimos 6 dias"
- **Comportamento esperado:** QueryBuilder retorna JSON com `categories: ["Alimentação"]`, `amount.min: 120`, `amount.max: 145`, `named_period: "last_6_days"`
- **Qualidade esperada:** JSON válido conforme schema, filtros corretos
- **Deve aparecer nos logs:** `[DEBUG] ai | QueryBuilder — Query NL convertida para JSON`
- **Não deve aparecer:** Erros de validação

### Teste 8 — Validador rejeita query inválida
- **Entrada:** JSON com `amount.min: -50` (valor negativo)
- **Comportamento esperado:** Validador retorna `{ valid: false }` com erro explicativo
- **Qualidade esperada:** Mensagem de erro clara e específica
- **Deve aparecer nos logs:** `[WARN] logic | FinanceBridgeValidator — Validação de query falhou`
- **Não deve aparecer:** Tentativa de execução no MongoDB

### Teste 9 — Pipeline de insert completo
- **Entrada:** "Gastei R$50 no almoço"
- **Comportamento esperado:** Pipeline executa 3 passos: classifier→"expense", category→"Alimentação", assembler→JSON completo
- **Qualidade esperada:** Lançamento salvo no MongoDB com amount=50, category="Alimentação"
- **Deve aparecer nos logs:** `[DEBUG] ai | InsertClassifier — Transação classificada como "expense"` + `[DEBUG] ai | CategorySelector — Categoria selecionada: "Alimentação"` + `[DEBUG] ai | InsertAssembler — Lançamento montado com sucesso` + `[INFO] logic | FinanceBridgeInsert — Pipeline de insert concluído`
- **Não deve aparecer:** Logs de fallback

### Teste 10 — Insert com caso ambíguo
- **Entrada:** "Uber Eats R$35"
- **Comportamento esperado:** CategorySelector classifica como "Alimentação" (não Transporte)
- **Qualidade esperada:** Análise contextual correta, subcategoria "Delivery"
- **Deve aparecer nos logs:** `[DEBUG] ai | CategorySelector — Categoria selecionada: "Alimentação"`
- **Não deve aparecer:** Categoria "Transporte"

### Teste 11 — Fallback do clasificador de insert
- **Entrada:** IA falha (timeout simulado) ao classificar tipo
- **Comportamento esperado:** Fallback retorna "expense"
- **Qualidade esperada:** Pipeline continua sem interrupção
- **Deve aparecer nos logs:** `[ERROR] ai | InsertClassifier — Falha ao classificar transação, usando fallback "expense"`
- **Não deve aparecer:** Crash do sistema

### Teste 12 — Busca via Serper
- **Entrada:** "taxa selic fevereiro 2026" via SearchManager
- **Comportamento esperado:** Serper retorna resultados orgânicos do Google
- **Qualidade esperada:** Resultados relevantes, answerBox quando disponível
- **Deve aparecer nos logs:** `[DEBUG] logic | SerperClient — Busca retornou N resultados orgânicos`
- **Não deve aparecer:** Logs de Brapi ou Tavily

### Teste 13 — Busca via Brapi (ticker)
- **Entrada:** "PETR4" via SearchManager com source="brapi"
- **Comportamento esperado:** Brapi retorna cotação atualizada de PETR4
- **Qualidade esperada:** Dados estruturados com preço, variação, volume
- **Deve aparecer nos logs:** `[DEBUG] logic | BrapiClient — Dados recebidos para /quote/PETR4`
- **Não deve aparecer:** Logs de Serper (Regra de Ouro: ticker → Brapi)

### Teste 14 — Busca via Tavily (pesquisa profunda)
- **Entrada:** "Tendências do mercado imobiliário 2026" via SearchManager com source="tavily"
- **Comportamento esperado:** Tavily retorna análise profunda com resposta e resultados filtrados
- **Qualidade esperada:** Conteúdo limpo, sem spam/SEO, focado em pesquisa
- **Deve aparecer nos logs:** `[DEBUG] logic | TavilyClient — Pesquisa retornou N resultados`
- **Não deve aparecer:** Logs de Serper ou Brapi

### Teste 15 — Fallback do Junior (IA falha completamente)
- **Entrada:** Chamada de IA do Junior falha com exceção
- **Comportamento esperado:** Junior retorna `{ decision: "escalate" }` como fallback seguro
- **Qualidade esperada:** Sistema não quebra, query é escalada para tratamento
- **Deve aparecer nos logs:** `[ERROR] ai | Junior — Falha ao analisar query`
- **Não deve aparecer:** Stack traces completos ou crash do sistema

---

**Fase 2 concluída com sucesso.**  
**16 módulos implementados (6 com IA, 10 com lógica pura).**  
**Pronto para iniciar Fase 3.**
