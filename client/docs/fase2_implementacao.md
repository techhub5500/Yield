# Plano de Implementação Detalhado - Fase 2
## Sistema de Memória Contextual

---

## 📋 Informações Gerais

- **Fase:** 2 - Sistema de Memória
- **Objetivos:** 4 e 5
- **Pré-requisito:** Fase 1 concluída ✅
- **Dependências:** MongoDB configurado, GPT-5 Nano integrado

---

## 🎯 Visão Geral da Fase 2

A Fase 2 implementa o **Sistema de Memória Contextual**, que permite ao sistema lembrar das conversas anteriores com o usuário. Este sistema é fundamental para:

- Manter contexto entre mensagens
- Permitir follow-ups naturais
- Preservar informações importantes do usuário
- Economizar tokens através de compressão inteligente

---

## 📁 Estrutura de Arquivos a Criar

```
server/
├── src/
│   ├── config/
│   │   └── memory-config.js          # Configurações do sistema de memória
│   ├── models/
│   │   ├── Memory.js                 # Schema do MongoDB para memória
│   │   └── MemoryRepository.js       # Operações CRUD de memória
│   └── services/
│       └── memory/
│           ├── index.js              # Serviço principal de memória
│           ├── memory-manager.js     # Gerenciador de ciclos e estados
│           ├── compression/
│           │   ├── compressor.js     # Lógica de compressão
│           │   ├── summarizer.js     # Integração com GPT-5 Nano para resumos
│           │   └── preservation.js   # Regras de preservação de dados críticos
│           ├── storage/
│           │   ├── persistence.js    # Persistência automática
│           │   └── loader.js         # Carregamento de memória existente
│           └── utils/
│               ├── word-counter.js   # Contador de palavras
│               └── cycle-manager.js  # Gerenciador de ciclos (user + AI)
└── tests/
    └── memory/
        ├── memory-manager.test.js
        ├── compressor.test.js
        └── persistence.test.js
```

---

## 📌 Objetivo 4: Criar o Sistema de Memória Contextual

### 4.1 Modelo de Dados da Memória

**Arquivo:** `server/src/models/Memory.js`

#### Schema do MongoDB

```javascript
{
  // Identificação
  chat_id: String,           // ID único do chat
  user_id: String,           // ID do usuário
  
  // Memória Recente (últimos 2 ciclos completos - sem modificação)
  recent_memory: [
    {
      cycle_id: Number,      // Identificador sequencial do ciclo
      timestamp: Date,       // Quando o ciclo ocorreu
      user_message: String,  // Mensagem original do usuário
      ai_response: String,   // Resposta completa da IA
      word_count: Number     // Contagem de palavras deste ciclo
    }
  ],
  
  // Memória Antiga (ciclos anteriores resumidos)
  old_memory: [
    {
      cycle_id: Number,           // ID original do ciclo
      timestamp: Date,            // Quando ocorreu originalmente
      summary: String,            // Resumo gerado pelo GPT-5 Nano
      preserved_data: {           // Dados críticos preservados
        numerical_values: [],     // Valores numéricos mencionados
        dates: [],                // Datas importantes
        decisions: [],            // Decisões tomadas
        essential_context: String // Contexto essencial
      },
      original_word_count: Number, // Palavras antes do resumo
      summary_word_count: Number   // Palavras após resumo
    }
  ],
  
  // Metadados
  metadata: {
    total_cycles: Number,         // Total de ciclos desde o início
    total_word_count: Number,     // Contagem atual de palavras
    last_compression: Date,       // Última compressão realizada
    compression_count: Number,    // Quantas vezes foi comprimido
    created_at: Date,
    updated_at: Date
  },
  
  // Dados Críticos (nunca são apagados)
  critical_data: {
    financial_goals: [],          // Metas financeiras do usuário
    configured_limits: [],        // Limites e alertas configurados
    declared_preferences: [],     // Preferências declaradas
    important_decisions: []       // Decisões importantes tomadas
  }
}
```

#### Índices Necessários

| Campo | Tipo | Justificativa |
|-------|------|---------------|
| `chat_id` | Único | Busca rápida por chat específico |
| `user_id` | Simples | Buscar todos os chats de um usuário |
| `user_id + updated_at` | Composto | Ordenar chats por atividade recente |

