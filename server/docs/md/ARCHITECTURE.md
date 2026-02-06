# Arquitetura do Sistema — Yield Server

## Visão Geral

O Yield Server é um sistema multi-agente de gestão financeira inteligente que combina **lógica determinística** com **inferência por IA** de forma estritamente separada.

---

## Diagrama de Fluxo Completo

```
USUÁRIO ENVIA MENSAGEM (POST /api/message)
         ↓
   [LÓGICA] Carrega memória do chat (MongoDB)
         ↓
   [IA - JUNIOR (Mini)] Classifica query
         ↓
   [LÓGICA] Dispatcher roteia baseado em decision
         ↓
    ┌─────────────┬─────────────┬──────────────┐
    ↓             ↓             ↓              ↓
[Bridge]      [Serper]    [ORQUESTRADOR]   [Follow-up]
(Nano)        (API)       (Full)           (Mini)
    ↓             ↓             ↓              ↓
 Retorna      Retorna    [IA] Cria DOC    [IA] Pergunta
    ↓             ↓             ↓              ↓
    └─────────────┴─────┐      ↓         Aguarda usuário
         ↓              ↓      ↓
   Resposta Direta   ┌──┴──────┴──┐
   (ResponseAgent)   ↓            ↓
                  [Análise]  [Investimentos]  [Planejamento]
                  (Full)     (Full)           (Full)
                     ↓            ↓            ↓
                  [IA] Metacognição + Ferramentas
                     ↓            ↓            ↓
                     └─────┬──────┴─────┬──────┘
                           ↓            ↓
                    [IA - RESPOSTA (Full)] Sintetiza tudo
                           ↓
                    [LÓGICA] Atualiza memória
                           ↓
                    RESPOSTA AO USUÁRIO
```

---

## Camadas do Sistema

### 1. API HTTP (`src/api/`)
- **server.js** — Express.js, CORS, logging middleware, error handling
- **routes/message.js** — `POST /api/message`, `GET /api/chat/:chatId/history`
- **Papel:** Interface com o frontend, orquestra o fluxo completo

### 2. Agentes de IA (`src/agents/`)
Cada arquivo encapsula **exatamente um ponto de decisão de IA**.

| Agente | Modelo | Reasoning | Verbosity | Função |
|--------|--------|-----------|-----------|--------|
| Junior | Mini | Medium | Low | Classificação e roteamento |
| Orquestrador | Full | High | Low | Decomposição e planejamento |
| Análise | Full | High | Low | Padrões financeiros |
| Investimentos | Full | High | Low | Mercado e ativos |
| Planejamento | Full | High | Low | Metas e orçamentos |
| Resposta | Full | High | High | Síntese para humanos |
| Summarizer | Nano | — | — | Resumo de ciclos de memória |
| Compressor | Full | High | Low | Compressão de memória |

### 3. Core - Lógica Pura (`src/core/`)
**NUNCA importa modelos de IA diretamente.**

- **memory/** — Persistência, estrutura, contagem de palavras, ciclos
- **router/** — Dispatcher (switch determinístico)
- **orchestrator/** — ExecutionManager, fila, preparador de input
- **state/** — Estado de agentes, chamadas externas, recuperação de contexto

### 4. Ferramentas (`src/tools/`)
- **finance-bridge/** — Query e insert no MongoDB via protocolo JSON
- **search/** — Serper, Brapi, Tavily (APIs externas)
- **math/** — Cálculos financeiros com Decimal.js

### 5. Utilitários (`src/utils/`)
- **logger.js** — Sistema de logging centralizado (.md)
- **ai/** — Client abstrato, OpenAI client, Model Factory

---

## Separação IA vs Lógica

### Regra Fundamental
```
src/core/   → NUNCA importa modelos de IA
src/agents/ → Cada arquivo = EXATAMENTE 1 ponto de decisão de IA
src/tools/  → Execução pura (chamadas HTTP, MongoDB, cálculos)
```

### Quando usar IA
- Classificação baseada em contexto
- Processamento de linguagem natural
- Raciocínio estratégico (decomposição, priorização)
- Síntese e formatação para humanos

### Quando usar Lógica
- Roteamento (switch/if-else após decisão da IA)
- CRUD no banco de dados
- Validação de estrutura e tipos
- Controle de fluxo (fila, dependências)
- Cálculos matemáticos

---

## Escolha de Modelos

| Modelo | Papel | Quando usar |
|--------|-------|-------------|
| **Full (GPT-5.2)** | Cérebro estratégico | Decisões complexas, planejamento, alto custo de erro |
| **Mini (GPT-5-mini)** | Executor inteligente | Raciocínio local, escopo definido, análise contextual |
| **Nano (GPT-5-nano)** | Infraestrutura | Tarefas simples, repetitivas, conversão de formato |

**Regra:** Nano NÃO suporta parâmetros de Reasoning/Verbosity.

---

## Sistema de Memória

```
Cada ciclo = mensagem do usuário + resposta da IA

Recente: últimos 2 ciclos completos (array direto)
Antigo: resumos de ciclos anteriores (via Nano)
Compressão: quando > 90% do limite (2250/2500 palavras), Full comprime para ~1000 palavras
```

---

## Resiliência

Todos os pontos de IA possuem fallbacks:
- Junior falha → escalada para Orquestrador
- Orquestrador falha → DOC de fallback (Agente de Análise)
- Coordenador falha → resultado de erro (não bloqueia dependentes)
- ResponseAgent falha → concatenação direta dos outputs
- Summarizer falha → ciclo completo preservado como string
- Compressor falha → resumos originais concatenados

---

## Limitações Conhecidas

### 1. Coordenadores não executam ferramentas reais
Os coordenadores (Análise, Investimentos, Planejamento) recebem descrições de ferramentas no prompt e as mencionam no `reasoning` e `tools_used`, mas **não há mecanismo de execução real**. `BaseCoordinator.execute()` apenas chama `model.completeJSON()` sem function calling nem pós-processamento de tool calls. Coordenadores respondem com base no conhecimento prévio do modelo, sem acesso a dados reais do usuário.

### 2. ExternalCallManager não integrado
Os módulos `AgentState`, `ExternalCallManager` e `ContextRecovery` em `core/state/` foram implementados mas não são utilizados em nenhum fluxo real. Todas as chamadas externas são síncronas via `await` direto, sem preservação de estado conforme descrito na constituição.

### 3. Modelos placeholder
Os modelos GPT-5.2, GPT-5-mini e GPT-5-nano referidos na constituição não existem ainda. O sistema usa placeholders: `nano → gpt-4o-mini`, `mini → gpt-4o-mini`, `full → gpt-4o`. Troca requer apenas alteração em `config/index.js`.
