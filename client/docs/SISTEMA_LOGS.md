# Sistema de Logs Estratégico - Documentação

> **Sistema Multi-Agente Yield - Plataforma de Finanças Pessoais**  
> **Data:** 05 de fevereiro de 2026  
> **Versão:** 1.0.0

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Níveis de Log](#níveis-de-log)
4. [Categorias](#categorias)
5. [Como Usar](#como-usar)
6. [Adicionando Novos Logs](#adicionando-novos-logs)
7. [Removendo ou Desativando Logs](#removendo-ou-desativando-logs)
8. [Boas Práticas](#boas-práticas)
9. [Configurações](#configurações)
10. [Formato do Arquivo de Log](#formato-do-arquivo-de-log)

---

## Visão Geral

O **Sistema de Logs Estratégico** foi projetado para rastrear o fluxo real de execução da plataforma Yield de forma **enxuta e confiável**. Diferente de logs verbosos que geram centenas de linhas, este sistema foca apenas nos **eventos realmente importantes**.

### Princípios Fundamentais

| Princípio | Descrição |
|-----------|-----------|
| **Estratégico** | Logar apenas eventos importantes, não tudo |
| **Legível** | Arquivos Markdown fáceis de ler por humanos |
| **Rastreável** | Cada requisição tem ID único para rastreamento |
| **Escalável** | Fácil adicionar/remover logs sem refatorações |
| **Performático** | Buffer de escrita para não impactar performance |

### O que é logado

- ✅ Início e fim do servidor
- ✅ Requisições de chat (início, decisão, fim)
- ✅ Escaladas entre agentes (Junior → Orquestrador)
- ✅ Operações do Finance Bridge
- ✅ Compressão de memória
- ✅ Erros e exceções

### O que NÃO é logado

- ❌ Cada mensagem trocada internamente
- ❌ Detalhes de tokens de IA
- ❌ Queries de banco de dados (exceto erros)
- ❌ Requisições de arquivos estáticos

---

## Arquitetura

```
server/src/utils/strategic-logger/
├── index.js              # API pública (use este arquivo)
├── log-manager.js        # Gerenciador principal
├── config.js             # Configurações centralizadas
├── formatters/
│   └── markdown.js       # Formatação em Markdown
└── writers/
    └── file-writer.js    # Escrita em arquivo

server/logs/
└── yield-YYYY-MM-DD.md   # Arquivos de log diários
```

### Fluxo de Dados

```
                    Seu Código
                        │
                        ▼
┌──────────────────────────────────────────┐
│           strategic-logger/index.js       │
│  (API pública - info, error, warning...) │
└────────────────────┬─────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────┐
│            log-manager.js                 │
│  - Filtra por nível                      │
│  - Verifica eventos estratégicos         │
│  - Gerencia contexto de requisições      │
└────────────────────┬─────────────────────┘
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│ markdown.js     │   │ file-writer.js  │
│ (Formata)       │   │ (Buffer+Escrita)│
└────────┬────────┘   └────────┬────────┘
         │                     │
         └─────────┬───────────┘
                   ▼
         ┌─────────────────┐
         │  yield-DATE.md  │
         │  (Arquivo final)│
         └─────────────────┘
```

---

## Níveis de Log

O sistema suporta 4 níveis de log, ordenados por severidade:

| Nível | Emoji | Quando Usar |
|-------|-------|-------------|
| **CRITICAL** | 🔴 | Falhas que impedem funcionamento do sistema |
| **ERROR** | ❌ | Erros que podem ser recuperados |
| **WARNING** | ⚠️ | Situações anômalas que merecem atenção |
| **INFO** | ✅ | Eventos importantes do ciclo normal |

### Configurando Nível Mínimo

Por padrão, todos os níveis são logados. Para mudar:

```bash
# No .env
LOG_MIN_LEVEL=WARNING  # Ignora INFO, loga WARNING, ERROR, CRITICAL
```

---

## Categorias

Logs são organizados em categorias para facilitar busca:

| Categoria | Descrição | Componentes |
|-----------|-----------|-------------|
| `system` | Ciclo de vida, saúde | Application, Server |
| `request` | Requisições HTTP | ChatHandler, RequestTracker |
| `agent` | Fluxo de agentes | JuniorAgent, Orchestrator, Coordinators |
| `bridge` | Finance Bridge | FinanceBridge, Operations |
| `memory` | Sistema de memória | MemoryManager, Compressor |
| `auth` | Autenticação | AuthService |
| `database` | Banco de dados | MongoDB, Repository |

---

## Como Usar

### Importação

```javascript
const strategicLogger = require('./utils/strategic-logger');
```

### Logs Simples

```javascript
// INFO - Evento importante
await strategicLogger.info('system', 'MeuComponente', 'Operação concluída');

// WARNING - Situação anômala
await strategicLogger.warning('database', 'MongoDB', 'Conexão lenta detectada', {
  meta: { latency: '500ms' }
});

// ERROR - Erro recuperável
await strategicLogger.error('agent', 'JuniorAgent', 'Falha ao classificar', {
  error: err,
  meta: { query: userMessage }
});

// CRITICAL - Falha grave
await strategicLogger.critical('system', 'Application', 'Servidor não consegue iniciar', {
  error: err
});
```

### Rastreamento de Requisição

Para acompanhar uma requisição do início ao fim:

```javascript
// Início da requisição
const requestId = `req_${Date.now()}`;
const reqLog = strategicLogger.startRequest(requestId, { 
  userId: 'user123',
  path: '/api/chat'
});

// Durante o processamento
reqLog.info('Handler', 'Iniciando processamento');
reqLog.warning('Handler', 'Cache miss');

// Ao finalizar
reqLog.end(true, { itemsProcessed: 10 }); // success=true
// ou
reqLog.end(false, { error: 'Timeout' }); // success=false
```

### Logs de Processo (Início/Fim)

```javascript
const startTime = Date.now();
await strategicLogger.processStart('Compressão de Memória', 'MemoryManager');

// ... executar processo ...

const duration = Date.now() - startTime;
await strategicLogger.processEnd('Compressão de Memória', 'MemoryManager', duration, true);
```

### Métodos de Conveniência

```javascript
// Decisão do sistema
await strategicLogger.decision('Orchestrator', 
  'Encaminhar para Planning', 
  'Query contém palavras de orçamento'
);

// Operação do Finance Bridge
await strategicLogger.bridgeOperation('query', true, 150, {
  filters: ['date', 'category'],
  resultsCount: 42
});

// Escalada entre agentes
await strategicLogger.agentEscalation('Junior', 'Orchestrator', 
  'Query complexa detectada'
);

// Compressão de memória
await strategicLogger.memoryCompression(2300, 950, 120);
```

---

## Adicionando Novos Logs

### Passo 1: Identifique o Local

Pergunte-se:
- Este é um **evento importante**? (Início/fim de processo, decisão, erro)
- Um desenvolvedor **precisa** ver isso para entender o fluxo?
- Isso ajuda a **diagnosticar problemas**?

Se a resposta for "não" para todas, **não adicione o log**.

### Passo 2: Escolha o Nível e a Categoria

```javascript
// Exemplo: Log para nova funcionalidade de exportação
await strategicLogger.info('system', 'ExportService', 
  'Exportação iniciada', {
    meta: { format: 'csv', records: 1500 }
  }
);
```

### Passo 3: Para Eventos Estratégicos

Se o evento é crítico e deve **sempre** ser logado (mesmo se nível mínimo estiver alto), adicione em `config.js`:

```javascript
// em config.js
const STRATEGIC_EVENTS = [
  // ... eventos existentes ...
  'export.start',
  'export.complete',
  'export.error'
];
```

E use `eventName` no log:

```javascript
await strategicLogger.info('system', 'ExportService', 
  'Exportação concluída', {
    eventName: 'export.complete',
    meta: { records: 1500, duration: '2.3s' }
  }
);
```

---

## Removendo ou Desativando Logs

### Desativar Temporariamente (Desenvolvimento)

```bash
# No .env
LOG_ENABLED=false  # Desativa completamente
# ou
LOG_CONSOLE=false  # Desativa apenas console (mantém arquivo)
```

### Desativar Log Específico

Comente ou remova a chamada:

```javascript
// await strategicLogger.info(...);  // Comentado
```

### Aumentar Nível Mínimo

```bash
# No .env
LOG_MIN_LEVEL=ERROR  # Só loga ERROR e CRITICAL
```

### Remover Evento Estratégico

Em `config.js`, remova o evento da lista `STRATEGIC_EVENTS`.

---

## Boas Práticas

### ✅ Faça

1. **Use níveis apropriados**
   ```javascript
   // Bom: nível correto
   await strategicLogger.error('...');  // Para erros
   await strategicLogger.info('...');   // Para eventos normais
   ```

2. **Inclua contexto útil**
   ```javascript
   // Bom: informações para diagnóstico
   await strategicLogger.error('agent', 'Classifier', 'Falha na classificação', {
     error: err,
     meta: { query: userMessage, complexity: 'unknown' }
   });
   ```

3. **Use logs de processo para operações longas**
   ```javascript
   await strategicLogger.processStart('Sincronização', 'SyncService');
   // ... operação ...
   await strategicLogger.processEnd('Sincronização', 'SyncService', duration, success);
   ```

4. **Rastreie requisições complexas**
   ```javascript
   const reqLog = strategicLogger.startRequest(requestId, context);
   // ... múltiplas operações ...
   reqLog.end(success);
   ```

### ❌ Evite

1. **Logs excessivos**
   ```javascript
   // Ruim: log em cada iteração
   for (const item of items) {
     await strategicLogger.info('...', 'Loop item'); // ❌
   }
   
   // Bom: log no final
   await strategicLogger.info('...', `Processados ${items.length} itens`); // ✅
   ```

2. **Informações sensíveis**
   ```javascript
   // Ruim: expõe senha
   await strategicLogger.info('auth', 'Login', 'Usuário logou', {
     meta: { password: user.password }  // ❌ NUNCA!
   });
   
   // Bom: apenas ID
   await strategicLogger.info('auth', 'Login', 'Usuário logou', {
     meta: { userId: user.id }  // ✅
   });
   ```

3. **Mensagens genéricas**
   ```javascript
   // Ruim: não ajuda
   await strategicLogger.error('system', 'X', 'Erro'); // ❌
   
   // Bom: específico
   await strategicLogger.error('system', 'X', 'Falha ao conectar ao serviço Y: timeout'); // ✅
   ```

---

## Configurações

### Arquivo: `config.js`

| Configuração | Padrão | Descrição |
|--------------|--------|-----------|
| `FILE_CONFIG.logsDir` | `server/logs` | Diretório dos logs |
| `FILE_CONFIG.maxFiles` | `7` | Máximo de arquivos a manter |
| `FILE_CONFIG.maxFileSize` | `5MB` | Tamanho máximo por arquivo |
| `BEHAVIOR_CONFIG.minLevel` | `INFO` | Nível mínimo |
| `BEHAVIOR_CONFIG.consoleOutput` | `true` | Também imprimir no console |
| `BEHAVIOR_CONFIG.bufferSize` | `5` | Logs antes de escrever |
| `BEHAVIOR_CONFIG.bufferFlushInterval` | `3000ms` | Intervalo máximo de flush |

### Variáveis de Ambiente

```bash
# Nível mínimo de log
LOG_MIN_LEVEL=INFO

# Habilitar/desabilitar logs
LOG_ENABLED=true

# Output no console
LOG_CONSOLE=true
```

---

## Formato do Arquivo de Log

Os logs são gerados em arquivos Markdown diários:

```
server/logs/yield-2026-02-05.md
```

### Estrutura do Arquivo

```markdown
# 📋 Logs do Sistema Yield

> **Data:** 05/02/2026
> **Ambiente:** development

---

## ⏰ 15:00

### ✅ INFO | 15:00:01

**Categoria:** `system`  
**Componente:** Application

▶️ Iniciando: Yield Finance Server

---

### ✅ INFO | 15:00:02

**Categoria:** `system`  
**Componente:** Application

Servidor Yield iniciado com sucesso na porta **3000**

| Campo | Valor |
|-------|-------|
| Port | `3000` |
| Env | development |

---

### ❌ ERROR | 15:05:23

**Categoria:** `request`  
**Componente:** ChatHandler

Erro ao processar chat: Timeout na API OpenAI

| Campo | Valor |
|-------|-------|
| Request Id | `chat_1707145523_a1b2c3` |
| Duration | `80234ms` |

<details>
<summary>🔍 Detalhes do Erro</summary>

\`\`\`
Error: Request timeout after 80000ms
    at OpenAI.request (...)
    ...
\`\`\`

</details>

---
```

---

## Verificando Saúde do Sistema

```javascript
// Health check
const status = strategicLogger.healthCheck();
console.log(status);
// { status: 'healthy', enabled: true, ... }

// Estatísticas
const stats = strategicLogger.getStatus();
console.log(stats);
// { total: 42, byLevel: { INFO: 30, ERROR: 2, ... }, ... }
```

---

## Resumo

| Ação | Comando |
|------|---------|
| Log simples | `await strategicLogger.info(categoria, componente, mensagem)` |
| Log com erro | `await strategicLogger.error(cat, comp, msg, { error: err })` |
| Rastrear requisição | `const req = strategicLogger.startRequest(id); req.end(true);` |
| Decisão | `await strategicLogger.decision(comp, 'decisão', 'motivo')` |
| Forçar escrita | `await strategicLogger.flush()` |
| Desativar | `LOG_ENABLED=false` no `.env` |

---

> **Lembre-se:** Menos é mais. Log apenas o essencial para rastrear o fluxo, identificar problemas e tomar decisões.
