# Análise de Latência — Yield Server

**Data:** 11/02/2026  
**Autor:** Arquiteto de Performance  
**Status:** Análise Completa  
**Caso de teste:** "Faça uma análise completa das minhas finanças e sugira um plano de ação"  
**Tempo total observado:** 671.730ms (~11min 12s)

---

## 1. Resumo Executivo

O sistema Yield Server apresenta latência de **~11 minutos** para queries complexas com escalada (3 coordenadores). A arquitetura é sólida e a qualidade das respostas é alta, porém o fluxo de execução sofre de **três gargalos estruturais** que se combinam para multiplicar a latência:

1. **Execução estritamente sequencial dos coordenadores** — Analysis → Planning → Investments executam um após o outro, sem paralelismo entre agentes independentes.
2. **Execução sequencial das tool_requests dentro de cada coordenador** — 7 queries ao Finance Bridge executadas uma a uma, quando poderiam ser paralelas.
3. **QueryBuilder (nano) excessivamente lento** — Cada conversão NL→JSON leva 18-29s (~23s média), representando **51.8% do tempo total**.

**Potencial de redução estimado:** 35-50% (de ~11min para ~5.5-7min), mantendo 100% da qualidade.

---

## 2. Diagnóstico Técnico — Cronologia Detalhada do Log

### 2.1 Timeline Completa (23:08:32 → 23:19:44)

