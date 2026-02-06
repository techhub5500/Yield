# ADR-001: Separação Fundamental entre IA e Lógica

**Data:** 05/02/2026  
**Status:** Aceita

## Contexto

O sistema é composto por múltiplos agentes de IA que interagem entre si e com ferramentas externas. Sem uma regra clara de separação, o código tenderia a misturar decisões contextuais (IA) com execução determinística (lógica), dificultando testes, manutenção e debugging.

## Decisão

Separar rigorosamente o código em duas categorias:
- **`core/`** — Lógica pura. NUNCA importa modelos de IA.
- **`agents/`** — Cada arquivo encapsula exatamente UM ponto de decisão de IA.

A integração entre IA e lógica acontece em pontos de integração bem definidos (managers, routes).

## Consequências

**Positivas:**
- Lógica pura é 100% testável sem mocks de IA
- Cada ponto de IA é isolado e substituível
- Debugging mais simples: problemas de IA ficam em `agents/`, problemas de lógica ficam em `core/`
- Custos de IA são rastreáveis (cada chamada está isolada)

**Negativas:**
- Mais arquivos e indireção no código
- Managers funcionam como "cola" entre as camadas

## Alternativas Consideradas

- **Código misto:** IA e lógica no mesmo arquivo → rejeitado por dificultar testes e debugging
- **IA como middleware:** Toda chamada passa por decorator de IA → rejeitado por acoplamento excessivo
