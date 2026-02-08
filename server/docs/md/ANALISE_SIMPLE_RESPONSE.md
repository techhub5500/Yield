# Análise: Problema de Classificação de Saudações e Proposta de Rota `simple_response`

**Data:** 07/02/2026  
**Status:** Análise completa — aguardando decisão de implementação  
**Problema identificado:** Agente Junior classifica saudações como `escalate`, desperdiçando recursos

---

## 1. Diagnóstico do Problema

### 1.1 Problema Relatado
- **Input:** "OLA"
- **Classificação do Junior:** `escalate`
- **Comportamento esperado:** Resposta social direta, sem escalada

### 1.2 Causa Raiz Identificada

**Arquivo:** `server/src/agents/junior/prompt.js` — Linha 32

```javascript
- Se a query é uma SAUDAÇÃO (oi, olá, bom dia, e aí, tudo bem, etc.) ou CONVERSA GERAL 
  sem intenção financeira → escalate
```

**Consequência:** O sistema está **intencionalmente** escalando saudações para o Orquestrador.

### 1.3 Impacto do Comportamento Atual

Quando o usuário envia "OLA", o fluxo executado é:

```
1. Junior (Mini) classifica como "escalate" ✅ (correto conforme prompt atual)
2. Dispatcher → Orquestrador (Full High/Low) gera DOC
3. Orquestrador pode alocar coordenadores (Análise, Investimentos, Planejamento)
4. Coordenadores (Full High/Low) executam análises
5. ResponseAgent (Full High/High) sintetiza resposta final
```

**Custo:** 3-5 chamadas de IA para responder "Olá! Como posso ajudar?"

**Problemas:**
- ⚠️ **Desperdício de recursos:** Usa GPT-5.2 (Full) para resposta trivial
- ⚠️ **Latência desnecessária:** Múltiplos agentes para resposta social simples
- ⚠️ **Custo financeiro:** Tokens desperdiçados em análise estratégica de saudação
- ⚠️ **Experiência do usuário:** Delay perceptível em interação que deveria ser instantânea

---

## 2. Análise da Arquitetura Atual

### 2.1 Rotas Existentes no Sistema

| Rota | Descrição | Modelo(s) Usado(s) | Casos de Uso |
|------|-----------|-------------------|--------------|
| `bridge_query` | Consulta a dados financeiros pessoais | Nano (NL→JSON) + MongoDB | "Quanto gastei ontem?" |
| `bridge_insert` | Lançamento de transações | Nano (classificador) + Mini (categoria) + Nano (montador) | "Gastei R$50 no almoço" |
| `serper` | Busca na internet (informações públicas) | API externa Serper | "Qual a taxa Selic?" |
| `escalate` | Análise complexa multi-agente | Full (Orquestrador + Coordenadores + Resposta) | "Analise meus investimentos" |

**Observação:** NÃO existe rota para interações sociais/triviais.

### 2.2 Casos de Uso Não Cobertos

Queries que deveriam ter resposta direta, mas são escaladas:

- **Saudações:** "Oi", "Olá", "Bom dia", "E aí", "Tudo bem?"
- **Agradecimentos:** "Obrigado", "Valeu", "Muito obrigado"
- **Perguntas sobre o sistema:** "Como você funciona?", "O que você faz?", "Pode me ajudar?"
- **Despedidas:** "Tchau", "Até logo", "Falou"
- **Conversas casuais:** "Legal", "Entendi", "Ok"

### 2.3 Verificação na Arquitetura

Consultando `server/docs/md/ARCHITECTURE.md`:

> **Camadas do Sistema**
> 1. API HTTP
> 2. Agentes de IA (Junior, Orquestrador, Coordenadores, Resposta)
> 3. Core - Lógica Pura (router, memory, orchestrator, state)
> 4. Ferramentas (finance-bridge, search, math)

**Conclusão:** O sistema foi projetado para 4 rotas específicas. Não há menção a rota social/trivial nos relatórios de implementação (Fases 1-4).

### 2.4 Verificação na Visão Geral (Constituição)

Consultando `client/docs/visao_geral.md`:

**Seção relevante:** O documento **menciona** que o Junior deve ser capaz de lidar com "interações sociais simples" e "perguntas sobre o próprio sistema", mas **não especifica** uma rota dedicada para isso.

