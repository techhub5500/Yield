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

**Status:** ✅ **RESOLVIDO PARA SAUDAÇÕES** (Patch 4.1 - 07/02/2026)

**Solução implementada:**
Rota `simple_response` adicionada para interações sociais. Saudações agora têm prioridade máxima e não são mais escaladas.

**Diagnóstico (se o problema persistir para queries financeiras):**
1. Verificar logs do Junior: `[AI] Junior — Decisão: "escalate"`
2. Conferir o prompt em `agents/junior/prompt.js`
3. Verificar se a memória está corretamente formatada
4. Se saudações ainda escalando: verificar se rota `simple_response` está em `validators.js`

---

### 3.1 Junior gera follow-up apos decidir por escalate

**Sintoma:** Logs mostram `Junior` com `decision: "escalate"` e, logo em seguida, `JuniorFollowup` e `MessageRoute` retornando pergunta ao usuario.

**Causa provavel:** Follow-up esta sendo aplicado a rotas que nao sao `bridge_insert`.

**Solucao:**
- Garantir que `agents/junior/index.js` ignore `needs_followup` quando a rota nao for `bridge_insert`.
- Validar que o `MessageRoute` apenas retorna follow-up quando a decisao final do Junior permitir.

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

**Status:** ✅ **RESOLVIDO** (06/02/2026)

**Solução implementada:**
`BaseCoordinator.execute()` agora implementa execução de ferramentas em dois passos (two-pass):
1. **Passo 1:** IA recebe a tarefa e solicita ferramentas via `tool_requests` no JSON
2. **Execução:** O sistema executa Finance Bridge, Search APIs e Módulo Matemático
3. **Passo 2:** IA recebe os dados reais e produz análise baseada em dados concretos

**Diagnóstico (se o problema persistir):**
1. Verificar se as ferramentas estão sendo injetadas nos coordenadores: `tools.financeBridge`, `tools.searchManager`, `tools.mathModule`
2. Verificar logs: `[AI] <Coordenador> — Executando N ferramenta(s) solicitada(s)`
3. Verificar se o prompt inclui a seção `SOLICITAÇÃO DE FERRAMENTAS` em `prompt-template.js`
4. Conferir se `metadata.tools_executed > 0` no resultado do coordenador

---

### 10. Erro em math:projectionWithContributions (PMT undefined)

**Sintoma:** Log do MathModule mostra `PMT=undefined` e a ferramenta falha com `DecimalError`.

**Causa provavel:** Parametros da tool_request foram enviados com nomes diferentes de `monthlyPayment`, `monthlyRate`, `months`.

**Solucao:**
- Garantir que o coordenador use os nomes exatos de parametros definidos no prompt.
- O BaseCoordinator normaliza alguns sinonimos, mas campos obrigatorios ainda devem estar presentes.
- Se persistir, revisar o JSON de tool_requests retornado pelo coordenador.

---

### 9. Saudações recebem respostas "robóticas" ou genéricas (Patch 4.1)

**Sintoma:** Respostas a "Olá", "Oi", "Bom dia" são muito formais ou não contextualizam memória recente.

**Status:** Novo problema potencial (Patch 4.1)

**Diagnóstico:**
1. Verificar se rota `simple_response` está sendo usada: logs devem mostrar `[DEBUG] logic | Dispatcher — Resposta social via ResponseAgent`
2. Verificar se ResponseAgent está disponível: caso contrário, usa fallback genérico
3. Verificar temperatura do modelo: deve ser 0.7 para interações sociais (mais criativo)
4. Se usuário pergunta sobre sistema mas resposta é vaga: verificar se `docs/md_sistema/sistema.md` existe e está acessível

**Solução:**
- Se fallback é usado: verificar se ResponseAgent foi injetado em `message.js`
- Se resposta não usa memória: verificar se `formatMemoryForResponse()` está funcionando
- Se resposta sobre sistema é genérica: verificar logs para `[DEBUG] ResponseAgent — Documentação do sistema carregada`

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

### 8. Histórico mostra resumos internos ou apenas 2 mensagens

**Sintoma:** 
- Chat com 10 interações mostra apenas 2 mensagens
- Aparecem textos como "Usuário perguntou... IA respondeu..." (resumos)
- Modal de histórico mostra vários chats extras que não foram criados

**Causa:**
Sistema foi projetado com 2 componentes de memória:
- `recent`: últimos 2 ciclos (para contexto da IA)
- `old`: resumos de ciclos antigos (para contexto da IA)

Antes da correção (08/02/2026), não havia histórico completo separado.

**Status:** ✅ **CORRIGIDO** (08/02/2026)

**Solução implementada:**
Adicionado campo `fullHistory` que armazena TODAS as mensagens sem resumir:
```javascript
{
  recent: [...],      // Últimos 2 ciclos → contexto para IA
  old: [...],         // Resumos → contexto para IA
  fullHistory: [...], // TODAS as mensagens → exibição ao usuário
  wordCount: 0
}
```

**Migração de dados existentes:**
Se você tem chats criados antes desta correção e quer preservar as mensagens:
```bash
cd server
node scripts/migrate-fullhistory.js
```

**⚠️ ATENÇÃO:**
- Apenas mensagens em `recent` podem ser recuperadas
- Mensagens que já foram resumidas em `old` foram perdidas
- Recomenda-se executar a migração imediatamente após atualizar o código

**Verificar correção:**
1. Criar novo chat e enviar 3+ mensagens
2. Recarregar página e abrir histórico
3. Todas as mensagens devem aparecer
4. Nenhum resumo interno deve ser exibido

---

## Checklist Pré-Deploy

- [ ] Variáveis de ambiente configuradas no servidor
- [ ] MongoDB acessível e com índice em `chatId`
- [ ] API keys válidas para OpenAI, Serper, Brapi, Tavily
- [ ] `NODE_ENV=production` (desativa logs DEBUG)
- [ ] Testar `GET /health` após deploy
- [ ] Testar `POST /api/message` com query simples
- [ ] Verificar que logs estão sendo escritos em `server/logs/`
- [ ] **[NOVO]** Executar script de migração se houver chats existentes: `node scripts/migrate-fullhistory.js`
