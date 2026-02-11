# Plano de Testes — Queries via Chat (Frontend)

## Escopo
Este documento define queries de teste para validar o fluxo completo do sistema via chat do frontend, incluindo roteamento do Junior, execução de ferramentas, escalada para coordenadores, síntese do ResponseAgent e comportamento de memória. Os logs esperados foram alinhados com o formato do logger central e as mensagens reais emitidas pelos módulos.

## Referência de logging (resumo)
- Níveis: ERROR, WARN, INFO, DEBUG.
- Tipos: logic, ai, system.
- Componentes principais: MessageRoute, Junior, Dispatcher, FinanceBridge, FinanceBridgeInsert, QueryBuilder, FinanceBridgeValidator, FinanceBridgeExecutor, SearchManager, SerperClient, BrapiClient, TavilyClient, Orchestrator, ExecutionManager, ExecutionQueue, ResponseAgent, MemoryManager, MemorySummarizer, MemoryCompressor, ExternalCallManager, HTTPServer.

---

## Testes

### Teste 01 — Saudacao simples (simple_response)
- Query: "Oi"
- O que esta sendo testado: Roteamento para simple_response e resposta social via Mini.
- Criterios de sucesso: Resposta breve e cordial; nao aciona Finance Bridge ou Orquestrador.
- Logs esperados (sucesso):
  - MessageRoute: "Nova mensagem recebida"
  - Junior: "Query classificada como \"simple_response\""
  - Dispatcher: "Resposta social via ResponseAgent"
  - ResponseAgent: "Resposta social formatada"
  - MessageRoute: "Ciclo completo"
- Logs de falha/alerta:
  - Dispatcher: "Rota desconhecida" ou "Falha na escalada"
  - ResponseAgent: "Falha ao formatar resposta social"

### Teste 02 — Saudacao com variacao (simple_response)
- Query: "Bom dia"
- O que esta sendo testado: Priorizacao da rota simple_response em saudacoes.
- Criterios de sucesso: Resposta social rapida; sem escalada.
- Logs esperados (sucesso): Junior "simple_response", Dispatcher "Resposta social via ResponseAgent", ResponseAgent "Resposta social formatada".
- Logs de falha/alerta: ResponseAgent "Falha ao formatar resposta social".

### Teste 03 — Agradecimento (simple_response)
- Query: "Obrigado"
- O que esta sendo testado: Interacao social pos-conversa.
- Criterios de sucesso: Resposta breve e contextual.
- Logs esperados (sucesso): Junior "simple_response" + ResponseAgent "Resposta social formatada".
- Logs de falha/alerta: Dispatcher "Rota desconhecida".

### Teste 04 — Despedida (simple_response)
- Query: "Tchau"
- O que esta sendo testado: Encerramento social sem escalada.
- Criterios de sucesso: Resposta positiva e curta.
- Logs esperados (sucesso): ResponseAgent "Resposta social formatada".
- Logs de falha/alerta: ResponseAgent "Falha ao formatar resposta social".

### Teste 05 — Pergunta sobre o sistema (simple_response + sistema.md)
- Query: "Como voce funciona?"
- O que esta sendo testado: Carregamento condicional de docs/md_sistema/sistema.md.
- Criterios de sucesso: Resposta explicativa usando contexto do sistema.
- Logs esperados (sucesso):
  - ResponseAgent: "Documentacao do sistema carregada para contexto"
  - ResponseAgent: "Resposta social formatada"
- Logs de falha/alerta:
  - ResponseAgent: "Nao foi possivel carregar documentacao do sistema"

### Teste 06 — Pergunta casual contextual (simple_response)
- Query: "Legal, entendi"
- O que esta sendo testado: Interacao social sem acao operacional.
- Criterios de sucesso: Resposta social sem acionar ferramentas.
- Logs esperados (sucesso): Junior "simple_response"; ResponseAgent "Resposta social formatada".
- Logs de falha/alerta: Dispatcher "Rota desconhecida".

