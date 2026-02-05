# Fase 1: Fundação (Infraestrutura Base)
## Plano de Implementação Detalhado

Este documento detalha todas as etapas necessárias para construir a base do sistema. A Fase 1 é composta por 3 objetivos que devem ser executados em ordem.

**Resumo da Fase 1:**
- **Objetivo 1:** Preparar o Banco de Dados (MongoDB)
- **Objetivo 2:** Construir o Finance Bridge (Middleware)
- **Objetivo 3:** Configurar a IA do Finance Bridge (GPT-5 Nano)

---

## 📁 Estrutura de Diretórios e Pastas

Antes de iniciar a implementação, é necessário criar a seguinte estrutura de pastas no projeto. Essa organização facilita a manutenção e garante que cada parte do sistema tenha seu lugar definido.

### Estrutura Proposta

```
server/
├── src/
│   ├── config/
│   │   └── database.js              # Configuração de conexão com MongoDB
│   │
│   ├── models/
│   │   └── Transaction.js           # Modelo/Schema das transações financeiras
│   │
│   ├── services/
│   │   ├── finance-bridge/
│   │   │   ├── index.js             # Ponto de entrada do Finance Bridge
│   │   │   ├── operations/
│   │   │   │   ├── query.js         # Operação de consulta
│   │   │   │   ├── insert.js        # Operação de inserção
│   │   │   │   ├── update.js        # Operação de atualização
│   │   │   │   ├── delete.js        # Operação de remoção
│   │   │   │   ├── aggregate.js     # Operação de cálculos (soma, média, etc.)
│   │   │   │   └── compare.js       # Operação de comparação entre períodos
│   │   │   │
│   │   │   ├── filters/
│   │   │   │   ├── boolean-logic.js # Lógica AND, OR, NOT
│   │   │   │   └── smart-periods.js # Tradução de períodos inteligentes
│   │   │   │
│   │   │   ├── validation/
│   │   │   │   ├── type-checker.js  # Validação de tipos de dados
│   │   │   │   ├── sanitizer.js     # Limpeza contra scripts maliciosos
│   │   │   │   └── range-checker.js # Verificação de valores permitidos
│   │   │   │
│   │   │   └── ai/
│   │   │       ├── nano-bridge.js   # Integração com GPT-5 Nano
│   │   │       └── prompts/
│   │   │           └── query-builder.txt  # Prompt para gerar JSON de consulta
│   │   │
│   │   └── shared/
│   │       └── date-utils.js        # Funções auxiliares para datas
│   │
│   └── utils/
│       ├── logger.js                # Sistema de logs
│       └── error-handler.js         # Tratamento centralizado de erros
│
├── docs/
│   ├── jsons/
│   │   └── lançamentos/             # (já existe) Categorias de despesas/receitas
│   └── md/
│       └── (documentação existente)
│
└── tests/
    └── finance-bridge/
        ├── operations.test.js       # Testes das operações
        ├── filters.test.js          # Testes dos filtros
        └── validation.test.js       # Testes de validação
```

### Explicação das Pastas

| Pasta | Propósito |
|-------|-----------|
| `config/` | Arquivos de configuração do sistema (conexão com banco, variáveis de ambiente) |
| `models/` | Definição da estrutura dos dados no MongoDB |
| `services/finance-bridge/` | Todo o código do Finance Bridge, organizado por responsabilidade |
| `services/finance-bridge/operations/` | Cada operação do banco em seu próprio arquivo |
| `services/finance-bridge/filters/` | Lógica de filtros e períodos inteligentes |
| `services/finance-bridge/validation/` | Camada de segurança e validação de dados |
| `services/finance-bridge/ai/` | Integração com o GPT-5 Nano |
| `services/shared/` | Funções utilitárias compartilhadas entre serviços |
| `utils/` | Funções auxiliares gerais (logs, tratamento de erros) |
| `tests/` | Testes automatizados para garantir funcionamento |

