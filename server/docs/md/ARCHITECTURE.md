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
    ┌──────────┬──────────┬──────────┬──────────────┬──────────────┐
    ↓          ↓          ↓          ↓              ↓              ↓
[Bridge]   [Serper]  [Simple]   [ORQUESTRADOR]  [Follow-up]
(Nano)     (API)     (Mini)     (Full)          (Mini)
    ↓          ↓          ↓          ↓              ↓
 Retorna   Retorna   Resposta   [IA] Cria DOC  [IA] Pergunta
    ↓          ↓       Social       ↓              ↓
    └──────────┴─────────┴──────────┐         Aguarda usuário
         ↓                           ↓
   Resposta Direta              ┌───┴────────┐
   (ResponseAgent)              ↓            ↓
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
| Resposta | Full | High | High | Síntese para humanos (escalada) |
| Resposta (direta) | Full | High | High | Formatação de rotas diretas |
| Resposta (social) | Mini | Low | Medium | Interações sociais (Patch 4.1) |
| Summarizer | Nano | — | — | Resumo de ciclos de memória |
| Compressor | Full | High | Low | Compressão de memória |

**Nota:** O ResponseAgent possui 3 modos:
- `synthesize()` — Escalada completa (Full High/High)
- `formatDirectResponse()` — Rotas diretas (Full High/High)
- `formatSimpleResponse()` — Interações sociais (Mini Low/Medium) — **Adicionado em Patch 4.1**

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

Estrutura de Memória:
- Recente (recent): últimos 2 ciclos completos (array direto) → para contexto da IA
- Antigo (old): resumos de ciclos anteriores (via Nano) → para contexto da IA
- Histórico Completo (fullHistory): TODAS as mensagens → para exibição ao usuário
- Compressão: quando > 90% do limite (2250/2500 palavras), Full comprime para ~1000 palavras
```

**SEPARAÇÃO IMPORTANTE:**
- `recent` + `old` = Memória contextual para a IA (limitada, resumida)
- `fullHistory` = Histórico completo para o usuário (ilimitado, sem resumo)

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

### 1. Coordenadores executam ferramentas via two-pass (RESOLVIDO)
~~Os coordenadores não executavam ferramentas reais.~~ **Resolvido em 06/02/2026.**
`BaseCoordinator.execute()` agora implementa execução em dois passos:
1. **Passo 1 (Planejamento):** IA analisa a tarefa e pode solicitar ferramentas via campo `tool_requests` no JSON
2. **Execução:** O sistema executa as ferramentas solicitadas (Finance Bridge, Search, Math) e coleta resultados reais
3. **Passo 2 (Síntese):** IA recebe os dados reais e produz análise final baseada em dados concretos do usuário

Ferramentas disponíveis: `finance_bridge:query`, `search:serper/brapi/tavily`, `math:compoundInterest/netPresentValue/internalRateOfReturn/sharpeRatio/valueAtRisk/projectionWithContributions`.

### 2. ExternalCallManager integrado ao fluxo (RESOLVIDO)
~~Os módulos AgentState, ExternalCallManager e ContextRecovery não eram utilizados.~~ **Resolvido em 06/02/2026.**
- `Dispatcher` usa `ExternalCallManager` em todas as rotas diretas (bridge_query, bridge_insert, serper)
- `BaseCoordinator` usa `ExternalCallManager` ao executar ferramentas durante o two-pass
- `message.js` faz cleanup dos estados via `clearChatStates(chatId)` após cada ciclo
- `chatId` é propagado por toda a cadeia: message.js → Dispatcher → ExecutionManager → Coordinators

### 3. Modelos placeholder
Os modelos GPT-5.2, GPT-5-mini e GPT-5-nano referidos na constituição não existem ainda. O sistema usa placeholders: `nano → gpt-4o-mini`, `mini → gpt-4o-mini`, `full → gpt-4o`. Troca requer apenas alteração em `config/index.js`.

---

## Atualizações Recentes

### Patch 4.1: Rota `simple_response` (07/02/2026)

**Motivação:** Saudações e interações sociais eram escaladas desnecessariamente para o Orquestrador, desperdiçando tokens e tempo.

**Implementação:**
- Adicionada 5ª rota no Junior: `simple_response`
- Prioridade máxima (antes de qualquer rota financeira)
- ResponseAgent usa modelo **Mini** (low/medium) em vez de Full
- Redução de custo: 90-95% para interações sociais
- Redução de latência: de 3-5s para 0.5-0.8s

**Casos de uso:**
- Saudações: "Oi", "Olá", "Bom dia"
- Agradecimentos: "Obrigado", "Valeu"
- Perguntas sobre o sistema: "Como você funciona?"
- Despedidas: "Tchau", "Até logo"

**Lógica especial:** Se usuário pergunta sobre o sistema, ResponseAgent carrega `docs/md_sistema/sistema.md` para contexto adicional.

**Arquivo de referência:** Ver `RELATORIO_FASE4.md` seção 9 para detalhes completos.

### Patch 4.2: Finance Bridge e dependências (11/02/2026)

**Motivação:** Queries que pedem receitas e despesas juntas geravam `filters.type: null`, falhando na validação; agentes dependentes não viam claramente falhas anteriores.

**Implementação:**
- Finance Bridge aceita consultas sem `filters.type` (ambos os tipos) e normaliza `type: all/both/ambos` para remoção
- QueryBuilder remove `filters.type` quando o pedido inclui receitas e despesas
- Prompts de coordenadores esclarecem quando usar `task_completed: false`
- Outputs de dependência agora incluem status de falha no prompt
