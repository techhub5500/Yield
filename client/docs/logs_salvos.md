**[2026-02-11T16:30:28.714Z]** 🔍 `DEBUG` | `logic` | **AuthMiddleware** — Usuário autenticado: tececonsultoria@gmail.com2  
> {"userId":"6989446554b8d9a5dee680ae","path":"/message"}

**[2026-02-11T16:30:28.758Z]** ✅ `INFO` | `logic` | **MessageRoute** — Nova mensagem recebida  
> {"chatId":"024b1b26-4c7e-4829-ad38-e74f153645ce","userId":"6989446554b8d9a5dee680ae","queryLength":94}

**[2026-02-11T16:30:28.802Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória não encontrada para chat 024b1b26-4c7e-4829-ad38-e74f153645ce, inicializando vazia

**[2026-02-11T16:30:35.404Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-mini  
> {"tokens":2371,"attempt":1}

**[2026-02-11T16:30:35.425Z]** ✅ `INFO` | `ai` | **Junior** — Query classificada como "escalate"  
> {"reasoning":"Requer análise aprofundada das finanças e da carteira, e criação de um plano de ação — tarefa comple","needsFollowup":false}

**[2026-02-11T16:30:35.444Z]** 🔍 `DEBUG` | `logic` | **MessageRoute** — Junior decidiu: "escalate"  
> {"chatId":"024b1b26-4c7e-4829-ad38-e74f153645ce","needsFollowup":false}

**[2026-02-11T16:30:35.449Z]** 🔍 `DEBUG` | `logic` | **Dispatcher** — Roteando para "escalate"  
> {"query":"Faca uma analise completa das minhas financas, avalie minha "}

**[2026-02-11T16:30:35.451Z]** ✅ `INFO` | `logic` | **Dispatcher** — Escalando para Orquestrador

**[2026-02-11T16:30:54.663Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":2528,"attempt":1}

**[2026-02-11T16:30:54.669Z]** ✅ `INFO` | `ai` | **Orchestrator** — DOC gerado com sucesso  
> {"requestId":"fe4f5f97-78dc-42d7-b0b9-bd5728a64f97","agentCount":3,"agents":"analysis, investments, planning"}

**[2026-02-11T16:30:54.672Z]** ✅ `INFO` | `logic` | **Dispatcher** — Executando DOC fe4f5f97-78dc-42d7-b0b9-bd5728a64f97 com 3 agente(s)

**[2026-02-11T16:30:54.674Z]** ✅ `INFO` | `logic` | **ExecutionManager** — Iniciando execução do DOC fe4f5f97-78dc-42d7-b0b9-bd5728a64f97  
> {"agentCount":3,"agents":"analysis, investments, planning"}

**[2026-02-11T16:30:54.675Z]** 🔍 `DEBUG` | `logic` | **ExecutionManager** — Processando agente "analysis" (prioridade: 1)  
> {"dependencies":"nenhuma"}

**[2026-02-11T16:30:54.678Z]** ✅ `INFO` | `ai` | **Agente de Análise** — Iniciando execução: "Coletar e analisar dados financeiros recentes do usuário (ex.: últimos 3–6 meses..."

**[2026-02-11T16:31:17.149Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":2743,"attempt":1}

**[2026-02-11T16:31:17.286Z]** ✅ `INFO` | `ai` | **Agente de Análise** — Executando 5 ferramenta(s) solicitada(s)

**[2026-02-11T16:31:17.314Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Processando query: "Buscar todas as transações (receitas e despesas) dos últimos..."

**[2026-02-11T16:31:40.643Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":3604,"attempt":1}

**[2026-02-11T16:31:40.742Z]** 🔍 `DEBUG` | `ai` | **QueryBuilder** — Query NL convertida para JSON  
> {"query":"Buscar todas as transações (receitas e despesas) dos últimos"}

**[2026-02-11T16:31:40.808Z]** ⚠️ `WARN` | `logic` | **FinanceBridgeValidator** — Validação de query falhou: Tipo inválido: "null". Esperado: "expense" ou "income"

**[2026-02-11T16:31:40.852Z]** ⚠️ `WARN` | `logic` | **FinanceBridge** — Query inválida: Tipo inválido: "null". Esperado: "expense" ou "income"

**[2026-02-11T16:31:40.885Z]** 🔍 `DEBUG` | `logic` | **Agente de Análise** — Ferramenta "finance_bridge:query" executada com sucesso

**[2026-02-11T16:31:40.900Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Processando query: "Gerar resumo mensal (por mês) dos últimos 6 meses: total de ..."

**[2026-02-11T16:32:02.145Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":3738,"attempt":1}

**[2026-02-11T16:32:02.174Z]** 🔍 `DEBUG` | `ai` | **QueryBuilder** — Query NL convertida para JSON  
> {"query":"Gerar resumo mensal (por mês) dos últimos 6 meses: total de "}

**[2026-02-11T16:32:02.196Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Executando query no MongoDB  
> {"filter":"{\"date\":{\"$gte\":\"2025-08-01\",\"$lte\":\"2026-01-31\"}}"}

**[2026-02-11T16:32:02.473Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Query retornou 1 resultados

**[2026-02-11T16:32:02.484Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Query retornou 1 resultados

**[2026-02-11T16:32:02.509Z]** 🔍 `DEBUG` | `logic` | **Agente de Análise** — Ferramenta "finance_bridge:query" executada com sucesso

**[2026-02-11T16:32:02.513Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Processando query: "Gerar gastos por categoria por mês (últimos 6 meses), com to..."

**[2026-02-11T16:32:29.232Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":4037,"attempt":1}

**[2026-02-11T16:32:29.251Z]** 🔍 `DEBUG` | `ai` | **QueryBuilder** — Query NL convertida para JSON  
> {"query":"Gerar gastos por categoria por mês (últimos 6 meses), com to"}

**[2026-02-11T16:32:29.263Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Executando query no MongoDB  
> {"filter":"{\"$and\":[{\"date\":{\"$gte\":\"2025-08-11\",\"$lte\":\"2026-02-11\"}},{\"type\":\"expense\"}]}"}

**[2026-02-11T16:32:29.749Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Query retornou 10 resultados

**[2026-02-11T16:32:29.916Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Query retornou 10 resultados

**[2026-02-11T16:32:30.035Z]** 🔍 `DEBUG` | `logic` | **Agente de Análise** — Ferramenta "finance_bridge:query" executada com sucesso

**[2026-02-11T16:32:30.109Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Processando query: "Listar transações recorrentes/assinaturas detectáveis nos úl..."

**[2026-02-11T16:32:54.914Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":3748,"attempt":1}

**[2026-02-11T16:32:55.980Z]** 🔍 `DEBUG` | `ai` | **QueryBuilder** — Query NL convertida para JSON  
> {"query":"Listar transações recorrentes/assinaturas detectáveis nos úl"}

**[2026-02-11T16:32:56.818Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Executando query no MongoDB  
> {"filter":"{\"$and\":[{\"date\":{\"$gte\":\"2025-08-11\",\"$lte\":\"2026-02-11\"}},{\"type\":\"expense\"}]}"}

**[2026-02-11T16:32:58.393Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Query retornou 10 resultados

**[2026-02-11T16:32:58.434Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Query retornou 10 resultados

**[2026-02-11T16:32:58.515Z]** 🔍 `DEBUG` | `logic` | **Agente de Análise** — Ferramenta "finance_bridge:query" executada com sucesso

**[2026-02-11T16:32:58.726Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Processando query: "Identificar possíveis cobranças duplicadas nos últimos 6 mes..."

**[2026-02-11T16:33:22.745Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":3967,"attempt":1}

**[2026-02-11T16:33:22.750Z]** 🔍 `DEBUG` | `ai` | **QueryBuilder** — Query NL convertida para JSON  
> {"query":"Identificar possíveis cobranças duplicadas nos últimos 6 mes"}

**[2026-02-11T16:33:22.762Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Executando query no MongoDB  
> {"filter":"{\"$and\":[{\"date\":{\"$gte\":\"2025-08-11\",\"$lte\":\"2026-02-11\"}},{\"type\":\"expense\"}]}"}

**[2026-02-11T16:33:22.875Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Query retornou 10 resultados

**[2026-02-11T16:33:22.876Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Query retornou 10 resultados

**[2026-02-11T16:33:22.879Z]** 🔍 `DEBUG` | `logic` | **Agente de Análise** — Ferramenta "finance_bridge:query" executada com sucesso

**[2026-02-11T16:34:07.842Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":6564,"attempt":1}

**[2026-02-11T16:34:07.867Z]** ✅ `INFO` | `ai` | **Agente de Análise** — Execução concluída  
> {"taskCompleted":true,"toolsUsed":"finance_bridge","toolsExecuted":1,"confidence":"medium","elapsed":"193190ms"}

**[2026-02-11T16:34:07.888Z]** 🔍 `DEBUG` | `logic` | **ExecutionQueue** — Agente "analysis" concluído  
> {"agentName":"analysis","success":true}

**[2026-02-11T16:34:07.892Z]** ✅ `INFO` | `logic` | **ExecutionManager** — Agente "analysis" concluído com sucesso  
> {"confidence":"medium"}

**[2026-02-11T16:34:07.895Z]** 🔍 `DEBUG` | `logic` | **ExecutionManager** — Processando agente "investments" (prioridade: 2)  
> {"dependencies":"nenhuma"}

**[2026-02-11T16:34:07.900Z]** ✅ `INFO` | `ai` | **Agente de Investimentos** — Iniciando execução: "Avaliar a carteira atual do usuário via finance_bridge (posições, custos, rentab..."

**[2026-02-11T16:34:32.619Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":2864,"attempt":1}

**[2026-02-11T16:34:32.635Z]** ✅ `INFO` | `ai` | **Agente de Investimentos** — Executando 3 ferramenta(s) solicitada(s)

**[2026-02-11T16:34:32.641Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Processando query: "Trazer a carteira atual completa do usuário: lista de posiçõ..."

**[2026-02-11T16:35:05.065Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":4089,"attempt":1}

**[2026-02-11T16:35:05.067Z]** 🔍 `DEBUG` | `ai` | **QueryBuilder** — Query NL convertida para JSON  
> {"query":"Trazer a carteira atual completa do usuário: lista de posiçõ"}

**[2026-02-11T16:35:05.071Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Executando query no MongoDB  
> {"filter":"{}"}

**[2026-02-11T16:35:05.124Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Query retornou 18 resultados

**[2026-02-11T16:35:05.125Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Query retornou 18 resultados

**[2026-02-11T16:35:05.127Z]** 🔍 `DEBUG` | `logic` | **Agente de Investimentos** — Ferramenta "finance_bridge:query" executada com sucesso

**[2026-02-11T16:35:05.128Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Processando query: "Trazer o histórico de movimentações e aportes dos últimos 24..."

**[2026-02-11T16:35:34.149Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":4036,"attempt":1}

**[2026-02-11T16:35:34.157Z]** 🔍 `DEBUG` | `ai` | **QueryBuilder** — Query NL convertida para JSON  
> {"query":"Trazer o histórico de movimentações e aportes dos últimos 24"}

**[2026-02-11T16:35:34.167Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Executando query no MongoDB  
> {"filter":"{\"$and\":[{\"date\":{\"$gte\":\"2024-02-11\",\"$lte\":\"2026-02-11\"}},{\"category\":{\"$in\":[{},{},{},{},{}]}},{\"type\":\"income\"}]}"}

**[2026-02-11T16:35:34.196Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Query retornou 0 resultados

**[2026-02-11T16:35:34.200Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Query retornou 0 resultados

**[2026-02-11T16:35:34.205Z]** 🔍 `DEBUG` | `logic` | **Agente de Investimentos** — Ferramenta "finance_bridge:query" executada com sucesso

**[2026-02-11T16:35:34.208Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Processando query: "Trazer relatório de proventos/renda: dividendos e juros rece..."

**[2026-02-11T16:35:56.489Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":3870,"attempt":1}

**[2026-02-11T16:35:56.497Z]** 🔍 `DEBUG` | `ai` | **QueryBuilder** — Query NL convertida para JSON  
> {"query":"Trazer relatório de proventos/renda: dividendos e juros rece"}

**[2026-02-11T16:35:56.501Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Executando query no MongoDB  
> {"filter":"{\"$and\":[{\"date\":{\"$gte\":\"2025-02-11\",\"$lte\":\"2026-02-11\"}},{\"type\":\"income\"}]}"}

**[2026-02-11T16:35:56.531Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Query retornou 4 resultados

**[2026-02-11T16:35:56.533Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Query retornou 4 resultados

**[2026-02-11T16:35:56.534Z]** 🔍 `DEBUG` | `logic` | **Agente de Investimentos** — Ferramenta "finance_bridge:query" executada com sucesso

**[2026-02-11T16:36:21.490Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":4241,"attempt":1}

**[2026-02-11T16:36:21.500Z]** ✅ `INFO` | `ai` | **Agente de Investimentos** — Execução concluída  
> {"taskCompleted":false,"toolsUsed":"finance_bridge","toolsExecuted":1,"confidence":"low","elapsed":"133599ms"}

**[2026-02-11T16:36:21.513Z]** 🔍 `DEBUG` | `logic` | **ExecutionQueue** — Agente "investments" concluído  
> {"agentName":"investments","success":false}

**[2026-02-11T16:36:21.518Z]** ✅ `INFO` | `logic` | **ExecutionManager** — Agente "investments" concluído com sucesso  
> {"confidence":"low"}

**[2026-02-11T16:36:21.520Z]** 🔍 `DEBUG` | `logic` | **ExecutionManager** — Processando agente "planning" (prioridade: 3)  
> {"dependencies":"analysis, investments"}

**[2026-02-11T16:36:21.524Z]** 🔍 `DEBUG` | `logic` | **ExecutionManager** — Aguardando dependências de "planning": analysis, investments

**[2026-02-11T16:36:21.539Z]** ✅ `INFO` | `ai` | **Agente de Planejamento** — Iniciando execução: "Com base nos diagnósticos de gastos/fluxo de caixa (analysis) e carteira (invest..."

**[2026-02-11T16:37:22.456Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":7495,"attempt":1}

**[2026-02-11T16:37:22.470Z]** ✅ `INFO` | `ai` | **Agente de Planejamento** — Executando 5 ferramenta(s) solicitada(s)

**[2026-02-11T16:37:22.474Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Processando query: "Consolidar receitas e despesas mensais (totais) dos últimos ..."

**[2026-02-11T16:37:46.324Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":4127,"attempt":1}

**[2026-02-11T16:37:46.327Z]** 🔍 `DEBUG` | `ai` | **QueryBuilder** — Query NL convertida para JSON  
> {"query":"Consolidar receitas e despesas mensais (totais) dos últimos "}

**[2026-02-11T16:37:46.330Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Executando query no MongoDB  
> {"filter":"{\"date\":{\"$gte\":\"2025-08-11\",\"$lte\":\"2026-02-11\"}}"}

**[2026-02-11T16:37:46.379Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Query retornou 6 resultados

**[2026-02-11T16:37:46.383Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Query retornou 6 resultados

**[2026-02-11T16:37:46.386Z]** 🔍 `DEBUG` | `logic` | **Agente de Planejamento** — Ferramenta "finance_bridge:query" executada com sucesso

**[2026-02-11T16:37:46.393Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Processando query: "Gastos por categoria nos últimos 3 meses (totais e média men..."

**[2026-02-11T16:38:15.748Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":4770,"attempt":1}

**[2026-02-11T16:38:15.778Z]** 🔍 `DEBUG` | `ai` | **QueryBuilder** — Query NL convertida para JSON  
> {"query":"Gastos por categoria nos últimos 3 meses (totais e média men"}

**[2026-02-11T16:38:15.789Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Executando query no MongoDB  
> {"filter":"{\"$and\":[{\"date\":{\"$gte\":\"2025-11-01\",\"$lte\":\"2026-01-31\"}},{\"category\":{\"$in\":[{},{}]}},{\"type\":\"expense\"},{\"subcategory\":{\"$in\":[{},{},{},{},{},{},{"}

**[2026-02-11T16:38:15.827Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Query retornou 1 resultados

**[2026-02-11T16:38:15.830Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Query retornou 1 resultados

**[2026-02-11T16:38:15.842Z]** 🔍 `DEBUG` | `logic` | **Agente de Planejamento** — Ferramenta "finance_bridge:query" executada com sucesso

**[2026-02-11T16:38:15.844Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Processando query: "Saldos atuais do usuário (conta corrente, poupança, e aplica..."

**[2026-02-11T16:38:44.796Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":4104,"attempt":1}

**[2026-02-11T16:38:45.035Z]** 🔍 `DEBUG` | `ai` | **QueryBuilder** — Query NL convertida para JSON  
> {"query":"Saldos atuais do usuário (conta corrente, poupança, e aplica"}

**[2026-02-11T16:38:45.665Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Executando query no MongoDB  
> {"filter":"{\"category\":{\"$in\":[{},{},{},{}]}}"}

**[2026-02-11T16:38:45.814Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Query retornou 0 resultados

**[2026-02-11T16:38:45.929Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Query retornou 0 resultados

**[2026-02-11T16:38:45.963Z]** 🔍 `DEBUG` | `logic` | **Agente de Planejamento** — Ferramenta "finance_bridge:query" executada com sucesso

**[2026-02-11T16:38:46.219Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Processando query: "Listar dívidas ativas (cartão, empréstimos, financiamentos):..."

**[2026-02-11T16:39:06.578Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":3290,"attempt":1}

**[2026-02-11T16:39:06.580Z]** 🔍 `DEBUG` | `ai` | **QueryBuilder** — Query NL convertida para JSON  
> {"query":"Listar dívidas ativas (cartão, empréstimos, financiamentos):"}

**[2026-02-11T16:39:06.582Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Executando query no MongoDB  
> {"filter":"{\"$and\":[{\"category\":{\"$in\":[{},{},{}]}},{\"type\":\"expense\"},{\"status\":\"active\"}]}"}

**[2026-02-11T16:39:06.611Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Query retornou 0 resultados

**[2026-02-11T16:39:06.614Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Query retornou 0 resultados

**[2026-02-11T16:39:06.616Z]** 🔍 `DEBUG` | `logic` | **Agente de Planejamento** — Ferramenta "finance_bridge:query" executada com sucesso

**[2026-02-11T16:39:06.624Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Processando query: "Consultar investimentos/posições atuais (carteira) e/ou prod..."

**[2026-02-11T16:39:25.829Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":3410,"attempt":1}

**[2026-02-11T16:39:25.837Z]** 🔍 `DEBUG` | `ai` | **QueryBuilder** — Query NL convertida para JSON  
> {"query":"Consultar investimentos/posições atuais (carteira) e/ou prod"}

**[2026-02-11T16:39:25.843Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Executando query no MongoDB  
> {"filter":"{\"category\":{\"$in\":[{}]}}"}

**[2026-02-11T16:39:25.869Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Query retornou 0 resultados

**[2026-02-11T16:39:25.871Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Query retornou 0 resultados

**[2026-02-11T16:39:25.873Z]** 🔍 `DEBUG` | `logic` | **Agente de Planejamento** — Ferramenta "finance_bridge:query" executada com sucesso

**[2026-02-11T16:40:55.249Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":10528,"attempt":1}

**[2026-02-11T16:40:55.281Z]** ✅ `INFO` | `ai` | **Agente de Planejamento** — Execução concluída  
> {"taskCompleted":true,"toolsUsed":"nenhuma","toolsExecuted":1,"confidence":"medium","elapsed":"273738ms"}

**[2026-02-11T16:40:55.284Z]** 🔍 `DEBUG` | `logic` | **ExecutionQueue** — Agente "planning" concluído  
> {"agentName":"planning","success":true}

**[2026-02-11T16:40:55.287Z]** ✅ `INFO` | `logic` | **ExecutionManager** — Agente "planning" concluído com sucesso  
> {"confidence":"medium"}

**[2026-02-11T16:40:55.292Z]** ✅ `INFO` | `logic` | **ExecutionManager** — Execução do DOC fe4f5f97-78dc-42d7-b0b9-bd5728a64f97 concluída  
> {"elapsed":"600617ms","agentsCompleted":3}

**[2026-02-11T16:40:55.304Z]** ✅ `INFO` | `logic` | **Dispatcher** — Escalada concluída com sucesso  
> {"requestId":"fe4f5f97-78dc-42d7-b0b9-bd5728a64f97","agentsExecuted":3}

**[2026-02-11T16:40:55.316Z]** 🔍 `DEBUG` | `logic` | **OutputIntegrator** — Outputs integrados: 2 sucesso, 1 falha(s)  
> {"successful":"analysis, planning","failed":"investments"}

**[2026-02-11T16:41:26.257Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":9730,"attempt":1}

**[2026-02-11T16:41:26.314Z]** ✅ `INFO` | `ai` | **ResponseAgent** — Resposta sintetizada com sucesso  
> {"format":"report","tone":"technical","agentsIntegrated":2,"responseLength":6010}

**[2026-02-11T16:41:26.524Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória não encontrada para chat 024b1b26-4c7e-4829-ad38-e74f153645ce, inicializando vazia

**[2026-02-11T16:41:26.596Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória salva para chat 024b1b26-4c7e-4829-ad38-e74f153645ce  
> {"userId":"6989446554b8d9a5dee680ae","wordCount":962,"recentCycles":1,"oldSummaries":0}

**[2026-02-11T16:41:26.599Z]** ✅ `INFO` | `logic` | **MessageRoute** — Ciclo completo  
> {"chatId":"024b1b26-4c7e-4829-ad38-e74f153645ce","decision":"escalate","elapsed":"657839ms"}

**[2026-02-11T16:41:26.652Z]** 🔍 `DEBUG` | `system` | **HTTPServer** — POST /message → 200 (657988ms)

**[2026-02-11T16:41:49.772Z]** 🔍 `DEBUG` | `logic` | **AuthMiddleware** — Usuário autenticado: tececonsultoria@gmail.com2  
> {"userId":"6989446554b8d9a5dee680ae","path":"/message"}

**[2026-02-11T16:41:49.776Z]** ✅ `INFO` | `logic` | **MessageRoute** — Nova mensagem recebida  
> {"chatId":"024b1b26-4c7e-4829-ad38-e74f153645ce","userId":"6989446554b8d9a5dee680ae","queryLength":65}

**[2026-02-11T16:41:49.809Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória carregada para chat 024b1b26-4c7e-4829-ad38-e74f153645ce  
> {"userId":"6989446554b8d9a5dee680ae"}

**[2026-02-11T16:42:03.253Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-mini  
> {"tokens":4307,"attempt":1}

**[2026-02-11T16:42:03.257Z]** ✅ `INFO` | `ai` | **Junior** — Query classificada como "escalate"  
> {"reasoning":"Pedido pede comparação e recomendações — requer análise aprofundada de padrões, tetos e plano de açã","needsFollowup":false}

**[2026-02-11T16:42:03.258Z]** 🔍 `DEBUG` | `logic` | **MessageRoute** — Junior decidiu: "escalate"  
> {"chatId":"024b1b26-4c7e-4829-ad38-e74f153645ce","needsFollowup":false}

**[2026-02-11T16:42:03.261Z]** 🔍 `DEBUG` | `logic` | **Dispatcher** — Roteando para "escalate"  
> {"query":"Compare meus gastos de alimentacao vs transporte e sugira aj"}

**[2026-02-11T16:42:03.264Z]** ✅ `INFO` | `logic` | **Dispatcher** — Escalando para Orquestrador

**[2026-02-11T16:42:23.746Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":4235,"attempt":1}

**[2026-02-11T16:42:23.771Z]** ✅ `INFO` | `ai` | **Orchestrator** — DOC gerado com sucesso  
> {"requestId":"ef93a61c-3e80-4a41-a6b5-f6ba0a080842","agentCount":2,"agents":"analysis, planning"}

**[2026-02-11T16:42:23.774Z]** ✅ `INFO` | `logic` | **Dispatcher** — Executando DOC ef93a61c-3e80-4a41-a6b5-f6ba0a080842 com 2 agente(s)

**[2026-02-11T16:42:23.780Z]** ✅ `INFO` | `logic` | **ExecutionManager** — Iniciando execução do DOC ef93a61c-3e80-4a41-a6b5-f6ba0a080842  
> {"agentCount":2,"agents":"analysis, planning"}

**[2026-02-11T16:42:23.783Z]** 🔍 `DEBUG` | `logic` | **ExecutionManager** — Processando agente "analysis" (prioridade: 1)  
> {"dependencies":"nenhuma"}

**[2026-02-11T16:42:23.785Z]** ✅ `INFO` | `ai` | **Agente de Análise** — Iniciando execução: "Comparar os gastos de Alimentação vs Transporte/Veículo no período disponível (2..."

**[2026-02-11T16:43:02.972Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":3973,"attempt":1}

**[2026-02-11T16:43:02.982Z]** ✅ `INFO` | `ai` | **Agente de Análise** — Execução concluída  
> {"taskCompleted":true,"toolsUsed":"nenhuma","toolsExecuted":0,"confidence":"medium","elapsed":"39196ms"}

**[2026-02-11T16:43:02.986Z]** 🔍 `DEBUG` | `logic` | **ExecutionQueue** — Agente "analysis" concluído  
> {"agentName":"analysis","success":true}

**[2026-02-11T16:43:02.994Z]** ✅ `INFO` | `logic` | **ExecutionManager** — Agente "analysis" concluído com sucesso  
> {"confidence":"medium"}

**[2026-02-11T16:43:02.997Z]** 🔍 `DEBUG` | `logic` | **ExecutionManager** — Processando agente "planning" (prioridade: 2)  
> {"dependencies":"analysis"}

**[2026-02-11T16:43:02.999Z]** 🔍 `DEBUG` | `logic` | **ExecutionManager** — Aguardando dependências de "planning": analysis

**[2026-02-11T16:43:03.007Z]** ✅ `INFO` | `ai` | **Agente de Planejamento** — Iniciando execução: "Com base na comparação Alimentação vs Transporte/Veículo, propor ajustes de orça..."

**[2026-02-11T16:43:49.348Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":5456,"attempt":1}

**[2026-02-11T16:43:49.406Z]** ✅ `INFO` | `ai` | **Agente de Planejamento** — Execução concluída  
> {"taskCompleted":true,"toolsUsed":"nenhuma","toolsExecuted":0,"confidence":"medium","elapsed":"46403ms"}

**[2026-02-11T16:43:49.419Z]** 🔍 `DEBUG` | `logic` | **ExecutionQueue** — Agente "planning" concluído  
> {"agentName":"planning","success":true}

**[2026-02-11T16:43:49.429Z]** ✅ `INFO` | `logic` | **ExecutionManager** — Agente "planning" concluído com sucesso  
> {"confidence":"medium"}

**[2026-02-11T16:43:49.433Z]** ✅ `INFO` | `logic` | **ExecutionManager** — Execução do DOC ef93a61c-3e80-4a41-a6b5-f6ba0a080842 concluída  
> {"elapsed":"85650ms","agentsCompleted":2}

**[2026-02-11T16:43:49.437Z]** ✅ `INFO` | `logic` | **Dispatcher** — Escalada concluída com sucesso  
> {"requestId":"ef93a61c-3e80-4a41-a6b5-f6ba0a080842","agentsExecuted":2}

**[2026-02-11T16:43:49.446Z]** 🔍 `DEBUG` | `logic` | **OutputIntegrator** — Outputs integrados: 2 sucesso, 0 falha(s)  
> {"successful":"analysis, planning","failed":"nenhuma"}

**[2026-02-11T16:44:07.769Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":5484,"attempt":1}

**[2026-02-11T16:44:07.771Z]** ✅ `INFO` | `ai` | **ResponseAgent** — Resposta sintetizada com sucesso  
> {"format":"structured","tone":"neutral","agentsIntegrated":2,"responseLength":2888}

**[2026-02-11T16:44:07.810Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória carregada para chat 024b1b26-4c7e-4829-ad38-e74f153645ce  
> {"userId":"6989446554b8d9a5dee680ae"}

**[2026-02-11T16:44:07.867Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória salva para chat 024b1b26-4c7e-4829-ad38-e74f153645ce  
> {"userId":"6989446554b8d9a5dee680ae","wordCount":1416,"recentCycles":2,"oldSummaries":0}

**[2026-02-11T16:44:07.877Z]** ✅ `INFO` | `logic` | **MessageRoute** — Ciclo completo  
> {"chatId":"024b1b26-4c7e-4829-ad38-e74f153645ce","decision":"escalate","elapsed":"138095ms"}

**[2026-02-11T16:44:07.987Z]** 🔍 `DEBUG` | `system` | **HTTPServer** — POST /message → 200 (138204ms)