---

## 🎯 Objetivo 1: Preparar o Banco de Dados

### 1.1 Criar a Conexão com o MongoDB

**O que fazer:**
Criar um arquivo de configuração que estabelece a conexão com o banco de dados MongoDB. Esse arquivo será importado por outros serviços que precisam acessar o banco.

**Arquivo:** `server/src/config/database.js`

**Requisitos:**
- Usar a biblioteca oficial do MongoDB para Node.js (mongoose ou mongodb driver)
- A string de conexão deve vir de variáveis de ambiente (não ficar fixa no código)
- Implementar reconexão automática em caso de queda
- Registrar logs quando conectar, desconectar ou ocorrer erro

**Comportamento esperado:**
- Ao iniciar o servidor, a conexão com o MongoDB é estabelecida automaticamente
- Se a conexão cair, o sistema tenta reconectar sem derrubar o servidor
- Erros de conexão são registrados para diagnóstico

---

### 1.2 Definir a Estrutura dos Documentos de Transações

**O que fazer:**
Criar o modelo (schema) que define como as transações financeiras são armazenadas no banco. Esse modelo garante que todos os dados sigam o mesmo formato.

**Arquivo:** `server/src/models/Transaction.js`

**Campos Obrigatórios:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `amount` | Decimal/Number | Valor da transação (sempre positivo, tipo definido pelo campo type) |
| `date` | Date | Data da transação no formato ISO 8601 |
| `category` | String | Categoria principal (ex: "Alimentação", "Salário") |
| `type` | String | "expense" (despesa) ou "income" (receita) |

**Campos Opcionais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `description` | String | Descrição livre da transação |
| `subcategory` | String | Subcategoria (ex: "Supermercado", "13º Salário") |
| `tags` | Array de Strings | Etiquetas para filtros personalizados |
| `payment_method` | String | Forma de pagamento (PIX, Cartão, Dinheiro, etc.) |
| `merchant` | String | Nome do estabelecimento |
| `status` | String | Status da transação (pendente, confirmada, cancelada) |
| `created_at` | Date | Data de criação do registro (automático) |
| `updated_at` | Date | Data da última atualização (automático) |
| `user_id` | String | Identificador do usuário dono da transação |

**Validações no modelo:**
- `amount` não pode ser negativo
- `date` não pode ser uma data futura além de 1 dia (margem para fusos horários)
- `category` deve existir nos arquivos de categorias (`despesas.json` ou `receitas.json`)
- `type` só aceita "expense" ou "income"

---

### 1.3 Criar Índices para Buscas Rápidas

**O que fazer:**
Configurar índices no MongoDB para acelerar as consultas mais frequentes. Sem índices, o banco precisa percorrer todos os documentos para encontrar os resultados.

**Índices a criar:**

| Campos | Tipo | Justificativa |
|--------|------|---------------|
| `user_id` + `date` | Composto | A maioria das buscas filtra por usuário e período |
| `user_id` + `category` | Composto | Consultas por categoria são muito comuns |
| `user_id` + `type` | Composto | Separar despesas de receitas rapidamente |
| `amount` | Simples | Buscas por faixa de valor |
| `tags` | Multikey | Permitir busca por qualquer tag |

**Onde configurar:** No arquivo do modelo (`Transaction.js`) ou em um script de migração separado.

---

### 1.4 Implementar Operações Básicas (CRUD)

**O que fazer:**
Criar funções simples para as 4 operações básicas de banco de dados. Essas funções serão usadas internamente pelo Finance Bridge.

**Operações:**

1. **Inserir (Create)**
   - Recebe os dados de uma transação
   - Valida os campos obrigatórios
   - Salva no banco e retorna o documento criado com seu ID

2. **Consultar (Read)**
   - Recebe filtros (período, categoria, valor, etc.)
   - Retorna lista de transações que correspondem aos filtros
   - Suporta ordenação e limite de resultados