### Teste 07 — Saudacao + consulta financeira (prioridade de roteamento)
- Query: "Ola, quanto gastei este mes?"
- O que esta sendo testado: Prioridade de bridge_query sobre saudacao quando ha intent financeira.
- Criterios de sucesso: Rota bridge_query; resposta com valor em R$.
- Logs esperados (sucesso):
  - Junior: "Query classificada como \"bridge_query\""
  - Dispatcher: "Roteando para \"bridge_query\""
  - FinanceBridge: "Processando query"
  - ResponseAgent: "Resposta direta formatada (bridge_query)"
- Logs de falha/alerta: Dispatcher "Resposta social via ResponseAgent" (indicaria roteamento incorreto).

### Teste 08 — Saudacao + lancamento (prioridade de roteamento)
- Query: "Bom dia, gastei R$30 no cafe"
- O que esta sendo testado: Prioridade de bridge_insert sobre saudacao.
- Criterios de sucesso: Rota bridge_insert; confirmacao de lancamento.
- Logs esperados (sucesso): Junior "bridge_insert"; FinanceBridgeInsert "Pipeline de insert concluido com sucesso".
- Logs de falha/alerta: ResponseAgent "Resposta social formatada" (roteamento incorreto).

### Teste 09 — Insert simples (despesa)
- Query: "Gastei R$50 no almoco"
- O que esta sendo testado: Pipeline de insert completo (classifier, selector, assembler, validator, executor).
- Criterios de sucesso: Insert concluido; categoria coerente.
- Logs esperados (sucesso):
  - FinanceBridgeInsert: "Iniciando pipeline de insert"
  - InsertClassifier: "Transacao classificada"
  - CategorySelector: "Categoria selecionada"
  - InsertAssembler: "Lancamento montado com sucesso"
  - FinanceBridgeInsert: "Pipeline de insert concluido com sucesso"
- Logs de falha/alerta: FinanceBridgeInsert "Validacao falhou".

### Teste 10 — Insert simples (receita)
- Query: "Recebi R$3000 de salario"
- O que esta sendo testado: Classificacao como income e categorias de receita.
- Criterios de sucesso: Tipo income; insert concluido.
- Logs esperados (sucesso): InsertClassifier "Transacao classificada como \"income\""; FinanceBridgeInsert "Pipeline de insert concluido".
- Logs de falha/alerta: InsertClassifier "Tipo invalido retornado".

### Teste 11 — Metodo de pagamento inferido
- Query: "Paguei R$120 de luz no cartao"
- O que esta sendo testado: Inferencia de payment_method no assembler.
- Criterios de sucesso: Insert concluido com payment_method coerente.
- Logs esperados (sucesso): InsertAssembler "Lancamento montado com sucesso".
- Logs de falha/alerta: InsertAssembler "Falha ao montar lancamento".

### Teste 12 — Caso ambiguo (Uber Eats)
- Query: "Uber Eats R$35"
- O que esta sendo testado: Analise contextual de categoria (Alimentacao vs Transporte).
- Criterios de sucesso: Categoria de alimentacao.
- Logs esperados (sucesso): CategorySelector "Categoria selecionada".
- Logs de falha/alerta: CategorySelector "Nenhum match encontrado, usando primeira categoria".

### Teste 13 — Data explicita passada
- Query: "Gastei R$200 no mercado ontem"
- O que esta sendo testado: Extraicao de data pelo assembler e validacao.
- Criterios de sucesso: Data preenchida; insert ok.
- Logs esperados (sucesso): InsertAssembler "Lancamento montado com sucesso".
- Logs de falha/alerta: FinanceBridgeValidator "Validacao de insert falhou".

### Teste 14 — Follow-up por dados incompletos
- Query: "Gastei 200"
- O que esta sendo testado: Follow-up do Junior para dados faltantes.
- Criterios de sucesso: Retorno de pergunta contextualizada; nao executa Finance Bridge.
- Logs esperados (sucesso):
  - Junior: "Query classificada como \"bridge_insert\""
  - MessageRoute: "Retornando follow-up ao usuario"
  - JuniorFollowup: "Follow-up gerado"
- Logs de falha/alerta: FinanceBridge "Processando insert" (nao deveria ocorrer).