---

### 4.2 Identificação e Carregamento de Chat

**Arquivo:** `server/src/services/memory/storage/loader.js`

#### Fluxo de Decisão

```
┌─────────────────────────────────────────────────────────────┐
│                  MENSAGEM RECEBIDA                          │
│                    (chat_id, user_id)                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │   chat_id existe no     │
              │       MongoDB?          │
              └─────────────────────────┘
                     │           │
                   SIM          NÃO
                     │           │
                     ▼           ▼
         ┌──────────────┐  ┌──────────────────┐
         │   CARREGAR   │  │  CRIAR MEMÓRIA   │
         │   MEMÓRIA    │  │     ZERADA       │
         │   EXISTENTE  │  │   (novo chat)    │
         └──────────────┘  └──────────────────┘
                     │           │
                     └─────┬─────┘
                           ▼
              ┌─────────────────────────┐
              │   Retornar objeto de    │
              │   memória para uso      │
              └─────────────────────────┘
```

#### Funções a Implementar

| Função | Descrição | Input | Output |
|--------|-----------|-------|--------|
| `loadMemory(chat_id, user_id)` | Carrega ou cria memória | IDs | Objeto Memory |
| `isNewChat(chat_id)` | Verifica se chat existe | chat_id | Boolean |
| `createEmptyMemory(chat_id, user_id)` | Cria memória zerada | IDs | Objeto Memory |
| `formatMemoryForAgent(memory)` | Formata memória para envio | Memory | String/Object |

---

### 4.3 Estrutura da Memória Recente

**Arquivo:** `server/src/services/memory/utils/cycle-manager.js`

#### Conceito de Ciclo

Um **ciclo completo** consiste em:
1. Mensagem do usuário
2. Resposta completa da IA

#### Regras de Gerenciamento

| Regra | Descrição |
|-------|-----------|
| **Limite** | Máximo de 2 ciclos na memória recente |
| **Integridade** | Ciclos recentes são mantidos na íntegra, sem modificação |
| **FIFO** | Quando um 3º ciclo é adicionado, o mais antigo vai para memória antiga |
| **Timestamp** | Cada ciclo recebe timestamp no momento da criação |

#### Funções a Implementar

| Função | Descrição |
|--------|-----------|
| `createCycle(userMessage, aiResponse)` | Cria novo objeto de ciclo |
| `addCycleToRecent(memory, cycle)` | Adiciona ciclo à memória recente |
| `promoteOldestCycle(memory)` | Move ciclo mais antigo para memória antiga |
| `getCycleCount(memory)` | Retorna quantidade de ciclos recentes |

---

### 4.4 Estrutura da Memória Antiga

**Arquivo:** `server/src/services/memory/compression/summarizer.js`

#### Processo de Resumo

Quando um ciclo sai da memória recente, ele é processado pelo GPT-5 Nano:

```
┌─────────────────────────────────────────────────────────────┐
│              CICLO COMPLETO ORIGINAL                        │
│  User: "Quero economizar R$ 5.000 até dezembro para        │
│         comprar uma TV nova"                                │
│  AI: "Entendido! Vou criar uma meta de R$ 5.000..."        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │     GPT-5 Nano          │
              │  Verbosity: Low         │
              │  Reasoning: Low         │
              └─────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    RESUMO GERADO                            │
│  "Usuário definiu meta: R$ 5.000 até dezembro/2026 para    │
│   compra de TV."                                            │
│                                                             │
│  Dados Preservados:                                         │
│  - numerical_values: [5000]                                 │
│  - dates: ["2026-12"]                                       │
│  - decisions: ["criar meta de economia"]                    │
└─────────────────────────────────────────────────────────────┘
```

#### Prompt para GPT-5 Nano (Resumo)

```
Você é um assistente de resumo para um sistema financeiro.

TAREFA: Resumir a conversa abaixo de forma concisa, preservando:
- Todos os valores numéricos (R$ X, porcentagens, quantidades)
- Todas as datas mencionadas
- Decisões importantes tomadas
- Contexto essencial para continuidade

REGRAS:
- Seja extremamente conciso (máximo 50 palavras)
- Use linguagem direta e objetiva
- Não adicione interpretações
- Preserve números exatamente como mencionados

CONVERSA:
[Mensagem do Usuário]: {user_message}
[Resposta da IA]: {ai_response}

FORMATO DE SAÍDA:
{
  "summary": "resumo aqui",
  "preserved_data": {
    "numerical_values": [],
    "dates": [],
    "decisions": [],
    "essential_context": ""
  }
}
```

