# Troubleshooting — Yield Server

## Problemas Comuns e Soluções

### 1. "Variáveis de ambiente ausentes" no startup

**Sintoma:** Servidor não inicia, log mostra variáveis faltantes.

**Solução:**
- Verificar se `.env` existe em `server/`
- Confirmar que contém `MONGODB_URI` e `OPENAI_API_KEY`
- Para APIs externas: `SERPER_API_KEY`, `BRAPI_API_KEY`, `TAVILY_API_KEY`

---

### 2. Timeout em chamadas de IA

**Sintoma:** Agentes demoram mais que o esperado, logs mostram retry.

**Soluções:**
- Aumentar `AGENT_TIMEOUT` no `.env` (padrão: 80000ms)
- Verificar rate limits na API da OpenAI
- Verificar se o modelo correto está configurado em `config/index.js`

---

### 3. Junior sempre escalando para Orquestrador

**Sintoma:** Queries simples vão para escalada em vez de rotas diretas.

**Diagnóstico:**
1. Verificar logs do Junior: `[AI] Junior — Decisão: "escalate"`
2. Conferir o prompt em `agents/junior/prompt.js`
3. Verificar se a memória está corretamente formatada

---

### 4. Finance Bridge retorna query inválida

**Sintoma:** Erro na validação do JSON gerado pelo QueryBuilder.

**Diagnóstico:**
1. Verificar log: `[ERROR] logic | FinanceBridgeValidator`
2. Conferir o schema em `tools/finance-bridge/schema.js`
3. Verificar se a IA está retornando JSON válido (log em `[DEBUG] ai`)

---

### 5. Memória não comprime

**Sintoma:** `wordCount` acima de 2250 sem compressão.

**Diagnóstico:**
1. Verificar `memory.shouldCompress()` — retorna boolean
2. Verificar se `compressMemory()` está sendo chamada
3. Conferir logs: `[INFO] logic | MemoryManager — Memória atingiu X%`

---

### 6. Coordenador não disponível

**Sintoma:** `ExecutionManager` loga "Coordenador X não disponível".

**Solução:**
- Verificar se o coordenador está registrado no `ExecutionManager`
- Confirmar que o nome no DOC (`agent: "analysis"`) corresponde à chave no Map de coordenadores

---

### 7. Resposta do ResponseAgent genérica demais

**Sintoma:** Resposta não integra outputs corretamente.

**Diagnóstico:**
1. Verificar logs: `[AI] ResponseAgent — Resposta sintetizada`
2. Verificar se outputs dos coordenadores chegam ao integrator
3. Conferir formato sugerido em `format-selector.js`

---

### 8. Coordenadores retornam análises sem dados reais do usuário

**Sintoma:** Respostas de coordenadores são genéricas, sem valores financeiros reais.

**Causa raiz (limitação conhecida):**
- Os coordenadores descrevem ferramentas no prompt, mas **não as executam de fato**.
- `BaseCoordinator.execute()` apenas chama `model.completeJSON()` — não há function calling nem pós-processamento de tool calls.
- Resultado: a IA "planeja" usar Finance Bridge, Serper, etc., mas os dados retornados são baseados no conhecimento prévio do modelo.

**Status:** Limitação arquitetural pendente. Resolução requer implementação de function calling da API OpenAI ou pós-processamento de tool calls nos coordenadores.

---

## Como Debugar o Fluxo de Agentes

### 1. Habilitar logs DEBUG
Em `.env`: `NODE_ENV=development` (padrão)

### 2. Rastrear uma mensagem
Filtrar logs por `chatId`:
```bash
grep "chatId" server/logs/YYYY-MM-DD.md
```

### 3. Fluxo típico nos logs
```
[INFO]  logic | MessageRoute — Nova mensagem recebida
[DEBUG] ai    | Junior — Decisão: "bridge_query"
[DEBUG] logic | Dispatcher — Roteando para "bridge_query"
[DEBUG] ai    | QueryBuilder — Query convertida para JSON
[DEBUG] logic | FinanceBridgeExecutor — Query executada
[DEBUG] ai    | ResponseAgent — Resposta direta formatada
[INFO]  logic | MemoryManager — Ciclo X movido para old e resumido
[INFO]  logic | MessageRoute — Ciclo completo (450ms)
```

---

## Como Validar Chamadas de IA

1. **Verificar logs tipo `ai`:**
   ```
   [DEBUG] ai | OpenAIClient — Resposta recebida do modelo X
   ```
2. **Conferir tokens gastos:** campo `tokens` no metadata do log
3. **Verificar retry:** campo `attempt` mostra tentativa atual

---

## Como Interpretar Logs

### Formato
```
[TIMESTAMP] LEVEL (type/component) mensagem
```

### Tipos
- `logic` — Operação determinística (validação, roteamento, CRUD)
- `ai` — Chamada a modelo de IA (classificação, síntese, resumo)
- `system` — Infraestrutura (startup, HTTP request, conexão)

### Níveis
- `ERROR` — Algo falhou e precisa de atenção
- `WARN` — Fallback ativado ou situação inesperada
- `INFO` — Operação importante concluída com sucesso
- `DEBUG` — Detalhes de execução (apenas em development)

---

## Checklist Pré-Deploy

- [ ] Variáveis de ambiente configuradas no servidor
- [ ] MongoDB acessível e com índice em `chatId`
- [ ] API keys válidas para OpenAI, Serper, Brapi, Tavily
- [ ] `NODE_ENV=production` (desativa logs DEBUG)
- [ ] Testar `GET /health` após deploy
- [ ] Testar `POST /api/message` com query simples
- [ ] Verificar que logs estão sendo escritos em `server/logs/`
