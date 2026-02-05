# Plano de Implementação
## Sistema Multi-Agente - MVP

Este documento organiza a construção do sistema em **14 objetivos**, cada um contendo tarefas específicas. Os objetivos estão em **ordem cronológica**: o primeiro deve ser concluído antes de avançar para o segundo, e assim por diante.

---

## 📌 Fase 1: Fundação (Infraestrutura Base)

---

### Objetivo 1: Preparar o Banco de Dados

Antes de qualquer agente funcionar, o sistema precisa de um lugar para guardar e buscar informações financeiras do usuário.

**Tarefas:**

1. Criar a conexão com o banco de dados MongoDB.
2. Definir a estrutura dos documentos de transações financeiras.
3. Criar índices para buscas rápidas por data, categoria e valor.
4. Implementar as operações básicas: inserir, consultar, atualizar e deletar registros.

---

### Objetivo 2: Construir o Finance Bridge

O Finance Bridge é a ponte entre os agentes de IA e o banco de dados. Ele traduz pedidos em linguagem natural para consultas estruturadas.

**Tarefas:**

1. Criar o serviço que recebe requisições no formato JSON padronizado (com campos: operation, params, filters, context).
2. Implementar a lógica de filtros booleanos (AND, OR, NOT) para combinar critérios de busca.
3. Implementar os "períodos inteligentes" que traduzem termos como "current_month", "last_quarter", "since_last_payday" e "last_x_days" em datas reais.
4. Criar as seis operações suportadas: query (consulta), insert (inserção), update (atualização), delete (remoção), aggregate (cálculos matemáticos) e compare (comparação entre períodos).
5. Adicionar camada de validação e segurança: verificar tipos de dados, sanitizar textos contra scripts maliciosos e bloquear valores inválidos (datas futuras impossíveis, valores negativos onde não permitido).

---

### Objetivo 3: Configurar a IA do Finance Bridge (GPT-5 Nano)

Dentro do Finance Bridge, existe uma IA pequena e rápida que transforma pedidos em texto para o formato JSON que o banco entende.

**Tarefas:**

1. Criar o prompt de sistema para o GPT-5 nano, orientando-o a receber pedidos em texto simples e gerar o JSON de consulta correspondente.
2. Enviar para o GPT-5 nano a lista de todos os filtros disponíveis (período, valor, categorias, status, método de pagamento) para que ele saiba o que pode usar.
3. Configurar o GPT-5 nano com baixa verbosidade e raciocínio médio para respostas rápidas e precisas.
4. Implementar o fluxo: receber texto do agente → GPT-5 nano gera JSON → Finance Bridge executa → resultado volta direto para o agente que pediu (sem passar novamente pelo GPT-5 nano).

---

## 📌 Fase 2: Sistema de Memória

---

### Objetivo 4: Criar o Sistema de Memória Contextual

A memória permite que o sistema lembre das conversas anteriores com o usuário, mantendo o contexto entre mensagens.

**Tarefas:**

1. Criar a estrutura que identifica se um chat é novo (iniciar com memória zerada) ou existente (carregar memória salva).
2. Implementar a "Memória Recente": guardar os últimos 2 ciclos completos (ciclo = mensagem do usuário + resposta da IA) sem nenhuma modificação.
3. Implementar a "Memória Antiga": todos os ciclos anteriores aos 2 mais recentes são resumidos pelo GPT-5 nano.
4. Criar o processo de persistência: a memória deve ser salva automaticamente após cada ciclo completo ser finalizado.

---

### Objetivo 5: Implementar a Gestão de Volume da Memória

Para não gastar tokens demais, a memória precisa ser comprimida quando ficar muito grande.

**Tarefas:**

1. Implementar o contador de palavras que monitora o tamanho total da memória.
2. Criar o gatilho de compressão: quando a memória atingir 90% do limite (2.250 palavras de um máximo de 2.500), iniciar a compressão automática.
3. Durante a compressão: resumir ainda mais os ciclos antigos, mas manter os 2 ciclos recentes intactos, reduzindo a ocupação para aproximadamente 40% (1.000 palavras).
4. Criar a "Regra de Preservação": mesmo durante compressão, nunca apagar metas financeiras, limites configurados, preferências declaradas e decisões importantes do usuário.

---

## 📌 Fase 3: Agente Júnior (Primeiro Contato)

---

### Objetivo 6: Construir o Agente Júnior

O Agente Júnior é a porta de entrada do sistema. Ele recebe toda mensagem do usuário e decide o que fazer com ela.

**Tarefas:**

