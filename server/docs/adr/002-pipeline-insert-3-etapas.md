# ADR-002: Pipeline de 3 Etapas no Finance Bridge Insert

**Data:** 05/02/2026  
**Status:** Aceita

## Contexto

O lançamento de transações financeiras requer: identificar tipo (despesa/receita), selecionar categoria correta, e extrair todos os dados (valor, data, descrição). Fazer tudo em uma única chamada de IA seria caro e propenso a erros.

## Decisão

Dividir o pipeline de insert em 3 chamadas de IA distintas:
1. **Classificação binária** (Nano) — expense ou income
2. **Seleção de categoria** (Mini) — análise contextual
3. **Montagem final** (Nano) — extração de dados e formatação JSON

Entre cada passo, lógica pura carrega o JSON correto e filtra dados relevantes.

## Consequências

**Positivas:**
- Cada passo de IA recebe apenas a informação necessária (otimização de tokens)
- Nano para tarefas simples reduz custo significativamente
- Erros são isoláveis (falhou na categoria? falhou na extração?)
- Classificação binária com Nano é quase gratuita

**Negativas:**
- 3 chamadas de IA em série aumentam latência total
- Mais pontos de falha (cada passo pode falhar)

## Alternativas Consideradas

- **Chamada única (Full):** Enviar tudo em uma chamada → rejeitado por custo e desperdício de tokens
- **2 etapas (classificação + resto):** → rejeitado porque a seleção de categoria precisa de raciocínio contextual (Mini), mas a montagem é simples (Nano)