3. **Atualizar (Update)**
   - Recebe o ID da transação e os campos a modificar
   - Atualiza apenas os campos informados (não sobrescreve todo o documento)
   - Retorna o documento atualizado

4. **Deletar (Delete)**
   - Recebe o ID da transação
   - Exige uma flag de confirmação para evitar deleções acidentais
   - Retorna confirmação de sucesso ou erro

**Onde implementar:** Pode ficar no próprio modelo ou em um arquivo separado de repository/DAO.

---

## 🎯 Objetivo 2: Construir o Finance Bridge

### 2.1 Criar o Serviço Principal

**O que fazer:**
Criar o ponto de entrada do Finance Bridge. Esse serviço recebe requisições em formato JSON e direciona para a operação correta.

**Arquivo:** `server/src/services/finance-bridge/index.js`

**Formato de Entrada (Payload):**

```json
{
  "operation": "query | insert | update | delete | aggregate | compare",
  "params": {
    "filters": { ... },
    "logic": "AND | OR",
    "sort": { ... },
    "limit": number
  },
  "context": {
    "user_id": "string",
    "user_timezone": "string",
    "currency": "BRL"
  }
}
```

**Fluxo de processamento:**
1. Receber o payload JSON
2. Validar a estrutura do payload (campos obrigatórios presentes)
3. Identificar qual operação foi solicitada
4. Direcionar para o arquivo da operação correspondente
5. Retornar o resultado ou erro

**Formato de Saída (Sucesso):**
```json
{
  "success": true,
  "data": [ ... ],
  "metadata": {
    "count": number,
    "execution_time_ms": number
  }
}
```

**Formato de Saída (Erro):**
```json
{
  "success": false,
  "error": {
    "code": "string",
    "message": "string"
  }
}
```

---

### 2.2 Implementar a Lógica de Filtros Booleanos

**O que fazer:**
Criar o sistema que combina múltiplos critérios de busca usando lógica booleana (AND, OR, NOT).

**Arquivo:** `server/src/services/finance-bridge/filters/boolean-logic.js`

**Comportamento por tipo:**

| Lógica | Comportamento | Exemplo |
|--------|---------------|---------|
| `AND` | Todos os critérios devem ser verdadeiros | Valor > 100 **E** Categoria = "Lazer" |
| `OR` | Pelo menos um critério deve ser verdadeiro | Categoria = "Alimentação" **OU** "Supermercado" |
| `NOT` (via exclude) | Exclui resultados específicos | Categoria = "Educação" **MAS NÃO** tag "Mensalidade" |

**Entrada:**
```json
{
  "filters": {
    "categories": ["alimentação"],
    "amount": { "min": 100, "max": 500 },
    "exclude_tags": ["restaurante"]
  },
  "logic": "AND"
}
```

**Saída:** Query MongoDB formatada corretamente.

---

### 2.3 Implementar os Períodos Inteligentes

**O que fazer:**
Criar funções que traduzem termos em linguagem natural para datas reais, considerando o fuso horário do usuário.

**Arquivo:** `server/src/services/finance-bridge/filters/smart-periods.js`

**Períodos suportados:**

| Termo | Significado | Cálculo |
|-------|-------------|---------|
| `current_month` | Mês atual | Do dia 01 até hoje |
| `last_month` | Mês anterior | Do dia 01 ao último dia do mês passado |
| `last_quarter` | Último trimestre | Os 3 meses anteriores ao atual |
| `fiscal_year` | Ano fiscal | De janeiro até dezembro do ano corrente |
| `since_last_payday` | Desde o último salário | Da última transação com categoria "Salário" até hoje |
| `last_x_days` | Últimos X dias | Hoje menos X dias (ex: last_7_days, last_30_days) |
| `today` | Apenas hoje | Das 00:00 às 23:59 de hoje |
| `yesterday` | Apenas ontem | Das 00:00 às 23:59 de ontem |
| `this_week` | Semana atual | De domingo (ou segunda) até hoje |

