# ADR-003: Sistema de Estado para Chamadas Externas

**Data:** 05/02/2026  
**Status:** Aceita

## Contexto

Conforme a constituição do sistema, agentes devem poder interagir com sistemas externos (Finance Bridge, APIs de busca, MongoDB) sem perder contexto. O agente inicia uma chamada, aguarda retorno, e retoma execução com memória e estado preservados.

## Decisão

Implementar um sistema de estado em memória (`core/state/`) com 3 componentes:
1. **AgentState** — Objeto que representa o estado do agente (idle, executing, waiting_external, completed, error)
2. **ExternalCallManager** — Gerencia o ciclo salvar-estado → executar → restaurar-estado
3. **ContextRecovery** — Reconstrói contexto completo para continuação

O estado é mantido em memória (Map) durante a execução de um ciclo e descartado ao final.

## Consequências

**Positivas:**
- Agentes mantêm contexto durante chamadas externas assíncronas
- Erros em chamadas externas são registrados no estado para diagnóstico
- Múltiplas chamadas externas sequenciais preservam resultados anteriores
- Cleanup automático ao final do ciclo

**Negativas:**
- Estado em memória não persiste entre reinícios do servidor (aceitável para HTTP request-response)
- Overhead de serialização/deserialização de estado

## Alternativas Consideradas

- **Sem estado explícito:** Confiar no escopo da função async → rejeitado porque não permite diagnóstico de chamadas pendentes e perde visibilidade
- **Estado no MongoDB:** Persistir cada estado → rejeitado por overhead de I/O em operações que duram segundos
- **Redis:** → rejeitado por adicionar dependência de infraestrutura desnecessária no estágio atual
