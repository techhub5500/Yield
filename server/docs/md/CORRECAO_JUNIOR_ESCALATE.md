# Correcao - Junior e follow-up em escalate

## Contexto
Durante o Teste 39, a query foi classificada como "escalate", mas o Junior ainda gerou follow-up e o fluxo nao chegou ao Dispatcher.

## Causa raiz
O Junior aplicava a logica de follow-up para qualquer rota quando `needs_followup` vinha como true, inclusive para `escalate`.

## O que foi ajustado
- Follow-up passou a ser aplicado somente quando `decision` for `bridge_insert`.
- Para outras rotas, `needs_followup`, `missing_info` e `followup_question` sao limpos e ignorados.
- A validacao de decisao deixou de exigir `followup_question` quando `needs_followup` estiver ausente, permitindo que o Junior gere a pergunta quando necessario.

## Arquivos alterados
- server/src/agents/junior/index.js
- server/src/agents/junior/validators.js
- server/docs/md/RELATORIO_FASE4.md
- server/docs/md/TROUBLESHOOTING.md

## Como validar
1. Rodar o Teste 39 do plano de testes.
2. Confirmar nos logs:
   - Junior classifica como "escalate".
   - Nao ha log de "JuniorFollowup".
   - Dispatcher e Orchestrator sao acionados.