**Entrada:**
```json
{ "named_period": "last_7_days" }
```

**Saída:**
```json
{ "start": "2026-01-28", "end": "2026-02-04" }
```

**Considerações importantes:**
- Sempre usar o fuso horário do usuário (recebido no context)
- O `since_last_payday` precisa buscar no banco a última transação de salário

---

### 2.4 Criar as Seis Operações

**Onde:** `server/src/services/finance-bridge/operations/`

#### 2.4.1 Query (Consulta)
**Arquivo:** `query.js`

**O que faz:** Busca transações com base nos filtros informados.

**Entrada:**
- Filtros (período, valor, categoria, tags, status, método de pagamento)
- Lógica booleana (AND/OR)
- Ordenação (campo e direção)
- Limite de resultados

**Saída:** Lista de transações encontradas.

---

#### 2.4.2 Insert (Inserção)
**Arquivo:** `insert.js`

**O que faz:** Cria uma nova transação no banco.

**Campos obrigatórios:**
- amount
- date
- category
- type (expense ou income)

**Validações antes de inserir:**
- Todos os campos obrigatórios estão presentes?
- O valor é um número positivo?
- A data é válida?
- A categoria existe nos JSONs de categorias?

**Saída:** Documento criado com seu ID.

---

#### 2.4.3 Update (Atualização)
**Arquivo:** `update.js`

**O que faz:** Modifica uma transação existente.

**Entrada:**
- ID da transação OU filtros para encontrá-la
- Campos a serem atualizados

**Validações:**
- A transação existe?
- Os novos valores são válidos?

**Saída:** Documento atualizado.

---

#### 2.4.4 Delete (Remoção)
**Arquivo:** `delete.js`

**O que faz:** Remove uma transação do banco.

**Entrada:**
- ID da transação
- Flag de confirmação (`confirm: true`)

**Proteção:** Sem a flag de confirmação, a operação é rejeitada.

**Saída:** Confirmação de exclusão.

---

#### 2.4.5 Aggregate (Cálculos)
**Arquivo:** `aggregate.js`

**O que faz:** Realiza cálculos matemáticos sobre grupos de transações.

**Operações suportadas:**
- `sum` - Soma total de valores
- `avg` - Média dos valores
- `count` - Contagem de transações
- `min` - Menor valor
- `max` - Maior valor

**Agrupamentos suportados:**
- Por categoria
- Por mês
- Por tipo (despesa/receita)
- Por método de pagamento

**Exemplo de uso:** "Qual o total gasto por categoria no último mês?"

**Saída:**
```json
{
  "Alimentação": 1250.00,
  "Transporte": 450.00,
  "Lazer": 320.00
}
```

---

#### 2.4.6 Compare (Comparação)
**Arquivo:** `compare.js`

**O que faz:** Compara dados entre dois períodos ou duas categorias.

**Tipos de comparação:**
- Período A vs Período B (ex: janeiro vs fevereiro)
- Categoria A vs Categoria B (ex: Alimentação vs Transporte)

**Saída:**
```json
{
  "period_a": { "total": 2500.00, "count": 45 },
  "period_b": { "total": 2800.00, "count": 52 },
  "difference": {
    "absolute": 300.00,
    "percentage": 12.0
  }
}
```

---

### 2.5 Adicionar Camada de Validação e Segurança

**Onde:** `server/src/services/finance-bridge/validation/`

#### 2.5.1 Validação de Tipos
**Arquivo:** `type-checker.js`

**O que faz:** Garante que cada campo receba o tipo de dado correto.

**Verificações:**
- `amount` deve ser número (não string "100")
- `date` deve ser string no formato ISO 8601
- `categories` deve ser array de strings
- `limit` deve ser número inteiro positivo