| Fase | Início | Fim | Duração | Modelo | Tokens | Descrição |
|------|--------|-----|---------|--------|--------|-----------|
| Auth + Validação | 23:08:32.307 | 23:08:32.329 | 22ms | — | — | Middleware + validação |
| Carregar Memória | 23:08:32.329 | 23:08:32.630 | 301ms | — | — | MongoDB (memória vazia) |
| **Junior** | 23:08:32.630 | 23:08:38.679 | **6.049ms** | gpt-5-mini | 2.594 | Classificação → "escalate" |
| **Orquestrador** | 23:08:38.707 | 23:09:01.089 | **22.382ms** | gpt-5.2 | 2.737 | Gera DOC com 3 agentes |
| **Analysis (total)** | 23:09:01.119 | 23:12:49.490 | **228.371ms** | — | — | Prioridade 1, sem deps |
| ↳ Step 1 (planejamento) | 23:09:01.119 | 23:09:34.684 | 33.565ms | gpt-5.2 | 3.379 | 7 tool_requests geradas |
| ↳ Tool 1 (QueryBuilder) | 23:09:34.691 | 23:09:58.171 | 23.480ms | gpt-5-nano | 4.272 | "transações últimos 6 meses" → 19 |
| ↳ Tool 2 (QueryBuilder) | 23:09:58.178 | 23:10:26.972 | 28.794ms | gpt-5-nano | 5.211 | "consolidado mensal" → 19 |
| ↳ Tool 3 (QueryBuilder) | 23:10:26.979 | 23:10:53.865 | 26.886ms | gpt-5-nano | 4.687 | "totais por categoria" → 12 |
| ↳ Tool 4 (QueryBuilder) | 23:10:53.869 | 23:11:13.376 | 19.507ms | gpt-5-nano | 3.902 | "recorrentes" → **0** |
| ↳ Tool 5 (QueryBuilder) | 23:11:13.387 | 23:11:38.869 | 25.482ms | gpt-5-nano | 4.693 | "duplicidades" → 14 |
| ↳ Tool 6 (QueryBuilder) | 23:11:39.074 | 23:11:57.151 | 18.077ms | gpt-5-nano | 3.825 | "dívidas" → **0** |
| ↳ Tool 7 (QueryBuilder) | 23:11:57.226 | 23:12:21.607 | 24.381ms | gpt-5-nano | 4.422 | "despesas fixas" → 1 |
| ↳ Step 2 (síntese) | 23:12:21.617 | 23:12:49.484 | 27.867ms | gpt-5.2 | 4.579 | Sintetiza com dados reais |
| **Planning (total)** | 23:12:49.516 | 23:17:23.798 | **274.282ms** | — | — | Prioridade 2, dep: analysis |
| ↳ Step 1 (planejamento) | 23:12:49.516 | 23:14:09.960 | 80.444ms | gpt-5.2 | 7.099 | 6 tool_requests geradas |
| ↳ Tool 1 (QueryBuilder) | 23:14:09.980 | 23:14:28.210 | 18.230ms | gpt-5-nano | 3.538 | "transações 6 meses" → 19 |
| ↳ Tool 2 (QueryBuilder) | 23:14:28.491 | 23:14:48.028 | 19.537ms | gpt-5-nano | 3.730 | "receitas mensais" → 5 |
| ↳ Tool 3 (QueryBuilder) | 23:14:48.049 | 23:15:17.171 | 29.122ms | gpt-5-nano | 4.358 | "despesas por categoria" → 14 |
| ↳ Tool 4 (QueryBuilder) | 23:15:17.175 | 23:15:42.749 | 25.574ms | gpt-5-nano | 4.174 | "recorrentes/assinaturas" → **0** |
| ↳ Tool 5 (QueryBuilder) | 23:15:42.752 | 23:16:04.794 | 22.042ms | gpt-5-nano | 3.727 | "dívidas/parcelamentos" → **0** |
| ↳ Tool 6 (QueryBuilder) | 23:16:04.809 | 23:16:23.720 | 18.911ms | gpt-5-nano | 3.266 | "contas conectadas" → **0** |
| ↳ Step 2 (síntese) | 23:16:23.743 | 23:17:23.779 | 60.036ms | gpt-5.2 | 7.556 | Sintetiza com dados reais |
| **Investments (total)** | 23:17:23.810 | 23:19:19.413 | **115.603ms** | — | — | Prioridade 3, dep: analysis+planning |
| ↳ Step 1 (planejamento) | 23:17:23.810 | 23:17:57.201 | 33.391ms | gpt-5.2 | 7.915 | 2 tool_requests geradas |
| ↳ Tool 1 (QueryBuilder) | 23:17:57.211 | 23:18:22.109 | 24.898ms | gpt-5-nano | 4.155 | "carteira do usuário" → 7 |
| ↳ Tool 2 (QueryBuilder) | 23:18:22.115 | 23:18:45.648 | 23.533ms | gpt-5-nano | 4.394 | "histórico aportes" → 0 |
| ↳ Step 2 (síntese) | 23:18:45.650 | 23:19:19.407 | 33.757ms | gpt-5.2 | 8.877 | Sintetiza com dados reais |
| **ResponseAgent** | 23:19:19.500 | 23:19:43.900 | **24.400ms** | gpt-5.2 | 8.184 | Síntese final → 4785 chars |
| Salvar Memória | 23:19:43.902 | 23:19:44.048 | 146ms | — | — | MongoDB |

### 2.2 Distribuição do Tempo

| Componente | Tempo (ms) | % do Total | Chamadas |
|------------|-----------|------------|----------|
| QueryBuilder (nano) | **347.454ms** | **51.8%** | 15 chamadas |
| Coordenadores Step 1 (full) | **147.400ms** | 21.9% | 3 chamadas |
| Coordenadores Step 2 (full) | **121.660ms** | 18.1% | 3 chamadas |
| Orquestrador (full) | 22.382ms | 3.3% | 1 chamada |
| ResponseAgent (full) | 24.400ms | 3.6% | 1 chamada |
| Junior (mini) | 6.049ms | 0.9% | 1 chamada |
| MongoDB (todas as ops) | ~2.000ms | 0.3% | ~20 chamadas |
| Overhead lógica | ~500ms | 0.1% | — |
| **TOTAL** | **~671.730ms** | **100%** | **24 chamadas IA** |

### 2.3 Conclusão do Diagnóstico