1. Criar o agente que recebe dois inputs: a memória completa do chat e a mensagem atual do usuário.
2. Implementar a lógica de classificação de complexidade:
   - **Trivial**: consultas diretas ("Quanto gastei ontem?") → resolver sozinho usando o Finance Bridge.
   - **Simples**: lançamentos completos ("Gastei R$50 no almoço") → inserir via Finance Bridge.
   - **Intermediária**: análises básicas ("Como estão meus gastos este mês?") → consultar dados e fazer cálculos.
   - **Complexa**: múltiplas tarefas ou análises profundas → escalar para o Orquestrador.
3. Implementar a detecção de informações faltantes em lançamentos: se o usuário diz "Gastei 200" sem dizer onde, o Júnior deve perguntar "Você gastou em que esse R$ 200,00?" antes de continuar.
4. Garantir que conversas de follow-up (perguntas de esclarecimento) sejam registradas na memória para manter o contexto.

---

### Objetivo 7: Implementar o Fluxo de Lançamentos do Agente Júnior

Quando o usuário quer registrar uma despesa ou receita, o Agente Júnior coordena um processo especial com economia de recursos.

**Tarefas:**

1. Criar a lógica que identifica se o lançamento é uma despesa ou receita.
2. Carregar apenas o arquivo JSON correspondente ao tipo identificado (despesas.json OU receitas.json, nunca ambos) para economizar tokens.
3. Enviar primeiro apenas a lista de categorias para o GPT-5 nano escolher a categoria correta.
4. Após a categoria ser escolhida, enviar apenas as subcategorias daquela categoria específica.
5. Com categoria e subcategoria definidas, o GPT-5 nano monta o JSON completo de lançamento e envia ao Finance Bridge.

---

### Objetivo 8: Conectar o Agente Júnior às APIs de Pesquisa

Para buscas na internet, o Agente Júnior pode usar a API Serper.

**Tarefas:**

1. Integrar a API Serper ao sistema.
2. Criar o prompt de sistema que orienta o Júnior a fazer buscas curtas e objetivas (ex: buscar "taxa selic setembro 2025" ao invés de "qual é a taxa selic atual do brasil este ano").
3. Implementar o fluxo: quando a pergunta do usuário exigir informação externa que não está no banco de dados, usar o Serper para buscar.

---

## 📌 Fase 4: Camada de Orquestração

---

### Objetivo 9: Construir o Agente Orquestrador

O Orquestrador é o cérebro estratégico que entra em ação quando a tarefa é complexa demais para o Júnior resolver sozinho.

**Tarefas:**

1. Criar o agente que recebe: memória completa, query do usuário e os contratos dos agentes coordenadores (definições do que cada agente faz, conforme o arquivo diferenças_coor.md).
2. Implementar a **Etapa 1 - Decomposição**: analisar a solicitação e identificar quais agentes são necessários (Análise, Investimentos e/ou Planejamento).
3. Implementar a **Etapa 2 - Dependências**: verificar se alguma tarefa precisa ser feita antes de outra (ex: análise de gastos antes de sugestão de orçamento).
4. Implementar a **Etapa 3 - Memorização**: extrair da memória apenas as informações relevantes para contextualizar os agentes.
5. Implementar a **Etapa 4 - Priorização**: definir a ordem de execução das tarefas e quais podem rodar em paralelo.

---

### Objetivo 10: Criar a Estrutura do DOC (Documento de Direção)

O DOC é o documento em JSON que o Orquestrador gera para instruir os agentes coordenadores.

**Tarefas:**

1. Definir a estrutura do DOC com os campos: ID único da requisição, query original do usuário e memória filtrada.
2. Incluir no DOC a análise do orquestrador: a intenção identificada e o raciocínio completo (chain of thought).
3. Incluir a distribuição de tarefas: para cada agente, especificar qual é a tarefa, o tipo de output esperado, a prioridade e as dependências.
4. Criar o sistema de controle de dependências que só libera a execução de um agente quando os agentes que ele depende já terminaram.

---

## 📌 Fase 5: Agentes Coordenadores

---

### Objetivo 11: Construir os Três Agentes Coordenadores

Os coordenadores são agentes especialistas que executam tarefas complexas em suas áreas de domínio.

**Tarefas:**

1. **Agente de Análise**: criar o agente especialista em comportamento financeiro passado e presente. Ele diagnostica gastos, identifica padrões (como assinaturas esquecidas), analisa fluxo de caixa e emite alertas de desvio.
2. **Agente de Investimentos**: criar o agente especialista em mercado e patrimônio. Ele analisa a carteira do usuário, consulta a API Brapi para cotações e indicadores, faz recomendações de aporte e cálculos de investimento.
3. **Agente de Planejamento**: criar o agente especialista em futuro financeiro. Ele cria orçamentos por categoria, gerencia metas, elabora planos de ação e simula cenários.
4. Conectar os coordenadores às APIs especializadas:
   - Agente de Análise e Investimentos: acesso à Brapi (dados de mercado) e Tavily (pesquisas profundas).
   - Todos os coordenadores: acesso ao Serper (pesquisas gerais).

