# Correcao - math:projectionWithContributions com PMT undefined

## Contexto
No Teste 39, o Agente de Planejamento acionou a ferramenta math:projectionWithContributions com `monthlyPayment` ausente, gerando erro do Decimal.js.

## Causa raiz
Os parametros da tool_request para math nao estavam padronizados. O MathModule espera `monthlyPayment`, `monthlyRate` e `months`, mas a chamada chegou com nomes diferentes ou ausentes.

## O que foi ajustado
- Normalizacao de parametros do MathModule no BaseCoordinator.
- Validacao de campos obrigatorios antes de chamar o MathModule, evitando `undefined`.
- Prompt dos coordenadores atualizado com nomes exatos de parametros para cada funcao matematica.

## Arquivos alterados
- server/src/agents/coordinators/base.js
- server/src/agents/coordinators/prompt-template.js
- server/docs/md/TROUBLESHOOTING.md

## Como validar
1. Rodar o Teste 39 e confirmar que `MathModule` loga `PMT` com valor definido.
2. Rodar o Teste 46 para projeção de aportes e validar os resultados.
3. Confirmar que nao ha erro de `DecimalError` nos logs.