**Interpretação:** A constituição reconhece a necessidade de respostas triviais, mas deixou a implementação em aberto. A decisão atual (escalate) foi uma escolha conservadora — "na dúvida, escale".

---

## 3. Análise do Prompt Proposto pelo Usuário

O usuário propôs adicionar uma 5ª rota: **`simple_response`**

### 3.1 Definição da Nova Rota

```
4. **simple_response** — Interações sociais e perguntas triviais sem necessidade de dados ou análise.
   Exemplos: "Oi", "Olá", "Bom dia", "Obrigado", "Como você funciona?", "O que você faz?"
```

### 3.2 Regra de Priorização Proposta

```
REGRAS DE DECISÃO (em ordem de prioridade):

1. **SAUDAÇÕES E INTERAÇÕES SOCIAIS** → simple_response
2. **LANÇAMENTOS FINANCEIROS** → bridge_insert
3. **CONSULTAS A DADOS PESSOAIS** → bridge_query
4. **BUSCA DE DADOS PÚBLICOS** → serper
5. **TAREFAS COMPLEXAS** → escalate
```

**Mudança crítica:** Saudações agora têm **prioridade máxima**, antes de qualquer análise financeira.

### 3.3 Validade da Proposta

✅ **Alinhada com boas práticas:** Resposta mais simples para query mais simples  
✅ **Reduz carga no sistema:** Evita chamadas desnecessárias ao Orquestrador  
✅ **Melhora experiência do usuário:** Respostas instantâneas para interações sociais  
✅ **Consistente com constituição:** Respeita princípio "IA Decide, Lógica Executa"  

⚠️ **Requer implementação completa:** Não basta mudar o prompt — precisa de handler no Dispatcher

---

## 4. Opções de Implementação

### Opção A: Rota `simple_response` com Resposta Pré-definida (Lógica Pura)

**Descrição:**  
Adicionar rota `simple_response` que retorna respostas pré-definidas sem chamada a IA.

**Implementação:**
1. Atualizar `agents/junior/prompt.js` com a rota `simple_response`
2. Adicionar handler `_handleSimpleResponse()` no Dispatcher (lógica pura)
3. Mapear padrões de saudação → respostas pré-definidas

**Exemplo:**
```javascript
// Em dispatcher.js
async _handleSimpleResponse(query, memory, chatId) {
  // LÓGICA PURA: mapeamento determinístico
  const responses = {
    saudacao: "Olá! Sou seu assistente financeiro pessoal. Como posso ajudar?",
    agradecimento: "De nada! Estou aqui sempre que precisar.",
    despedida: "Até logo! Cuide bem das suas finanças! 💰",
  };
  
  // Lógica para detectar tipo (regex simples ou keyword matching)
  const tipo = detectarTipo(query);
  
  return {
    success: true,
    type: 'simple_response',
    data: { response: responses[tipo] || responses.saudacao },
  };
}
```

**Vantagens:**
- ✅ Zero custo de IA
- ✅ Latência mínima (~10ms)
- ✅ Resposta consistente e previsível
- ✅ Fácil de implementar

**Desvantagens:**
- ❌ Respostas "robóticas" (não contextuais)
- ❌ Não usa memória do chat (não personaliza)
- ❌ Limitado a padrões pré-definidos

---

### Opção B: Rota `simple_response` com ResponseAgent Direto (IA Leve)

**Descrição:**  
Adicionar rota que chama o ResponseAgent diretamente, sem passar por Orquestrador.

**Implementação:**
1. Atualizar `agents/junior/prompt.js` com a rota `simple_response`
2. Adicionar handler `_handleSimpleResponse()` no Dispatcher
3. Handler chama `responseAgent.formatDirectResponse()` com tipo `simple_response`
4. Adicionar lógica no ResponseAgent para este tipo (usa prompt simplificado)

**Exemplo:**
```javascript
// Em dispatcher.js
async _handleSimpleResponse(query, memory, chatId) {
  // Retorna estrutura esperada pelo message.js
  return {
    success: true,
    type: 'simple_response',
    data: { query, memory }, // Dados mínimos
  };
}

// Em message.js (ajuste no fluxo)
else if (routeResult.type === 'simple_response') {
  const formatted = await responseAgent.formatSimpleResponse(query, memory);
  finalResponse = formatted.response;
}

// Em agents/response/index.js (novo método)
async function formatSimpleResponse(query, memory) {
  // Usa modelo MINI em vez de FULL para economizar
  const mini = ModelFactory.getMini('low', 'medium');
  // Prompt específico para interações sociais
  // ...
}
```