### Teste 15 — Insert com descricao curta
- Query: "Remedio R$60"
- O que esta sendo testado: Seletor de categoria e subcategoria com descricao breve.
- Criterios de sucesso: Categoria de farmacia; insert concluido.
- Logs esperados (sucesso): CategorySelector "Categoria selecionada"; FinanceBridgeInsert "Pipeline de insert concluido".
- Logs de falha/alerta: CategorySelector "Nenhum match encontrado".

### Teste 16 — Assinatura de servico
- Query: "Assinei Netflix por 39,90"
- O que esta sendo testado: Categorizacao de lazer/entretenimento.
- Criterios de sucesso: Categoria coerente; insert concluido.
- Logs esperados (sucesso): CategorySelector "Categoria selecionada".
- Logs de falha/alerta: InsertAssembler "Falha ao montar lancamento".

### Teste 17 — Despesa com data especifica
- Query: "Paguei aluguel R$1200 dia 5"
- O que esta sendo testado: Interpretacao de data e categoria de moradia.
- Criterios de sucesso: Insert com data valida.
- Logs esperados (sucesso): InsertAssembler "Lancamento montado com sucesso".
- Logs de falha/alerta: FinanceBridgeValidator "Validacao de insert falhou".

### Teste 18 — Receita extra
- Query: "Ganhei 500 de freelance"
- O que esta sendo testado: Classificacao income e descricao.
- Criterios de sucesso: Insert concluido como receita.
- Logs esperados (sucesso): InsertClassifier "Transacao classificada como \"income\"".
- Logs de falha/alerta: InsertClassifier "Falha ao classificar transacao".

### Teste 19 — Debito e categoria combustivel
- Query: "Gasolina 200 no debito"
- O que esta sendo testado: Inferencia de metodo de pagamento e categoria.
- Criterios de sucesso: Insert concluido.
- Logs esperados (sucesso): InsertAssembler "Lancamento montado com sucesso".
- Logs de falha/alerta: FinanceBridgeInsert "Validacao falhou".

### Teste 20 — Data futura (validacao)
- Query: "Gastei R$100 amanha"
- O que esta sendo testado: Bloqueio de data futura para despesas.
- Criterios de sucesso: Validacao falha; sistema responde com erro controlado.
- Logs esperados (sucesso): FinanceBridgeInsert "Validacao falhou: Data futura nao e permitida".
- Logs de falha/alerta: FinanceBridgeExecutor "Insert executado com sucesso" (nao deveria ocorrer).

### Teste 21 — Query simples do mes atual
- Query: "Quanto gastei este mes?"
- O que esta sendo testado: bridge_query com named_period current_month.
- Criterios de sucesso: Resposta com total em R$.
- Logs esperados (sucesso):
  - FinanceBridge: "Processando query"
  - QueryBuilder: "Query NL convertida para JSON"
  - FinanceBridgeExecutor: "Executando query no MongoDB"
- Logs de falha/alerta: FinanceBridge "Query invalida".

### Teste 22 — Query mes passado
- Query: "Quanto gastei no mes passado?"
- O que esta sendo testado: named_period last_month.
- Criterios de sucesso: Resposta com total do mes anterior.
- Logs esperados (sucesso): QueryBuilder "Query NL convertida"; FinanceBridgeExecutor "Query retornou".
- Logs de falha/alerta: FinanceBridgeValidator "Validacao de query falhou".

### Teste 23 — Filtro por categoria e periodo curto
- Query: "Gastos de alimentacao nos ultimos 6 dias"
- O que esta sendo testado: Filtro categories + named_period last_6_days.
- Criterios de sucesso: Retorno filtrado.
- Logs esperados (sucesso): FinanceBridgeExecutor "Executando query no MongoDB".
- Logs de falha/alerta: FinanceBridgeValidator "Campo \"categories\" deve ser um array".

### Teste 24 — Intervalo de valor
- Query: "Gastos entre R$120 e R$145 nesse mes ?"
- O que esta sendo testado: Filtros amount.min/max e period.start/end.
- Criterios de sucesso: Query valida e executada.
- Logs esperados (sucesso): FinanceBridgeExecutor "Query retornou".
- Logs de falha/alerta: FinanceBridgeValidator "Valor minimo e maior que valor maximo".