**Comportamento:** Se encontrar tipo errado, retorna erro descritivo informando qual campo está incorreto.

---

#### 2.5.2 Sanitização
**Arquivo:** `sanitizer.js`

**O que faz:** Limpa strings de entrada para prevenir ataques.

**Proteções:**
- Remover tags HTML/JavaScript
- Escapar caracteres especiais que podem ser usados em injection
- Limitar tamanho máximo de strings (ex: description máximo 500 caracteres)

---

#### 2.5.3 Checagem de Range
**Arquivo:** `range-checker.js`

**O que faz:** Valida se os valores estão dentro de limites aceitáveis.

**Verificações:**
- `amount` não pode ser negativo
- `amount` não pode ser absurdamente alto (ex: > 1 bilhão)
- `date` não pode ser mais de 10 anos no passado
- `date` não pode ser mais de 1 dia no futuro
- `limit` não pode ser maior que 1000 (proteção contra queries muito pesadas)

---

## 🎯 Objetivo 3: Configurar a IA do Finance Bridge (GPT-5 Nano)

### 3.1 Criar a Integração com GPT-5 Nano

**O que fazer:**
Criar o serviço que se comunica com o GPT-5 Nano para transformar pedidos em texto para JSON estruturado.

**Arquivo:** `server/src/services/finance-bridge/ai/nano-bridge.js`

**Fluxo de funcionamento:**
1. Receber texto em linguagem natural (ex: "gastos de alimentação nos últimos 7 dias")
2. Enviar para o GPT-5 Nano junto com o prompt de sistema e a lista de filtros disponíveis
3. Receber o JSON gerado pelo modelo
4. Validar se o JSON está no formato correto
5. Retornar o JSON validado ou erro

**Configurações do modelo:**
- Verbosity: Low (respostas curtas e diretas)
- Reasoning: Medium (raciocínio suficiente para entender o contexto)

---

### 3.2 Criar o Prompt de Sistema

**O que fazer:**
Escrever as instruções que o GPT-5 Nano recebe para saber como gerar os JSONs.

**Arquivo:** `server/src/services/finance-bridge/ai/prompts/query-builder.txt`

**Conteúdo do prompt:**

O prompt deve incluir:

1. **Identidade:** "Você é um assistente especializado em transformar pedidos em linguagem natural para consultas estruturadas em JSON."

2. **Objetivo:** "Seu único trabalho é gerar um JSON válido que o Finance Bridge possa executar."

3. **Formato de saída:** Especificar exatamente a estrutura JSON esperada, com todos os campos possíveis.

4. **Lista de filtros disponíveis:**
   - Períodos: current_month, last_month, last_quarter, fiscal_year, since_last_payday, last_x_days, today, yesterday, this_week
   - Valores: min, max
   - Categorias: lista das categorias válidas
   - Outros: status, payment_method, tags, exclude_tags

5. **Lista de operações:**
   - query, insert, update, delete, aggregate, compare

6. **Regras:**
   - Sempre retornar apenas JSON, sem texto adicional
   - Se faltar informação, usar valores padrão sensatos (ex: limit = 50)
   - Se o pedido for ambíguo, escolher a interpretação mais comum

7. **Exemplos:** Incluir 3-5 exemplos de entrada e saída esperada.

---

### 3.3 Implementar o Fluxo Completo

**O que fazer:**
Garantir que o fluxo funcione de ponta a ponta sem quebras.

**Fluxo:**
```
Agente de IA envia texto
        ↓
  nano-bridge.js recebe
        ↓
 Monta payload para GPT-5 Nano
 (prompt sistema + filtros disponíveis + texto do agente)
        ↓
 Envia para API do GPT-5 Nano
        ↓
 Recebe JSON gerado
        ↓
 Valida estrutura do JSON
        ↓
 Envia para Finance Bridge (index.js)
        ↓
 Finance Bridge executa operação
        ↓
 Resultado volta direto para o Agente original
 (NÃO passa novamente pelo GPT-5 Nano)
```