---

### 4.5 Persistência Automática

**Arquivo:** `server/src/services/memory/storage/persistence.js`

#### Momento de Persistência

A memória é salva **automaticamente** quando:
1. Um ciclo completo é finalizado (usuário enviou + IA respondeu)
2. Uma compressão é realizada
3. Dados críticos são adicionados

#### Fluxo de Persistência

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Usuário    │───►│     IA       │───►│   Ciclo      │
│   envia msg  │    │   responde   │    │   completo   │
└──────────────┘    └──────────────┘    └──────────────┘
                                              │
                                              ▼
                                   ┌──────────────────┐
                                   │   Atualizar      │
                                   │   memória local  │
                                   └──────────────────┘
                                              │
                                              ▼
                                   ┌──────────────────┐
                                   │   Persistir no   │
                                   │   MongoDB        │
                                   └──────────────────┘
                                              │
                                              ▼
                                   ┌──────────────────┐
                                   │   Confirmar      │
                                   │   salvamento     │
                                   └──────────────────┘
```

#### Funções a Implementar

| Função | Descrição |
|--------|-----------|
| `saveMemory(memory)` | Salva memória no MongoDB |
| `updateMemory(chat_id, updates)` | Atualização parcial |
| `onCycleComplete(memory, cycle)` | Hook executado ao completar ciclo |
| `scheduleAutoSave(memory, interval)` | Salvamento periódico (fallback) |

---

## 📌 Objetivo 5: Implementar a Gestão de Volume da Memória

### 5.1 Contador de Palavras

**Arquivo:** `server/src/services/memory/utils/word-counter.js`

#### Configurações

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `MAX_WORDS` | 2.500 | Limite máximo de palavras |
| `COMPRESSION_THRESHOLD` | 90% (2.250) | Gatilho de compressão |
| `TARGET_AFTER_COMPRESSION` | 40% (1.000) | Meta após compressão |

#### Funções a Implementar

| Função | Descrição |
|--------|-----------|
| `countWords(text)` | Conta palavras em um texto |
| `getTotalWordCount(memory)` | Soma palavras de toda a memória |
| `getUsagePercentage(memory)` | Retorna % de uso do limite |
| `needsCompression(memory)` | Verifica se precisa comprimir |
| `calculateRecentWordsCount(memory)` | Palavras nos 2 ciclos recentes |
| `calculateOldWordsCount(memory)` | Palavras na memória antiga |

---

### 5.2 Sistema de Compressão

**Arquivo:** `server/src/services/memory/compression/compressor.js`

#### Gatilho de Compressão

```
┌─────────────────────────────────────────────────────────────┐
│                   MONITORAMENTO CONTÍNUO                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │   Contagem atual de     │
              │   palavras >= 2.250?    │
              │   (90% de 2.500)        │
              └─────────────────────────┘
                     │           │
                   SIM          NÃO
                     │           │
                     ▼           ▼
         ┌──────────────┐  ┌──────────────────┐
         │   INICIAR    │  │   Continuar      │
         │  COMPRESSÃO  │  │   monitorando    │
         └──────────────┘  └──────────────────┘
                │
                ▼
    ┌───────────────────────┐
    │ 1. Manter 2 ciclos    │
    │    recentes intactos  │
    │                       │
    │ 2. Comprimir memória  │
    │    antiga             │
    │                       │
    │ 3. Aplicar regras de  │
    │    preservação        │
    │                       │
    │ 4. Reduzir para ~40%  │
    │    (1.000 palavras)   │
    └───────────────────────┘
```

#### Algoritmo de Compressão

```
INÍCIO DO PROCESSO DE COMPRESSÃO

1. CALCULAR situação atual
   - total_palavras = contar_todas_palavras(memória)
   - palavras_recentes = contar_palavras(ciclos_recentes)
   - palavras_antigas = total_palavras - palavras_recentes
   