### Teste 25 — Somente receitas do mes
- Query: "Mostre minhas receitas deste mes"
- O que esta sendo testado: Filtro por tipo e periodo.
- Criterios de sucesso: Query valida e resposta com receitas.
- Logs esperados (sucesso): FinanceBridge "Query retornou".
- Logs de falha/alerta: FinanceBridge "Query invalida".

### Teste 26 — Comparativo por categoria (roteamento)
- Query: "Quais categorias eu mais gastei este trimestre?"
- O que esta sendo testado: bridge_query com named_period last_quarter.
- Criterios de sucesso: Resposta com categorias mais relevantes.
- Logs esperados (sucesso): QueryBuilder "Query NL convertida"; ResponseAgent "Resposta direta formatada (bridge_query)".
- Logs de falha/alerta: Dispatcher "Escalando para Orquestrador" (nao deveria).

### Teste 27 — Intervalo de datas explicitas
- Query: "Despesas entre 2025-12-01 e 2025-12-31"
- O que esta sendo testado: period.start/end validos ISO.
- Criterios de sucesso: Query executada.
- Logs esperados (sucesso): FinanceBridgeExecutor "Executando query no MongoDB".
- Logs de falha/alerta: FinanceBridgeValidator "Data de inicio invalida".

### Teste 28 — Filtro por valor minimo
- Query: "Despesas acima de R$500"
- O que esta sendo testado: amount.min.
- Criterios de sucesso: Query valida.
- Logs esperados (sucesso): FinanceBridgeExecutor "Query retornou".
- Logs de falha/alerta: FinanceBridgeValidator "Valor minimo invalido".

### Teste 29 — Exclusao por categoria
- Query: "Gastos deste mes exceto lazer"
- O que esta sendo testado: Uso de exclude.categories.
- Criterios de sucesso: Query valida com exclusao.
- Logs esperados (sucesso): FinanceBridgeExecutor "Executando query no MongoDB".
- Logs de falha/alerta: FinanceBridgeValidator "Validacao de query falhou".

### Teste 30 — Filtro por metodo de pagamento
- Query: "Quanto gastei no cartao de credito este mes?"
- O que esta sendo testado: payment_method.
- Criterios de sucesso: Query valida e resposta com filtro.
- Logs esperados (sucesso): QueryBuilder "Query NL convertida para JSON".
- Logs de falha/alerta: FinanceBridge "Query invalida".

### Teste 31 — Limite de resultados
- Query: "Mostre os ultimos 5 lancamentos"
- O que esta sendo testado: params.limit.
- Criterios de sucesso: Limit aplicado.
- Logs esperados (sucesso): FinanceBridgeExecutor "Query retornou".
- Logs de falha/alerta: FinanceBridgeValidator "Limite invalido".

### Teste 32 — Ordenacao por valor
- Query: "Ordene meus gastos por valor, do maior para o menor"
- O que esta sendo testado: params.sort.field=amount e order=desc.
- Criterios de sucesso: Query valida.
- Logs esperados (sucesso): FinanceBridgeExecutor "Executando query no MongoDB".
- Logs de falha/alerta: FinanceBridgeValidator "Campo de ordenacao invalido".

### Teste 33 — Serper: taxa Selic
- Query: "Qual a taxa Selic atual?"
- O que esta sendo testado: Rota serper com busca publica.
- Criterios de sucesso: Resposta com valor e data.
- Logs esperados (sucesso):
  - Junior: "Query classificada como \"serper\""
  - Dispatcher: "Serper search executada com sucesso"
  - SerperClient: "Busca retornou"
- Logs de falha/alerta: SerperClient "API key do Serper nao configurada".

### Teste 34 — Serper: pergunta institucional
- Query: "Quem e o presidente do Banco Central?"
- O que esta sendo testado: Rota serper para informacao publica.
- Criterios de sucesso: Resposta com nome atual.
- Logs esperados (sucesso): SearchManager "Busca via \"serper\""; SerperClient "Executando busca".
- Logs de falha/alerta: SearchManager "Falha na busca (serper)".

### Teste 35 — Serper: noticias de mercado
- Query: "Noticias do dolar hoje"
- O que esta sendo testado: Busca serper com contexto atual.
- Criterios de sucesso: Resposta com resumo de noticias.
- Logs esperados (sucesso): SerperClient "Busca retornou".
- Logs de falha/alerta: SerperClient "Timeout na busca".