**Vantagens:**
- ✅ Resposta contextual (usa memória)
- ✅ Flexibilidade da IA (lida com variações)
- ✅ Personalização ("Olá, João! Seus gastos estão equilibrados.")
- ✅ Tom consistente com o resto do sistema

**Desvantagens:**
- ❌ Ainda usa 1 chamada de IA (custo baixo, mas não zero)
- ❌ Latência ~500-800ms (aceitável, mas não instantânea)
- ❌ Requer novo método no ResponseAgent

---

### Opção C: Rota `simple_response` Híbrida (Lógica + IA Condicional)

**Descrição:**  
Combina Opção A e B — usa respostas pré-definidas por padrão, IA apenas se contexto recente existe.

**Implementação:**
1. Handler `_handleSimpleResponse()` verifica memória recente
2. **Se memória.recent vazia ou irrelevante:** resposta pré-definida (Opção A)
3. **Se memória.recent contém contexto financeiro:** chama IA para resposta contextual (Opção B)

**Exemplo:**
```javascript
async _handleSimpleResponse(query, memory, chatId) {
  // LÓGICA: verificar se há contexto recente relevante
  const hasRecentContext = memory.recent.length > 0;
  
  if (!hasRecentContext) {
    // Resposta rápida pré-definida
    return {
      success: true,
      type: 'simple_response',
      data: { response: "Olá! Como posso ajudar com suas finanças hoje?" },
    };
  }
  
  // Contexto existe → chama IA para resposta personalizada
  return {
    success: true,
    type: 'simple_response',
    data: { query, memory }, // ResponseAgent irá formatar
  };
}
```

**Vantagens:**
- ✅ Melhor custo-benefício (IA apenas quando necessário)
- ✅ Respostas instantâneas na maioria dos casos
- ✅ Personalização quando faz sentido
- ✅ Escalável (adicionar novos padrões pré-definidos é trivial)

**Desvantagens:**
- ❌ Lógica de decisão adicional (quando usar pré-definido vs IA)
- ❌ Complexidade de manutenção (dois caminhos de execução)

---

## 5. Impacto no Sistema

### 5.1 Arquivos a Serem Modificados

| Arquivo | Tipo de Mudança | Descrição |
|---------|----------------|-----------|
| `src/agents/junior/prompt.js` | **Atualização** | Adicionar rota `simple_response` + regras de priorização |
| `src/agents/junior/validators.js` | **Atualização** | Adicionar validação para `simple_response` |
| `src/core/router/dispatcher.js` | **Adição** | Novo método `_handleSimpleResponse()` |
| `src/api/routes/message.js` | **Ajuste** | Adicionar case para `simple_response` no fluxo de resposta |
| `src/agents/response/index.js` | **Condicional** | Se Opção B/C: adicionar método `formatSimpleResponse()` |
| `src/agents/response/prompt.js` | **Condicional** | Se Opção B/C: adicionar `SIMPLE_RESPONSE_PROMPT` |

### 5.2 Compatibilidade com Fases Anteriores

✅ **Fase 1 (Memória):** Sem impacto — memória continua funcionando igual  
✅ **Fase 2 (Junior + Dispatcher):** Adição de rota — não quebra rotas existentes  
✅ **Fase 3 (Orquestrador):** Sem impacto — `escalate` ainda existe para queries complexas  
✅ **Fase 4 (API):** Ajuste mínimo — adicionar case no switch de resposta  

**Conclusão:** Mudança **aditiva** e **não destrutiva** — não quebra nenhum módulo existente.

### 5.3 Testes Necessários

Após implementação, validar:

1. **Saudações básicas:** "Oi", "Olá", "Bom dia" → `simple_response`
2. **Agradecimentos:** "Obrigado", "Valeu" → `simple_response`
3. **Perguntas sobre sistema:** "Como você funciona?" → `simple_response`
4. **Queries financeiras não escaladas:** "Quanto gastei ontem?" → `bridge_query` ✅
5. **Queries complexas:** "Analise meus gastos e sugira otimizações" → `escalate` ✅
6. **Ambiguidade:** "Legal" (após conversa financeira) → testar com e sem contexto