**Importante:** O resultado do banco de dados vai direto para quem pediu, sem processamento adicional pelo modelo. Isso economiza tokens e reduz latência.

---

### 3.4 Tratamento de Erros na IA

**O que fazer:**
Definir como o sistema se comporta quando o GPT-5 Nano retorna algo inesperado.

**Cenários de erro:**

| Situação | Comportamento |
|----------|---------------|
| JSON inválido (sintaxe errada) | Tentar novamente 1 vez, depois retornar erro |
| Operação inexistente | Retornar erro informando operações válidas |
| Filtro inexistente | Ignorar o filtro inválido e continuar |
| Timeout (mais de 10 segundos) | Retornar erro de timeout |
| Resposta vazia | Retornar erro pedindo mais contexto |

---

## ✅ Checklist de Conclusão da Fase 1

Antes de avançar para a Fase 2, todos os itens abaixo devem estar funcionando:

### Objetivo 1 - Banco de Dados
- [ ] Conexão com MongoDB estabelecida e estável
- [ ] Modelo de Transaction criado com todos os campos
- [ ] Índices criados e funcionando
- [ ] Operações CRUD básicas testadas

### Objetivo 2 - Finance Bridge
- [ ] Serviço principal recebe e direciona requisições
- [ ] Lógica AND/OR funcionando
- [ ] Todos os períodos inteligentes traduzindo corretamente
- [ ] Operação query funcionando com filtros
- [ ] Operação insert funcionando com validação
- [ ] Operação update funcionando
- [ ] Operação delete funcionando com confirmação
- [ ] Operação aggregate calculando corretamente
- [ ] Operação compare retornando diferenças
- [ ] Validação de tipos bloqueando dados inválidos
- [ ] Sanitização removendo conteúdo malicioso
- [ ] Checagem de range rejeitando valores absurdos

### Objetivo 3 - IA do Finance Bridge
- [ ] Integração com GPT-5 Nano funcionando
- [ ] Prompt de sistema gerando JSONs corretos
- [ ] Fluxo completo testado (texto → JSON → banco → resposta)
- [ ] Tratamento de erros implementado

---

## 📋 Ordem de Execução Recomendada

Para quem for implementar, seguir esta ordem minimiza retrabalho:

1. **Criar estrutura de pastas** (conforme seção inicial)
2. **Configurar conexão MongoDB** (1.1)
3. **Criar modelo Transaction** (1.2)
4. **Criar índices** (1.3)
5. **Implementar CRUD básico** (1.4)
6. **Criar ponto de entrada do Finance Bridge** (2.1)
7. **Implementar filtros booleanos** (2.2)
8. **Implementar períodos inteligentes** (2.3)
9. **Criar operação query** (2.4.1)
10. **Criar operação insert** (2.4.2)
11. **Criar operação update** (2.4.3)
12. **Criar operação delete** (2.4.4)
13. **Criar operação aggregate** (2.4.5)
14. **Criar operação compare** (2.4.6)
15. **Adicionar validação de tipos** (2.5.1)
16. **Adicionar sanitização** (2.5.2)
17. **Adicionar checagem de range** (2.5.3)
18. **Criar integração com GPT-5 Nano** (3.1)
19. **Escrever prompt de sistema** (3.2)
20. **Testar fluxo completo** (3.3)
21. **Implementar tratamento de erros** (3.4)

---

## ⚠️ Observações Importantes

- **Variáveis de ambiente:** Nunca colocar credenciais (string de conexão, API keys) diretamente no código. Usar arquivo `.env`.
- **Logs:** Registrar todas as operações importantes para facilitar debug.
- **Testes:** Criar testes para cada operação antes de avançar.
- **Qualidade > Velocidade:** É preferível demorar mais e ter código robusto do que avançar rápido e ter que refazer depois.