### Teste 36 — Serper: conceito economico
- Query: "O que e inflacao IPCA?"
- O que esta sendo testado: Resposta informativa sem escalada.
- Criterios de sucesso: Resposta direta e curta.
- Logs esperados (sucesso): ResponseAgent "Resposta direta formatada (serper)".
- Logs de falha/alerta: ResponseAgent "Falha ao formatar resposta direta".

### Teste 37 — Escalada simples (Analise)
- Query: "Analise meus gastos do ultimo trimestre e identifique tendencias"
- O que esta sendo testado: Escalada com 1 coordenador (analysis).
- Criterios de sucesso: DOC com analysis; resposta sintetizada.
- Logs esperados (sucesso):
  - Dispatcher: "Escalando para Orquestrador"
  - Orchestrator: "DOC gerado com sucesso"
  - ExecutionManager: "Agente \"analysis\" concluido com sucesso"
  - ResponseAgent: "Resposta sintetizada com sucesso"
- Logs de falha/alerta: Orchestrator "DOC invalido".

### Teste 38 — Escalada com investimentos
- Query: "Avalie minha carteira e sugira realocacao entre renda fixa e acoes"
- O que esta sendo testado: Coordenador de investimentos.
- Criterios de sucesso: ExecutionManager executa investments.
- Logs esperados (sucesso): ExecutionManager "Processando agente \"investments\""; ResponseAgent "Resposta sintetizada".
- Logs de falha/alerta: ExecutionManager "Coordenador \"investments\" nao disponivel".

### Teste 39 — Escalada com planejamento
- Query: "Crie um plano para juntar R$10.000 ate dezembro de 2026"
- O que esta sendo testado: Coordenador de planejamento com metas.
- Criterios de sucesso: Plano coerente e referencias a datas/valores.
- Logs esperados (sucesso): ExecutionManager "Processando agente \"planning\"".
- Logs de falha/alerta: ExecutionManager "Falha no agente \"planning\"".

### Teste 40 — Escalada com dependencia (investments -> planning)
- Query: "Analise meus investimentos e sugira ajustes no orcamento"
- O que esta sendo testado: Dependencias entre agentes no DOC.
- Criterios de sucesso: Planning aguarda investments.
- Logs esperados (sucesso):
  - ExecutionManager: "Aguardando dependencias de \"planning\""
  - ExecutionManager: "Agente \"investments\" concluido com sucesso"
- Logs de falha/alerta: Planning concluido antes de investments.

### Teste 41 — Escalada completa (3 agentes)
- Query: "Faca uma analise completa das minhas financas, avalie minha carteira e sugira um plano de acao"
- O que esta sendo testado: DOC com analysis, investments e planning.
- Criterios de sucesso: Execucao em cadeia; resposta integrada.
- Logs esperados (sucesso): ExecutionManager "Iniciando execucao do DOC" + OutputIntegrator "Outputs integrados".
- Logs de falha/alerta: Orchestrator "Agentes duplicados no plano".

### Teste 42 — Comparacao e ajuste de gastos
- Query: "Compare meus gastos de alimentacao vs transporte e sugira ajustes"
- O que esta sendo testado: Analise + planejamento (resposta estruturada).
- Criterios de sucesso: Formato structured.
- Logs esperados (sucesso): ResponseAgent "Resposta sintetizada com sucesso" com format suggested.
- Logs de falha/alerta: ResponseAgent fallback.

### Teste 43 — Reducao de despesas e aporte
- Query: "Quero reduzir despesas e aumentar aportes. Quais cortes e estrategia?"
- O que esta sendo testado: Escalada multipla com integracao de outputs.
- Criterios de sucesso: Resposta integrada e viavel.
- Logs esperados (sucesso): OutputIntegrator "Outputs integrados".
- Logs de falha/alerta: ExecutionManager "Falha no agente".

### Teste 44 — Investments com ticker (Brapi)
- Query: "Tenho PETR4 e VALE3. Analise risco e traga cotacoes atuais"
- O que esta sendo testado: Uso de Brapi via coordinator.
- Criterios de sucesso: BrapiClient chamado; dados usados na resposta.
- Logs esperados (sucesso): BrapiClient "Requisicao" e "Dados recebidos".
- Logs de falha/alerta: BrapiClient "Timeout na requisicao".