---

## 6. Recomendação

### Solução Recomendada: **Opção C (Híbrida)**

**Justificativa:**

1. **Melhor custo-benefício:** Zero custo para primeiras interações, IA apenas quando contexto importa
2. **Experiência do usuário otimizada:** Resposta instantânea para saudações sem contexto
3. **Qualidade mantida:** Resposta contextual quando memória recente existe
4. **Escalabilidade:** Fácil adicionar novos padrões pré-definidos via configuração
5. **Alinhamento com constituição:** "IA Decide, Lógica Executa" — lógica escolhe quando IA é necessária

### Implementação Sugerida (Fase 4.1 — Patch)

#### Etapa 1: Atualizar prompt do Junior
```javascript
// Em src/agents/junior/prompt.js
const JUNIOR_SYSTEM_PROMPT = `Você é o Agente Junior — o roteador inteligente de um sistema financeiro pessoal.

Sua tarefa é analisar a mensagem do usuário e classificá-la em UMA das seguintes rotas:

ROTAS DISPONÍVEIS:
1. **simple_response** — Interações sociais e perguntas triviais.
   Exemplos: "Oi", "Olá", "Bom dia", "Obrigado", "Como você funciona?"
   
2. **bridge_query** — Consultas a dados financeiros pessoais.
   Exemplos: "Quanto gastei ontem?", "Gastos do mês"
   
3. **bridge_insert** — Lançamento de transações.
   Exemplos: "Gastei R$50 no almoço"
   
4. **serper** — Busca na internet.
   Exemplos: "Qual a taxa Selic atual?"
   
5. **escalate** — Análise complexa multi-agente.
   Exemplos: "Analise meus investimentos e sugira ajustes"

REGRAS DE DECISÃO (em ordem de prioridade):

1. **SAUDAÇÕES E INTERAÇÕES SOCIAIS** → simple_response
   - Saudações: "oi", "olá", "bom dia", "e aí", "tudo bem"
   - Agradecimentos: "obrigado", "valeu", "muito obrigado"
   - Perguntas sobre o sistema: "como você funciona?", "o que você faz?"
   - Despedidas: "tchau", "até logo", "falou"
   - Conversas casuais: "legal", "entendi", "ok"

2. **LANÇAMENTOS FINANCEIROS** → bridge_insert
   [... regras existentes ...]

3. **CONSULTAS A DADOS PESSOAIS** → bridge_query
   [... regras existentes ...]

4. **BUSCA DE DADOS PÚBLICOS** → serper
   [... regras existentes ...]

5. **TAREFAS COMPLEXAS** → escalate
   [... regras existentes ...]

(...restante do prompt...)
`;
```

