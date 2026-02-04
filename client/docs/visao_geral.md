# Sistema de Multi-Agente
## Arquitetura Aprimorada v2.0

---


## 🧠 1. Sistema de Memória Contextual

### 1.1 Identificação e Carregamento

Ao receber uma mensagem, o sistema verifica se o chat já possui histórico:
- **Chat Novo:** Inicia com contexto zerado
- **Chat Existente:** Carrega a memória consolidada

### 1.2 Estrutura Simples de Memória

**Memória Recente:**
- Últimos 2 ciclos completos mantidos na íntegra
- Acesso direto sem processamento

**Memória Antiga:**
- Todos os ciclos anteriores são resumidos individualmente
- Resumo feito por GPT-5 nano (Verbosity: Low, Reasoning: Low)
- Preserva: valores numéricos, datas, decisões importantes e contexto essencial

(Esse sistema funciona de forma comitante ous eja sempre se atulaizando a cada ciclo novas novas. é importante que a memoria seja feito a cada ciclo, pois assim o gpt 5 nano tem oq ue eu usuairo enviou e o que a IA respondeu para facilitar resumo e deixar mais inteligente, do que reusmir a cada coisa enviada ou recebida.)

### 1.3 Gestão de Volume

**Controle de Tamanho:**
- Limite máximo: 2.500 palavras
- Quando atingir 90% do limite (2.250 palavras), o sistema:
  - Comprime os resumos antigos
  - Mantém os 2 ciclos recentes intactos
  - Reduz ocupação para aproximadamente 40% (1.000 palavras)

**Regra de Preservação:**
O sistema sempre preserva informações críticas mesmo durante compressão:
- Metas financeiras do usuário
- Limites e alertas configurados
- Preferências declaradas
- Decisões importantes tomadas

---

## 🔀 2. Sistema de Roteamento Inteligente (Smart Router)

### 2.1 Agente Junior (First Responder)

**Entrada:**
- Memória (completa)
- Query atual do usuário


**Critérios de Decisão:**

O Junior analisa a query e decide:
- Se for **consulta simples**: usa FinanceBridge para buscar dados
- Se for **lançamento de dados**: usa FinanceBridge para inserir a transação
- Se for **busca externa**: usa Serper para pesquisar na internet
- Se for **complexo ou multi-tarefa**: escala para o Orquestrador

OBS: Se for **lançamento de dados**: O agente junior deve antes de enivar para o gpt 5 nano ele deve ver se tem algo faltando no, por exemplo se o usuario fala "Eu gasti 200" - essa query é insuficiente, o junior retorna "voce gastou em que esse R$ 200,00 ?" ai o usuario manda "no supermercado"
Ai o agente junior pode enviar para o agente GPT  5 nano.

é importante que em casos como esse aonde é preciso fazer follow on que o sistema de memoria identifique e coloque na memoria a titulo de contextualização.

**Classificação de Complexidade:**

| Tipo | Descrição | Ação |
|------|-----------|------|
| **Trivial** | Consultas diretas ("Quanto gastei ontem?") | Junior → Bridge → Resposta |
| **Simples** | Lançamentos ("Gastei R$50 no almoço") | Junior → Bridge.insert |
| **Intermediária** | Análises básicas ("Como estão meus gastos este mês?") | Junior → Bridge + Cálculo |
| **Complexa** | Múltiplas frentes ("Analise meus investimentos e sugira ajustes no orçamento") | Escalar → Orquestrador |

### 2.2 Regras de Envio de Memória

**Para Junior (Execução Direta):**
- Bridge/Serper: Memória COMPLETA 
- Lançamento: Memória NÃO enviada (apenas parsing do input)

**Para Orquestrador (Escalada):**
- Memória COMPLETA 
- Query atual


---

## 🏛️ 3. Camada de Orquestração (Orchestration Layer)

### 3.1 Agente Orquestrador (Strategic Brain)

**Processo de Análise (Chain of Thought):**

###  Contratos dos Agentes Coordenadores

  - O agente orquestrador recebe os contratos de cada agente, os contratos, são quem sao cada agente e o que eles fazem, os contratos dos agentes são essenciais para o raciocínio do orquestrador, os agentes são:

**Agente de Análise:**

**Agente de Investimentos:**

**Agente de Planejamento:**
O que cada agente faz esta em "server\jsons\md\diferenças_coor.md" deve ser guia para elaboração do contrato

O Orquestrador segue três etapas de raciocínio:

**ETAPA 1 - DECOMPOSIÇÃO:**
Identifica quais áreas estão envolvidas na solicitação do usuário:
- Precisa de análise? → Agente de Análise
- Envolve investimentos? → Agente de Investimentos  
- Requer planejamento de metas ou orçamento? → Agente de Planejamento