### Teste 45 — Planejamento com contexto macro
- Query: "Considere Selic e inflacao e ajuste meu planejamento para 2026"
- O que esta sendo testado: Uso de busca externa por coordenador.
- Criterios de sucesso: Chamada Serper/Tavily; resposta contextual.
- Logs esperados (sucesso): SearchManager "Busca via"; SerperClient ou TavilyClient "Pesquisa retornou".
- Logs de falha/alerta: SearchManager "Falha na busca".

### Teste 46 — Projecao de aportes (math)
- Query: "Projete aportes de R$500 por 24 meses com juros de 1% ao mes"
- O que esta sendo testado: Rota math_direct com calculo direto.
- Criterios de sucesso: MathModule executado, toolsExecuted > 0, resposta direta, sem consulta ao MongoDB.
- Logs esperados (sucesso): Junior "math_direct"; Dispatcher "Roteando para \"math_direct\""; MathDirect "Calculo matematico direto executado"; MathModule "Projecao: PMT=500"; ResponseAgent "Resposta direta formatada (math_direct)".
- Logs de falha/alerta: Dispatcher "Falha no MathDirect".

### Teste 47 — Juros compostos (math)
- Query: "Calcule juros compostos de R$1000 a 1% por 12 meses"
- O que esta sendo testado: Rota math_direct com calculo direto.
- Criterios de sucesso: MathModule executado, toolsExecuted > 0, valor final em R$, sem consulta ao MongoDB.
- Logs esperados (sucesso): Junior "math_direct"; MathDirect "Calculo matematico direto executado"; MathModule "Juros compostos: P=1000"; ResponseAgent "Resposta direta formatada (math_direct)".
- Logs de falha/alerta: Dispatcher "Falha no MathDirect".

### Teste 48 — VPL e TIR (math)
- Query: "Avalie VPL e TIR para fluxos -1000, 300, 400, 500 e taxa 10%"
- O que esta sendo testado: Rota math_direct com calculo direto (VPL e TIR).
- Criterios de sucesso: MathModule executado, toolsExecuted > 0, VPL e TIR retornados, sem consulta ao MongoDB.
- Logs esperados (sucesso): Junior "math_direct"; MathDirect "Calculo matematico direto executado"; MathModule "VPL:" e "TIR:"; ResponseAgent "Resposta direta formatada (math_direct)".
- Logs de falha/alerta: MathModule "TIR nao convergiu".

### Teste 49 — Sharpe Ratio (math)
- Query: "Use retornos 1%, -0,5%, 2% e taxa livre 0,6% para calcular Sharpe"
- O que esta sendo testado: Rota math_direct com calculo direto.
- Criterios de sucesso: MathModule executado, toolsExecuted > 0, Sharpe calculado, sem consulta ao MongoDB.
- Logs esperados (sucesso): Junior "math_direct"; MathDirect "Calculo matematico direto executado"; MathModule "Sharpe:"; ResponseAgent "Resposta direta formatada (math_direct)".
- Logs de falha/alerta: Dispatcher "Falha no MathDirect".

### Teste 50 — VaR (math)
- Query: "Calcule VaR com retornos 0,5%, -1%, 0,8%, -0,3% e confianca 95%"
- O que esta sendo testado: Rota math_direct com calculo direto.
- Criterios de sucesso: MathModule executado, toolsExecuted > 0, VaR formatado, sem consulta ao MongoDB.
- Logs esperados (sucesso): Junior "math_direct"; MathDirect "Calculo matematico direto executado"; MathModule "VaR:"; ResponseAgent "Resposta direta formatada (math_direct)".
- Logs de falha/alerta: Dispatcher "Falha no MathDirect".

### Teste 51 — Escalada com dependencia e memoria
- Query: "Com base no que gastei este mes, crie um plano de economia"
- O que esta sendo testado: Uso de memoria na escalada + planejamento.
- Criterios de sucesso: Resposta referencia gastos recentes.
- Logs esperados (sucesso): Orchestrator "DOC gerado"; PlanningCoordinator "Execucao concluida".
- Logs de falha/alerta: Orchestrator "DOC invalido".