- **99.6% do tempo é gasto em chamadas LLM.**
- O MongoDB é irrelevante para latência (~2s total).
- A lógica de orquestração é eficiente (~500ms).
- O problema é **quantitativo** (24 chamadas IA) e **estrutural** (execução serial).

---

## 3. Pontos Específicos de Intervenção

### 3.1 — Execução Sequencial de Tool Requests nos Coordenadores

**Localização:** `src/agents/coordinators/base.js` → método `_executeToolRequests()`

**Causa da latência:**  
O método `_executeToolRequests()` executa cada tool request em um loop `for...of` sequencial:
```javascript
for (const request of toolRequests) {
  const result = await this._executeSingleTool(request, chatId);
  // ...
}
```
Cada chamada ao Finance Bridge inclui uma chamada LLM ao QueryBuilder (nano), que leva ~23s em média. Com 7 tool requests, são ~166s sequenciais quando poderiam ser ~23s em paralelo.

**Proposta de otimização:**  
Substituir o loop sequencial por `Promise.all()` com controle de concorrência:
```javascript
async _executeToolRequests(toolRequests, chatId) {
  const results = {};
  const promises = toolRequests.map(async (request) => {
    const key = `${request.tool}:${request.action || 'default'}`;
    try {
      const result = await this._executeSingleTool(request, chatId);
      results[key] = { success: true, data: result };
    } catch (error) {
      results[key] = { success: false, error: error.message };
    }
  });
  await Promise.all(promises);
  return results;
}
```

**Justificativa de preservação de qualidade:**  
As tool requests são **independentes entre si** por definição — o coordenador as solicita todas no Passo 1 antes de receber qualquer resultado. A ordem de execução não afeta o resultado. Todas são entregues ao Passo 2 (síntese) da mesma forma. Zero impacto na qualidade.

**Impacto estimado:**  
- Analysis: tools de ~166s → ~29s (economia: **~137s**)
- Planning: tools de ~133s → ~29s (economia: **~104s**)
- Investments: tools de ~48s → ~25s (economia: **~23s**)
- **Economia total: ~264s (4min 24s) = redução de ~39%**

---

### 3.2 — Execução Sequencial dos Coordenadores no ExecutionManager

**Localização:** `src/core/orchestrator/execution-manager.js` → método `execute()`

**Causa da latência:**  
O ExecutionManager processa agentes em um `for...of` sequencial. Mesmo agentes **sem dependência mútua** esperam pelo término do anterior. No caso observado:
- Analysis (prioridade 1, sem deps): 228s
- Planning (prioridade 2, dep: analysis): 274s  
- Investments (prioridade 3, dep: analysis + planning): 116s
- **Total serial: 618s**

O Orquestrador colocou Investments como dependente de Planning. Mas mesmo se fosse necessário, Analysis e Investments poderiam começar simultaneamente em muitos cenários.

**Proposta de otimização:**  
Implementar execução por **wave/batch** — agentes na mesma prioridade sem dependências pendentes iniciam simultaneamente:

```javascript
async execute(doc, chatId) {
  const queue = new ExecutionQueue();
  const agents = doc.execution_plan.agents;
  const sorted = queue.sortByPriority(agents);
  
  // Agrupar por onda de execução
  while (sorted.length > 0) {
    // Encontrar agentes cujas dependências já foram resolvidas
    const ready = sorted.filter(a => 
      a.dependencies.every(dep => queue.isCompleted(dep))
    );
    
    if (ready.length === 0) break; // Deadlock prevention
    
    // Remover do pool
    ready.forEach(a => sorted.splice(sorted.indexOf(a), 1));
    
    // Executar wave em paralelo
    await Promise.all(ready.map(async (agentSpec) => {
      const input = prepareInput(agentSpec, queue.getResults(), chatId);
      const coordinator = this.coordinators[agentSpec.agent];
      const result = await coordinator.execute(input);
      queue.markCompleted(agentSpec.agent, result);
    }));
  }
}
```

