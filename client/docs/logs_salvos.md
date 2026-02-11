**[2026-02-11T15:27:04.328Z]** 🔍 `DEBUG` | `logic` | **AuthMiddleware** — Usuário autenticado: tececonsultoria@gmail.com2  
> {"userId":"6989446554b8d9a5dee680ae","path":"/message"}

**[2026-02-11T15:27:04.332Z]** ✅ `INFO` | `logic` | **MessageRoute** — Nova mensagem recebida  
> {"chatId":"3bdc18c6-d7fe-4bb2-a54d-d86c5f6db602","userId":"6989446554b8d9a5dee680ae","queryLength":22}

**[2026-02-11T15:27:04.404Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória carregada para chat 3bdc18c6-d7fe-4bb2-a54d-d86c5f6db602  
> {"userId":"6989446554b8d9a5dee680ae"}

**[2026-02-11T15:27:09.185Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-mini  
> {"tokens":2388,"attempt":1}

**[2026-02-11T15:27:09.205Z]** ✅ `INFO` | `ai` | **Junior** — Query classificada como "serper"  
> {"reasoning":"Pedido por notícias sobre o dólar hoje — busca de informação pública disponível na internet.","needsFollowup":false}

**[2026-02-11T15:27:09.210Z]** 🔍 `DEBUG` | `logic` | **MessageRoute** — Junior decidiu: "serper"  
> {"chatId":"3bdc18c6-d7fe-4bb2-a54d-d86c5f6db602","needsFollowup":false}

**[2026-02-11T15:27:09.223Z]** 🔍 `DEBUG` | `logic` | **Dispatcher** — Roteando para "serper"  
> {"query":"Noticias do dolar hoje"}

**[2026-02-11T15:27:09.238Z]** 🔍 `DEBUG` | `logic` | **ExternalCallManager** — Agente "junior" aguardando "search:serper"  
> {"chatId":"3bdc18c6-d7fe-4bb2-a54d-d86c5f6db602","pendingCalls":1}

**[2026-02-11T15:27:09.255Z]** 🔍 `DEBUG` | `logic` | **SearchManager** — Busca via "serper": "Noticias do dolar hoje"

**[2026-02-11T15:27:09.265Z]** 🔍 `DEBUG` | `logic` | **SerperClient** — Executando busca: "Noticias do dolar hoje"

**[2026-02-11T15:27:10.317Z]** 🔍 `DEBUG` | `logic` | **SerperClient** — Busca retornou 10 resultados orgânicos

**[2026-02-11T15:27:10.354Z]** 🔍 `DEBUG` | `logic` | **ExternalCallManager** — Agente "junior" retomou após "search:serper"  
> {"chatId":"3bdc18c6-d7fe-4bb2-a54d-d86c5f6db602"}

**[2026-02-11T15:27:10.371Z]** 🔍 `DEBUG` | `logic` | **Dispatcher** — Serper search executada com sucesso

**[2026-02-11T15:27:16.468Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":1683,"attempt":1}

**[2026-02-11T15:27:16.477Z]** 🔍 `DEBUG` | `ai` | **ResponseAgent** — Resposta direta formatada (serper)  
> {"format":"conversational","responseLength":858}

**[2026-02-11T15:27:16.515Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória carregada para chat 3bdc18c6-d7fe-4bb2-a54d-d86c5f6db602  
> {"userId":"6989446554b8d9a5dee680ae"}

**[2026-02-11T15:27:29.544Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":1507,"attempt":1}

**[2026-02-11T15:27:29.590Z]** 🔍 `DEBUG` | `ai` | **MemorySummarizer** — Ciclo 5bd3d99e-119a-456e-a1d5-8226828ef430 resumido com sucesso

**[2026-02-11T15:27:29.763Z]** ✅ `INFO` | `logic` | **MemoryManager** — Ciclo 5bd3d99e-119a-456e-a1d5-8226828ef430 movido para old e resumido

**[2026-02-11T15:27:29.852Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória salva para chat 3bdc18c6-d7fe-4bb2-a54d-d86c5f6db602  
> {"userId":"6989446554b8d9a5dee680ae","wordCount":191,"recentCycles":2,"oldSummaries":1}

**[2026-02-11T15:27:29.855Z]** ✅ `INFO` | `logic` | **MessageRoute** — Ciclo completo  
> {"chatId":"3bdc18c6-d7fe-4bb2-a54d-d86c5f6db602","decision":"serper","elapsed":"25524ms"}

**[2026-02-11T15:27:29.954Z]** 🔍 `DEBUG` | `system` | **HTTPServer** — POST /message → 200 (25628ms)

**[2026-02-11T15:27:39.205Z]** 🔍 `DEBUG` | `logic` | **AuthMiddleware** — Usuário autenticado: tececonsultoria@gmail.com2  
> {"userId":"6989446554b8d9a5dee680ae","path":"/message"}

**[2026-02-11T15:27:39.208Z]** ✅ `INFO` | `logic` | **MessageRoute** — Nova mensagem recebida  
> {"chatId":"e88bbbca-b3d9-4800-81f2-e631628af9c3","userId":"6989446554b8d9a5dee680ae","queryLength":22}

**[2026-02-11T15:27:39.243Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória não encontrada para chat e88bbbca-b3d9-4800-81f2-e631628af9c3, inicializando vazia

**[2026-02-11T15:27:45.905Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-mini  
> {"tokens":2411,"attempt":1}

**[2026-02-11T15:27:45.912Z]** ✅ `INFO` | `ai` | **Junior** — Query classificada como "serper"  
> {"reasoning":"Pergunta sobre um indicador econômico público (IPCA) — busca de informação/definição disponível na i","needsFollowup":false}

**[2026-02-11T15:27:45.954Z]** 🔍 `DEBUG` | `logic` | **MessageRoute** — Junior decidiu: "serper"  
> {"chatId":"e88bbbca-b3d9-4800-81f2-e631628af9c3","needsFollowup":false}

**[2026-02-11T15:27:45.958Z]** 🔍 `DEBUG` | `logic` | **Dispatcher** — Roteando para "serper"  
> {"query":"O que e inflacao IPCA?"}

**[2026-02-11T15:27:45.971Z]** 🔍 `DEBUG` | `logic` | **ExternalCallManager** — Agente "junior" aguardando "search:serper"  
> {"chatId":"e88bbbca-b3d9-4800-81f2-e631628af9c3","pendingCalls":1}

**[2026-02-11T15:27:46.043Z]** 🔍 `DEBUG` | `logic` | **SearchManager** — Busca via "serper": "O que e inflacao IPCA?"

**[2026-02-11T15:27:46.069Z]** 🔍 `DEBUG` | `logic` | **SerperClient** — Executando busca: "O que e inflacao IPCA?"

**[2026-02-11T15:27:47.123Z]** 🔍 `DEBUG` | `logic` | **SerperClient** — Busca retornou 10 resultados orgânicos

**[2026-02-11T15:27:47.149Z]** 🔍 `DEBUG` | `logic` | **ExternalCallManager** — Agente "junior" retomou após "search:serper"  
> {"chatId":"e88bbbca-b3d9-4800-81f2-e631628af9c3"}

**[2026-02-11T15:27:47.281Z]** 🔍 `DEBUG` | `logic` | **Dispatcher** — Serper search executada com sucesso

**[2026-02-11T15:27:52.261Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":1538,"attempt":1}

**[2026-02-11T15:27:52.335Z]** 🔍 `DEBUG` | `ai` | **ResponseAgent** — Resposta direta formatada (serper)  
> {"format":"conversational","responseLength":651}

**[2026-02-11T15:27:52.427Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória não encontrada para chat e88bbbca-b3d9-4800-81f2-e631628af9c3, inicializando vazia

**[2026-02-11T15:27:52.473Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória salva para chat e88bbbca-b3d9-4800-81f2-e631628af9c3  
> {"userId":"6989446554b8d9a5dee680ae","wordCount":116,"recentCycles":1,"oldSummaries":0}

**[2026-02-11T15:27:52.480Z]** ✅ `INFO` | `logic` | **MessageRoute** — Ciclo completo  
> {"chatId":"e88bbbca-b3d9-4800-81f2-e631628af9c3","decision":"serper","elapsed":"13269ms"}

**[2026-02-11T15:27:52.508Z]** 🔍 `DEBUG` | `system` | **HTTPServer** — POST /message → 200 (13296ms)

**[2026-02-11T15:27:58.205Z]** 🔍 `DEBUG` | `logic` | **AuthMiddleware** — Usuário autenticado: tececonsultoria@gmail.com2  
> {"userId":"6989446554b8d9a5dee680ae","path":"/message"}

**[2026-02-11T15:27:58.212Z]** ✅ `INFO` | `logic` | **MessageRoute** — Nova mensagem recebida  
> {"chatId":"e88bbbca-b3d9-4800-81f2-e631628af9c3","userId":"6989446554b8d9a5dee680ae","queryLength":64}

**[2026-02-11T15:27:58.244Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória carregada para chat e88bbbca-b3d9-4800-81f2-e631628af9c3  
> {"userId":"6989446554b8d9a5dee680ae"}

**[2026-02-11T15:28:07.933Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-mini  
> {"tokens":2729,"attempt":1}

**[2026-02-11T15:28:07.937Z]** ✅ `INFO` | `ai` | **Junior** — Query classificada como "escalate"  
> {"reasoning":"Pedido requer análise aprofundada dos seus gastos do último trimestre e identificação de tendências ","needsFollowup":false}

**[2026-02-11T15:28:07.939Z]** 🔍 `DEBUG` | `logic` | **MessageRoute** — Junior decidiu: "escalate"  
> {"chatId":"e88bbbca-b3d9-4800-81f2-e631628af9c3","needsFollowup":false}

**[2026-02-11T15:28:07.950Z]** 🔍 `DEBUG` | `logic` | **Dispatcher** — Roteando para "escalate"  
> {"query":"Analise meus gastos do ultimo trimestre e identifique tenden"}

**[2026-02-11T15:28:07.959Z]** ✅ `INFO` | `logic` | **Dispatcher** — Escalando para Orquestrador

**[2026-02-11T15:28:20.136Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":2189,"attempt":1}

**[2026-02-11T15:28:20.147Z]** ✅ `INFO` | `ai` | **Orchestrator** — DOC gerado com sucesso  
> {"requestId":"5f66aabb-8d75-41a9-9930-a3f742e09490","agentCount":1,"agents":"analysis"}

**[2026-02-11T15:28:20.153Z]** ✅ `INFO` | `logic` | **Dispatcher** — Executando DOC 5f66aabb-8d75-41a9-9930-a3f742e09490 com 1 agente(s)

**[2026-02-11T15:28:20.169Z]** ✅ `INFO` | `logic` | **ExecutionManager** — Iniciando execução do DOC 5f66aabb-8d75-41a9-9930-a3f742e09490  
> {"agentCount":1,"agents":"analysis"}

**[2026-02-11T15:28:20.177Z]** 🔍 `DEBUG` | `logic` | **ExecutionManager** — Processando agente "analysis" (prioridade: 1)  
> {"dependencies":"nenhuma"}

**[2026-02-11T15:28:20.192Z]** ✅ `INFO` | `ai` | **Agente de Análise** — Iniciando execução: "Coletar e consolidar os gastos dos últimos 3 meses (último trimestre), classific..."

**[2026-02-11T15:28:45.407Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":2752,"attempt":1}

**[2026-02-11T15:28:45.409Z]** ✅ `INFO` | `ai` | **Agente de Análise** — Executando 3 ferramenta(s) solicitada(s)

**[2026-02-11T15:28:45.412Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Processando query: "Listar todas as transações de DESPESA (saídas) dos últimos 3..."

**[2026-02-11T15:29:03.875Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":3395,"attempt":1}

**[2026-02-11T15:29:03.888Z]** 🔍 `DEBUG` | `ai` | **QueryBuilder** — Query NL convertida para JSON  
> {"query":"Listar todas as transações de DESPESA (saídas) dos últimos 3"}

**[2026-02-11T15:29:03.910Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Executando query no MongoDB  
> {"filter":"{\"$and\":[{\"date\":{\"$gte\":\"2025-11-01\",\"$lte\":\"2026-01-31\"}},{\"type\":\"expense\"}]}"}

**[2026-02-11T15:29:03.996Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Query retornou 1 resultados

**[2026-02-11T15:29:04.030Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Query retornou 1 resultados

**[2026-02-11T15:29:04.092Z]** 🔍 `DEBUG` | `logic` | **Agente de Análise** — Ferramenta "finance_bridge:query" executada com sucesso

**[2026-02-11T15:29:04.163Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Processando query: "Listar todas as transações de RECEITA/ENTRADA (créditos) dos..."

**[2026-02-11T15:29:21.674Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":3558,"attempt":1}

**[2026-02-11T15:29:21.738Z]** 🔍 `DEBUG` | `ai` | **QueryBuilder** — Query NL convertida para JSON  
> {"query":"Listar todas as transações de RECEITA/ENTRADA (créditos) dos"}

**[2026-02-11T15:29:21.751Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Executando query no MongoDB  
> {"filter":"{\"$and\":[{\"date\":{\"$gte\":\"2025-11-01\",\"$lte\":\"2026-01-31\"}},{\"type\":\"income\"}]}"}

**[2026-02-11T15:29:21.793Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Query retornou 0 resultados

**[2026-02-11T15:29:21.799Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Query retornou 0 resultados

**[2026-02-11T15:29:21.803Z]** 🔍 `DEBUG` | `logic` | **Agente de Análise** — Ferramenta "finance_bridge:query" executada com sucesso

**[2026-02-11T15:29:21.852Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Processando query: "Trazer um resumo agregado (se disponível) de despesas por mê..."

**[2026-02-11T15:29:33.861Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":2768,"attempt":1}

**[2026-02-11T15:29:33.865Z]** 🔍 `DEBUG` | `ai` | **QueryBuilder** — Query NL convertida para JSON  
> {"query":"Trazer um resumo agregado (se disponível) de despesas por mê"}

**[2026-02-11T15:29:33.867Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Executando query no MongoDB  
> {"filter":"{\"$and\":[{\"date\":{\"$gte\":\"2025-11-01\",\"$lte\":\"2026-01-31\"}},{\"type\":\"expense\"}]}"}

**[2026-02-11T15:29:33.896Z]** 🔍 `DEBUG` | `logic` | **FinanceBridgeExecutor** — Query retornou 1 resultados

**[2026-02-11T15:29:33.905Z]** ✅ `INFO` | `logic` | **FinanceBridge** — Query retornou 1 resultados

**[2026-02-11T15:29:33.911Z]** 🔍 `DEBUG` | `logic` | **Agente de Análise** — Ferramenta "finance_bridge:query" executada com sucesso

**[2026-02-11T15:30:03.715Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":4323,"attempt":1}

**[2026-02-11T15:30:03.730Z]** ✅ `INFO` | `ai` | **Agente de Análise** — Execução concluída  
> {"taskCompleted":true,"toolsUsed":"finance_bridge","toolsExecuted":1,"confidence":"low","elapsed":"103534ms"}

**[2026-02-11T15:30:03.744Z]** 🔍 `DEBUG` | `logic` | **ExecutionQueue** — Agente "analysis" concluído  
> {"agentName":"analysis","success":true}

**[2026-02-11T15:30:03.747Z]** ✅ `INFO` | `logic` | **ExecutionManager** — Agente "analysis" concluído com sucesso  
> {"confidence":"low"}

**[2026-02-11T15:30:03.755Z]** ✅ `INFO` | `logic` | **ExecutionManager** — Execução do DOC 5f66aabb-8d75-41a9-9930-a3f742e09490 concluída  
> {"elapsed":"103582ms","agentsCompleted":1}

**[2026-02-11T15:30:03.766Z]** ✅ `INFO` | `logic` | **Dispatcher** — Escalada concluída com sucesso  
> {"requestId":"5f66aabb-8d75-41a9-9930-a3f742e09490","agentsExecuted":1}

**[2026-02-11T15:30:03.775Z]** 🔍 `DEBUG` | `logic` | **OutputIntegrator** — Outputs integrados: 1 sucesso, 0 falha(s)  
> {"successful":"analysis","failed":"nenhuma"}

**[2026-02-11T15:30:12.862Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5.2  
> {"tokens":2500,"attempt":1}

**[2026-02-11T15:30:12.866Z]** ✅ `INFO` | `ai` | **ResponseAgent** — Resposta sintetizada com sucesso  
> {"format":"conversational","tone":"alert","agentsIntegrated":1,"responseLength":1244}

**[2026-02-11T15:30:12.892Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória carregada para chat e88bbbca-b3d9-4800-81f2-e631628af9c3  
> {"userId":"6989446554b8d9a5dee680ae"}

**[2026-02-11T15:30:12.941Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória salva para chat e88bbbca-b3d9-4800-81f2-e631628af9c3  
> {"userId":"6989446554b8d9a5dee680ae","wordCount":307,"recentCycles":2,"oldSummaries":0}

**[2026-02-11T15:30:12.943Z]** ✅ `INFO` | `logic` | **MessageRoute** — Ciclo completo  
> {"chatId":"e88bbbca-b3d9-4800-81f2-e631628af9c3","decision":"escalate","elapsed":"134735ms"}

**[2026-02-11T15:30:12.979Z]** 🔍 `DEBUG` | `system` | **HTTPServer** — POST /message → 200 (134772ms)

**[2026-02-11T15:30:47.188Z]** 🔍 `DEBUG` | `logic` | **AuthMiddleware** — Usuário autenticado: tececonsultoria@gmail.com2  
> {"userId":"6989446554b8d9a5dee680ae","path":"/message"}

**[2026-02-11T15:30:47.228Z]** ✅ `INFO` | `logic` | **MessageRoute** — Nova mensagem recebida  
> {"chatId":"e88bbbca-b3d9-4800-81f2-e631628af9c3","userId":"6989446554b8d9a5dee680ae","queryLength":55}

**[2026-02-11T15:30:47.272Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória carregada para chat e88bbbca-b3d9-4800-81f2-e631628af9c3  
> {"userId":"6989446554b8d9a5dee680ae"}

**[2026-02-11T15:31:10.103Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-mini  
> {"tokens":3963,"attempt":1}

**[2026-02-11T15:31:10.105Z]** 🔍 `DEBUG` | `ai` | **JuniorFollowup** — Follow-up gerado  
> {"missingFields":["saldo_atual_destinado_à_meta","renda_mensal_liquida","despesas_mensais_medias","confirmacao_data_alvo"],"source":"model"}

**[2026-02-11T15:31:10.108Z]** ✅ `INFO` | `ai` | **Junior** — Query classificada como "escalate"  
> {"reasoning":"Pedido de criação de um plano de poupança até uma data fixa — tarefa complexa que exige análise da r","needsFollowup":true}

**[2026-02-11T15:31:10.115Z]** 🔍 `DEBUG` | `logic` | **MessageRoute** — Junior decidiu: "escalate"  
> {"chatId":"e88bbbca-b3d9-4800-81f2-e631628af9c3","needsFollowup":true}

**[2026-02-11T15:31:10.118Z]** 🔍 `DEBUG` | `logic` | **MessageRoute** — Retornando follow-up ao usuário

**[2026-02-11T15:31:10.145Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória carregada para chat e88bbbca-b3d9-4800-81f2-e631628af9c3  
> {"userId":"6989446554b8d9a5dee680ae"}

**[2026-02-11T15:32:17.729Z]** 🔍 `DEBUG` | `ai` | **OpenAIClient** — Resposta recebida do modelo gpt-5-nano  
> {"tokens":8235,"attempt":1}

**[2026-02-11T15:32:17.731Z]** 🔍 `DEBUG` | `ai` | **MemorySummarizer** — Ciclo a1dd5673-06f1-4ff1-91bb-4efde627361e resumido com sucesso

**[2026-02-11T15:32:17.732Z]** ✅ `INFO` | `logic` | **MemoryManager** — Ciclo a1dd5673-06f1-4ff1-91bb-4efde627361e movido para old e resumido

**[2026-02-11T15:32:17.783Z]** 🔍 `DEBUG` | `logic` | **MemoryStorage** — Memória salva para chat e88bbbca-b3d9-4800-81f2-e631628af9c3  
> {"userId":"6989446554b8d9a5dee680ae","wordCount":335,"recentCycles":2,"oldSummaries":1}

**[2026-02-11T15:32:17.796Z]** 🔍 `DEBUG` | `system` | **HTTPServer** — POST /message → 200 (90679ms)