#### Etapa 2: Adicionar handler no Dispatcher
```javascript
// Em src/core/router/dispatcher.js

// No método route(), adicionar case:
case 'simple_response':
  return await this._handleSimpleResponse(query, memory, chatId);

// Novo método privado:
/**
 * Roteia para resposta social/trivial.
 * Usa resposta pré-definida se não houver contexto recente relevante.
 * Caso contrário, chama ResponseAgent para resposta contextual.
 * @private
 */
async _handleSimpleResponse(query, memory, chatId) {
  // LÓGICA: verificar contexto recente
  const hasRecentFinancialContext = memory.recent && memory.recent.length > 0;
  
  if (!hasRecentFinancialContext) {
    // Resposta rápida pré-definida (LÓGICA PURA)
    const predefinedResponse = this._selectPredefinedResponse(query);
    
    logger.logic('DEBUG', 'Dispatcher', 'Resposta social pré-definida (sem contexto)');
    
    return {
      success: true,
      type: 'simple_response',
      mode: 'predefined',
      data: { response: predefinedResponse },
    };
  }
  
  // Contexto existe → delega para ResponseAgent formatar com contexto
  logger.logic('DEBUG', 'Dispatcher', 'Resposta social com contexto (via IA)');
  
  return {
    success: true,
    type: 'simple_response',
    mode: 'contextual',
    data: { query, memory },
  };
}

/**
 * Seleciona resposta pré-definida baseada em padrões simples.
 * LÓGICA PURA — mapeamento determinístico.
 * @private
 */
_selectPredefinedResponse(query) {
  const q = query.toLowerCase().trim();
  
  // Saudações
  if (/^(oi|olá|ola|hey|e aí|eai|oii+|ola+)$/i.test(q)) {
    return "Olá! Sou seu assistente financeiro pessoal. Como posso ajudar você hoje?";
  }
  if (/bom\s*dia/i.test(q)) {
    return "Bom dia! Pronto para cuidar das suas finanças? Como posso ajudar?";
  }
  if (/boa\s*tarde/i.test(q)) {
    return "Boa tarde! O que você gostaria de saber sobre suas finanças?";
  }
  if (/boa\s*noite/i.test(q)) {
    return "Boa noite! Como posso ajudar com suas finanças?";
  }
  
  // Agradecimentos
  if (/(obrigad[oa]|valeu|thanks|muito obrigad[oa])/i.test(q)) {
    return "De nada! Estou aqui sempre que precisar. 😊";
  }
  
  // Perguntas sobre o sistema
  if (/(como (você|vc) funciona|o que (você|vc) faz|para que serve|pode me ajudar)/i.test(q)) {
    return "Sou seu assistente financeiro pessoal! Posso ajudar você a:\n• Consultar gastos e receitas\n• Registrar transações\n• Analisar padrões financeiros\n• Buscar informações sobre investimentos\n• Planejar metas e orçamentos\n\nO que você gostaria de fazer?";
  }
  
  // Despedidas
  if (/^(tchau|até logo|até|falou|bye|adeus)$/i.test(q)) {
    return "Até logo! Cuide bem das suas finanças! 💰";
  }
  
  // Fallback genérico
  return "Olá! Como posso ajudar você com suas finanças hoje?";
}
```

#### Etapa 3: Ajustar fluxo no message.js
```javascript
// Em src/api/routes/message.js

// No bloco de geração de resposta final:

if (decision.decision === 'simple_response') {
  // --- Resposta social/trivial ---
  if (routeResult.mode === 'predefined') {
    // Resposta pré-definida (lógica pura)
    finalResponse = routeResult.data.response;
  } else {
    // Resposta contextual (via IA)
    if (responseAgent) {
      const formatted = await responseAgent.formatSimpleResponse(
        query,
        memory
      );
      finalResponse = formatted.response;
    } else {
      // Fallback sem ResponseAgent
      finalResponse = routeResult.data.response || "Olá! Como posso ajudar?";
    }
  }
}
else if (decision.decision === 'escalate' && routeResult.success && routeResult.data?.doc) {
  // [... código existente para escalate ...]
}
// [... restante do código ...]
```

#### Etapa 4: (Opcional) Adicionar método no ResponseAgent
```javascript
// Em src/agents/response/index.js

/**
 * Formata resposta social/trivial com contexto da memória recente.
 * Usa modelo MINI (mais leve) para interações sociais.
 * 
 * @param {string} query - Query do usuário
 * @param {Object} memory - Memória do chat
 * @returns {Promise<Object>} Resposta formatada
 */
async function formatSimpleResponse(query, memory) {
  // Usa MINI em vez de FULL para economizar
  const mini = ModelFactory.getMini('low', 'medium');
  
  const memoryContext = formatMemoryForResponse(memory);
  
  const systemPrompt = `Você é um assistente financeiro amigável respondendo a uma interação social simples.

CONTEXTO: O usuário está fazendo uma saudação, agradecimento ou pergunta casual.

SUA TAREFA: Responder de forma amigável, concisa e contextual.

REGRAS:
- Seja cordial e acolhedor
- Mantenha resposta curta (máximo 2-3 linhas)
- Se há contexto financeiro recente na memória, faça referência rápida
- Ofereça ajuda de forma natural
- Não liste funcionalidades salvo se perguntado
- Tom: friendly, warm, helpful