**Justificativa de preservação de qualidade:**  
Agentes com dependências continuam aguardando — a semântica de dependência é preservada. Apenas agentes verdadeiramente independentes rodam em paralelo. A qualidade dos outputs individuais não é afetada.

**Impacto estimado (com dependências atuais):**  
Com a árvore atual (analysis → planning → investments), a paralelização direta é limitada pelas dependências declaradas. Porém, combinado com 3.3 (prompt de paralelismo no Orquestrador), o impacto é significativo.

**Impacto se Investments dependesse apenas de Analysis (não de Planning):**  
- Wave 1: Analysis = 228s  
- Wave 2: Planning + Investments em paralelo = max(274s, 116s) = 274s  
- **Total: 502s** (vs 618s serial) = economia de **~116s (19%)**

---

### 3.3 — Orquestrador Declara Dependências Excessivamente Conservadoras

**Localização:** `src/agents/orchestrator/prompt.js`

**Causa da latência:**  
O DOC gerado declarou Investments como dependente de AMBOS Analysis e Planning. Na query "análise completa + plano de ação", Investments poderia depender apenas de Analysis (para saber o contexto financeiro), não de Planning. O Planning e Investments poderiam correr em paralelo após Analysis.

**Proposta de otimização:**  
Adicionar ao prompt do Orquestrador uma diretriz explícita sobre minimização de dependências:
```
REGRA DE DEPENDÊNCIAS:
- Declare dependência APENAS quando o output do agente anterior é INSUMO DIRETO para o trabalho.
- Prefira dependências mínimas para maximizar execução paralela.
- Se dois agentes podem trabalhar independentemente após receber o mesmo insumo base, NÃO os encadeie.
- Exemplo: Se A fornece diagnóstico, e B (plano) e C (investimentos) usam o diagnóstico mas NÃO se usam mutuamente, B e C devem depender apenas de A, não de B→C.
```

**Justificativa de preservação de qualidade:**  
A IA continua decidindo dependências — apenas recebe orientação explícita para declarar dependências **mínimas necessárias**. Quando houver dependência real, ela será declarada. A qualidade das análises individuais não é afetada.

**Impacto estimado:** Permite que a otimização 3.2 alcance seu potencial máximo. Combinado com 3.2: economia de **~116-150s (17-22%)**.

---

### 3.4 — QueryBuilder (Nano) Envia Schema Completo em Cada Chamada

**Localização:** `src/tools/finance-bridge/query-builder.js` → constante `QUERY_BUILDER_SYSTEM_PROMPT`

**Causa da latência:**  
Cada chamada ao QueryBuilder inclui o schema completo do Finance Bridge no system prompt. Com 15 chamadas no caso observado, o schema foi processado 15 vezes. O schema + regras contribuem para os ~4000 tokens por chamada, o que é alto para uma conversão NL→JSON por nano.

**Proposta de otimização:**  
1. **Reduzir o schema no prompt** — incluir apenas campos essenciais, remover exemplos redundantes.
2. **Cache de schema tokenizado** — se a API permitir, usar system prompt cacheável.
3. **Considerar conversão determinística para padrões comuns** — para queries como "últimos 6 meses", "mês atual", usar template pré-construído em vez de LLM.

**Justificativa de preservação de qualidade:**  
A redução de schema mantém todas as capacidades — apenas remove redundância documental. Templates determinísticos seriam usados apenas para padrões triviais e com fallback para IA.

**Impacto estimado:** Redução de ~20-30% no tempo por chamada QueryBuilder (de ~23s para ~16-18s). Com 15 chamadas, economia de ~**75-105s (11-16%)**.

---

### 3.5 — Queries Redundantes Entre Coordenadores

**Localização:** `src/agents/coordinators/base.js` → sem cache cross-coordinator

**Causa da latência:**  
Dados idênticos são consultados por coordenadores diferentes:
- Analysis consulta "transações últimos 6 meses" → 19 resultados
- Planning consulta "transações últimos 6 meses (receitas e despesas)" → **mesmos 19 resultados**
- Ambos consultam "recorrentes" → 0 resultados
- Ambos consultam "dívidas" → 0 resultados