**ETAPA 2 - DEPENDÊNCIAS:**
Verifica se há ordem de execução necessária:
- Alguma tarefa precisa ser feita antes de outra?
- Há dados que um agente produz e outro consome?

**ETAPA 3 - MEMORIZAÇÃO:**
Analise a memoria recebida e verifica o que é importante a titulo de contexto:
- O que nessa memoria é necessario para manter o agente contextualizado?
OBS: deve chegar para o agente que é uma memória.

**ETAPA 4 - PRIORIZAÇÃO:**
Define a estratégia de execução:
- Qual a ordem lógica das tarefas?
- Quais podem ser executadas em paralelo?

**Estrutura do DOC (Documento de Direção):**

O DOC é um documento estruturado que contém:

**Identificação:**
- ID único da requisição
- Query original do usuário
- Memória. (do processo de memorização)

**Análise do Orquestrador:**
- Descrição da intenção identificada
- Raciocínio completo do orquestrador (chain of thought)

**Distribuição de Tarefas:**
Para cada agente envolvido, especifica:
- Qual agente receberá cada tarefa
- Descrição clara da tarefa específica
- Tipo de output esperado
- Dependências de outros agentes (se houver)

**Exemplo de distribuição:**
- Agente de Análise (Prioridade 1): Analisar padrão de gastos dos últimos 3 meses, gerando relatório com categorias e tendências.
- Agente de Planejamento (Prioridade 2): Com base na análise anterior, sugerir ajustes no orçamento com plano de ação estruturado

Precisamos criar um sistema que controle a prioridade e dependência entre agentes.
- O agente orquestrador define a ordem das tarefas e estabelece quais agentes devem atuar em sequência.
- Por exemplo:
- O agente analista deve realizar uma análise.
- Somente após essa análise ser concluída, o agente de planejamento recebe o resultado para executar o planejamento.
- O sistema deve permitir que o orquestrador envie para a lógica:
- Qual agente deve executar a tarefa.
- Qual é a dependência existente entre os agentes.
- A execução só avança para o próximo agente quando o anterior finalizar sua tarefa, garantindo que o fluxo respeite a ordem definida pelo orquestrador

---

## 🛠️ 4. Toolkit dos Agentes (Ferramentas Especializadas)

### 4.1 Finance Bridge (Database Interface)

**Arquitetura de Consulta Flexível:**
O banco de dados usado é o mongodb!
O Finance Bridge é um middleware de comunicação estruturada que permite ao Agente de IA realizar operações financeiras complexas através de um protocolo JSON estrito, suportando lógica booleana e contextos temporais inteligentes.

O agente de IA vai receber uma descrição do que é o financial bridgt e será orientado a responder um texto simples como "Busque gastos de alimentação entre R$ 120 e R$ 145 nos últimos 6 dias, mas ignore “Restaurantes”, ordene pelos 10 mais recentes." 

NO financial bridgt tera Uma IA que sera o gpt 5 nano com verbosity low e resongin middle. esse agente tera um instrução clara, ele recebe a query do outro agente + tudo que ele pode usar como filtro e faz um json e envia para o financial brigdt, o financial bridgt retorna os dados conforme o json recebido e envia direto para o agente de IA que primeiro requisitou. (nao tem para que enviar novamente para o gpt 5 nano)

1. Estrutura Base de Requisição (Payload)

Toda comunicação com o Finance Bridge segue este formato padrão para garantir previsibilidade e segurança:

{
  "operation": "query | insert | update | delete | aggregate | compare",
  "params": {
    "filters": {
      "period": {
        "start": "YYYY-MM-DD",
        "end": "YYYY-MM-DD",
        "named_period": "string"
      },
      "amount": {
        "min": number,
        "max": number
      },
      "categories": ["string"],
      "status": "string",
      "payment_method": "string"
    },
    "logic": "AND | OR | NOT",
    "sort": {
      "field": "date | amount | category",
      "order": "asc | desc"
    },
    "limit": number
  },
  "context": {
    "user_timezone": "string",
    "currency": "BRL"
  }
}

2. Inteligência de Filtros e Lógica
Lógica Booleana

O sistema não apenas lista itens, mas processa relações lógicas entre os filtros:

AND
Todos os critérios devem ser satisfeitos
Ex: Valor > 100 E Categoria = "Lazer"

OR
Pelo menos um critério deve ser satisfeito
Ex: Categoria = "Alimentação" OU "Supermercado"

NOT
Exclui resultados específicos
Ex: Categoria = "Educação" MAS NÃO "Mensalidade Escolar"