2. CALCULAR meta de compressão
   - meta_total = 1.000 palavras (40%)
   - palavras_disponiveis_para_antigos = meta_total - palavras_recentes
   
3. SE palavras_disponiveis_para_antigos <= 0
   - ERRO: Ciclos recentes excedem limite (situação rara)
   - Notificar sistema para análise
   
4. PARA CADA resumo na memória_antiga (do mais antigo ao mais novo)
   - SE soma_atual + tamanho_resumo > palavras_disponiveis_para_antigos
     - resumo_comprimido = GPT5_nano.comprimir_mais(resumo)
     - EXTRAIR dados_criticos e MOVER para critical_data
   - soma_atual += tamanho_resumo_final
   
5. VERIFICAR dados críticos
   - GARANTIR que critical_data está preservado
   - NUNCA comprimir ou remover critical_data

6. ATUALIZAR metadados
   - metadata.last_compression = agora()
   - metadata.compression_count += 1
   - metadata.total_word_count = nova_contagem

7. PERSISTIR memória comprimida

FIM
```

---

### 5.3 Regras de Preservação

**Arquivo:** `server/src/services/memory/compression/preservation.js`

#### Dados Críticos (NUNCA são apagados)

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| **Metas Financeiras** | Objetivos declarados pelo usuário | "Quero juntar R$ 10.000 para uma viagem" |
| **Limites Configurados** | Alertas e tetos definidos | "Me avise se gastar mais de R$ 500 em restaurantes" |
| **Preferências** | Escolhas pessoais declaradas | "Prefiro investir em renda fixa" |
| **Decisões Importantes** | Escolhas significativas feitas | "Decidi cancelar a assinatura do streaming" |

#### Detecção de Dados Críticos

O sistema deve identificar automaticamente padrões que indicam dados críticos:

```javascript
// Padrões de detecção (regex/keywords)
const PATTERNS = {
  financial_goals: [
    /quero (juntar|economizar|poupar|guardar)/i,
    /minha meta é/i,
    /objetivo de/i,
    /até (janeiro|fevereiro|...|dezembro)/i
  ],
  configured_limits: [
    /me avise (quando|se)/i,
    /limite de/i,
    /não (gastar|passar de)/i,
    /alerta quando/i
  ],
  declared_preferences: [
    /prefiro/i,
    /não gosto de/i,
    /sempre quero/i,
    /nunca faça/i
  ],
  important_decisions: [
    /decidi/i,
    /vou (cancelar|parar|começar)/i,
    /a partir de (hoje|agora|amanhã)/i
  ]
};
```

#### Funções a Implementar

| Função | Descrição |
|--------|-----------|
| `extractCriticalData(text)` | Extrai dados críticos de um texto |
| `classifyCriticalData(data)` | Classifica em uma das 4 categorias |
| `mergeCriticalData(existing, new)` | Mescla sem duplicar |
| `isProtectedData(data)` | Verifica se dado é protegido |
| `getCriticalDataSummary(memory)` | Resumo dos dados críticos |

---

### 5.4 Prompt para Compressão Adicional (GPT-5 Nano)

Quando a compressão normal não é suficiente, o sistema pede ao GPT-5 Nano para comprimir ainda mais:

```
Você é um assistente de compressão extrema para um sistema de memória.

TAREFA: Comprimir o resumo abaixo ao MÁXIMO possível, mantendo apenas:
- Valores numéricos exatos
- Datas específicas
- Decisões finais

REGRAS:
- Máximo de 20 palavras
- Use abreviações se necessário
- Remova qualquer contexto não essencial
- Preserve TODOS os números e datas

RESUMO ATUAL:
{current_summary}

DADOS JÁ PRESERVADOS SEPARADAMENTE:
{preserved_data}