---

### Objetivo 12: Implementar o Protocolo de Execução dos Coordenadores

Cada coordenador segue um processo padronizado de trabalho para garantir qualidade.

**Tarefas:**

1. Implementar o pipeline de 6 passos que todo coordenador deve seguir:
   - **Recepção**: receber memória + query + DOC do orquestrador.
   - **Metacognição**: pausa para refletir "O que preciso fazer exatamente?".
   - **Planejamento Interno**: definir a sequência de ferramentas que usará.
   - **Execução**: usar as ferramentas na ordem planejada.
   - **Validação**: verificar se a tarefa foi completada adequadamente.
   - **Entrega Estruturada**: formatar e enviar o resultado.
2. Criar o prompt de metacognição guiada com as 4 perguntas obrigatórias: clareza de missão, inventário de recursos, planejamento de execução e critério de qualidade.
3. Implementar o Módulo Matemático que é ativado automaticamente quando a tarefa envolve cálculos complexos, fórmulas financeiras ou análises de risco.

---

## 📌 Fase 6: Resposta Final e Fluxo Contínuo

---

### Objetivo 13: Construir o Agente de Resposta Final

O Agente de Resposta é quem monta a resposta definitiva que o usuário vai receber.

**Tarefas:**

1. Criar o agente que recebe: memória, query original, DOC do orquestrador e os resultados de todos os coordenadores que trabalharam.
2. Implementar a lógica de síntese: o agente analisa todos os outputs e decide a melhor forma de responder ao usuário.
3. Garantir formatação adequada: números monetários com separadores de milhar e duas casas decimais, linguagem clara e resposta acionável (o usuário sabe o que fazer).
4. Gerar a resposta final e enviar ao usuário.

---

### Objetivo 14: Implementar o Fluxo de Execução Contínua

Este é o ponto mais crítico do sistema. Os agentes precisam conseguir usar ferramentas externas sem "morrer" no meio do processo.

**Tarefas:**

1. Criar o mecanismo de **Estado de Espera (waiting)**: quando um agente aciona uma ferramenta externa (como o Finance Bridge ou uma API), ele entra em estado de espera preservando toda sua memória e contexto atual.
2. Implementar a **Reativação por Evento**: quando a ferramenta externa retorna os dados, o agente é reativado automaticamente e continua de onde parou, sem precisar reconstruir o histórico.
3. Configurar o **Timeout de 80 segundos**: se a ferramenta externa não responder dentro desse tempo, o sistema deve lidar com o erro de forma adequada.
4. Garantir que a resposta da ferramenta seja integrada de forma transparente ao fluxo, permitindo que o agente execute a próxima tarefa imediatamente.
5. Testar o fluxo completo: usuário envia mensagem → Agente Júnior processa → chama Finance Bridge → aguarda (waiting) → recebe dados → continua processamento → gera resposta.

---

## 📋 Resumo Visual da Ordem de Implementação

| Fase | Objetivos | Descrição |
|------|-----------|-----------|
| **1. Fundação** | 1, 2, 3 | Banco de dados, Finance Bridge e sua IA interna |
| **2. Memória** | 4, 5 | Sistema de memória e gestão de volume |
| **3. Júnior** | 6, 7, 8 | Agente Júnior, lançamentos e pesquisas |
| **4. Orquestração** | 9, 10 | Orquestrador e estrutura do DOC |
| **5. Coordenadores** | 11, 12 | Três agentes especialistas e seu protocolo |
| **6. Resposta e Fluxo** | 13, 14 | Agente de Resposta e execução contínua |

---

## ⚠️ Observações Importantes

- **Qualidade antes de velocidade**: é aceitável que o sistema demore mais para responder se isso garantir respostas de qualidade.
- **Latência como necessidade**: a latência não é um erro, é o tempo necessário para o sistema pensar e buscar informações corretas.
- **Objetivo 14 é crítico**: o fluxo de execução contínua é o coração do sistema. Sem ele funcionando corretamente, os agentes não conseguem usar ferramentas externas de forma eficiente.
- **Arquivos de referência**: os contratos dos agentes estão em `server\docs\md\diferenças_coor.md`, os critérios das APIs estão em `server\docs\md\diferenças_API.md`, e as categorias de lançamentos estão em `server\docs\jsons\lançamentos`.