Períodos Inteligentes (Contexto Relativo)

Além de datas fixas, o sistema resolve macros financeiras em tempo real:

current_month
Do dia 01 até a data atual

last_quarter
Os últimos 3 meses fechados

fiscal_year
O ano fiscal vigente

since_last_payday
Filtra transações desde o último recebimento de salário detectado
(Essencial para análise de fluxo de caixa pessoal)

3. Operações Suportadas
Operação	Descrição
query	Consulta detalhada com filtros booleanos e ordenação
insert	Lançamento de novos dados (Requer: amount, date, category)
update	Modificação de registros existentes via ID ou filtro
delete	Remoção de registros (Exige flag de confirmação)
aggregate	Cálculos matemáticos (Soma, Média, Contagem) por grupo
compare	Análise comparativa entre dois períodos ou categorias
4. Sistema de Validação e Segurança
Campos de Dados

Obrigatórios

amount (Decimal)

date (ISO 8601)

category (String)

Opcionais

description

tags

payment_method

merchant

status

Camadas de Proteção

Validação de Tipo
Garante que valores monetários não sejam enviados como texto

Sanitização
Bloqueio automático contra injeção de scripts ou comandos maliciosos nas strings de descrição

Checagem de Range
Impede datas futuras impossíveis ou valores negativos em campos não permitidos

5. Exemplo Prático de Fluxo
Requisição da IA

Busque gastos de alimentação entre R$ 120 e R$ 145 nos últimos 6 dias, mas ignore “Restaurantes”, ordene pelos mais recentes.

JSON Gerado pelo Agente
{
  "operation": "query",
  "params": {
    "filters": {
      "period": { "named_period": "last_6_days" },
      "amount": { "min": 120.00, "max": 145.00 },
      "categories": ["alimentação"]
    },
    "logic": "NOT",
    "exclude": {
      "tags": ["restaurante"]
    },
    "sort": {
      "field": "date",
      "order": "desc"
    },
    "limit": 50
  }
}

O sistema de lançamentos feito pelo Agente Júnior deve seguir uma lógica diferente.
Exemplo de uso:
- O Agente Júnior envia para o GPT‑5 Nano a instrução: “Lançar compra de R$ 150,00 no supermercado”.
- O GPT‑5 Nano recebe as informações de categorias de receitas e despesas, e das subcategorias, para montar o JSON de lançamento.
- Esse JSON é enviado ao Financial Bridge, que executa o lançamento e retorna diretamente ao Agente Júnior se houve sucesso ou erro.

Funcionamento do Sistema
- Recebimento das categorias
- Quando o GPT‑5 Nano precisa realizar um lançamento, ele recebe as categorias de receitas e despesas

- Seleção da categoria
- O GPT‑5 Nano sinaliza qual categoria é necessária (podendo ser mais de uma).
- Após essa escolha, ele recebe as subcategorias correspondentes.
- Construção do JSON
- Com categorias e subcategorias em mãos, o GPT‑5 Nano possui todas as informações necessárias para montar o JSON de lançamento.
- Otimização de tokens
- Ao receber uma requisição do Agente Júnior, o GPT‑5 Nano identifica se é despesa ou receita.
- Assim, ele recebe apenas o JSON referente ao tipo correto (receitas ou despesas), evitando carregar por exemplo 50 categorias possíveis.
- Dessa forma, o sistema trabalha apenas com uma parte das categorias, economizando tokens e tornando o processo mais eficiente.
- Fluxo final
- O GPT‑5 Nano envia a categoria escolhida.
- O sistema retorna as subcategorias daquela categoria.
- Com isso, o GPT‑5 Nano já tem os dados completos para montar e enviar o lançamento.

- Fluxo final
- O GPT‑5 Nano envia a categoria escolhida.
- O sistema retorna as subcategorias daquela categoria.
- Com isso, o GPT‑5 Nano já tem os dados completos para montar e enviar o lançamento.

Estrutura de Arquivos
- Os JSONs de categorias e subcategorias estão localizados na pasta: server\docs\jsons\lançamentos

São dois arquivos json, um para despesas e um para receitas, esses arquivos tem tanto a categoria quando as subcategorias de cada categoria, mas lembre-se primeiro envia soente as categorias e depois as subcategorias para poupar uso desnecessarios

### 4.2 Sistema de Pesquisa Externa (Search Layer)

**API 1: Serper (Pesquisas Gerais)**
- Uso: Informações gerais, notícias, tutoriais
- Acesso: Junior + Coordenadores