SAÍDA: Texto ultra-comprimido (máximo 20 palavras)
```

---

## 🔧 Configurações do Sistema

**Arquivo:** `server/src/config/memory-config.js`

```javascript
module.exports = {
  // Limites de memória
  memory: {
    maxWords: 2500,
    compressionThreshold: 0.90,  // 90%
    targetAfterCompression: 0.40, // 40%
    recentCyclesCount: 2
  },
  
  // Configurações do GPT-5 Nano para resumos
  summarizer: {
    model: 'gpt-5-nano',
    verbosity: 'low',
    reasoning: 'low',
    maxSummaryWords: 50,
    maxCompressedWords: 20,
    timeout: 10000 // 10 segundos
  },
  
  // Persistência
  persistence: {
    autoSaveInterval: 30000, // 30 segundos (fallback)
    retryAttempts: 3,
    retryDelay: 1000
  },
  
  // Detecção de dados críticos
  criticalData: {
    enableAutoDetection: true,
    patterns: { /* patterns object */ }
  }
};
```

---

## 📊 Fluxo Completo da Fase 2

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO COMPLETO DE MEMÓRIA                          │
└─────────────────────────────────────────────────────────────────────────────┘

      NOVA MENSAGEM DO USUÁRIO
              │
              ▼
    ┌─────────────────┐
    │ 1. Identificar  │
    │    chat_id      │
    └─────────────────┘
              │
              ▼
    ┌─────────────────┐     ┌─────────────────┐
    │ Chat existe?    │─NO─►│ Criar memória   │
    │                 │     │ zerada          │
    └─────────────────┘     └─────────────────┘
          │ YES                     │
          ▼                         │
    ┌─────────────────┐             │
    │ Carregar        │◄────────────┘
    │ memória         │
    └─────────────────┘
              │
              ▼
    ┌─────────────────┐
    │ 2. Processar    │
    │    mensagem     │
    │    (agentes)    │
    └─────────────────┘
              │
              ▼
    ┌─────────────────┐
    │ 3. IA gera      │
    │    resposta     │
    └─────────────────┘
              │
              ▼
    ┌─────────────────┐
    │ 4. Criar ciclo  │
    │    completo     │
    └─────────────────┘
              │
              ▼
    ┌─────────────────┐     ┌─────────────────┐
    │ Ciclos recentes │─YES─►│ Mover mais     │
    │ > 2 ?           │     │ antigo p/ old  │
    └─────────────────┘     └─────────────────┘
          │ NO                      │
          ▼                         ▼
    ┌─────────────────┐     ┌─────────────────┐
    │ Adicionar novo  │     │ GPT-5 Nano     │
    │ ciclo ao recent │     │ resume ciclo   │
    └─────────────────┘     └─────────────────┘
              │                     │
              └──────────┬──────────┘
                         ▼
              ┌─────────────────┐
              │ 5. Extrair      │
              │ dados críticos  │
              └─────────────────┘
                         │
                         ▼
              ┌─────────────────┐
              │ 6. Contar       │
              │ palavras        │
              └─────────────────┘
                         │
                         ▼
              ┌─────────────────┐     ┌─────────────────┐
              │ >= 90% limite?  │─YES─►│ Executar       │
              │ (2.250 palavras)│     │ compressão     │
              └─────────────────┘     └─────────────────┘
                    │ NO                    │
                    ▼                       ▼
              ┌─────────────────┐     ┌─────────────────┐
              │ 7. Persistir    │◄────│ Reduzir para   │
              │ memória         │     │ 40% (~1.000)   │
              └─────────────────┘     └─────────────────┘
                         │
                         ▼
              ┌─────────────────┐
              │ MEMÓRIA         │
              │ ATUALIZADA      │
              └─────────────────┘
```

---

## ✅ Critérios de Aceitação

### Objetivo 4 - Sistema de Memória Contextual

| # | Critério | Verificação |
|---|----------|-------------|
| 4.1 | Sistema identifica corretamente chats novos vs existentes | Teste com chat_id novo e existente |
| 4.2 | Memória recente mantém exatamente 2 ciclos | Teste com 1, 2 e 3 ciclos |
| 4.3 | Ciclos recentes são armazenados sem modificação | Comparar input vs stored |
| 4.4 | Ciclos antigos são resumidos pelo GPT-5 Nano | Verificar chamada à API |
| 4.5 | Resumos preservam valores numéricos e datas | Validar preserved_data |
| 4.6 | Memória é persistida após cada ciclo completo | Verificar MongoDB |
| 4.7 | Sistema recupera memória corretamente ao reabrir chat | Teste de load/save |

### Objetivo 5 - Gestão de Volume