Há **pelo menos 4-5 queries completamente duplicadas**, cada uma custando ~23s de QueryBuilder + MongoDB.

**Proposta de otimização:**  
Implementar um **cache de resultados de ferramentas por ciclo** no escopo do `ExecutionManager`:

```javascript
class ToolResultCache {
  constructor() { this.cache = new Map(); }
  
  getCacheKey(tool, action, paramsHash) {
    return `${tool}:${action}:${paramsHash}`;
  }
  
  async getOrExecute(tool, action, params, executeFn) {
    const key = this.getCacheKey(tool, action, hash(params));
    if (this.cache.has(key)) return this.cache.get(key);
    const result = await executeFn();
    this.cache.set(key, result);
    return result;
  }
}
```

O cache vive apenas durante a execução do DOC e é destruído ao final do ciclo.

**Complexidade:** A dificuldade aqui é que os coordenadores enviam queries em **linguagem natural** ao QueryBuilder, e queries semanticamente idênticas têm texto diferente. O cache precisaria operar após a conversão NL→JSON, comparando o JSON resultante.

**Alternativa mais viável:** Fornecer dados pré-carregados aos coordenadores como contexto compartilhado (ver 4.7).

**Justificativa de preservação de qualidade:**  
Cache retorna resultados idênticos — zero impacto na qualidade. Os coordenadores recebem exatamente os mesmos dados.

**Impacto estimado:** Eliminação de ~5 chamadas QueryBuilder duplicadas = economia de **~115s (17%)**.

---

### 3.6 — Coordenadores Geram Tool Requests Especulativas com Resultado Vazio

**Localização:** Prompt dos coordenadores (`src/agents/coordinators/prompt-template.js`)

**Causa da latência:**  
No caso analisado:
- "Cobrancas recorrentes/assinaturas" → **0 resultados** (Analysis E Planning pediram = 2 chamadas)
- "Dívidas/parcelamentos" → **0 resultados** (Analysis E Planning = 2 chamadas)
- "Contas conectadas" → **0 resultados** (Planning = 1 chamada)
- "Histórico de aportes" → **0 resultados** (Investments = 1 chamada)

São **6 chamadas completamente inúteis**, cada uma custando ~23s. Total desperdiçado: **~138s**.

**Proposta de otimização:**  
Incluir no prompt dos coordenadores orientação para priorizar queries com alta probabilidade de retorno:
```
REGRA DE FERRAMENTAS:
- Solicite APENAS ferramentas cujas queries tenham alta probabilidade de retornar dados úteis.
- Para um usuário SEM histórico prévio na memória, NÃO solicite queries de: recorrentes, assinaturas, dívidas, contas conectadas — a menos que o usuário tenha mencionado explicitamente esses itens.
- Prefira queries amplas (ex: "todas as transações dos últimos 6 meses") em vez de múltiplas queries especializadas — a análise dos subconjuntos pode ser feita na etapa de síntese.
- Máximo de tool_requests recomendado: 3 a 4 por coordenador.
```

**Justificativa de preservação de qualidade:**  
Queries que retornam 0 resultados não contribuem para a qualidade da resposta. A redução de queries especulativas não remove nenhum dado real — apenas evita gastar tempo buscando dados que não existem. O coordenador continua analisando os dados que existem.

**Impacto estimado:** Redução de ~4-6 chamadas nano = economia de **~92-138s (14-21%)**.

---

### 3.7 — ResponseAgent Não Recebe os Outputs via Streaming

**Localização:** `src/api/routes/message.js` → fluxo principal

**Causa da latência percebida:**  
O usuário espera os **11 minutos completos** antes de ver qualquer resposta. O ResponseAgent só começa após todos os coordenadores terminarem.