Retorne JSON:
{
  "response": "Sua resposta aqui",
  "format": "quick",
  "tone": "friendly"
}`;

  const userPrompt = [
    `MEMÓRIA RECENTE:`,
    memoryContext,
    ``,
    `QUERY DO USUÁRIO: "${query}"`,
    ``,
    `Responda de forma amigável e contextual.`,
  ].join('\n');

  try {
    const result = await mini.completeJSON(systemPrompt, userPrompt, {
      maxTokens: 200,
      temperature: 0.7, // Mais criativo para interações sociais
    });

    logger.ai('DEBUG', 'ResponseAgent', `Resposta social formatada`, {
      responseLength: result.response?.length || 0,
    });

    return {
      response: result.response || "Olá! Como posso ajudar?",
      format: result.format || 'quick',
      tone: result.tone || 'friendly',
    };
  } catch (error) {
    logger.error('ResponseAgent', 'ai', `Falha ao formatar resposta social: ${error.message}`);
    
    // Fallback: resposta genérica
    return {
      response: "Olá! Como posso ajudar você com suas finanças hoje?",
      format: 'quick',
      tone: 'friendly',
    };
  }
}

// Adicionar ao module.exports
module.exports = {
  synthesize,
  formatDirectResponse,
  formatSimpleResponse, // NOVO
};
```

#### Etapa 5: Atualizar validadores
```javascript
// Em src/agents/junior/validators.js

function validateDecisionStructure(decision) {
  const validRoutes = [
    'bridge_query',
    'bridge_insert',
    'serper',
    'simple_response', // NOVO
    'escalate',
  ];
  
  // [... resto da validação existente ...]
}
```

---

## 7. Métricas de Sucesso

Após implementação, monitorar:

### Antes (baseline atual):
- **Saudações → escalate:** 100% dos casos
- **Tokens gastos por saudação:** ~3.000-5.000 tokens (Orquestrador + Coordenadores + Resposta)
- **Latência média (saudação):** 3-5 segundos

### Depois (meta):
- **Saudações → simple_response:** 100% dos casos
- **Tokens gastos (sem contexto):** 0 tokens (resposta pré-definida)
- **Tokens gastos (com contexto):** ~200-400 tokens (Mini)
- **Latência média (sem contexto):** <50ms
- **Latência média (com contexto):** 500-800ms
- **Redução de custo:** 90-100% para interações sociais

---

## 8. Próximos Passos

1. **Decisão:** Avaliar e aprovar a Opção C (Híbrida)
2. **Implementação:** Seguir as 5 etapas acima
3. **Testes manuais:** Executar bateria de 10 queries de teste (saudações variadas)
4. **Logging:** Adicionar métricas específicas para `simple_response` no logger
5. **Documentação:** Atualizar `RELATORIO_FASE4.md` com patch 4.1
6. **Deploy:** Integrar mudanças ao servidor

---

## 9. Alternativas Consideradas e Descartadas

### Alternativa 1: Manter comportamento atual (escalate para saudações)
**Descartado:** Desperdício de recursos, latência ruim, custo desnecessário

### Alternativa 2: Modificar Orquestrador para detectar queries triviais
**Descartado:** Ainda requer 1 chamada ao Full model; problema deve ser resolvido no Junior

### Alternativa 3: Usar regex no Junior (sem IA) para classificar saudações
**Descartado:** Junior já é IA; regex seria inconsistente com arquitetura; Opção C já usa lógica pura no Dispatcher

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Classificação incorreta de queries financeiras como `simple_response` | Baixo | Médio | Regras de priorização claras no prompt; testes extensivos |
| Respostas pré-definidas soarem "robóticas" | Médio | Baixo | Usar modo contextual (IA) quando memória existe; refinar respostas com feedback |
| Compatibilidade com clientes existentes | Muito Baixo | Baixo | API response mantém estrutura idêntica |
| Overhead de decisão (pré-definido vs contextual) | Muito Baixo | Muito Baixo | Verificação de memória.recent é operação O(1) |

---

## Conclusão

A adição da rota `simple_response` é **necessária**, **viável** e **alinhada com os princípios da constituição do sistema**. A implementação híbrida (Opção C) oferece o melhor equilíbrio entre custo, latência e qualidade de resposta.

**Recomendação final:** APROVAR implementação da Opção C (Híbrida) como Fase 4.1 (Patch).

---

**Autor:** GitHub Copilot  
**Revisão necessária:** Equipe técnica + decisão de arquitetura  
**Estimativa de implementação:** 2-3 horas de desenvolvimento + 1 hora de testes