### Teste 52 — Consulta com contexto de memoria
- Query: "E quanto gastei no total este mes?"
- O que esta sendo testado: Uso de memoria recente apos lancamentos.
- Criterios de sucesso: Resposta inclui lancamentos anteriores.
- Logs esperados (sucesso): MemoryStorage "Memoria carregada para chat".
- Logs de falha/alerta: MemoryStorage "Memoria nao encontrada" (em chat ja existente).

### Teste 53 — Resumo de memoria (3o ciclo)
- Query: "Gastei R$25 no onibus"
- O que esta sendo testado: Resumo automatico ao ultrapassar 2 ciclos recentes.
- Criterios de sucesso: Ciclo movido para old e resumido.
- Logs esperados (sucesso):
  - MemoryManager: "Ciclo ... movido para old e resumido"
  - MemorySummarizer: "Ciclo ... resumido com sucesso"
- Logs de falha/alerta: MemorySummarizer "Falha ao resumir ciclo".

### Teste 54 — Escalada com falha controlada de ferramenta
- Query: "Pesquise tendencias do mercado imobiliario 2026 e integre no meu plano"
- O que esta sendo testado: Uso de Tavily em coordenador e handling de falha.
- Criterios de sucesso: Resposta inclui pesquisa; se API falhar, resposta ainda retorna.
- Logs esperados (sucesso): TavilyClient "Pesquisa profunda" + "Pesquisa retornou".
- Logs de falha/alerta: TavilyClient "API key do Tavily nao configurada" ou "Timeout na pesquisa".

### Teste 55 — Busca publica com dados economicos
- Query: "Qual o CDI hoje?"
- O que esta sendo testado: Rota serper para indicador.
- Criterios de sucesso: Resposta direta.
- Logs esperados (sucesso): SerperClient "Executando busca".
- Logs de falha/alerta: SerperClient "Falha na busca Serper".

### Teste 56 — Pergunta rapida (quick format)
- Query: "Quanto tenho na conta?"
- O que esta sendo testado: Format-selector sugerindo quick em rota direta.
- Criterios de sucesso: Resposta curta (1-2 frases).
- Logs esperados (sucesso): ResponseAgent "Resposta direta formatada (bridge_query)".
- Logs de falha/alerta: ResponseAgent "Falha ao formatar resposta direta".

### Teste 57 — Relatorio detalhado (report format)
- Query: "Me de um relatorio detalhado dos meus gastos dos ultimos 3 meses"
- O que esta sendo testado: Format-selector sugerindo report na escalada.
- Criterios de sucesso: Resposta em formato de relatorio.
- Logs esperados (sucesso): ResponseAgent "Resposta sintetizada com sucesso" com format report.
- Logs de falha/alerta: ResponseAgent fallback.

### Teste 58 — Lista estruturada (structured format)
- Query: "Liste os principais cortes de gastos e vantagens e desvantagens"
- O que esta sendo testado: Format-selector sugerindo structured.
- Criterios de sucesso: Resposta estruturada e comparativa.
- Logs esperados (sucesso): ResponseAgent "Resposta sintetizada com sucesso".
- Logs de falha/alerta: ResponseAgent "Falha ao sintetizar resposta".

### Teste 59 — Serper vs escalada (roteamento publico)
- Query: "Qual o valor do dolar hoje?"
- O que esta sendo testado: Junior prioriza serper para dado publico.
- Criterios de sucesso: Rota serper.
- Logs esperados (sucesso): Junior "serper"; Dispatcher "Serper search executada com sucesso".
- Logs de falha/alerta: Dispatcher "Escalando para Orquestrador".

### Teste 60 — Escalada para analise de fluxo
- Query: "Analise meu fluxo de caixa e identifique gargalos"
- O que esta sendo testado: Coordenador de analise.
- Criterios de sucesso: ResponseAgent integra output de analysis.
- Logs esperados (sucesso): ExecutionManager "Agente \"analysis\" concluido com sucesso".
- Logs de falha/alerta: ExecutionManager "Falha no agente \"analysis\"".

---

Fim do plano de testes.