**Proposta de otimização (médio prazo):**  
Implementar **streaming parcial** via Server-Sent Events (SSE) ou WebSocket:
1. Enviar status de progresso ao cliente ("Analisando suas finanças...", "Planejando ação...")
2. Quando cada coordenador terminar, enviar resultado parcial
3. ResponseAgent sintetiza no final, mas o usuário já viu progresso

**Justificativa de preservação de qualidade:**  
A resposta final permanece idêntica. O streaming é apenas UX — não altera o processamento.

**Impacto na latência real:** Nenhum (mesma duração total), mas impacto enorme na **latência percebida**.

---

## 4. Estratégias de Otimização

### 4.1 Arquitetura

| Estratégia | Descrição | Risco |
|------------|-----------|-------|
| Wave-based execution no ExecutionManager | Agentes sem dependências pendentes iniciam simultaneamente | Baixo — respeita dependências declaradas |
| Prompt do Orquestrador com diretriz de dependências mínimas | IA declara dependências mínimas necessárias | Baixo — IA mantém julgamento |

### 4.2 Orquestração

| Estratégia | Descrição | Risco |
|------------|-----------|-------|
| Parallel tool execution nos coordenadores | `Promise.all()` para tool requests independentes | Mínimo — tools já são independentes por design |
| Limitar tool_requests por coordenador | Orientar IA a pedir no máximo 3-4 queries | Baixo — queries com 0 resultados são noise |

### 4.3 Comunicação entre Agentes

| Estratégia | Descrição | Risco |
|------------|-----------|-------|
| Dados compartilhados via contexto pré-carregado | Carregar dados financeiros base ANTES dos coordenadores e injetar como contexto, eliminando queries redundantes | Médio — requer mudança no input-builder |
| Dependency outputs mais ricos | Incluir dados brutos (não só análise) nos outputs de agentes anteriores | Baixo — depende de prompt |

### 4.4 Uso de Contexto

| Estratégia | Descrição | Risco |
|------------|-----------|-------|
| System prompt cacheável | Usar cache de prompt para o QueryBuilder (reduz tokens reprocessados) | Mínimo — depende da API do provedor |
| Reduzir schema no QueryBuilder | Schema mais enxuto, sem redundância documental | Baixo — manter campos essenciais |

### 4.5 Paralelização

| Estratégia | Descrição | Risco |
|------------|-----------|-------|
| Tool requests em paralelo (dentro de cada coordenador) | `Promise.all()` em `_executeToolRequests()` | Mínimo — mudança de 5 linhas |
| Coordenadores em paralelo (entre ondas) | Wave-based execution no ExecutionManager | Baixo — respeita grafo de dependências |

### 4.6 Cache Inteligente

| Estratégia | Descrição | Risco |
|------------|-----------|-------|
| Cache de Finance Bridge por ciclo | Cache de resultados MongoDB durante execução do DOC | Baixo — cache destruído após ciclo |
| Cache de QueryBuilder (NL→JSON) | Cache normalizado por hash da query | Médio — requer normalização semântica |

### 4.7 Estratégias Híbridas

| Estratégia | Descrição | Risco |
|------------|-----------|-------|
| **Pre-fetch financeiro** | Antes dos coordenadores, executar 1-2 queries genéricas ("todas transações últimos 6 meses", "resumo mensal") e injetar os dados como contexto compartilhado. Coordenadores pedem queries adicionais apenas se necessário. Elimina redundância e reduz número total de tool requests. | Médio — requer orquestração adicional no Dispatcher, mas preserva qualidade pois coordenadores ainda podem pedir dados extras |
| **Two-pass otimizado** | No Passo 1 do coordenador, se a IA solicitar queries ao Finance Bridge, converter TODAS as queries NL→JSON em paralelo antes de executar no MongoDB. Atualmente, cada query passa pelo ciclo completo (NL→JSON→MongoDB) sequencialmente | Baixo — separação de fases dentro do mesmo fluxo |

---

## 5. Estimativa de Impacto

### Classificação por Impacto