**Prompt Sistema para o Junior:**
O Junior recebe orientação para fazer buscas rápidas e objetivas na web, usando termos específicos e consultas curtas. Exemplo: deve buscar "taxa selic setembro de 2025" ao invés de "qual é a taxa selic atual do brasil este ano".

**Prompt Sistema para os Coordenadores:**
Os Coordenadores recebem orientação estratégica: usar Serper para contexto geral e validação de informações públicas. Para dados específicos de mercado financeiro, devem preferir a Brapi. Para pesquisas que exigem profundidade e contexto, usar Tavily.

**API 2: Brapi (Dados de Mercado)**
- Uso: Cotações, indicadores de empresas, fundamentos
- Acesso: Apenas Coordenadores (Análise, Investimentos)


**API 3: Tavily (Pesquisa Contextual)**
- Uso: Análises aprofundadas, contexto histórico, relatórios
- Acesso: Apenas Coordenadores


### 4.3 Módulo Matemático (Precision Engine)

**Quando usar:**
- Cálculos complexos
- Juros compostos
- Projeções financeiras
- Análises de risco (VaR, Sharpe Ratio, etc.)

**Prompt Sistema:**

O agente em modo matemático recebe instruções para operar com alta precisão:

**Regras Absolutas:**
1. Sempre usar formatação numérica adequada com separadores de milhar
2. Arredondar resultados monetários para 2 casas decimais
3. Validar os inputs antes de realizar cálculos



**Para cálculos complexos:**
Decompor a solução em etapas numeradas, mostrando cada passo do raciocínio matemático.

---

## 🎯 5. Protocolo de Execução dos Coordenadores

### 5.1 Pipeline de Processamento

**Sequência de Trabalho do Coordenador:**

1. **RECEPÇÃO:** Recebe Memória + Query + DOC do Orquestrador

2. **METACOGNIÇÃO (Pausa Analítica):** Momento de reflexão interna - "O que preciso fazer exatamente? Como devo executar?"

3. **PLANEJAMENTO INTERNO:** Define a sequência lógica de ferramentas que usará

4. **EXECUÇÃO:** Usa as ferramentas de forma criteriosa e na ordem planejada

5. **VALIDAÇÃO:** Verifica se a tarefa foi completada adequadamente

6. **ENTREGA ESTRUTURADA:** Formata e envia o resultado para o Agente de Resposta

### 5.2 Metacognição Guiada

**Perguntas Internas Obrigatórias:**

1. **Clareza de Missão:**
   - "Qual é EXATAMENTE minha entrega esperada?"
   - "O que o Orquestrador quer que EU faça ?"

2. **Inventário de Recursos:**
   - "Quais é a ferramenta que devo usar para essa tarefa?"


4. **Critério de Qualidade:**
   - "Como sei que terminei bem?"


---

## 📤 6. Camada de Resposta Final (Response Layer)

### 6.1 Agente de Resposta (Final Synthesizer)

**Inputs:**

O Agente de Resposta recebe um pacote completo de informações:
- Mesma memoria enviada para os coordenadores
- Query Original do Usuário
- DOC do Orquestrador (com o plano completo)
- Outputs de todos os Coordenadores que trabalharam:
  - Resultado do Agente de Análise
  - Resultado do Agente de Investimentos  
  - Resultado do Agente de Planejamento


**Formato de Saída:**

O agente de reposta analise tudo e se pergunta: Qual é a melhor forma de repsonder o usuario?

gera a resposta e envia ao usuario. 
-

PONTO EXTREMAMENTE IMPORTANTE:
"Os agentes precisam ser capazes de interagir com sistemas externos sem encerrar o fluxo de execução.
Por exemplo:
Quando o agente júnior precisa utilizar o Financial Bridge, ele deve executar uma ação que ative o Financial Bridge e já envie a solicitação necessária.
Em seguida, o agente júnior deve aguardar a resposta, mantendo seu estado e contexto.
Após alguns segundos, quando o Financial Bridge retornar os dados, o agente júnior deve retomar o fluxo normalmente, dando continuidade à tarefa.
Atualmente, a  forma como meu sistema funciona é assim: 
O agente júnior envia a requisição ao Financial Bridge e encerra a execução.
Quando o Financial Bridge retorna os dados, ele precisa enviar não apenas a resposta, mas também um histórico completo, para que o agente júnior consiga reconstruir o contexto.
------
O objetivo é que o sistema funcione de forma contínua. Sempre que for necessário utilizar um sistema ou ferramenta externa, o agente deve ser capaz de ativá-la, aguardar o retorno preservando sua memória e, quando a resposta chegar, continuar o fluxo para executar a próxima tarefa, sem perda de contexto."