| # | Critério | Verificação |
|---|----------|-------------|
| 5.1 | Contador de palavras funciona corretamente | Testes unitários |
| 5.2 | Compressão dispara em 90% do limite | Teste com 2.250+ palavras |
| 5.3 | Após compressão, memória reduz para ~40% | Verificar word count |
| 5.4 | Ciclos recentes permanecem intactos após compressão | Comparar antes/depois |
| 5.5 | Metas financeiras são preservadas | Testar com meta declarada |
| 5.6 | Limites configurados são preservados | Testar com limite definido |
| 5.7 | Preferências declaradas são preservadas | Testar com preferência |
| 5.8 | Decisões importantes são preservadas | Testar com decisão |

---

## 🧪 Casos de Teste Sugeridos

### Teste 1: Fluxo Básico de Memória

```
1. Criar chat novo
2. Enviar mensagem 1 → Receber resposta 1 (ciclo 1)
3. Verificar: recent_memory tem 1 ciclo
4. Enviar mensagem 2 → Receber resposta 2 (ciclo 2)
5. Verificar: recent_memory tem 2 ciclos
6. Enviar mensagem 3 → Receber resposta 3 (ciclo 3)
7. Verificar: recent_memory tem 2 ciclos, old_memory tem 1 resumo
```

### Teste 2: Compressão Automática

```
1. Criar memória artificial com 2.200 palavras
2. Adicionar ciclo que ultrapassa 2.250 palavras
3. Verificar: compressão foi disparada
4. Verificar: total de palavras ~1.000
5. Verificar: 2 ciclos recentes intactos
```

### Teste 3: Preservação de Dados Críticos

```
1. Enviar: "Quero economizar R$ 5.000 até junho"
2. Provocar múltiplas compressões
3. Verificar: critical_data.financial_goals contém a meta
4. Verificar: valor R$ 5.000 e data "junho" preservados
```

---

## 📝 Observações de Implementação

### Tratamento de Erros

1. **Falha no GPT-5 Nano durante resumo:**
   - Manter ciclo original sem resumir
   - Marcar como `pending_summarization: true`
   - Tentar novamente no próximo ciclo

2. **Falha na persistência:**
   - Implementar retry com backoff exponencial
   - Manter memória em cache local
   - Log de erro para investigação

3. **Contagem de palavras inconsistente:**
   - Recalcular total ao carregar memória
   - Corrigir automaticamente se necessário

### Performance

1. **Carregar memória:** Operação síncrona, deve ser rápida (<100ms)
2. **Persistir memória:** Pode ser assíncrona (não bloquear resposta)
3. **Compressão:** Operação mais demorada, executar em background
4. **GPT-5 Nano:** Timeout de 10 segundos, retry 1x

### Integração com Fase 3

A memória será consumida pelo **Agente Júnior** (Fase 3):
- O Júnior recebe `memory.formatted` no início de cada interação
- A memória formatada inclui: recent + old summaries + critical_data
- O formato exato será definido na Fase 3

---

## 📅 Estimativa de Tempo

| Componente | Estimativa |
|------------|------------|
| Modelo e Repository (Memory.js) | 30 min |
| Loader e Persistence | 45 min |
| Cycle Manager | 30 min |
| Word Counter | 20 min |
| Summarizer (GPT-5 Nano) | 45 min |
| Compressor | 60 min |
| Preservation Rules | 45 min |
| Serviço Principal (index.js) | 30 min |
| Configurações | 15 min |
| Testes | 60 min |
| **TOTAL ESTIMADO** | **~6 horas** |

---

## 🔗 Dependências da Fase 1

A Fase 2 utiliza os seguintes componentes já implementados:

| Componente | Arquivo | Uso |
|------------|---------|-----|
| Conexão MongoDB | `config/database.js` | Persistência da memória |
| Logger | `utils/logger.js` | Logs de operações |
| Error Handler | `utils/error-handler.js` | Tratamento de erros |
| GPT-5 Nano | `services/finance-bridge/ai/nano-bridge.js` | Base para summarizer |
| Date Utils | `services/shared/date-utils.js` | Manipulação de datas |

---

**Documento criado em:** 04 de fevereiro de 2026  
**Próxima fase:** Fase 3 - Agente Júnior (Objetivos 6, 7 e 8)