| # | Otimização | Impacto | Redução Estimada | Complexidade |
|---|-----------|---------|------------------|-------------|
| 1 | **Tool requests em paralelo** (3.1) | 🔴 **Alto** | **~264s (39%)** | Baixa (5 linhas) |
| 2 | **Coordenadores em paralelo** (3.2 + 3.3) | 🟡 **Médio-Alto** | **~116-150s (17-22%)** | Média |
| 3 | **Reduzir queries especulativas** (3.6) | 🟡 **Médio** | **~92-138s (14-21%)** | Baixa (prompt) |
| 4 | **Eliminar queries redundantes** (3.5) | 🟡 **Médio** | **~115s (17%)** | Média-Alta |
| 5 | **Otimizar prompt QueryBuilder** (3.4) | 🟢 **Baixo-Médio** | **~75-105s (11-16%)** | Baixa |
| 6 | **Streaming de progresso** (3.7) | 🟢 **Baixo** (real) / 🔴 **Alto** (percebido) | 0s real | Alta |

> **Nota:** As reduções NÃO são perfeitamente cumulativas. A otimização #1 é independente das demais. As otimizações #3 e #4 reduzem o pool de queries que #1 paraleliza, criando redução composta.

### Cenário Conservador (apenas #1 + #3)

**Implementação:** Paralelizar tool requests + reduzir queries especulativas.

| Fase | Antes | Depois |
|------|-------|--------|
| Junior | 6s | 6s |
| Orquestrador | 22s | 22s |
| Analysis (7 tools → 4 tools, paralelas) | 228s | 34s + 29s + 28s = **~91s** |
| Planning (6 tools → 3 tools, paralelas; sequencial após Analysis) | 274s | 80s + 29s + 60s = **~169s** |
| Investments (2 tools, paralelas; sequencial após Planning) | 116s | 33s + 25s + 34s = **~92s** |
| ResponseAgent | 24s | 24s |
| **Total** | **~671s** | **~404s** |
| **Redução** | — | **~40%** |

### Cenário Otimista (todas as otimizações aplicáveis)

**Implementação:** #1 + #2 + #3 + #5

| Fase | Duração |
|------|---------|
| Junior | 6s |
| Orquestrador | 22s |
| Analysis (3-4 tools, paralelas) | ~75s |
| Planning + Investments (paralelos após Analysis, 3+2 tools paralelas) | max(~135s, ~80s) = ~135s |
| ResponseAgent | 24s |
| **Total** | **~262s (~4min 22s)** |
| **Redução** | **~61%** |

---

## 6. Plano de Implementação

### Fase A — Quick Wins (Risco Mínimo, Impacto Alto)

**Prioridade: IMEDIATA**

#### A.1 — Paralelizar tool requests nos coordenadores
- **Arquivo:** `src/agents/coordinators/base.js`
- **Mudança:** Substituir `for...of await` por `Promise.all()` em `_executeToolRequests()`
- **Linhas afetadas:** ~15 linhas
- **Teste:** Executar mesma query e verificar que resultados são idênticos, tempo reduzido
- **Risco:** Mínimo — ferramentas já são independentes por design
- **Impacto esperado:** ~39% de redução

#### A.2 — Reduzir queries especulativas via prompt
- **Arquivos:** `src/agents/coordinators/prompt-template.js`, opcionalmente `analysis.js`, `investments.js`, `planning.js`
- **Mudança:** Adicionar diretriz no prompt para limitar tool_requests e evitar queries especulativas
- **Linhas afetadas:** ~10-20 linhas de prompt
- **Teste:** Verificar que coordenadores pedem 3-4 queries em vez de 6-7
- **Risco:** Baixo — IA mantém liberdade de pedir mais se necessário
- **Impacto esperado:** ~14-21% de redução adicional

### Fase B — Otimizações Estruturais (Risco Baixo-Médio)

**Prioridade: CURTO PRAZO (1-2 sprints)**

#### B.1 — Wave-based execution no ExecutionManager
- **Arquivo:** `src/core/orchestrator/execution-manager.js`
- **Mudança:** Implementar execução por ondas com `Promise.all()` para agentes sem dependências pendentes
- **Linhas afetadas:** ~40-60 linhas (reescrita do método `execute()`)
- **Teste:** DOCs com dependências variadas (1 agente, 2 paralelos, 3 encadeados)
- **Risco:** Baixo — preserva semântica de dependências
- **Impacto esperado:** ~17-22% quando combinado com B.2

#### B.2 — Prompt do Orquestrador: dependências mínimas
- **Arquivo:** `src/agents/orchestrator/prompt.js`
- **Mudança:** Adicionar diretriz explícita sobre minimização de dependências
- **Linhas afetadas:** ~10 linhas de prompt
- **Teste:** Verificar DOCs gerados — Planning e Investments devem depender apenas de Analysis quando possível
- **Risco:** Baixo — IA mantém julgamento
- **Impacto:** Habilita B.1 a atingir seu potencial máximo

#### B.3 — Otimizar schema do QueryBuilder
- **Arquivo:** `src/tools/finance-bridge/query-builder.js`
- **Mudança:** Reduzir system prompt, eliminando redundâncias e exemplos desnecessários
- **Teste:** Validar que queries complexas ainda são corretamente convertidas
- **Risco:** Baixo — testar com bateria de queries antes de deploy

### Fase C — Otimizações Avançadas (Risco Médio)

**Prioridade: MÉDIO PRAZO (2-4 sprints)**

#### C.1 — Cache de resultados Finance Bridge por ciclo
- **Arquivos:** Novo `src/core/orchestrator/tool-cache.js` + integração em `base.js`
- **Mudança:** Cache que compara JSON normalizado de queries Finance Bridge
- **Teste:** Verificar hit rate em queries típicas
- **Risco:** Médio — normalização de JSON precisa ser robusta

#### C.2 — Pre-fetch de dados financeiros
- **Arquivos:** `src/core/router/dispatcher.js`, novo módulo de pre-fetch
- **Mudança:** Antes de executar coordenadores, fazer 1-2 queries genéricas e injetar como contexto
- **Teste:** Verificar que coordenadores usam dados pré-carregados
- **Risco:** Médio — requer mudança no fluxo de orquestração

#### C.3 — Streaming de progresso (SSE)
- **Arquivos:** `src/api/routes/message.js`, `src/api/server.js`, frontend
- **Mudança:** Implementar SSE para enviar status de progresso ao cliente
- **Teste:** Verificar que o frontend exibe progresso em tempo real
- **Risco:** Médio — requer mudanças no frontend

### Ordem Recomendada

```
Fase A (imediata)      → A.1 paralelizar tools → A.2 reduzir queries especulativas
                         ↓ (validar redução ~40-50%)
Fase B (curto prazo)   → B.2 prompt orquestrador → B.1 wave execution → B.3 schema QB
                         ↓ (validar redução acumulada ~55-65%)  
Fase C (médio prazo)   → C.1 cache → C.2 pre-fetch → C.3 streaming
                         ↓ (latência real ~4-5min, percebida ~instantânea com streaming)
```

---

## 7. Conclusão

O sistema Yield Server possui uma arquitetura bem projetada com separação clara de responsabilidades. O problema de latência não é arquitetural — é de **estratégia de execução**. A arquitetura já suporta paralelismo (ferramentas são independentes, coordenadores declaram dependências explícitas), mas a implementação atual não o explora.

A otimização mais impactante e de menor risco (**paralelizar tool_requests dentro dos coordenadores**) pode ser implementada com mudança de ~5 linhas de código e oferece ~39% de redução imediata. Combinada com ajustes de prompt para reduzir queries especulativas (~14-21%), o sistema pode atingir **~40-50% de redução** na Fase A, mantendo 100% da qualidade das respostas.

O objetivo de 20-30% de redução é **alcançável com margem de segurança** apenas com as otimizações da Fase A.
